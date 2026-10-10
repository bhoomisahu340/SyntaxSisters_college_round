import { useEffect, useState } from 'react'
import { useRef } from 'react'
import { bus } from '../../core/bus.ts'
import type { VisionStatus } from '../../core/events.ts'
import { WAKE_WORD } from '../../core/voice/config.ts'

type VisionHealth = {
  faceRatio: number
  brightness: number
  speechErrors: number
  frameTimeMs?: number
  cameraWidth?: number
  cameraHeight?: number
}

type FaceCoordinates = {
  x: number
  y: number
  confidence: number
  faceWidth: number
}

type CursorCoordinates = { x: number; y: number }

const INITIAL_HEALTH: VisionHealth = {
  faceRatio: 0,
  brightness: 0,
  speechErrors: 0,
}

export function VisionDebugPage() {
  const [status, setStatus] = useState<VisionStatus>('idle')
  const [message, setMessage] = useState('Start the camera to test local face tracking.')
  const [health, setHealth] = useState(INITIAL_HEALTH)
  const [faceDetected, setFaceDetected] = useState(false)
  const [coordinates, setCoordinates] = useState<FaceCoordinates | null>(null)
  const [cursor, setCursor] = useState<CursorCoordinates | null>(null)
  const [eventSource, setEventSource] = useState<'LIVE' | 'SIMULATED' | 'NONE'>('NONE')
  const simulatedLossPending = useRef(false)

  useEffect(() => {
    const offStatus = bus.on('VISION_STATUS_CHANGED', (next) => {
      setStatus(next.status)
      setMessage(next.message)
    })
    const offHealth = bus.on('HEALTH', (next) => setHealth(next))
    const offFace = bus.on('FACE_POSITION', (position) => {
      setFaceDetected(true)
      setCoordinates(position)
      setEventSource(position.simulated ? 'SIMULATED' : 'LIVE')
    })
    const offLost = bus.on('FACE_LOST', () => {
      setFaceDetected(false)
      setEventSource(simulatedLossPending.current ? 'SIMULATED' : 'LIVE')
      simulatedLossPending.current = false
    })
    const offCursor = bus.on('CURSOR_POSITION', (position) => setCursor(position))
    const offSimulation = bus.on('VISION_DEBUG_SIMULATION_REQUESTED', ({ event }) => {
      if (event === 'FACE_POSITION') {
        bus.emit('FACE_POSITION', {
          x: 0.52,
          y: 0.48,
          confidence: 1,
          faceWidth: 0.18,
          simulated: true,
        })
      } else if (event === 'FACE_LOST') {
        simulatedLossPending.current = true
        bus.emit('FACE_LOST')
      } else {
        bus.emit('FACE_POSITION', {
          x: 0.5,
          y: 0.5,
          confidence: 1,
          faceWidth: 0.18,
          simulated: true,
        })
      }
    })

    bus.emit('VISION_STATUS_REQUESTED')
    return () => {
      offStatus()
      offHealth()
      offFace()
      offLost()
      offCursor()
      offSimulation()
    }
  }, [])

  const statusLabel = status === 'running' ? 'Tracking active' : status.replaceAll('-', ' ')
  const isLoading =
    status === 'checking-model' ||
    status === 'requesting-camera' ||
    status === 'loading-model'

  return (
    <main className="min-h-[75vh] px-[8%] py-10 pr-[min(44vw,500px)] max-sm:px-5 max-sm:pb-[32rem]">
      <span className="section-label">LOCAL CAMERA CHECK</span>
      <h1 className="font-[Manrope,sans-serif] text-4xl font-extrabold text-[#17324f]">
        Vision debug
      </h1>
      <p className="mt-3 max-w-xl text-[#718096]">
        Check camera access, face detection, and lighting. Frames stay on this device.
      </p>

      <div className="mt-7 flex flex-wrap gap-3">
        <button
          type="button"
          className="button primary"
          onClick={() => bus.emit('VISION_START_REQUESTED')}
          disabled={isLoading || status === 'running'}
        >
          Start camera
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => bus.emit('VISION_STOP_REQUESTED')}
        >
          Stop camera
        </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => bus.emit('VISION_DEBUG_SIMULATION_REQUESTED', { event: 'FACE_POSITION' })}
          >
            Simulate face position
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => bus.emit('VISION_DEBUG_SIMULATION_REQUESTED', { event: 'FACE_LOST' })}
          >
            Simulate face lost
          </button>
      </div>

      {isLoading ? (
        <p className="mt-5 flex items-center gap-2 text-sm font-medium text-[#066772]" role="status">
          <span className="size-4 animate-spin rounded-full border-2 border-[#087f8c] border-r-transparent" />
          Initializing local camera tracking…
        </p>
      ) : null}
      <p className={`${isLoading ? 'mt-3' : 'mt-5'} rounded-md border border-[#e3e9ef] bg-white p-4 text-sm text-[#293b4f]`} role="status">
        <strong className="capitalize">{statusLabel}:</strong> {message}
      </p>
      {status === 'model-missing' ? (
        <p className="mt-3 max-w-xl text-sm text-[#718096]">
          Download the FaceLandmarker model and place it at{' '}
          <code className="rounded bg-white px-1.5 py-0.5">public/models/face_landmarker.task</code>.
        </p>
      ) : null}

      <dl className="mt-6 grid max-w-xl grid-cols-2 gap-3">
        <div className="border-t border-[#e3e9ef] py-3">
          <dt className="text-xs text-[#718096]">Face detected</dt>
          <dd className="mt-1 font-semibold text-[#17324f]">{faceDetected ? 'Yes' : 'Not yet'}</dd>
        </div>
        <div className="border-t border-[#e3e9ef] py-3">
          <dt className="text-xs text-[#718096]">Face detection ratio</dt>
          <dd className="mt-1 font-semibold text-[#17324f]">{Math.round(health.faceRatio * 100)}%</dd>
        </div>
        <div className="border-t border-[#e3e9ef] py-3">
          <dt className="text-xs text-[#718096]">Normalized face position</dt>
          <dd className="mt-1 font-semibold text-[#17324f]">
            {coordinates ? `x ${coordinates.x.toFixed(3)} · y ${coordinates.y.toFixed(3)}` : '—'}
          </dd>
        </div>
        <div className="border-t border-[#e3e9ef] py-3">
          <dt className="text-xs text-[#718096]">Frame processing</dt>
          <dd className="mt-1 font-semibold text-[#17324f]">
            {health.frameTimeMs === undefined ? '—' : `${health.frameTimeMs.toFixed(1)} ms`}
          </dd>
        </div>
        <div className="border-t border-[#e3e9ef] py-3">
          <dt className="text-xs text-[#718096]">Cursor position</dt>
          <dd className="mt-1 font-semibold text-[#17324f]">
            {cursor ? `${Math.round(cursor.x)}, ${Math.round(cursor.y)}` : '—'}
          </dd>
        </div>
        <div className="border-t border-[#e3e9ef] py-3">
          <dt className="text-xs text-[#718096]">Frame brightness</dt>
          <dd className="mt-1 font-semibold text-[#17324f]">{Math.round(health.brightness)} / 255</dd>
        </div>
        <div className="border-t border-[#e3e9ef] py-3">
          <dt className="text-xs text-[#718096]">Camera resolution</dt>
          <dd className="mt-1 font-semibold text-[#17324f]">
            {health.cameraWidth && health.cameraHeight ? `${health.cameraWidth} × ${health.cameraHeight}` : '—'}
          </dd>
        </div>
        <div className="border-t border-[#e3e9ef] py-3">
          <dt className="text-xs text-[#718096]">Tracking mode</dt>
          <dd className="mt-1 font-semibold text-[#17324f]">VIDEO · local WASM</dd>
        </div>
        <div className="border-t border-[#e3e9ef] py-3">
          <dt className="text-xs text-[#718096]">Event source</dt>
          <dd className={`mt-1 font-semibold ${eventSource === 'SIMULATED' ? 'text-orange-700' : 'text-[#17324f]'}`}>
            {eventSource === 'NONE' ? 'Waiting' : eventSource}
          </dd>
        </div>
      </dl>

      <details className="mt-8 max-w-xl border-t border-[#e3e9ef] pt-4">
        <summary className="cursor-pointer text-sm font-semibold text-[#17324f]">
          SIMULATED debug controls
        </summary>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="category-button" onClick={() => bus.emit('FACE_POSITION', { x: 0.35, y: 0.5, confidence: 1, faceWidth: 0.18, simulated: true })}>Look left · SIMULATED</button>
          <button type="button" className="category-button" onClick={() => bus.emit('FACE_POSITION', { x: 0.65, y: 0.5, confidence: 1, faceWidth: 0.18, simulated: true })}>Look right · SIMULATED</button>
          <button type="button" className="category-button" onClick={() => bus.emit('VISION_DEBUG_SIMULATION_REQUESTED', { event: 'FACE_RECOVERED' })}>Simulate recovery · SIMULATED</button>
          <button type="button" className="category-button" onClick={() => bus.emit('VOICE_FINAL', { text: `${WAKE_WORD} scroll down`, confidence: 1 })}>Say “scroll down” · SIMULATED</button>
          <button type="button" className="category-button" onClick={() => bus.emit('VOICE_FINAL', { text: `${WAKE_WORD} click`, confidence: 1 })}>Say “click” · SIMULATED</button>
        </div>
      </details>
    </main>
  )
}