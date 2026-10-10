import { useEffect, useRef, useState } from 'react'
import { bus } from '../../core/bus.ts'
import type { VisionStatus } from '../../core/events.ts'
import { createVisionTracker, type VisionTracker } from '../../core/vision/tracker.ts'
import { useAppStore } from '../store.ts'

type VisionRuntimeProps = {
  debug: boolean
}

/** Explicit, human-readable diagnostic for every vision state. */
function describeStatus(
  status: VisionStatus,
  faceDetected: boolean,
  paused: boolean,
): { label: string; tone: 'idle' | 'busy' | 'ok' | 'warn' | 'error' } {
  if (paused) return { label: 'Paused', tone: 'idle' }
  switch (status) {
    case 'checking-model':
      return { label: 'Loading model… checking files', tone: 'busy' }
    case 'loading-model':
      return { label: 'Loading model…', tone: 'busy' }
    case 'requesting-camera':
      return { label: 'Waiting for camera permission…', tone: 'busy' }
    case 'running':
      return faceDetected
        ? { label: 'Face detected', tone: 'ok' }
        : { label: 'Model loaded · no face detected', tone: 'warn' }
    case 'model-missing':
      return { label: 'Model error: file missing', tone: 'error' }
    case 'camera-denied':
      return { label: 'Camera error: permission denied', tone: 'error' }
    case 'camera-unavailable':
      return { label: 'Camera error: unavailable', tone: 'error' }
    case 'unsupported':
      return { label: 'Unsupported in this browser', tone: 'error' }
    case 'error':
      return { label: 'Tracking error', tone: 'error' }
    case 'idle':
    default:
      return { label: 'Hands-free is off', tone: 'idle' }
  }
}

export function VisionRuntime({ debug }: VisionRuntimeProps) {
  const paused = useAppStore((state) => state.paused)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trackerRef = useRef<VisionTracker | null>(null)
  const statusRef = useRef<{ status: VisionStatus; message: string }>({
    status: 'idle',
    message: 'Camera has not started.',
  })
  const [status, setStatus] = useState<VisionStatus>('idle')
  const [statusMessage, setStatusMessage] = useState('Camera has not started.')
  const [faceDetected, setFaceDetected] = useState(false)
  const [minimized, setMinimized] = useState(false)

  useEffect(() => {
    const drawNose = (x: number, y: number) => {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      if (!video || !canvas || !context || !video.videoWidth) return

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
      }
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.beginPath()
      context.arc(x * canvas.width, y * canvas.height, 10, 0, Math.PI * 2)
      context.fillStyle = '#f97316'
      context.fill()
      context.lineWidth = 3
      context.strokeStyle = '#ffffff'
      context.stroke()
    }

    const clearNose = () => {
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height)
    }

    const offFace = bus.on('FACE_POSITION', ({ x, y }) => drawNose(x, y))
    const offFaceState = bus.on('FACE_POSITION', () => setFaceDetected(true))
    const offLost = bus.on('FACE_LOST', () => {
      clearNose()
      setFaceDetected(false)
    })
    const offStatus = bus.on('VISION_STATUS_CHANGED', (status) => {
      statusRef.current = status
      setStatus(status.status)
      setStatusMessage(status.message)
    })
    const offStart = bus.on('VISION_START_REQUESTED', () => {
      if (!videoRef.current) return
      if (!trackerRef.current) trackerRef.current = createVisionTracker(videoRef.current)
      if (statusRef.current.status === 'running') {
        bus.emit('VISION_STATUS_CHANGED', statusRef.current)
        return
      }
      void trackerRef.current.start()
    })
    const offStop = bus.on('VISION_STOP_REQUESTED', () => trackerRef.current?.stop())
    const offStatusRequest = bus.on('VISION_STATUS_REQUESTED', () => {
      bus.emit('VISION_STATUS_CHANGED', statusRef.current)
    })

    return () => {
      offFace()
      offFaceState()
      offLost()
      offStatus()
      offStart()
      offStop()
      offStatusRequest()
      trackerRef.current?.stop()
      trackerRef.current = null
    }
  }, [])

  const statusInfo = describeStatus(status, faceDetected, paused)
  const statusDotClass =
    statusInfo.tone === 'ok'
      ? 'bg-emerald-500'
      : statusInfo.tone === 'warn'
        ? 'bg-amber-500'
        : statusInfo.tone === 'error'
          ? 'bg-red-500'
          : statusInfo.tone === 'busy'
            ? 'bg-sky-500 animate-pulse'
            : 'bg-zinc-400'

  return (
    <aside
      data-target-ignore
      data-target-occluder
      className={`fixed z-40 overflow-hidden rounded-lg border border-[#d7e0e6] bg-white shadow-xl ${
        debug
          ? 'right-5 top-24 w-[min(36vw,420px)] max-sm:left-4 max-sm:right-4 max-sm:top-auto max-sm:bottom-24 max-sm:w-auto'
          : 'bottom-24 right-4 w-56 max-sm:bottom-24 max-sm:right-2 max-sm:w-40'
      }`}
      aria-label="Hands-free camera preview"
    >
      <div className="flex min-h-9 items-center justify-between gap-2 border-b border-[#e3e9ef] px-2.5 py-1.5">
        <span
          className="flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-[#17324f]"
          role="status"
          aria-live="polite"
          title={statusMessage}
        >
          <span className={`size-2 shrink-0 rounded-full ${statusDotClass}`} aria-hidden="true" />
          <span className="truncate">{statusInfo.label}</span>
        </span>
        <button
          type="button"
          className="grid size-7 shrink-0 place-items-center rounded text-sm text-[#293b4f] hover:bg-[#f0f5f7] focus-visible:outline-2 focus-visible:outline-[#087f8c]"
          aria-label={minimized ? 'Expand camera preview' : 'Minimize camera preview'}
          aria-expanded={!minimized}
          onClick={() => setMinimized((value) => !value)}
        >
          {minimized ? '+' : '−'}
        </button>
      </div>
      {!minimized ? (
        <>
          <div className={status === 'running' ? 'relative w-full' : 'absolute size-px overflow-hidden'}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              aria-label="Live mirrored webcam preview, processed locally"
              className="block aspect-[4/3] h-auto w-full scale-x-[-1] object-cover"
            />
            <canvas
              ref={canvasRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
          </div>
          <div className="flex items-center justify-between gap-2 px-2.5 py-2">
            {status === 'running' ? (
              <>
                <span className="min-w-0 truncate text-[11px] text-[#718096]">
                  {paused ? 'Cursor and voice paused' : 'Frames stay on this device'}
                </span>
                <button
                  type="button"
                  className="shrink-0 rounded bg-[#eef3f6] px-2 py-1 text-[11px] font-semibold text-[#17324f]"
                  onClick={() => {
                    bus.emit('VISION_STOP_REQUESTED')
                    bus.emit('VOICE_STOP_REQUESTED')
                  }}
                >
                  Turn off
                </button>
              </>
            ) : (
              <button
                type="button"
                className="w-full rounded bg-[#087f8c] px-2.5 py-2 text-xs font-bold text-white disabled:opacity-60"
                disabled={status === 'checking-model' || status === 'requesting-camera' || status === 'loading-model'}
                title={statusMessage}
                onClick={() => {
                  bus.emit('VISION_START_REQUESTED')
                  bus.emit('VOICE_START_REQUESTED')
                }}
              >
                Enable hands-free
              </button>
            )}
          </div>
        </>
      ) : null}
    </aside>
  )
}