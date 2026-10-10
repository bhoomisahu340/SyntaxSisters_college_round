import { useEffect, useRef, useState } from 'react'
import { bus } from '../../core/bus.ts'
import { useAppStore } from '../store.ts'
import {
  DEFAULT_CALIBRATION_PROFILE,
  loadCalibration,
  mapFaceToCursor,
  recenterCalibration,
  saveCalibration,
  type CalibrationProfile,
} from '../../core/vision/calibration.ts'
import { OneEuroFilter } from '../../core/vision/OneEuroFilter.ts'

type CursorPoint = { x: number; y: number }

export function CursorOverlay() {
  const paused = useAppStore((state) => state.paused)
  const [position, setPosition] = useState<CursorPoint | null>(null)
  const [faceLostWarning, setFaceLostWarning] = useState(false)
  const profileRef = useRef<CalibrationProfile | null>(null)
  const calibratedRef = useRef(false)
  const recenterPending = useRef(false)
  const faceLostTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const xFilter = useRef(new OneEuroFilter())
  const yFilter = useRef(new OneEuroFilter())

  useEffect(() => {
    const storedProfile = loadCalibration()
    profileRef.current = storedProfile ?? DEFAULT_CALIBRATION_PROFILE
    calibratedRef.current = storedProfile !== null

    const offCalibration = bus.on('CALIBRATION_CHANGED', ({ profile }) => {
      profileRef.current = profile ?? DEFAULT_CALIBRATION_PROFILE
      calibratedRef.current = profile !== null
      xFilter.current.reset()
      yFilter.current.reset()
      setPosition(null)
    })
    const offRecenter = bus.on('CALIBRATION_RECENTER_REQUESTED', () => {
      if (!calibratedRef.current || !profileRef.current) {
        bus.emit('ACTION_BLOCKED', { id: 'cursor', reason: 'not-calibrated' })
        return
      }
      recenterPending.current = true
    })
    const offFace = bus.on('FACE_POSITION', (sample) => {
      if (
        !Number.isFinite(sample.x) ||
        !Number.isFinite(sample.y) ||
        !Number.isFinite(sample.faceWidth) ||
        sample.confidence < 0.3 ||
        sample.faceWidth <= 0
      ) return
      if (faceLostTimer.current !== null) {
        clearTimeout(faceLostTimer.current)
        faceLostTimer.current = null
      }
      setFaceLostWarning(false)
      if (useAppStore.getState().paused) return
      const profile = profileRef.current
      if (!profile) return

      if (recenterPending.current) {
        recenterPending.current = false
        const recentered = recenterCalibration(profile, sample)
        if (saveCalibration(recentered)) {
          bus.emit('ACTION_EXECUTED', { id: 'cursor', verb: 'recenter' })
        } else {
          bus.emit('ACTION_BLOCKED', { id: 'cursor', reason: 'calibration-save-failed' })
        }
      }

      const point = mapFaceToCursor(sample, profileRef.current ?? profile, {
        width: window.innerWidth,
        height: window.innerHeight,
      })
      const now = performance.now()
      bus.emit('CURSOR_POSITION', {
        x: xFilter.current.filter(point.x, now),
        y: yFilter.current.filter(point.y, now),
      })
    })
    const offCursor = bus.on('CURSOR_POSITION', (next) => {
      if (!useAppStore.getState().paused) setPosition(next)
    })
    const offLost = bus.on('FACE_LOST', () => {
      if (faceLostTimer.current !== null) clearTimeout(faceLostTimer.current)
      faceLostTimer.current = setTimeout(() => {
        faceLostTimer.current = null
        setFaceLostWarning(true)
      }, 500)
    })
    const offPause = bus.on('PAUSE_CHANGED', ({ paused: next }) => {
      if (next) {
        if (faceLostTimer.current !== null) clearTimeout(faceLostTimer.current)
        faceLostTimer.current = null
        setFaceLostWarning(false)
      }
    })
    const onResize = () => setPosition(null)
    window.addEventListener('resize', onResize)

    return () => {
      offCalibration()
      offRecenter()
      offFace()
      offCursor()
      offLost()
      offPause()
      window.removeEventListener('resize', onResize)
      if (faceLostTimer.current !== null) clearTimeout(faceLostTimer.current)
    }
  }, [])

  if (!position && !faceLostWarning && !paused) return null

  return (
    <>
      {position ? (
        <div
          data-target-ignore
          aria-hidden="true"
          className="pointer-events-none fixed z-[60] size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-[#087f8c]/90 shadow-[0_0_0_3px_rgba(8,127,140,0.45)]"
          style={{ left: `${position.x}px`, top: `${position.y}px` }}
        />
      ) : null}
      {faceLostWarning ? (
        <div
          data-target-ignore
          role="status"
          className="pointer-events-none fixed left-1/2 top-4 z-[70] -translate-x-1/2 rounded-md bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-950 shadow"
        >
          Face not detected. Cursor is frozen.
        </div>
      ) : null}
      {paused ? (
        <div
          data-target-ignore
          role="status"
          className="pointer-events-none fixed left-1/2 top-4 z-[70] -translate-x-1/2 rounded-md bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-950 shadow"
        >
          Cursor paused.
        </div>
      ) : null}
    </>
  )
}