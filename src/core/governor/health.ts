import { bus } from '../bus.ts'

const FACE_LOST_MS = 500
const FACE_STABLE_MS = 2000
const DARKNESS_THRESHOLD = 55
const NORMAL_RADIUS = 120
const DARK_RADIUS = 180
const NORMAL_DWELL_MS = 800
const DARK_DWELL_MS = 1200

export function attachHealthGovernor(): () => void {
  let paused = false
  let lane: 'POINTER' | 'NUMBERS' = 'POINTER'
  let lostTimer: ReturnType<typeof setTimeout> | null = null
  let stableTimer: ReturnType<typeof setTimeout> | null = null
  let wasNumbersVisible = false
  let adjustingNumbers = false
  let wasDark = false
  let speechErrors = 0
  let faceRatio = 0
  let brightness = 0
  let faceLostAt: number | null = null

  const publishHealth = () => {
    bus.emit('GOVERNOR_HEALTH_CHANGED', {
      faceRatio,
      brightness,
      speechErrors,
      faceLostMs: faceLostAt === null ? 0 : Date.now() - faceLostAt,
    })
  }

  const clear = (timer: ReturnType<typeof setTimeout> | null) => {
    if (timer !== null) clearTimeout(timer)
  }
  const setLane = (next: 'POINTER' | 'NUMBERS') => {
    if (lane === next) return
    lane = next
    bus.emit('LANE_CHANGED', { lane })
  }
  const setWarning = (warning: string | null) => {
    bus.emit('GOVERNOR_WARNING_CHANGED', { warning })
  }
  const setDarkMode = (dark: boolean) => {
    if (wasDark === dark) return
    wasDark = dark
    bus.emit('GOVERNOR_SETTINGS_CHANGED', {
      snapRadius: dark ? DARK_RADIUS : NORMAL_RADIUS,
      dwellMs: dark ? DARK_DWELL_MS : NORMAL_DWELL_MS,
    })
    if (dark) setWarning('Low lighting detected. Snap radius and dwell time increased.')
    else if (lane === 'POINTER') setWarning(null)
  }

  const offHealth = bus.on('HEALTH', (health) => {
    brightness = health.brightness
    faceRatio = health.faceRatio
    setDarkMode(wasDark ? brightness < DARKNESS_THRESHOLD + 15 : brightness < DARKNESS_THRESHOLD)
    publishHealth()
  })
  const offSpeechError = bus.on('VOICE_ERROR', () => {
    speechErrors += 1
    publishHealth()
  })
  const offNumbersVisibility = bus.on('TARGETS_VISIBILITY_CHANGED', ({ visible }) => {
    if (!adjustingNumbers) wasNumbersVisible = visible
  })
  const offLost = bus.on('FACE_LOST', () => {
    faceLostAt = Date.now()
    publishHealth()
    clear(stableTimer)
    stableTimer = null
    clear(lostTimer)
    lostTimer = setTimeout(() => {
      lostTimer = null
      if (paused) return
      setLane('NUMBERS')
      publishHealth()
      setWarning('Face not detected. Numbered controls are available while the cursor is frozen.')
      if (!wasNumbersVisible) {
        adjustingNumbers = true
        bus.emit('TARGETS_VISIBILITY_CHANGED', { visible: true })
        adjustingNumbers = false
      }
    }, FACE_LOST_MS)
  })
  const offFace = bus.on('FACE_POSITION', ({ confidence, simulated }) => {
    if (simulated) {
      if (lane !== 'NUMBERS' || stableTimer !== null || paused) return
      stableTimer = setTimeout(() => {
        stableTimer = null
        if (paused) return
        setLane('POINTER')
        setWarning(wasDark ? 'Low lighting detected. Move to a brighter area for easier tracking.' : null)
        if (!wasNumbersVisible) {
          adjustingNumbers = true
          bus.emit('TARGETS_VISIBILITY_CHANGED', { visible: false })
          adjustingNumbers = false
        }
      }, FACE_STABLE_MS)
      return
    }
    if (confidence < 0.3) return
    faceLostAt = null
    publishHealth()
    clear(lostTimer)
    lostTimer = null
    if (lane !== 'NUMBERS' || stableTimer !== null || paused) return
    stableTimer = setTimeout(() => {
      stableTimer = null
      if (paused) return
      setLane('POINTER')
      setWarning(wasDark ? 'Low lighting detected. Move to a brighter area for easier tracking.' : null)
      if (!wasNumbersVisible) {
        adjustingNumbers = true
        bus.emit('TARGETS_VISIBILITY_CHANGED', { visible: false })
        adjustingNumbers = false
      }
    }, FACE_STABLE_MS)
  })
  const offPause = bus.on('PAUSE_CHANGED', ({ paused: next }) => {
    paused = next
    if (next) {
      clear(lostTimer)
      clear(stableTimer)
      lostTimer = null
      stableTimer = null
      setWarning('Paused. Cursor and target activation are frozen.')
    } else if (lane === 'POINTER') {
      setWarning(wasDark ? 'Low lighting detected. Move to a brighter area for easier tracking.' : null)
    }
  })

  return () => {
    clear(lostTimer)
    clear(stableTimer)
    offHealth()
    offSpeechError()
    offNumbersVisibility()
    offLost()
    offFace()
    offPause()
  }
}