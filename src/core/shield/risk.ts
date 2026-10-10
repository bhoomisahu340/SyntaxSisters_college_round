import type { TargetDescriptor } from '../events.ts'

const RISKY_ACTION = /\b(book|submit|pay|delete|send|confirm)\b/i

export function isRiskyTarget(target: TargetDescriptor): boolean {
  if (RISKY_ACTION.test(target.name)) return true
  const isActionControl =
    target.tagName === 'button' ||
    target.tagName === 'input' && ['submit', 'button'].includes(target.inputType) ||
    target.tagName === 'a'
  return isActionControl && RISKY_ACTION.test(target.formText)
}
