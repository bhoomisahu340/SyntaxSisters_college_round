import { WAKE_WORD } from './config.ts'

export type VoiceCommandId =
  | 'scroll-up'
  | 'scroll-down'
  | 'go-back'
  | 'go-forward'
  | 'new-tab'
  | 'next-tab'
  | 'close-tab'
  | 'go-to-shop'
  | 'go-to-appointments'
  | 'go-home'
  | 'explore-shop'
  | 'recenter'
  | 'book-appointment'
  | 'show-numbers'
  | 'hide-numbers'
  | 'click-number'
  | 'open-number'
  | 'view-details'
  | 'ui-cancel'
  | 'show-doctors'
  | 'choose-date'
  | 'show-slots'
  | 'show-all-products'
  | 'show-accessibility-products'
  | 'show-technology-products'
  | 'show-daily-living-products'
  | 'show-wellness-products'
  | 'click'
  | 'open'
  | 'this'
  | 'type-here'
  | 'enter-name'
  | 'confirm'
  | 'not-that-one'
  | 'start-typing'
  | 'stop-typing'
  | 'pause'
  | 'resume'

export type DynamicVoiceCommand =
  | { id: 'search'; query: string }
  | { id: 'open-product'; query: string }
  | { id: 'select-doctor' | 'select-slot' | 'select-target'; number: number }

const FILLERS = /\b(please|um|uh|er|like|just)\b/g

/** Longer phrases first so "stop listening" wins over a shorter overlap. */
const PHRASES: ReadonlyArray<readonly [string, VoiceCommandId]> = [
  ['stop listening', 'pause'],
  ['start listening', 'resume'],
  ['scroll down', 'scroll-down'],
  ['scroll up', 'scroll-up'],
  ['show numbers', 'show-numbers'],
  ['hide numbers', 'hide-numbers'],
  ['go to appointments', 'go-to-appointments'],
  ['open appointments', 'go-to-appointments'],
  ['go to booking', 'go-to-appointments'],
  ['open booking', 'go-to-appointments'],
  ['go to shop', 'go-to-shop'],
  ['open shop', 'go-to-shop'],
  ['explore shop', 'explore-shop'],
  ['go home', 'go-home'],
  ['go to home', 'go-home'],
  ['show accessibility products', 'show-accessibility-products'],
  ['show technology products', 'show-technology-products'],
  ['show daily living products', 'show-daily-living-products'],
  ['show wellness products', 'show-wellness-products'],
  ['show all products', 'show-all-products'],
  ['show available slots', 'show-slots'],
  ['show doctors', 'show-doctors'],
  ['choose date', 'choose-date'],
  ['not that one', 'not-that-one'],
  ['view details', 'view-details'],
  ['type here', 'type-here'],
  ['enter name', 'enter-name'],
  ['enter my name', 'enter-name'],
  ['type my name', 'enter-name'],
  ['type in my name', 'enter-name'],
  ['start typing', 'start-typing'],
  ['stop typing', 'stop-typing'],
  ['confirm', 'confirm'],
  ['cancel', 'ui-cancel'],
  ['close', 'ui-cancel'],
  ['click', 'click'],
  ['open', 'open'],
  ['this', 'this'],
  ['recenter', 'recenter'],
  ['book an appointment', 'book-appointment'],
  ['book appointment', 'book-appointment'],
  ['page down', 'scroll-down'],
  ['page up', 'scroll-up'],
  ['go forward', 'go-forward'],
  ['go back', 'go-back'],
  ['close tab', 'close-tab'],
  ['next tab', 'next-tab'],
  ['new tab', 'new-tab'],
  ['open tab', 'new-tab'],
  ['switch tab', 'next-tab'],
  ['forward', 'go-forward'],
  ['resume', 'resume'],
  ['pause', 'pause'],
  ['back', 'go-back'],
]

const PAUSE_OR_RESUME = new Set<VoiceCommandId>(['pause', 'resume'])

/**
 * Words that never change a command's meaning. Stripping them lets natural
 * speech such as "go to the shop" or "go home now" still match, while keeping
 * matching token-based (word boundaries) so unrelated words cannot collide.
 */
const SOFT_WORDS = new Set(['the', 'a', 'an', 'now', 'hey'])

/** Real Shop categories. Kept in sync with ShopPage; no invented categories. */
const CATEGORY_SLUGS: ReadonlyArray<{ slug: string; id: VoiceCommandId }> = [
  { slug: 'all', id: 'show-all-products' },
  { slug: 'accessibility', id: 'show-accessibility-products' },
  { slug: 'technology', id: 'show-technology-products' },
  { slug: 'daily living', id: 'show-daily-living-products' },
  { slug: 'wellness', id: 'show-wellness-products' },
]

const categoryPhrases: ReadonlyArray<readonly [string, VoiceCommandId]> =
  CATEGORY_SLUGS.flatMap(({ slug, id }) => [
    [`go to ${slug}`, id],
    [`show ${slug}`, id],
    [`open ${slug}`, id],
  ])

/** Longer/static phrases first, then generated category phrases. */
const ALL_PHRASES: ReadonlyArray<readonly [string, VoiceCommandId]> = [
  ...PHRASES,
  ...categoryPhrases,
]

function matchTokens(text: string): string[] {
  return normalizeUtterance(text)
    .split(' ')
    .filter((token) => token.length > 0 && !SOFT_WORDS.has(token))
}

/** True when `phrase` appears as consecutive whole tokens inside `tokens`. */
function isContiguousSubsequence(phrase: readonly string[], tokens: readonly string[]): boolean {
  if (phrase.length === 0 || phrase.length > tokens.length) return false
  for (let start = 0; start <= tokens.length - phrase.length; start += 1) {
    let matched = true
    for (let offset = 0; offset < phrase.length; offset += 1) {
      if (tokens[start + offset] !== phrase[offset]) {
        matched = false
        break
      }
    }
    if (matched) return true
  }
  return false
}

const TOKENIZED_PHRASES: ReadonlyArray<{ tokens: string[]; id: VoiceCommandId }> =
  ALL_PHRASES.map(([phrase, id]) => ({ tokens: matchTokens(phrase), id }))

export function normalizeUtterance(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(FILLERS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripWake(normalized: string): { hasWake: boolean; rest: string } {
  const wake = normalizeUtterance(WAKE_WORD)
  if (!wake) return { hasWake: false, rest: normalized }
  if (normalized === wake) return { hasWake: true, rest: '' }
  if (normalized.startsWith(`${wake} `)) {
    return { hasWake: true, rest: normalized.slice(wake.length).trim() }
  }
  const idx = normalized.indexOf(` ${wake} `)
  if (idx >= 0) {
    const rest = `${normalized.slice(0, idx)} ${normalized.slice(idx + wake.length + 2)}`.trim()
    return { hasWake: true, rest }
  }
  if (normalized.endsWith(` ${wake}`)) {
    return { hasWake: true, rest: normalized.slice(0, -wake.length).trim() }
  }
  return { hasWake: false, rest: normalized }
}

export function matchDynamicCommand(raw: string): DynamicVoiceCommand | null {
  const normalized = normalizeUtterance(raw)
  const { hasWake, rest } = stripWake(normalized)
  if (!hasWake) return null

  const search = /^search for (.+)$/.exec(rest)
  if (search?.[1]) return { id: 'search', query: search[1] }

  const doctor = /^select doctor (\d{1,2})$/.exec(rest)
  if (doctor) return { id: 'select-doctor', number: Number(doctor[1]) }

  const slot = /^select slot (\d{1,2})$/.exec(rest)
  if (slot) return { id: 'select-slot', number: Number(slot[1]) }

  const selection = /^select (\d{1,2})$/.exec(rest)
  if (selection) return { id: 'select-target', number: Number(selection[1]) }

  const product = /^open (.+)$/.exec(rest)
  if (product?.[1]) return { id: 'open-product', query: product[1] }

  return null
}

export function matchNumberCommand(
  raw: string,
): { id: 'click-number' | 'open-number'; number: number } | null {
  const normalized = normalizeUtterance(raw)
  const { hasWake, rest } = stripWake(normalized)
  if (!hasWake) return null

  const match = /^(click|open)\s+(\d{1,2})$/.exec(rest)
  if (!match) return null

  const number = Number(match[2])
  if (number < 1) return null
  return { id: match[1] === 'click' ? 'click-number' : 'open-number', number }
}

function matchPhrase(haystack: string): VoiceCommandId | null {
  const tokens = matchTokens(haystack)
  if (tokens.length === 0) return null
  for (const { tokens: phraseTokens, id } of TOKENIZED_PHRASES) {
    if (phraseTokens.length === 0) continue
    if (phraseTokens.length === 1) {
      // Single-word verbs must match the whole utterance so that phrases like
      // "open <product name>" still reach the dynamic open-product handler
      // instead of being captured by the bare "open" verb.
      if (tokens.length === 1 && tokens[0] === phraseTokens[0]) return id
      continue
    }
    if (isContiguousSubsequence(phraseTokens, tokens)) return id
  }
  return null
}

/**
 * Allowlisted commands only. Pause/resume work without the wake word;
 * everything else must include it in the same utterance.
 */
export function matchCommand(raw: string): VoiceCommandId | null {
  const normalized = normalizeUtterance(raw)
  if (!normalized) return null
  const { hasWake, rest } = stripWake(normalized)
  const pauseHit = matchPhrase(normalized)
  if (pauseHit && PAUSE_OR_RESUME.has(pauseHit)) return pauseHit
  if (!hasWake) return null
  if (!rest) return null
  const fromRest = matchPhrase(rest)
  if (fromRest && PAUSE_OR_RESUME.has(fromRest)) return fromRest
  return matchPhrase(rest)
}
