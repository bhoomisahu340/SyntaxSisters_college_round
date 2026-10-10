import type { CalibrationProfile } from './vision/calibration.ts'

export type Lane = 'POINTER' | 'NUMBERS'
export type VisionStatus =
  | 'idle'
  | 'checking-model'
  | 'requesting-camera'
  | 'loading-model'
  | 'running'
  | 'model-missing'
  | 'camera-denied'
  | 'camera-unavailable'
  | 'unsupported'
  | 'error'
export type VoiceStatus =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'restarting'
  | 'paused'
  | 'blocked'
  | 'unsupported'
  | 'error'

export type TargetDescriptor = {
  id: string
  number: number
  name: string
  top: number
  left: number
  width: number
  height: number
  tagName: string
  inputType: string
  formText: string
  href: string
}
export type ShieldState = 'IDLE' | 'HOVER' | 'LOCKED' | 'AWAIT_CONFIRM' | 'PAUSED'
export type BenchmarkMode = 'mouse' | 'drishva'
export type BenchmarkTask = 'search-service' | 'select-slot' | 'complete-booking'
export type BenchmarkSummary = {
  id: string
  mode: BenchmarkMode
  completionTimeMs: number
  commandAccuracy: number | null
  commandsMatched: number
  commandsTotal: number
  selectionErrors: number
  preventedByShield: number
  completedAt: number
}
export type BrowserSite = 'home' | 'shop' | 'booking'
export type ShopCategory = 'All' | 'Accessibility' | 'Technology' | 'Daily Living' | 'Wellness'

export type AppEvent =
  | {
      type: 'FACE_POSITION'
      payload: {
        x: number
        y: number
        confidence: number
        faceWidth: number
        simulated?: boolean
      }
    }
  | { type: 'FACE_LOST' }
  | { type: 'VOICE_INTERIM'; payload: { text: string } }
  | { type: 'VOICE_FINAL'; payload: { text: string; confidence: number } }
  | {
      type: 'VOICE_STATUS_CHANGED'
      payload: { status: VoiceStatus; message: string }
    }
  | { type: 'VOICE_ERROR'; payload: { error: string; permanent: boolean } }
  | {
      type: 'VOICE_COMMAND_MATCHED'
      payload: { text: string; matched: boolean; command: string | null }
    }
  | { type: 'TARGET_SNAPPED'; payload: TargetDescriptor }
  | { type: 'TARGET_LOCKED'; payload: TargetDescriptor & { risk: boolean } }
  | { type: 'TARGET_LOCK_REQUESTED'; payload: { id: string } }
  | { type: 'TARGET_CLEARED' }
  | { type: 'TARGET_SELECTED_BY_NUMBER'; payload: { id: string; verb: 'click' | 'open' } }
  | { type: 'TARGET_EXECUTE_REQUESTED'; payload: { id: string } }
  | { type: 'TARGET_LOCK_CURRENT_REQUESTED' }
  | {
      type: 'VOICE_ACTION_REQUESTED'
      payload: { verb: 'click' | 'open' | 'this' | 'type-here' | 'confirm' | 'cancel' | 'not-that-one' }
    }
  | {
      type: 'SHIELD_STATE_CHANGED'
      payload: {
        state: ShieldState
        targetId: string | null
        targetName: string | null
        risk: boolean
        message: string
      }
    }
  | { type: 'TARGET_ALTERNATIVES_REQUESTED'; payload: { targetId: string } }
  | { type: 'TARGET_ALTERNATIVES_CHANGED'; payload: { targets: TargetDescriptor[] } }
  | { type: 'DICTATION_START_REQUESTED'; payload: { targetId: string | null } }
  | { type: 'DICTATION_TARGET_SELECTED'; payload: { targetId: string; name: string } }
  | { type: 'DICTATION_STOP_REQUESTED' }
  | { type: 'DICTATION_STATE_CHANGED'; payload: { active: boolean; targetName: string } }
  | { type: 'DICTATION_PREVIEW_CHANGED'; payload: { text: string } }
  | { type: 'BENCHMARK_STARTED'; payload: { mode: BenchmarkMode } }
  | { type: 'BENCHMARK_STATUS_REQUESTED' }
  | { type: 'BENCHMARK_TASK_SIGNAL'; payload: { task: BenchmarkTask } }
  | { type: 'BENCHMARK_UPDATED'; payload: { runs: BenchmarkSummary[]; activeMode: BenchmarkMode | null; completedTasks: BenchmarkTask[] } }
  | { type: 'VISION_START_REQUESTED' }
  | { type: 'VISION_STOP_REQUESTED' }
  | { type: 'VOICE_START_REQUESTED' }
  | { type: 'VOICE_STOP_REQUESTED' }
  | { type: 'TAB_ACTION_REQUESTED'; payload: { action: 'new' | 'next' | 'close' } }
  | { type: 'UI_CANCEL_REQUESTED' }
  | {
      type: 'VOICE_SEARCH_REQUESTED'
      payload: { query: string }
    }
  | {
      type: 'SHOP_CATEGORY_REQUESTED'
      payload: { category: ShopCategory }
    }
  | { type: 'SHOP_OPEN_PRODUCT_REQUESTED'; payload: { query: string } }
  | { type: 'BOOKING_NAME_FOCUS_REQUESTED' }
  | {
      type: 'BOOKING_VOICE_ACTION_REQUESTED'
      payload: {
        action: 'show-doctors' | 'search' | 'select-doctor' | 'choose-date' | 'show-slots' | 'select-slot'
        value?: string | number
      }
    }
  | { type: 'VISION_STATUS_REQUESTED' }
  | {
      type: 'VISION_DEBUG_SIMULATION_REQUESTED'
      payload: { event: 'FACE_POSITION' | 'FACE_LOST' | 'FACE_RECOVERED' }
    }
  | { type: 'CALIBRATION_RECENTER_REQUESTED' }
  | { type: 'CALIBRATION_CHANGED'; payload: { profile: CalibrationProfile | null } }
  | {
      type: 'VISION_STATUS_CHANGED'
      payload: { status: VisionStatus; message: string }
    }
  | { type: 'CURSOR_POSITION'; payload: { x: number; y: number } }
  | { type: 'TARGETS_VISIBILITY_CHANGED'; payload: { visible: boolean } }
  | {
      type: 'TARGETS_UPDATED'
      payload: {
        targets: TargetDescriptor[]
      }
    }
  | {
      type: 'TARGET_ACTIVATE_REQUESTED'
      payload: { number: number; verb: 'click' | 'open' }
    }
  | { type: 'ACTION_EXECUTED'; payload: { id: string; verb: string } }
  | { type: 'ACTION_BLOCKED'; payload: { id: string; reason: string } }
  | { type: 'LANE_CHANGED'; payload: { lane: Lane } }
  | {
      type: 'GOVERNOR_WARNING_CHANGED'
      payload: { warning: string | null }
    }
  | {
      type: 'GOVERNOR_HEALTH_CHANGED'
      payload: {
        faceRatio: number
        brightness: number
        speechErrors: number
        faceLostMs: number
      }
    }
  | {
      type: 'GOVERNOR_SETTINGS_CHANGED'
      payload: { snapRadius: number; dwellMs: number }
    }
  | {
      type: 'HEALTH'
      payload: {
        faceRatio: number
        brightness: number
        speechErrors: number
        frameTimeMs?: number
        cameraWidth?: number
        cameraHeight?: number
      }
    }
  | { type: 'PAUSE_CHANGED'; payload: { paused: boolean } }

export type EventType = AppEvent['type']
