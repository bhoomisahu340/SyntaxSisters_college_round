export type Lane = 'POINTER' | 'NUMBERS'

export type AppEvent =
  | {
      type: 'FACE_POSITION'
      payload: { x: number; y: number; confidence: number; faceWidth: number }
    }
  | { type: 'FACE_LOST' }
  | { type: 'VOICE_INTERIM'; payload: { text: string } }
  | { type: 'VOICE_FINAL'; payload: { text: string; confidence: number } }
  | { type: 'TARGET_SNAPPED'; payload: { id: string } }
  | { type: 'TARGET_LOCKED'; payload: { id: string; risk: boolean } }
  | { type: 'TARGET_CLEARED' }
  | { type: 'TARGETS_VISIBILITY_CHANGED'; payload: { visible: boolean } }
  | {
      type: 'TARGETS_UPDATED'
      payload: {
        targets: Array<{
          id: string
          number: number
          name: string
          top: number
          left: number
          width: number
          height: number
        }>
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
      type: 'HEALTH'
      payload: { faceRatio: number; brightness: number; speechErrors: number }
    }
  | { type: 'PAUSE_CHANGED'; payload: { paused: boolean } }

export type EventType = AppEvent['type']
