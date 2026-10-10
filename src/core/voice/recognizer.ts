import { bus } from '../bus.ts'
import type { VoiceStatus } from '../events.ts'

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

type BrowserSpeechRecognitionError = {
  error: string
  message?: string
}

type BrowserSpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  start: () => void
  stop: () => void
  onstart: (() => void) | null
  onresult: ((event: BrowserSpeechResultEvent) => void) | null
  onerror: ((event: BrowserSpeechRecognitionError) => void) | null
  onend: (() => void) | null
}

export type VoiceEngineStatus = VoiceStatus

export type VoiceController = {
  start: () => VoiceEngineStatus
  stop: () => void
  dispose: () => void
  subscribe: (cb: (status: VoiceEngineStatus) => void) => () => void
}

const MIN_BACKOFF_MS = 250
const MAX_BACKOFF_MS = 4000

function getCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
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
  let instance: BrowserSpeechRecognition | null = null
  let wanted = false
  let paused = false
  let disposed = false
  let starting = false
  let backoffMs = MIN_BACKOFF_MS
  let restartTimer: ReturnType<typeof setTimeout> | null = null

  const setStatus = (next: VoiceEngineStatus, message: string) => {
    status = next
    bus.emit('VOICE_STATUS_CHANGED', { status: next, message })
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

  const stopInstance = () => {
    const current = instance
    instance = null
    starting = false
    if (!current) return
    try {
      current.stop()
    } catch {
      // A recognition session may already have ended.
    }
  }

  const scheduleRestart = () => {
    if (
      !wanted ||
      paused ||
      disposed ||
      instance ||
      restartTimer !== null ||
      status === 'blocked' ||
      status === 'unsupported'
    ) {
      return
    }
    const delay = backoffMs
    backoffMs = Math.min(MAX_BACKOFF_MS, backoffMs * 2)
    setStatus('restarting', `Recognition ended. Restarting in ${delay} ms.`)
    restartTimer = setTimeout(() => {
      restartTimer = null
      begin()
    }, delay)
  }

  const begin = () => {
    if (
      !Ctor ||
      !wanted ||
      paused ||
      disposed ||
      instance ||
      starting ||
      status === 'blocked' ||
      status === 'unsupported'
    ) return

    starting = true
    const finalizedResults = new Set<number>()
    try {
      const recognition = new Ctor()
      instance = recognition
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'
      recognition.maxAlternatives = 1
      setStatus('starting', 'Starting speech recognition…')

      recognition.onstart = () => {
        try {
          if (instance !== recognition || disposed || paused || !wanted) return
          starting = false
          setStatus('listening', 'Microphone is listening.')
        } catch {
          // Speech callbacks must not escape the browser event handler.
        }
      }

      recognition.onresult = (event) => {
        try {
          if (instance !== recognition || disposed) return
          let interim = ''
          const finals: string[] = []
          let confidence = 0
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index]
            const alternative = result[0]
            if (!alternative) continue
            if (result.isFinal) {
              if (finalizedResults.has(index)) continue
              finalizedResults.add(index)
              finals.push(alternative.transcript)
              confidence = Number.isFinite(alternative.confidence)
                ? alternative.confidence
                : 0
            } else {
              interim += alternative.transcript
            }
          }
          if (interim) bus.emit('VOICE_INTERIM', { text: interim })
          const finalText = finals.join('').trim()
          if (finalText) {
            backoffMs = MIN_BACKOFF_MS
            bus.emit('VOICE_FINAL', { text: finalText, confidence })
          }
        } catch {
          // Speech callbacks must not escape the browser event handler.
        }
      }

      recognition.onerror = (event) => {
        try {
          if (instance !== recognition || disposed) return
          const permanent =
            event.error === 'not-allowed' || event.error === 'service-not-allowed'
          const message = permanent
            ? 'Microphone access is blocked. Allow microphone access in browser settings, then reload.'
            : event.error === 'no-speech'
              ? 'No speech was detected. Keep listening and try again.'
              : event.message || `Speech recognition error: ${event.error}.`
          bus.emit('VOICE_ERROR', { error: message, permanent })
          if (permanent) {
            wanted = false
            clearRestart()
            instance = null
            starting = false
            setStatus('blocked', message)
          } else {
            setStatus('error', `${message} Waiting for recognition to restart…`)
          }
        } catch {
          // Speech callbacks must not escape the browser event handler.
        }
      }

      recognition.onend = () => {
        try {
          if (instance !== recognition || disposed) return
          instance = null
          starting = false
          if (paused) {
            setStatus('paused', 'Recognition is paused.')
            return
          }
          if (!wanted) {
            setStatus('idle', 'Microphone is off.')
            return
          }
          scheduleRestart()
        } catch {
          // Speech callbacks must not escape the browser event handler.
        }
      }

      recognition.start()
    } catch (error) {
      instance = null
      starting = false
      const message = error instanceof Error
        ? `Could not start speech recognition: ${error.message}`
        : 'Could not start speech recognition.'
      bus.emit('VOICE_ERROR', { error: message, permanent: false })
      setStatus('error', message)
      scheduleRestart()
    }
  }

  const offPause = bus.on('PAUSE_CHANGED', ({ paused: next }) => {
    paused = next
    if (next) {
      clearRestart()
      stopInstance()
      setStatus('paused', 'Recognition is paused.')
      return
    }
    if (wanted && status !== 'blocked' && status !== 'unsupported' && !instance) {
      begin()
    } else if (!wanted && status === 'paused') {
      setStatus('idle', 'Microphone is off.')
    }
  })

  return {
    start() {
      if (!Ctor) {
        setStatus('unsupported', 'Speech recognition is unavailable. Use Chrome or a compatible Chromium browser.')
        return 'unsupported'
      }
      if (disposed) return status
      if (status === 'blocked') return 'blocked'
      wanted = true
      if (paused) {
        setStatus('paused', 'Recognition is paused.')
        return 'paused'
      }
      if (instance || starting || restartTimer !== null) return status
      begin()
      return status
    },
    stop() {
      wanted = false
      clearRestart()
      stopInstance()
      if (status !== 'blocked' && status !== 'unsupported' && status !== 'error') {
        setStatus('idle', 'Microphone is off.')
      }
    },
    dispose() {
      if (disposed) return
      wanted = false
      clearRestart()
      stopInstance()
      offPause()
      disposed = true
      listeners.clear()
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
