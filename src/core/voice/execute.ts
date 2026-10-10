import { bus } from '../bus.ts'
import { matchCommand, type VoiceCommandId } from './registry.ts'

const SCROLL_PX = 420

let paused = false
let attached = false

function run(id: VoiceCommandId): void {
  switch (id) {
    case 'scroll-up':
      window.scrollBy({ top: -SCROLL_PX, behavior: 'smooth' })
      break
    case 'scroll-down':
      window.scrollBy({ top: SCROLL_PX, behavior: 'smooth' })
      break
    case 'go-back':
      window.history.back()
      break
    case 'go-forward':
      window.history.forward()
      break
    case 'new-tab':
    case 'next-tab':
    case 'close-tab':
      break
    case 'pause':
      if (!paused) bus.emit('PAUSE_CHANGED', { paused: true })
      break
    case 'resume':
      if (paused) bus.emit('PAUSE_CHANGED', { paused: false })
      break
  }
  bus.emit('ACTION_EXECUTED', { id: 'voice', verb: id })
}

export function attachVoiceCommands(): () => void {
  if (attached) return () => {}
  attached = true

  const offPause = bus.on('PAUSE_CHANGED', (payload) => {
    paused = payload.paused
  })

  const offFinal = bus.on('VOICE_FINAL', ({ text }) => {
    try {
      const command = matchCommand(text)
      if (!command) return
      if (paused && command !== 'resume') {
        bus.emit('ACTION_BLOCKED', { id: 'voice', reason: 'paused' })
        return
      }
      run(command)
    } catch {
      // Never escape the speech pipeline.
    }
  })

  return () => {
    offPause()
    offFinal()
    attached = false
  }
}
