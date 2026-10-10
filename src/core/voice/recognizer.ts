import { bus } from '../bus.ts'

type RecognitionCtor = new () => BrowserSpeechRecognition

type SpeechAlt = { transcript: string; confidence: number }

type SpeechResult = {
  isFinal: boolean
  0?: SpeechAlt
}

type BrowserSpeechResultEvent = {
  resultIndex: number
  results: { length: number; [index: number]: SpeechResult }
}

type BrowserSpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  start: () => void
  stop: () => void
  onresult: ((event: BrowserSpeechResultEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

export type VoiceEngineStatus =
  | 'idle'
  | 'listening'
  | 'paused'
  | 'blocked'
  | 'unsupported'

export type VoiceController = {
  start: () => VoiceEngineStatus
  stop: () => void
  subscribe: (cb: (status: VoiceEngineStatus) => void) => () => void
}

const MIN_BACKOFF_MS = 250
const MAX_BACKOFF_MS = 4000

function getCtor(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function createRecognizer(): VoiceController {
  const Ctor = getCtor()
  const listeners = new Set<(status: VoiceEngineStatus) => void>()
  let status: VoiceEngineStatus = Ctor ? 'idle' : 'unsupported'
  let rec: BrowserSpeechRecognition | null = null
  let wanted = false
  let paused = false
  let backoffMs = MIN_BACKOFF_MS
  let restartTimer: ReturnType<typeof setTimeout> | null = null

  const setStatus = (next: VoiceEngineStatus) => {
    status = next
    for (const cb of listeners) {
      try {
        cb(next)
      } catch {
        // HUD subscribers must not break the engine.
      }
    }
  }

  const clearRestart = () => {
    if (restartTimer !== null) {
      clearTimeout(restartTimer)
      restartTimer = null
    }
  }

  const scheduleRestart = () => {
    if (!wanted || paused || status === 'blocked' || status === 'unsupported') {
      return
    }
    clearRestart()
    const delay = backoffMs
    backoffMs = Math.min(MAX_BACKOFF_MS, backoffMs * 2)
    restartTimer = setTimeout(() => {
      restartTimer = null
      begin()
    }, delay)
  }

  const handleResult = (event: BrowserSpeechResultEvent) => {
    try {
      backoffMs = MIN_BACKOFF_MS
      let interim = ''
      let finalText = ''
      let confidence = 0
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const alt = result[0]
        if (!alt) continue
        if (result.isFinal) {
          finalText += alt.transcript
          confidence = Number.isFinite(alt.confidence) ? alt.confidence : 0
        } else {
          interim += alt.transcript
        }
      }
      if (interim) bus.emit('VOICE_INTERIM', { text: interim })
      if (finalText.trim()) {
        bus.emit('VOICE_FINAL', { text: finalText, confidence })
      }
    } catch {
      // Never escape the speech handler.
    }
  }

  const attachHandlers = (instance: BrowserSpeechRecognition) => {
    instance.onresult = (event) => {
      handleResult(event)
    }
    instance.onerror = (event) => {
      try {
        if (event.error === 'not-allowed') {
          wanted = false
          clearRestart()
          setStatus('blocked')
          return
        }
      } catch {
        // ignore
      }
    }
    instance.onend = () => {
      try {
        rec = null
        if (!wanted || status === 'blocked') return
        if (paused) return
        scheduleRestart()
      } catch {
        // ignore
      }
    }
  }

  const begin = () => {
    if (!Ctor || !wanted || paused || status === 'blocked') return
    try {
      const instance = new Ctor()
      instance.continuous = true
      instance.interimResults = true
      instance.lang = 'en-US'
      instance.maxAlternatives = 1
      attachHandlers(instance)
      rec = instance
      instance.start()
      setStatus('listening')
    } catch {
      scheduleRestart()
    }
  }

  const unpause = bus.on('PAUSE_CHANGED', ({ paused: next }) => {
    paused = next
    if (next) {
      setStatus('paused')
      return
    }
    if (wanted && status !== 'blocked' && status !== 'unsupported') {
      if (rec) {
        setStatus('listening')
        return
      }
      backoffMs = MIN_BACKOFF_MS
      begin()
    }
  })

  return {
    start() {
      if (!Ctor) {
        setStatus('unsupported')
        return 'unsupported'
      }
      if (status === 'blocked') return 'blocked'
      wanted = true
      backoffMs = MIN_BACKOFF_MS
      begin()
      return status
    },
    stop() {
      wanted = false
      clearRestart()
      try {
        rec?.stop()
      } catch {
        // ignore
      }
      rec = null
      unpause()
      if (status !== 'blocked' && status !== 'unsupported') {
        setStatus('idle')
      }
    },
    subscribe(cb) {
      listeners.add(cb)
      cb(status)
      return () => {
        listeners.delete(cb)
      }
    },
  }
}
