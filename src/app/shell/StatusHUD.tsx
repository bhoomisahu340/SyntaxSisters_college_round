import { useEffect, useRef, useState } from 'react'
import { bus } from '../../core/bus.ts'
import { WAKE_WORD } from '../../core/voice/config.ts'
import { attachVoiceCommands } from '../../core/voice/execute.ts'
import type { Lane } from '../../core/events.ts'
import {
  createRecognizer,
  type VoiceController,
  type VoiceEngineStatus,
} from '../../core/voice/recognizer.ts'
import { useAppStore } from '../store.ts'

/** True when the normalized transcript contains the configured wake word. */
function containsWakeWord(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
  return normalized.split(/\s+/).includes(WAKE_WORD)
}

export function StatusHUD() {
  const paused = useAppStore((state) => state.paused)
  const recRef = useRef<VoiceController | null>(null)
  const [engine, setEngine] = useState<VoiceEngineStatus>('idle')
  const [interim, setInterim] = useState('')
  const [finalText, setFinalText] = useState('')
  const [lastVerb, setLastVerb] = useState('')
  const [engineMessage, setEngineMessage] = useState('')
  const [lastError, setLastError] = useState('')
  const [lastMatch, setLastMatch] = useState<boolean | null>(null)
  const [shieldMessage, setShieldMessage] = useState('')
  const [lane, setLane] = useState<Lane>('POINTER')
  const [governorWarning, setGovernorWarning] = useState('')
  const [speechErrors, setSpeechErrors] = useState(0)
  const [wakeHint, setWakeHint] = useState('')
  const wakeHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const detach = attachVoiceCommands()
    const rec = createRecognizer()
    recRef.current = rec
    const offStatus = rec.subscribe(setEngine)
    const offPause = bus.on('PAUSE_CHANGED', ({ paused: next }) => {
      useAppStore.getState().setPaused(next)
    })
    const offInterim = bus.on('VOICE_INTERIM', ({ text }) => setInterim(text))
    const offFinal = bus.on('VOICE_FINAL', ({ text }) => {
      setFinalText(text)
      setInterim('')
    })
    const offAction = bus.on('ACTION_EXECUTED', ({ verb }) => setLastVerb(verb))
    const offStatusMessage = bus.on('VOICE_STATUS_CHANGED', ({ status, message }) => {
      setEngine(status)
      setEngineMessage(message)
      if (status === 'listening' || status === 'idle') setLastError('')
    })
    const offError = bus.on('VOICE_ERROR', ({ error }) => setLastError(error))
    const offMatch = bus.on('VOICE_COMMAND_MATCHED', ({ text, matched }) => {
      setLastMatch(matched)
      // Coach the user only when a non-empty utterance failed to match AND did
      // not contain the wake word. Successful matches and empty transcripts show
      // nothing; the hint auto-dismisses and never executes anything.
      if (!matched && text.trim() && !containsWakeWord(text)) {
        if (wakeHintTimer.current !== null) clearTimeout(wakeHintTimer.current)
        setWakeHint(`Tip: start your command with “${WAKE_WORD}”, e.g. “${WAKE_WORD}, scroll down”.`)
        wakeHintTimer.current = setTimeout(() => {
          wakeHintTimer.current = null
          setWakeHint('')
        }, 6000)
      } else {
        if (wakeHintTimer.current !== null) clearTimeout(wakeHintTimer.current)
        wakeHintTimer.current = null
        setWakeHint('')
      }
    })
    const offShield = bus.on('SHIELD_STATE_CHANGED', ({ message }) => setShieldMessage(message))
    const offLane = bus.on('LANE_CHANGED', ({ lane: next }) => setLane(next))
    const offWarning = bus.on('GOVERNOR_WARNING_CHANGED', ({ warning }) => setGovernorWarning(warning ?? ''))
    const offGovernorHealth = bus.on('GOVERNOR_HEALTH_CHANGED', (health) => setSpeechErrors(health.speechErrors))
    const offStart = bus.on('VOICE_START_REQUESTED', () => rec.start())
    const offStop = bus.on('VOICE_STOP_REQUESTED', () => rec.stop())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') bus.emit('PAUSE_CHANGED', { paused: true })
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      offStatus()
      offPause()
      offInterim()
      offFinal()
      offAction()
      offStatusMessage()
      offError()
      offMatch()
      offShield()
      offLane()
      offWarning()
      offGovernorHealth()
      offStart()
      offStop()
      window.removeEventListener('keydown', onKeyDown)
      if (wakeHintTimer.current !== null) clearTimeout(wakeHintTimer.current)
      detach()
      rec.stop()
      rec.dispose()
      recRef.current = null
    }
  }, [])

  const label = engine === 'unsupported'
    ? 'Voice unsupported — use Chrome'
    : engine === 'blocked'
      ? 'Microphone blocked'
      : paused
        ? 'Paused'
        : engine === 'listening'
          ? 'Listening'
          : engine === 'starting'
            ? 'Starting voice…'
            : engine === 'restarting'
              ? 'Restarting voice…'
              : engine === 'error'
                ? 'Voice error — retrying'
                : 'Mic off'

  const transcript = interim || `Say “${WAKE_WORD} scroll down”`

  return (
    <div data-target-ignore data-target-occluder className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800 bg-zinc-900/95 px-4 py-2 text-sm text-zinc-100">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${engine === 'listening' && !paused ? 'bg-emerald-500/20 text-emerald-300' : paused ? 'bg-amber-500/20 text-amber-200' : 'bg-zinc-700 text-zinc-300'}`}>
          {label}
        </span>
        <div className="min-w-[12rem] flex-1 truncate" aria-live="polite">
          <p className={interim ? 'truncate italic text-zinc-400' : 'truncate text-zinc-300'}>{transcript}</p>
          <p className="text-xs text-zinc-400">Lane: {lane} · Speech errors: {speechErrors}</p>
          {finalText ? <p className="truncate text-xs text-zinc-100">Heard: {finalText}</p> : null}
          {governorWarning ? <p className="truncate text-xs text-amber-300">{governorWarning}</p> : null}
          {lastError ? <p className="truncate text-xs text-amber-300">{lastError}</p> : null}
          {lastMatch !== null ? <p className="text-xs text-zinc-400">{lastMatch ? 'Command matched' : 'No command matched'}</p> : null}
          {wakeHint ? <p className="truncate text-xs text-sky-300">{wakeHint}</p> : null}
          {shieldMessage ? <p className="truncate text-xs text-teal-200">{shieldMessage}</p> : null}
          {engineMessage ? <span className="sr-only">{engineMessage}</span> : null}
        </div>
        {lastVerb ? <span className="text-xs text-zinc-500">cmd: {lastVerb}</span> : null}
        {engine !== 'listening' || paused ? (
          <button
            type="button"
            className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-900 disabled:opacity-40"
            onClick={() => {
              if (paused) bus.emit('PAUSE_CHANGED', { paused: false })
              recRef.current?.start()
            }}
            disabled={engine === 'unsupported' || engine === 'blocked' || engine === 'starting' || engine === 'restarting'}
          >
            {paused ? 'Resume voice' : 'Start listening'}
          </button>
        ) : null}
        <button
          type="button"
          className="min-h-11 rounded-md bg-amber-300 px-5 py-2 text-sm font-bold text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          onClick={() => bus.emit('PAUSE_CHANGED', { paused: !paused })}
          aria-pressed={paused}
        >
          {paused ? 'Resume hands-free' : 'Pause hands-free'}
        </button>
      </div>
    </div>
  )
}
