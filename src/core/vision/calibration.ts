import { bus } from '../bus.ts'

export type FaceSample = {
  x: number
  y: number
  faceWidth: number
}

export type CalibrationCaptures = {
  neutral: FaceSample
  topLeft: FaceSample
  topRight: FaceSample
  bottomRight: FaceSample
  bottomLeft: FaceSample
  brightness: number
}

export type CalibrationProfile = {
  version: 1
  neutralX: number
  neutralY: number
  leftOffset: number
  rightOffset: number
  topOffset: number
  bottomOffset: number
  brightness: number
  savedAt: number
}

const STORAGE_KEY = 'drishva.calibration.v1'
const MIN_FACE_WIDTH = 0.04
const DEAD_ZONE = 0.012

export const DEFAULT_CALIBRATION_PROFILE: CalibrationProfile = {
  version: 1,
  neutralX: 0.5,
  neutralY: 0.5,
  leftOffset: -0.55,
  rightOffset: 0.55,
  topOffset: -0.55,
  bottomOffset: 0.55,
  brightness: 128,
  savedAt: 0,
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function offsets(sample: FaceSample, neutral: FaceSample) {
  const faceWidth = Math.max(sample.faceWidth, MIN_FACE_WIDTH)
  return {
    x: (sample.x - neutral.x) / faceWidth,
    y: (sample.y - neutral.y) / faceWidth,
  }
}

function isProfile(value: unknown): value is CalibrationProfile {
  if (!value || typeof value !== 'object') return false
  const profile = value as Partial<CalibrationProfile>
  return (
    profile.version === 1 &&
    [
      profile.neutralX,
      profile.neutralY,
      profile.leftOffset,
      profile.rightOffset,
      profile.topOffset,
      profile.bottomOffset,
      profile.brightness,
      profile.savedAt,
    ].every((number) => typeof number === 'number' && Number.isFinite(number)) &&
    (profile.rightOffset ?? 0) - (profile.leftOffset ?? 0) > 0.03 &&
    (profile.bottomOffset ?? 0) - (profile.topOffset ?? 0) > 0.03 &&
    (profile.neutralX ?? -1) >= 0 &&
    (profile.neutralX ?? 2) <= 1 &&
    (profile.neutralY ?? -1) >= 0 &&
    (profile.neutralY ?? 2) <= 1 &&
    (profile.brightness ?? -1) >= 0 &&
    (profile.brightness ?? 256) <= 255
  )
}

export function buildCalibrationProfile(
  captures: CalibrationCaptures,
): CalibrationProfile | null {
  const neutral = captures.neutral
  if (!Number.isFinite(neutral.faceWidth) || neutral.faceWidth < MIN_FACE_WIDTH) {
    return null
  }

  const left = [captures.topLeft, captures.bottomLeft].map((point) => offsets(point, neutral))
  const right = [captures.topRight, captures.bottomRight].map((point) => offsets(point, neutral))
  const top = [captures.topLeft, captures.topRight].map((point) => offsets(point, neutral))
  const bottom = [captures.bottomLeft, captures.bottomRight].map((point) => offsets(point, neutral))
  const profile: CalibrationProfile = {
    version: 1,
    neutralX: neutral.x,
    neutralY: neutral.y,
    leftOffset: mean(left.map((point) => point.x)),
    rightOffset: mean(right.map((point) => point.x)),
    topOffset: mean(top.map((point) => point.y)),
    bottomOffset: mean(bottom.map((point) => point.y)),
    brightness: clamp(captures.brightness, 0, 255),
    savedAt: Date.now(),
  }

  return isProfile(profile) ? profile : null
}

export function mapFaceToCursor(
  sample: FaceSample,
  profile: CalibrationProfile,
  viewport: { width: number; height: number },
): { x: number; y: number } {
  const faceWidth = Math.max(sample.faceWidth, MIN_FACE_WIDTH)
  const rawX = (sample.x - profile.neutralX) / faceWidth
  const rawY = (sample.y - profile.neutralY) / faceWidth
  const deadZoneX = Math.abs(rawX) <= DEAD_ZONE ? 0 : rawX - Math.sign(rawX) * DEAD_ZONE
  const deadZoneY = Math.abs(rawY) <= DEAD_ZONE ? 0 : rawY - Math.sign(rawY) * DEAD_ZONE
  const normalizedX =
    (deadZoneX - profile.leftOffset) / (profile.rightOffset - profile.leftOffset)
  const normalizedY =
    (deadZoneY - profile.topOffset) / (profile.bottomOffset - profile.topOffset)

  return {
    x: clamp(normalizedX, 0, 1) * viewport.width,
    y: clamp(normalizedY, 0, 1) * viewport.height,
  }
}

export function loadCalibration(): CalibrationProfile | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const parsed: unknown = JSON.parse(stored)
    return isProfile(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveCalibration(profile: CalibrationProfile): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
    bus.emit('CALIBRATION_CHANGED', { profile })
    return true
  } catch {
    return false
  }
}

export function recenterCalibration(
  profile: CalibrationProfile,
  sample: FaceSample,
): CalibrationProfile {
  const delta = offsets(sample, {
    x: profile.neutralX,
    y: profile.neutralY,
    faceWidth: sample.faceWidth,
  })
  const next = {
    ...profile,
    neutralX: sample.x,
    neutralY: sample.y,
    leftOffset: profile.leftOffset - delta.x,
    rightOffset: profile.rightOffset - delta.x,
    topOffset: profile.topOffset - delta.y,
    bottomOffset: profile.bottomOffset - delta.y,
    savedAt: Date.now(),
  }
  return isProfile(next) ? next : profile
}