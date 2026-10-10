import { useEffect, useRef, useState } from 'react'
import { bus } from '../../core/bus.ts'
import type { VisionStatus } from '../../core/events.ts'
import { WAKE_WORD } from '../../core/voice/config.ts'
import {
  buildCalibrationProfile,
  loadCalibration,
  saveCalibration,
  type CalibrationCaptures,
  type FaceSample,
} from '../../core/vision/calibration.ts'

type FaceStepId = 'neutral' | 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft'
type StepId = FaceStepId | 'brightness'

const STEPS: ReadonlyArray<{
  id: StepId
  label: string
  instruction: string
  duration: number
}> = [
  { id: 'neutral', label: 'Neutral', instruction: 'Face the screen and hold a comfortable neutral posture.', duration: 2000 },
  { id: 'topLeft', label: 'Top left', instruction: 'Gently turn your head toward the top-left marker.', duration: 2500 },
  { id: 'topRight', label: 'Top right', instruction: 'Gently turn your head toward the top-right marker.', duration: 2500 },
  { id: 'bottomRight', label: 'Bottom right', instruction: 'Gently turn your head toward the bottom-right marker.', duration: 2500 },
  { id: 'bottomLeft', label: 'Bottom left', instruction: 'Gently turn your head toward the bottom-left marker.', duration: 2500 },
  { id: 'brightness', label: 'Lighting check', instruction: 'Hold still while the camera checks the room lighting.', duration: 1000 },
]

const CORNER_CLASSES: Partial<Record<FaceStepId, string>> = {
  neutral: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
  topLeft: 'left-6 top-28',
  topRight: 'right-6 top-28',
  bottomRight: 'bottom-24 right-6',
  bottomLeft: 'bottom-24 left-6',
}

function averageFaceSample(samples: FaceSample[]): FaceSample | null {
  if (!samples.length) return null
  const total = samples.reduce(
    (sum, sample) => ({
      x: sum.x + sample.x,
      y: sum.y + sample.y,
      faceWidth: sum.faceWidth + sample.faceWidth,
    }),
    { x: 0, y: 0, faceWidth: 0 },
  )
  return {
    x: total.x / samples.length,
    y: total.y / samples.length,
    faceWidth: total.faceWidth / samples.length,
  }
}

export function CalibrationPage() {
  const [status, setStatus] = useState<VisionStatus>('idle')
  const [statusMessage, setStatusMessage] = useState('Start the camera before calibration.')
  const [faceDetected, setFaceDetected] = useState(false)
  const [brightness, setBrightness] = useState(0)
  const [stepIndex, setStepIndex] = useState(-1)
  const [progress, setProgress] = useState(0)
  const [capturedCount, setCapturedCount] = useState(0)
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)
  const [savedProfile, setSavedProfile] = useState(() => loadCalibration())
  const currentStepRef = useRef<StepId | null>(null)
  const faceSamplesRef = useRef<FaceSample[]>([])
  const brightnessSamplesRef = useRef<number[]>([])
  const capturesRef = useRef<Partial<CalibrationCaptures>>({})

  useEffect(() => {
    const offStatus = bus.on('VISION_STATUS_CHANGED', (next) => {
      setStatus(next.status)
      setStatusMessage(next.message)
      if (next.status !== 'running' && currentStepRef.current !== null) {
        currentStepRef.current = null
        setStepIndex(-1)
        setProgress(0)
        setError('Camera tracking stopped. Restart it, then retry calibration.')
      }
    })
    const offFace = bus.on('FACE_POSITION', (position) => {
      setFaceDetected(true)
      const step = currentStepRef.current
      if (
        step &&
        step !== 'brightness' &&
        !position.simulated &&
        Number.isFinite(position.x) &&
        Number.isFinite(position.y) &&
        Number.isFinite(position.faceWidth) &&
        position.confidence >= 0.3
      ) {
        faceSamplesRef.current.push({
          x: position.x,
          y: position.y,
          faceWidth: position.faceWidth,
        })
      }
    })
    const offLost = bus.on('FACE_LOST', () => setFaceDetected(false))
    const offHealth = bus.on('HEALTH', (health) => {
      setBrightness(health.brightness)
      if (currentStepRef.current === 'brightness') {
        brightnessSamplesRef.current.push(health.brightness)
      }
    })
    const offCalibration = bus.on('CALIBRATION_CHANGED', ({ profile }) => {
      setSavedProfile(profile)
    })

    bus.emit('VISION_STATUS_REQUESTED')
    return () => {
      offStatus()
      offFace()
      offLost()
      offHealth()
      offCalibration()
    }
  }, [])

  useEffect(() => {
    const step = STEPS[stepIndex]
    currentStepRef.current = step?.id ?? null
    if (!step) return

    faceSamplesRef.current = []
    brightnessSamplesRef.current = []
    const startedAt = performance.now()
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - startedAt
      setProgress(Math.min(1, elapsed / step.duration))
      if (elapsed < step.duration) return

      if (step.id === 'brightness') {
        if (!brightnessSamplesRef.current.length) {
          setError('No camera brightness samples arrived. Restart the camera and try again.')
          setProgress(0)
          currentStepRef.current = null
          setStepIndex(-1)
          return
        }
        capturesRef.current.brightness =
          brightnessSamplesRef.current.reduce((sum, value) => sum + value, 0) /
          brightnessSamplesRef.current.length
      } else {
        const sample = averageFaceSample(faceSamplesRef.current)
        if (!sample || sample.faceWidth < 0.04) {
          setError('No face was detected for this point. Center your face and restart calibration.')
          setProgress(0)
          currentStepRef.current = null
          setStepIndex(-1)
          return
        }
        capturesRef.current[step.id] = sample
        setCapturedCount((count) => count + 1)
      }

      if (stepIndex === STEPS.length - 1) {
        const captures = capturesRef.current as CalibrationCaptures
        const profile = buildCalibrationProfile(captures)
        if (!profile) {
          setError('The corner movement was too small to calibrate. Restart and look farther toward each marker.')
          setProgress(0)
        } else if (!saveCalibration(profile)) {
          setError('Calibration could not be saved in this browser. Check local storage settings and try again.')
          setProgress(0)
        } else {
          setSavedProfile(profile)
          setComplete(true)
        }
        currentStepRef.current = null
        setStepIndex(-1)
        return
      }

      setStepIndex(stepIndex + 1)
    }, 100)

    return () => window.clearInterval(timer)
  }, [stepIndex])

  function startCalibration() {
    if (status !== 'running') return
    capturesRef.current = {}
    setCapturedCount(0)
    setProgress(0)
    setComplete(false)
    setError('')
    currentStepRef.current = 'neutral'
    setStepIndex(0)
  }

  function skipCalibration() {
    currentStepRef.current = null
    setStepIndex(-1)
    setProgress(0)
    window.location.hash = '#/'
  }

  const isLoading =
    status === 'checking-model' ||
    status === 'requesting-camera' ||
    status === 'loading-model'

  const activeStep = STEPS[stepIndex]
  const activeCorner = activeStep && activeStep.id !== 'brightness'
    ? CORNER_CLASSES[activeStep.id]
    : undefined

  return (
    <main className="min-h-[75vh] px-[8%] py-10 max-sm:px-5 max-sm:pb-32">
      <span className="section-label">HEAD CURSOR SETUP</span>
      <h1 className="font-[Manrope,sans-serif] text-4xl font-extrabold text-[#17324f]">
        Calibrate movement
      </h1>
      <p className="mt-3 max-w-2xl text-[#718096]">
        A short guided setup maps comfortable head movement to the screen. Your camera frames are processed locally and never saved.
      </p>

      <section className="mt-7 max-w-2xl border-t border-[#e3e9ef] py-5" aria-live="polite">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-[#e4f5f2] px-3 py-1 text-xs font-bold text-[#066772]">
            {status === 'running' ? 'Camera ready' : status.replaceAll('-', ' ')}
          </span>
          <span className="text-sm text-[#718096]">{statusMessage}</span>
        </div>
        {isLoading ? (
          <p className="mt-3 flex items-center gap-2 text-sm font-medium text-[#066772]" role="status">
            <span className="size-4 animate-spin rounded-full border-2 border-[#087f8c] border-r-transparent" />
            Initializing local camera tracking…
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="button secondary"
            onClick={() => bus.emit('VISION_START_REQUESTED')}
            disabled={status === 'running' || status === 'checking-model' || status === 'requesting-camera' || status === 'loading-model'}
          >
            Start camera
          </button>
          <button
            type="button"
            className="button primary"
            onClick={startCalibration}
            disabled={status !== 'running' || stepIndex >= 0}
          >
            {stepIndex >= 0
              ? 'Calibrating…'
              : complete || error
                ? 'Retry calibration'
                : 'Start calibration'}
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={skipCalibration}
          >
            Skip calibration
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => bus.emit('VISION_STOP_REQUESTED')}
            disabled={status !== 'running'}
          >
            Stop camera
          </button>
        </div>
      </section>

      <section className="max-w-2xl border-t border-[#e3e9ef] py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-[#17324f]">
            {activeStep ? `${activeStep.label} · ${stepIndex + 1} of ${STEPS.length}` : complete ? 'Calibration complete' : 'Ready when you are'}
          </h2>
          <span className="text-sm text-[#718096]">{capturedCount} of 5 face points</span>
        </div>
        <p className="mt-2 text-sm text-[#718096]">
          {activeStep?.instruction ?? (complete
            ? <>Your cursor mapping is saved on this device. Navigate with head movement and say “{WAKE_WORD} recenter” to reset neutral posture.</>
            : 'Hold neutral for 2 seconds, then follow the four corner markers. The lighting check runs last.')}
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e3e9ef]" aria-label="Calibration progress">
          <div className="h-full bg-[#087f8c] transition-[width] duration-100" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="mt-3 text-xs text-[#718096]">
          Face: {faceDetected ? 'detected' : 'not detected'} · Brightness: {Math.round(brightness)} / 255 · Lighting sample saved after calibration
        </p>
        {savedProfile ? (
          <p className="mt-2 text-xs font-semibold text-[#066772]">Saved calibration is available on this device.</p>
        ) : null}
        {error ? <p className="mt-3 text-sm font-medium text-red-700" role="alert">{error}</p> : null}
      </section>

      {activeCorner ? (
        <div
          data-target-ignore
          className={`pointer-events-none fixed z-40 grid size-14 place-items-center rounded-full border-4 border-white bg-orange-500 shadow-[0_0_0_7px_rgba(249,115,22,0.24)] ${activeCorner}`}
          aria-hidden="true"
        />
      ) : null}
      {activeStep?.id === 'brightness' ? (
        <div data-target-ignore className="pointer-events-none fixed left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 rounded-md bg-white/95 px-4 py-2 text-sm font-semibold text-[#17324f] shadow">
          Lighting check
        </div>
      ) : null}
    </main>
  )
}