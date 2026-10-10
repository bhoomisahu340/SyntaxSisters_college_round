import { useEffect, useRef, useState } from 'react'
import { bus } from '../../core/bus.ts'
import { WAKE_WORD } from '../../core/voice/config.ts'
import { attachVoiceCommands } from '../../core/voice/execute.ts'
import {
  createRecognizer,
  type VoiceController,
  type VoiceEngineStatus,
} from '../../core/voice/recognizer.ts'
import { useAppStore } from '../store.ts'

export function StatusHUD() {
  const paused = useAppStore((s) => s.paused)
  const recRef = useRef<VoiceController | null>(null)
  const [engine, setEngine] = useState<VoiceEngineStatus>('idle')
  const [interim, setInterim] = useState('')
  const [finalText, setFinalText] = useState('')
  const [lastVerb, setLastVerb] = useState('')

  useEffect(() => {
    const detach = attachVoiceCommands()
    const rec = createRecognizer()
    recRef.current = rec
    const offStatus = rec.subscribe(setEngine)
    const offPause = bus.on('PAUSE_CHANGED', ({ paused: next }) => {
      useAppStore.getState().setPaused(next)
    })
    const offInterim = bus.on('VOICE_INTERIM', ({ text }) => {
      setInterim(text)
    })
    const offFinal = bus.on('VOICE_FINAL', ({ text }) => {
      setFinalText(text)
      setInterim('')
    })
    const offAction = bus.on('ACTION_EXECUTED', ({ verb }) => {
      setLastVerb(verb)
    })

    return () => {
      offStatus()
      offPause()
      offInterim()
      offFinal()
      offAction()
      detach()
      rec.stop()
      recRef.current = null
    }
  }, [])

  const label =
    engine === 'unsupported'
      ? 'Voice unsupported — use Chrome'
      : engine === 'blocked'
        ? 'Microphone blocked'
        : paused
          ? 'Paused'
          : engine === 'listening'
            ? 'Listening'
            : 'Mic off'

  const transcript = interim || finalText || `Say “${WAKE_WORD} scroll down”`

  return (
    <div data-target-ignore className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800 bg-zinc-900/95 px-4 py-3 text-sm text-zinc-100">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            engine === 'listening' && !paused
              ? 'bg-emerald-500/20 text-emerald-300'
              : paused
                ? 'bg-amber-500/20 text-amber-200'
                : 'bg-zinc-700 text-zinc-300'
          }`}
        >
          {label}
        </span>
        <p
          className={`min-w-[12rem] flex-1 truncate ${interim ? 'italic text-zinc-400' : 'text-zinc-200'}`}
        >
          {transcript}
        </p>
        {lastVerb ? (
          <span className="text-xs text-zinc-500">cmd: {lastVerb}</span>
        ) : null}
        {engine !== 'listening' || paused ? (
          <button
            type="button"
            className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-900 disabled:opacity-40"
            onClick={() => {
              if (paused) bus.emit('PAUSE_CHANGED', { paused: false })
              recRef.current?.start()
            }}
            disabled={engine === 'unsupported' || engine === 'blocked'}
          >
            {paused ? 'Resume' : 'Start listening'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
