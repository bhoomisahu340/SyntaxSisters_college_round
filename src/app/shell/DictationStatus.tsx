import { useEffect, useRef, useState } from 'react'
import { bus } from '../../core/bus.ts'
import { attachDictation, isDictationActive } from '../../core/voice/dictation.ts'

const FIELD_BLOCK_REASONS = new Set([
  'text-field-not-available',
  'focus-failed',
  'focused-target-is-not-text',
  'unsupported-input-type',
  'locked-target-is-not-a-text-input',
])

export function DictationStatus() {
  const [targetName, setTargetName] = useState('')
  const [preview, setPreview] = useState('')
  const [hint, setHint] = useState('')
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const detachDictation = attachDictation()
    const showHint = (message: string) => {
      setHint(message)
      if (hintTimer.current !== null) clearTimeout(hintTimer.current)
      hintTimer.current = setTimeout(() => {
        hintTimer.current = null
        setHint('')
      }, 7000)
    }
    const offState = bus.on('DICTATION_STATE_CHANGED', ({ active, targetName: nextName }) => {
      setTargetName(active ? nextName : '')
      if (!active) setPreview('')
      if (active) setHint('')
    })
    const offInterim = bus.on('VOICE_INTERIM', ({ text }) => {
      if (isDictationActive()) setPreview(text)
    })
    const offPreview = bus.on('DICTATION_PREVIEW_CHANGED', ({ text }) => setPreview(text))
    // "Start typing" with no eligible text field focused used to fail silently:
    // the dictation module emits ACTION_BLOCKED but nothing rendered it. Surface
    // a clear instruction so the user knows how to begin dictation.
    const offBlocked = bus.on('ACTION_BLOCKED', ({ reason }) => {
      if (!FIELD_BLOCK_REASONS.has(reason)) return
      showHint('No text field is selected. Focus a text box or say “type here” over one, then say “start typing”.')
    })

    return () => {
      if (hintTimer.current !== null) clearTimeout(hintTimer.current)
      offState()
      offInterim()
      offPreview()
      offBlocked()
      detachDictation()
    }
  }, [])

  if (targetName) {
    return (
      <div
        data-target-ignore
        role="status"
        className="fixed right-4 top-20 z-50 max-w-xs rounded-md border border-teal-700 bg-white px-3 py-2 text-sm text-[#17324f] shadow"
      >
        <strong className="text-teal-800">Dictation · {targetName}</strong>
        <p className="mt-1 min-h-5 text-[#718096]">{preview || 'Listening for text…'}</p>
      </div>
    )
  }

  if (hint) {
    return (
      <div
        data-target-ignore
        role="status"
        className="fixed right-4 top-20 z-50 max-w-xs rounded-md border border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-950 shadow"
      >
        <strong className="text-amber-800">Dictation needs a text field</strong>
        <p className="mt-1">{hint}</p>
      </div>
    )
  }

  return null
}