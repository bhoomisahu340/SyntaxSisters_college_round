import { bus } from '../bus.ts'
import type { TargetDescriptor } from '../events.ts'

const LOCK_TIMEOUT_MS = 5000

let attached = false

export function attachIntentShield(): () => void {
  if (attached) return () => {}
  attached = true

  let state: 'IDLE' | 'HOVER' | 'LOCKED' | 'AWAIT_CONFIRM' | 'PAUSED' = 'IDLE'
  let hovered: TargetDescriptor | null = null
  let locked: (TargetDescriptor & { risk: boolean }) | null = null
  let pendingVerb: 'click' | 'open' | null = null
  let lockTimer: ReturnType<typeof setTimeout> | null = null

  const clearTimer = () => {
    if (lockTimer !== null) clearTimeout(lockTimer)
    lockTimer = null
  }

  const publish = (message: string) => {
    bus.emit('SHIELD_STATE_CHANGED', {
      state,
      targetId: locked?.id ?? hovered?.id ?? null,
      targetName: locked?.name ?? hovered?.name ?? null,
      risk: locked?.risk ?? false,
      message,
    })
  }

  const clearLock = (message = 'Target cleared.') => {
    clearTimer()
    locked = null
    pendingVerb = null
    state = hovered ? 'HOVER' : 'IDLE'
    bus.emit('TARGET_CLEARED')
    publish(message)
  }

  const execute = (verb: 'click' | 'open') => {
    if (!locked) {
      bus.emit('ACTION_BLOCKED', { id: 'shield', reason: 'no-target-locked' })
      publish('Lock a target before acting.')
      return
    }
    const targetId = locked.id
    bus.emit('TARGET_EXECUTE_REQUESTED', { id: targetId })
    clearLock(`${verb === 'open' ? 'Opened' : 'Activated'} ${locked?.name ?? 'target'}.`)
  }

  const offSnapped = bus.on('TARGET_SNAPPED', (target) => {
    hovered = target
    if (state !== 'PAUSED' && !locked) state = 'HOVER'
    publish('Target in range.')
  })
  const offLock = bus.on('TARGET_LOCKED', (target) => {
    if (state === 'PAUSED') {
      bus.emit('ACTION_BLOCKED', { id: target.id, reason: 'paused' })
      return
    }
    clearTimer()
    locked = target
    pendingVerb = null
    state = 'LOCKED'
    lockTimer = setTimeout(() => clearLock('Target lock expired after 5 seconds.'), LOCK_TIMEOUT_MS)
    publish(target.risk ? 'Risky target locked. Say a voice action, then confirm.' : 'Target locked.')
  })
  const offCleared = bus.on('TARGET_CLEARED', () => {
    clearTimer()
    locked = null
    pendingVerb = null
    if (state !== 'PAUSED') state = hovered ? 'HOVER' : 'IDLE'
    publish(state === 'PAUSED' ? 'Paused.' : 'Target cleared.')
  })
  const offVoice = bus.on('VOICE_ACTION_REQUESTED', ({ verb }) => {
    if (state === 'PAUSED') {
      bus.emit('ACTION_BLOCKED', { id: 'shield', reason: 'paused' })
      return
    }
    if (verb === 'this') {
      if (!hovered) {
        bus.emit('ACTION_BLOCKED', { id: 'shield', reason: 'no-hovered-target' })
        publish('No target is currently hovered.')
        return
      }
      bus.emit('TARGET_LOCK_REQUESTED', { id: hovered.id })
      return
    }
    if (verb === 'cancel' || verb === 'not-that-one') {
      if (locked) bus.emit('TARGET_ALTERNATIVES_REQUESTED', { targetId: locked.id })
      clearLock(verb === 'not-that-one' ? 'Cancelled. Numbered alternatives are shown.' : 'Cancelled.')
      return
    }
    if (verb === 'type-here') {
      const targetId = locked && ['input', 'textarea'].includes(locked.tagName)
        ? locked.id
        : null
      if (!targetId) {
        const active = document.activeElement
        if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) {
          bus.emit('ACTION_BLOCKED', { id: 'shield', reason: 'focused-target-is-not-text' })
          publish('Focus a text field before typing.')
          return
        }
      }
      if (locked && !targetId) {
        bus.emit('ACTION_BLOCKED', { id: 'shield', reason: 'locked-target-is-not-a-text-input' })
        publish('The locked target is not a text field.')
        return
      }
      bus.emit('DICTATION_START_REQUESTED', { targetId })
      publish('Text field locked for dictation.')
      return
    }
    if (verb === 'confirm') {
      if (state !== 'AWAIT_CONFIRM' || !locked?.risk || !pendingVerb) {
        bus.emit('ACTION_BLOCKED', { id: 'shield', reason: 'confirmation-not-requested' })
        publish('There is no risky action waiting for confirmation.')
        return
      }
      execute(pendingVerb)
      return
    }
    if (verb === 'click' || verb === 'open') {
      if (!locked) {
        bus.emit('ACTION_BLOCKED', { id: 'shield', reason: 'no-target-locked' })
        publish('Say “this” or wait for the dwell lock before acting.')
        return
      }
      if (locked.risk) {
        pendingVerb = verb
        state = 'AWAIT_CONFIRM'
        publish(`Risky action requested. Say “confirm” to ${verb} ${locked.name}.`)
        return
      }
      execute(verb)
    }
  })
  const offPause = bus.on('PAUSE_CHANGED', ({ paused }) => {
    if (paused) {
      clearTimer()
      locked = null
      pendingVerb = null
      state = 'PAUSED'
      bus.emit('TARGET_CLEARED')
      publish('Paused. Activation is disabled.')
    } else {
      state = hovered ? 'HOVER' : 'IDLE'
      publish('Resumed.')
    }
  })

  publish('Intent Shield ready.')
  return () => {
    clearTimer()
    offSnapped()
    offLock()
    offCleared()
    offVoice()
    offPause()
    attached = false
  }
}
