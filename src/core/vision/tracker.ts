import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from '@mediapipe/tasks-vision'
import { bus } from '../bus.ts'
import type { VisionStatus } from '../events.ts'

const MODEL_PATH = '/models/face_landmarker.task'
const WASM_PATH = '/wasm'
const MIN_FRAME_INTERVAL_MS = 1000 / 30
const SLOW_FRAME_MS = 50
const SLOW_FRAME_LIMIT = 5
const FRAME_WATCHDOG_MS = 2000
const BRIGHTNESS_SIZE = 32
const FACE_WINDOW_SIZE = 30

function publishStatus(status: VisionStatus, message: string): void {
  bus.emit('VISION_STATUS_CHANGED', { status, message })
}

function permissionMessage(error: unknown): { status: VisionStatus; message: string } {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return {
      status: 'camera-denied',
      message: 'Camera access was blocked. Allow camera access for this site, then try again.',
    }
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return {
      status: 'camera-unavailable',
      message: 'No camera was found. Connect a webcam and try again.',
    }
  }
  if (error instanceof DOMException && error.name === 'NotReadableError') {
    return {
      status: 'camera-unavailable',
      message: 'The camera is busy in another app. Close that app and try again.',
    }
  }
  return {
    status: 'error',
    message: error instanceof Error ? error.message : 'The camera could not start.',
  }
}

function averageBrightness(
  video: HTMLVideoElement,
  context: CanvasRenderingContext2D,
): number {
  try {
    context.drawImage(video, 0, 0, BRIGHTNESS_SIZE, BRIGHTNESS_SIZE)
    const { data } = context.getImageData(0, 0, BRIGHTNESS_SIZE, BRIGHTNESS_SIZE)
    let total = 0
    for (let index = 0; index < data.length; index += 4) {
      total += (data[index] + data[index + 1] + data[index + 2]) / 3
    }
    return total / (BRIGHTNESS_SIZE * BRIGHTNESS_SIZE)
  } catch {
    return 0
  }
}

function facePosition(result: FaceLandmarkerResult) {
  const landmarks = result.faceLandmarks[0]
  if (!landmarks || landmarks.length <= 454) return null
  const nose = landmarks[1]
  const leftCheek = landmarks[234]
  const rightCheek = landmarks[454]
  if (!nose || !leftCheek || !rightCheek) return null

  // MediaPipe only returns a landmark set after the face passes the detection
  // and presence confidence thresholds, so a present landmark set is already a
  // confident detection. FaceLandmarker frequently reports visibility/presence
  // as 0 (not undefined) even for clearly detected faces, which would collapse
  // confidence to 0 and cause every frame to be discarded by the downstream
  // confidence gates. Only trust those scores when they are positive numbers.
  const landmarkScores = [nose.visibility, nose.presence].filter(
    (value): value is number => typeof value === 'number' && value > 0,
  )
  const confidence = landmarkScores.length > 0 ? Math.min(...landmarkScores) : 0.9

  return {
    x: 1 - nose.x,
    y: nose.y,
    confidence,
    faceWidth: Math.abs(rightCheek.x - leftCheek.x),
  }
}

export type VisionTracker = {
  start: () => Promise<void>
  stop: () => void
}

export function createVisionTracker(video: HTMLVideoElement): VisionTracker {
  let stream: MediaStream | null = null
  let landmarker: FaceLandmarker | null = null
  let animationFrame = 0
  let starting = false
  let running = false
  let cancelled = false
  let lastFrameAt = 0
  let slowFrames = 0
  let resolutionReduced = false
  let restartingAtLowResolution = false
  let lastSuccessfulFrameAt = 0
  let watchdogTimer: ReturnType<typeof setInterval> | null = null
  let faceWasDetected: boolean | null = null
  const faceWindow: boolean[] = []
  const brightnessCanvas = document.createElement('canvas')
  brightnessCanvas.width = BRIGHTNESS_SIZE
  brightnessCanvas.height = BRIGHTNESS_SIZE
  const brightnessContext = brightnessCanvas.getContext('2d', {
    willReadFrequently: true,
  })

  const releaseResources = () => {
    running = false
    if (watchdogTimer !== null) clearInterval(watchdogTimer)
    watchdogTimer = null
    if (animationFrame) window.cancelAnimationFrame(animationFrame)
    animationFrame = 0
    try {
      landmarker?.close()
    } catch {
      // Continue releasing the camera even if MediaPipe cleanup fails.
    }
    landmarker = null
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    video.pause()
    video.srcObject = null
  }

  const reduceCameraResolution = async () => {
    if (restartingAtLowResolution || cancelled || !running) return
    restartingAtLowResolution = true
    running = false
    if (animationFrame) window.cancelAnimationFrame(animationFrame)
    animationFrame = 0
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    video.srcObject = null

    try {
      const reducedStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 320 },
          height: { ideal: 240 },
        },
      })
      if (cancelled) {
        reducedStream.getTracks().forEach((track) => track.stop())
        return
      }
      stream = reducedStream
      video.srcObject = reducedStream
      await video.play()
      lastFrameAt = 0
      lastSuccessfulFrameAt = performance.now()
      slowFrames = 0
      running = true
      publishStatus('running', 'Tracking resumed at reduced 320 × 240 camera resolution.')
      animationFrame = window.requestAnimationFrame(inspectFrame)
    } catch (error) {
      const failure = permissionMessage(error)
      releaseResources()
      publishStatus(failure.status, failure.message)
    } finally {
      restartingAtLowResolution = false
    }
  }

  const recoverStalledStream = async () => {
    if (!running || starting || restartingAtLowResolution || cancelled) return
    running = false
    restartingAtLowResolution = true
    if (animationFrame) window.cancelAnimationFrame(animationFrame)
    animationFrame = 0
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    video.srcObject = null
    publishStatus('requesting-camera', 'No camera frame arrived for 2 seconds. Reconnecting the local stream…')

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: resolutionReduced ? 320 : 640 },
          height: { ideal: resolutionReduced ? 240 : 480 },
        },
      })
      if (cancelled) {
        releaseResources()
        return
      }
      video.srcObject = stream
      await video.play()
      lastFrameAt = 0
      lastSuccessfulFrameAt = performance.now()
      slowFrames = 0
      running = true
      publishStatus('running', `Tracking resumed at ${resolutionReduced ? '320 × 240' : '640 × 480'} camera resolution.`)
      animationFrame = window.requestAnimationFrame(inspectFrame)
    } catch (error) {
      const failure = permissionMessage(error)
      releaseResources()
      publishStatus(failure.status, failure.message)
    } finally {
      restartingAtLowResolution = false
    }
  }

  const inspectFrame = (timestamp: number) => {
    if (!running) return
    animationFrame = window.requestAnimationFrame(inspectFrame)
    if (
      timestamp - lastFrameAt < MIN_FRAME_INTERVAL_MS ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      !landmarker
    ) {
      return
    }

    lastFrameAt = timestamp
    const startedAt = performance.now()
    try {
      const result = landmarker.detectForVideo(video, timestamp)
      lastSuccessfulFrameAt = performance.now()
      const position = facePosition(result)
      const faceDetected = position !== null
      faceWindow.push(faceDetected)
      if (faceWindow.length > FACE_WINDOW_SIZE) faceWindow.shift()

      if (faceDetected && position) {
        bus.emit('FACE_POSITION', position)
      } else if (faceWasDetected !== false) {
        bus.emit('FACE_LOST')
      }
      faceWasDetected = faceDetected

      const brightness = brightnessContext
        ? averageBrightness(video, brightnessContext)
        : 0
      const frameTimeMs = performance.now() - startedAt
      bus.emit('HEALTH', {
        faceRatio:
          faceWindow.reduce((total, detected) => total + Number(detected), 0) /
          faceWindow.length,
        brightness,
        speechErrors: 0,
        frameTimeMs,
        cameraWidth: video.videoWidth,
        cameraHeight: video.videoHeight,
      })

      slowFrames = frameTimeMs > SLOW_FRAME_MS ? slowFrames + 1 : 0
      if (slowFrames >= SLOW_FRAME_LIMIT && !resolutionReduced) {
        resolutionReduced = true
        void reduceCameraResolution()
      }
    } catch {
      publishStatus('error', 'Face tracking hit a frame error. Stop and restart the camera.')
    }
  }

  return {
    async start() {
      if (starting || running || restartingAtLowResolution) return
      starting = true
      cancelled = false
      try {
        publishStatus('checking-model', 'Checking the local face model…')
        const modelResponse = await fetch(MODEL_PATH, { method: 'HEAD' })
        const contentType = modelResponse.headers.get('content-type') ?? ''
        if (!modelResponse.ok || contentType.includes('text/html')) {
          publishStatus(
            'model-missing',
            'Add face_landmarker.task to public/models/, then restart the dev server.',
          )
          return
        }
        if (cancelled) return

        if (!navigator.mediaDevices?.getUserMedia) {
          publishStatus('unsupported', 'Camera access needs a secure browser context such as localhost or HTTPS.')
          return
        }

        publishStatus('requesting-camera', 'Waiting for camera permission…')
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        })
        if (cancelled) {
          releaseResources()
          return
        }

        video.srcObject = stream
        await video.play()
        publishStatus('loading-model', 'Loading the face model from local files…')
        const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)
        const nextLandmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })
        if (cancelled) {
          nextLandmarker.close()
          releaseResources()
          return
        }

        landmarker = nextLandmarker
        running = true
        lastFrameAt = 0
        lastSuccessfulFrameAt = performance.now()
        slowFrames = 0
        resolutionReduced = false
        faceWasDetected = null
        faceWindow.length = 0
        publishStatus('running', 'Camera and face tracking are running locally.')
        animationFrame = window.requestAnimationFrame(inspectFrame)
        if (watchdogTimer !== null) clearInterval(watchdogTimer)
        watchdogTimer = setInterval(() => {
          if (
            running &&
            performance.now() - lastSuccessfulFrameAt > FRAME_WATCHDOG_MS
          ) {
            void recoverStalledStream()
          }
        }, 500)
      } catch (error) {
        const failure = permissionMessage(error)
        releaseResources()
        publishStatus(failure.status, failure.message)
      } finally {
        starting = false
      }
    },
    stop() {
      cancelled = true
      releaseResources()
      faceWindow.length = 0
      faceWasDetected = null
      publishStatus('idle', 'Camera stopped.')
    },
  }
}