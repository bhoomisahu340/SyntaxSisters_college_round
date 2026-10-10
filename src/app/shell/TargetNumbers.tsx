import { useEffect, useState } from 'react'
import { bus } from '../../core/bus.ts'
import { startTargetScanner, type TargetSnapshot } from '../../core/dom/targets.ts'

export function TargetNumbers() {
  const [targets, setTargets] = useState<TargetSnapshot[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const offTargets = bus.on('TARGETS_UPDATED', ({ targets: next }) => {
      setTargets(next)
    })
    const offVisibility = bus.on('TARGETS_VISIBILITY_CHANGED', ({ visible: next }) => {
      setVisible(next)
    })
    const stopScanner = startTargetScanner()

    return () => {
      offTargets()
      offVisibility()
      stopScanner()
    }
  }, [])

  if (!visible) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-40" aria-hidden="true">
      {targets.map((target) => (
        <span
          key={target.id}
          className="absolute grid size-7 place-items-center rounded-full border-2 border-white bg-teal-700 text-xs font-bold text-white shadow-lg"
          style={{
            top: `${Math.max(4, Math.min(target.top - 24, window.innerHeight - 32))}px`,
            left: `${Math.max(4, Math.min(target.left - 24, window.innerWidth - 32))}px`,
          }}
          title={`${target.number}: ${target.name}`}
        >
          {target.number}
        </span>
      ))}
    </div>
  )
}