import type { TargetDescriptor } from '../events.ts'

const RISKY_ACTION = /\b(book|submit|pay|delete|send|confirm)\b/i

/**
 * Classify a target as risky using only the control's OWN identity, never the
 * text of the whole surrounding form. The previous version tested the entire
 * form's text, which marked every field on the booking page (date, time, name,
 * …) as risky because the form contains a "Confirm Appointment" button.
 *
 * Rules:
 * - Navigation links are never risky; they only change the page.
 * - A control is risky only when it is a genuine action control (a button or a
 *   submit input) whose own label commits a risky action, or a submit input.
 */
export function isRiskyTarget(target: TargetDescriptor): boolean {
  if (target.tagName === 'a') return false
  const isSubmit = target.tagName === 'input' && target.inputType === 'submit'
  const isButton = target.tagName === 'button'
  if (!isSubmit && !isButton) return false
  return isSubmit || RISKY_ACTION.test(target.name)
}
