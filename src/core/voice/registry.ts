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
  | 'book-appointment'
  | 'show-numbers'
  | 'hide-numbers'
  | 'click-number'
  | 'open-number'
  | 'pause'
  | 'resume'

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
  for (const [phrase, id] of PHRASES) {
    if (haystack === phrase) return id
    if (haystack.startsWith(`${phrase} `)) return id
    if (haystack.endsWith(` ${phrase}`)) return id
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
