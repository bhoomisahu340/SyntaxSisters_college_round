import { useEffect, useState } from 'react'
import { bus } from '../../core/bus.ts'
import { attachDictation, isDictationActive } from '../../core/voice/dictation.ts'

export function DictationStatus() {
  const [targetName, setTargetName] = useState('')
  const [preview, setPreview] = useState('')

  useEffect(() => {
    const detachDictation = attachDictation()
    const offState = bus.on('DICTATION_STATE_CHANGED', ({ active, targetName: nextName }) => {
      setTargetName(active ? nextName : '')
      if (!active) setPreview('')
    })
    const offInterim = bus.on('VOICE_INTERIM', ({ text }) => {
      if (isDictationActive()) setPreview(text)
    })
    const offPreview = bus.on('DICTATION_PREVIEW_CHANGED', ({ text }) => setPreview(text))

    return () => {
      offState()
      offInterim()
      offPreview()
      detachDictation()
    }
  }, [])

  if (!targetName) return null

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