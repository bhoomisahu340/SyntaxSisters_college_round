import { bus } from '../bus.ts'
import { WAKE_WORD } from './config.ts'

let activeField: HTMLInputElement | HTMLTextAreaElement | null = null
let previousValue = ''
let targetName = ''

function normalized(text: string): string {
  const value = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const wake = WAKE_WORD.toLowerCase()
  return value.startsWith(`${wake} `) ? value.slice(wake.length + 1).trim() : value
}

function setNativeValue(field: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = field instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  setter?.call(field, value)
  field.dispatchEvent(new Event('input', { bubbles: true }))
}

function setCaret(field: HTMLInputElement | HTMLTextAreaElement, offset: number): void {
  try {
    field.setSelectionRange(offset, offset)
  } catch {
    // Some input types, such as email, do not expose a text selection range.
  }
}

function announce(active: boolean, name = ''): void {
  bus.emit('DICTATION_STATE_CHANGED', { active, targetName: name })
  bus.emit('DICTATION_PREVIEW_CHANGED', { text: '' })
}

function stopDictation(): void {
  activeField = null
  targetName = ''
  announce(false)
}

export function isDictationActive(): boolean {
  return activeField !== null
}

export function consumeDictationUtterance(text: string): boolean {
  if (!activeField) return false
  const command = normalized(text)
  if (['pause', 'stop listening', 'resume', 'start listening'].includes(command)) {
    return false
  }
  if (command === 'stop typing') {
    stopDictation()
    return true
  }
  if (command === 'undo') {
    setNativeValue(activeField, previousValue)
    return true
  }
  if (command === 'clear') {
    previousValue = activeField.value
    setNativeValue(activeField, '')
    return true
  }
  if (command === 'delete last word') {
    const current = activeField.value
    previousValue = current
    const start = activeField.selectionStart ?? current.length
    const before = current.slice(0, start).replace(/\s*\S+\s*$/, '')
    const after = current.slice(activeField.selectionEnd ?? start)
    setNativeValue(activeField, before + after)
    setCaret(activeField, before.length)
    return true
  }
  if (command === 'new line') {
    insertText(activeField instanceof HTMLTextAreaElement ? '\n' : ' ')
    return true
  }
  insertText(text.trim())
  return true
}

function insertText(text: string): void {
  const field = activeField
  if (!field || !text) return
  previousValue = field.value
  const start = field.selectionStart ?? field.value.length
  const end = field.selectionEnd ?? start
  const next = field.value.slice(0, start) + text + field.value.slice(end)
  setNativeValue(field, next)
  const caret = start + text.length
  setCaret(field, caret)
}

export function attachDictation(): () => void {
  const offSelected = bus.on('DICTATION_TARGET_SELECTED', ({ name }) => {
    const field = document.activeElement
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) {
      bus.emit('ACTION_BLOCKED', { id: 'dictation', reason: 'focused-target-is-not-text' })
      return
    }
    if (field instanceof HTMLInputElement && !['text', 'search', 'email', 'tel', 'url'].includes(field.type)) {
      bus.emit('ACTION_BLOCKED', { id: 'dictation', reason: 'unsupported-input-type' })
      return
    }
    activeField = field
    targetName = name
    previousValue = field.value
    announce(true, targetName)
  })
  const offStop = bus.on('DICTATION_STOP_REQUESTED', stopDictation)
  const offPause = bus.on('PAUSE_CHANGED', ({ paused }) => {
    if (paused) stopDictation()
  })
  const offClear = bus.on('FACE_LOST', () => {
    if (activeField && !activeField.isConnected) stopDictation()
  })

  return () => {
    offSelected()
    offStop()
    offPause()
    offClear()
    stopDictation()
  }
}