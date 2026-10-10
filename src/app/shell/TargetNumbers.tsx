import { useEffect, useRef, useState } from 'react'
import { bus } from '../../core/bus.ts'
import { startTargetScanner, type TargetSnapshot } from '../../core/dom/targets.ts'
import { isRiskyTarget } from '../../core/shield/risk.ts'
import { attachIntentShield } from '../../core/shield/machine.ts'
import { useAppStore } from '../store.ts'

const SNAP_RADIUS = 120
const DWELL_MS = 800
const HYSTERESIS = 1.5

function distanceToTarget(point: { x: number; y: number }, target: TargetSnapshot): number {
  const centerX = target.left + target.width / 2
  const centerY = target.top + target.height / 2
  return Math.hypot(point.x - centerX, point.y - centerY)
}

export function TargetNumbers() {
  const [targets, setTargets] = useState<TargetSnapshot[]>([])
  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState<TargetSnapshot | null>(null)
  const [locked, setLocked] = useState<TargetSnapshot | null>(null)
  const [dwellProgress, setDwellProgress] = useState(0)
  const [dwellDurationMs, setDwellDurationMs] = useState(DWELL_MS)
  const [alternativeIds, setAlternativeIds] = useState<string[] | null>(null)
  const targetsRef = useRef<TargetSnapshot[]>([])
  const hoveredRef = useRef<TargetSnapshot | null>(null)
  const lockedIdRef = useRef<string | null>(null)
  const dwellStartedAt = useRef(0)
  const snapRadius = useRef(SNAP_RADIUS)
  const dwellDuration = useRef(DWELL_MS)
  const dwellTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dwellInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const cancelDwell = () => {
      if (dwellTimeout.current !== null) clearTimeout(dwellTimeout.current)
      if (dwellInterval.current !== null) clearInterval(dwellInterval.current)
      dwellTimeout.current = null
      dwellInterval.current = null
      dwellStartedAt.current = 0
      setDwellProgress(0)
    }

    const lockTarget = (target: TargetSnapshot) => {
      if (useAppStore.getState().paused) return
      lockedIdRef.current = target.id
      setLocked(target)
      bus.emit('TARGET_LOCKED', { ...target, risk: isRiskyTarget(target) })
    }

    const offTargets = bus.on('TARGETS_UPDATED', ({ targets: next }) => {
      targetsRef.current = next
      setTargets(next)
    })
    const offVisibility = bus.on('TARGETS_VISIBILITY_CHANGED', ({ visible: next }) => {
      setVisible(next)
    })
    const offGovernorSettings = bus.on('GOVERNOR_SETTINGS_CHANGED', (settings) => {
      snapRadius.current = settings.snapRadius
      dwellDuration.current = settings.dwellMs
      setDwellDurationMs(settings.dwellMs)
      const currentHover = hoveredRef.current
      if (!currentHover || lockedIdRef.current === currentHover.id) return
      cancelDwell()
      dwellStartedAt.current = performance.now()
      dwellInterval.current = setInterval(() => {
        setDwellProgress(Math.min(1, (performance.now() - dwellStartedAt.current) / dwellDuration.current))
      }, 40)
      dwellTimeout.current = setTimeout(() => {
        cancelDwell()
        lockTarget(currentHover)
      }, dwellDuration.current)
    })
    const offCursor = bus.on('CURSOR_POSITION', (point) => {
      if (useAppStore.getState().paused) return
      const list = targetsRef.current
      const current = hoveredRef.current
      const currentDistance = current ? distanceToTarget(point, current) : Infinity
      const nearest = list
        .map((target) => ({ target, distance: distanceToTarget(point, target) }))
        .sort((first, second) => first.distance - second.distance)[0]
      const next = current && currentDistance <= snapRadius.current * HYSTERESIS
        ? current
        : nearest && nearest.distance <= snapRadius.current
          ? nearest.target
          : null

      if (next?.id === current?.id) return
      cancelDwell()
      hoveredRef.current = next
      setHovered(next)
      if (!next) {
        bus.emit('TARGET_CLEARED')
        return
      }

      bus.emit('TARGET_SNAPPED', next)
      if (lockedIdRef.current === next.id) return
      dwellStartedAt.current = performance.now()
      dwellInterval.current = setInterval(() => {
        setDwellProgress(Math.min(1, (performance.now() - dwellStartedAt.current) / dwellDuration.current))
      }, 40)
      dwellTimeout.current = setTimeout(() => {
        cancelDwell()
        lockTarget(next)
      }, dwellDuration.current)
    })
    const offLockCurrent = bus.on('TARGET_LOCK_CURRENT_REQUESTED', () => {
      const target = hoveredRef.current
      if (target) lockTarget(target)
      else bus.emit('ACTION_BLOCKED', { id: 'shield', reason: 'no-hovered-target' })
    })
    const offNumberSelection = bus.on('TARGET_SELECTED_BY_NUMBER', ({ id, verb }) => {
      if (useAppStore.getState().paused) {
        bus.emit('ACTION_BLOCKED', { id, reason: 'paused' })
        return
      }
      const target = targetsRef.current.find((item) => item.id === id)
      if (!target) {
        bus.emit('ACTION_BLOCKED', { id, reason: 'target-not-found' })
        return
      }
      lockTarget(target)
      bus.emit('VOICE_ACTION_REQUESTED', { verb })
    })
    const offLocked = bus.on('TARGET_LOCKED', (target) => {
      lockedIdRef.current = target.id
      setLocked(target)
      cancelDwell()
      setAlternativeIds(null)
    })
    const offCleared = bus.on('TARGET_CLEARED', () => {
      lockedIdRef.current = null
      setLocked(null)
    })
    const offAlternatives = bus.on('TARGET_ALTERNATIVES_REQUESTED', ({ targetId }) => {
      const rejected = targetsRef.current.find((target) => target.id === targetId)
      const alternatives = rejected
        ? targetsRef.current
            .filter((target) => target.id !== targetId)
            .map((target) => ({
              target,
              distance: distanceToTarget(
                { x: rejected.left + rejected.width / 2, y: rejected.top + rejected.height / 2 },
                target,
              ),
            }))
            .sort((first, second) => first.distance - second.distance)
            .slice(0, 4)
            .map(({ target }) => target)
        : targetsRef.current.slice(0, 4)
      setAlternativeIds(alternatives.map((target) => target.id))
      setVisible(true)
      bus.emit('TARGET_ALTERNATIVES_CHANGED', { targets: alternatives })
    })
    const offPause = bus.on('PAUSE_CHANGED', ({ paused }) => {
      if (!paused) return
      cancelDwell()
      hoveredRef.current = null
      setHovered(null)
      bus.emit('TARGET_CLEARED')
    })
    const offFaceLost = bus.on('FACE_LOST', () => {
      cancelDwell()
      hoveredRef.current = null
      setHovered(null)
      bus.emit('TARGET_CLEARED')
    })
    const detachShield = attachIntentShield()
    const stopScanner = startTargetScanner()

    return () => {
      cancelDwell()
      offTargets()
      offVisibility()
      offGovernorSettings()
      offCursor()
      offLockCurrent()
      offNumberSelection()
      offLocked()
      offCleared()
      offAlternatives()
      offPause()
      offFaceLost()
      stopScanner()
      detachShield()
    }
  }, [])

  const displayedTargets = alternativeIds
    ? targets.filter((target) => alternativeIds.includes(target.id))
    : targets

  return (
    <>
      {visible ? (
        <div className="pointer-events-none fixed inset-0 z-40" aria-hidden="true">
          {displayedTargets.map((target) => (
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
      ) : null}
      {hovered && dwellProgress > 0 && dwellProgress < 1 ? (
        <div
          data-target-ignore
          aria-hidden="true"
          className="pointer-events-none fixed z-[55] grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white p-1 shadow"
          style={{
            left: `${hovered.left + hovered.width / 2}px`,
            top: `${hovered.top + hovered.height / 2}px`,
            background: `conic-gradient(#087f8c ${dwellProgress * 360}deg, #d7e0e6 0deg)`,
          }}
        >
          <span className="grid size-full place-items-center rounded-full bg-white text-[10px] font-bold text-[#17324f]">
            {(Math.ceil((1 - dwellProgress) * dwellDurationMs / 100) / 10).toFixed(1)}
          </span>
        </div>
      ) : null}
      {locked ? (
        <>
          <div
            data-target-ignore
            aria-hidden="true"
            className="pointer-events-none fixed z-[54] rounded-md border-[3px] border-[#087f8c] shadow-[0_0_0_3px_rgba(8,127,140,0.2)]"
            style={{ top: locked.top - 4, left: locked.left - 4, width: locked.width + 8, height: locked.height + 8 }}
          />
          <div
            data-target-ignore
            role="status"
            className="pointer-events-none fixed z-[55] rounded bg-[#17324f] px-2 py-1 text-xs font-semibold text-white shadow"
            style={{ top: Math.max(4, locked.top - 30), left: locked.left }}
          >
            {locked.tagName === 'a' ? 'Link' : locked.tagName === 'button' ? 'Button' : locked.tagName}: {locked.name}{isRiskyTarget(locked) ? ' · confirmation required' : ''}
          </div>
        </>
      ) : null}
    </>
  )
}