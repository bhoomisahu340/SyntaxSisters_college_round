import { bus } from '../bus.ts'
import { consumeDictationUtterance } from './dictation.ts'
import {
  matchCommand,
  matchDynamicCommand,
  matchNumberCommand,
  type VoiceCommandId,
} from './registry.ts'

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
    case 'book-appointment':
    case 'go-to-appointments':
      window.location.hash = '#/booking'
      break
    case 'go-to-shop':
      window.location.hash = '#/shop'
      break
    case 'go-home':
      window.location.hash = '#/'
      break
    case 'explore-shop':
      window.location.hash = '#/shop'
      break
    case 'recenter':
      bus.emit('CALIBRATION_RECENTER_REQUESTED')
      break
    case 'show-numbers':
      bus.emit('TARGETS_VISIBILITY_CHANGED', { visible: true })
      break
    case 'hide-numbers':
      bus.emit('TARGETS_VISIBILITY_CHANGED', { visible: false })
      break
    case 'show-all-products':
      bus.emit('SHOP_CATEGORY_REQUESTED', { category: 'All' })
      break
    case 'show-accessibility-products':
      bus.emit('SHOP_CATEGORY_REQUESTED', { category: 'Accessibility' })
      break
    case 'show-technology-products':
      bus.emit('SHOP_CATEGORY_REQUESTED', { category: 'Technology' })
      break
    case 'show-daily-living-products':
      bus.emit('SHOP_CATEGORY_REQUESTED', { category: 'Daily Living' })
      break
    case 'show-wellness-products':
      bus.emit('SHOP_CATEGORY_REQUESTED', { category: 'Wellness' })
      break
    case 'show-doctors':
      bus.emit('BOOKING_VOICE_ACTION_REQUESTED', { action: 'show-doctors' })
      break
    case 'choose-date':
      bus.emit('BOOKING_VOICE_ACTION_REQUESTED', { action: 'choose-date' })
      break
    case 'show-slots':
      bus.emit('BOOKING_VOICE_ACTION_REQUESTED', { action: 'show-slots' })
      break
    case 'view-details':
    case 'open':
      bus.emit('VOICE_ACTION_REQUESTED', { verb: 'open' })
      break
    case 'click':
      bus.emit('VOICE_ACTION_REQUESTED', { verb: 'click' })
      break
    case 'this':
      bus.emit('VOICE_ACTION_REQUESTED', { verb: 'this' })
      break
    case 'type-here':
      bus.emit('VOICE_ACTION_REQUESTED', { verb: 'type-here' })
      break
    case 'start-typing':
      bus.emit('DICTATION_START_REQUESTED', { targetId: null })
      break
    case 'stop-typing':
      bus.emit('DICTATION_STOP_REQUESTED')
      break
    case 'confirm':
      bus.emit('VOICE_ACTION_REQUESTED', { verb: 'confirm' })
      break
    case 'ui-cancel':
      bus.emit('UI_CANCEL_REQUESTED')
      bus.emit('VOICE_ACTION_REQUESTED', { verb: 'cancel' })
      break
    case 'not-that-one':
      bus.emit('VOICE_ACTION_REQUESTED', { verb: 'not-that-one' })
      break
    case 'click-number':
    case 'open-number':
      break
    case 'new-tab':
      bus.emit('TAB_ACTION_REQUESTED', { action: 'new' })
      break
    case 'next-tab':
      bus.emit('TAB_ACTION_REQUESTED', { action: 'next' })
      break
    case 'close-tab':
      bus.emit('TAB_ACTION_REQUESTED', { action: 'close' })
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
      if (consumeDictationUtterance(text)) {
        bus.emit('VOICE_COMMAND_MATCHED', { text, matched: true, command: 'dictation' })
        return
      }
      const numberedCommand = matchNumberCommand(text)
      if (numberedCommand) {
        bus.emit('VOICE_COMMAND_MATCHED', {
          text,
          matched: true,
          command: numberedCommand.id,
        })
        if (paused) {
          bus.emit('ACTION_BLOCKED', { id: 'voice', reason: 'paused' })
          return
        }
        bus.emit('TARGET_ACTIVATE_REQUESTED', {
          number: numberedCommand.number,
          verb: numberedCommand.id === 'click-number' ? 'click' : 'open',
        })
        return
      }

      const command = matchCommand(text)
      const dynamicCommand = command ? null : matchDynamicCommand(text)
      const matchedCommand = command ?? dynamicCommand?.id ?? null
      bus.emit('VOICE_COMMAND_MATCHED', {
        text,
        matched: matchedCommand !== null,
        command: matchedCommand,
      })
      if (!matchedCommand) return
      if (paused && matchedCommand !== 'resume') {
        bus.emit('ACTION_BLOCKED', { id: 'voice', reason: 'paused' })
        return
      }
      if (command) {
        run(command)
      } else if (dynamicCommand) {
        switch (dynamicCommand.id) {
          case 'search':
            bus.emit('VOICE_SEARCH_REQUESTED', { query: dynamicCommand.query })
            break
          case 'open-product':
            bus.emit('SHOP_OPEN_PRODUCT_REQUESTED', { query: dynamicCommand.query })
            break
          case 'select-doctor':
            bus.emit('BOOKING_VOICE_ACTION_REQUESTED', {
              action: 'select-doctor',
              value: dynamicCommand.number,
            })
            break
          case 'select-slot':
            bus.emit('BOOKING_VOICE_ACTION_REQUESTED', {
              action: 'select-slot',
              value: dynamicCommand.number,
            })
            break
          case 'select-target':
            bus.emit('TARGET_ACTIVATE_REQUESTED', {
              number: dynamicCommand.number,
              verb: 'click',
            })
            break
        }
      }
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
