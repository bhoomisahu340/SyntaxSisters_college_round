import { bus } from '../bus.ts'
import type { TargetDescriptor } from '../events.ts'

export type TargetSnapshot = TargetDescriptor

type ScannedTarget = {
  element: HTMLElement
  snapshot: TargetSnapshot
}

const SELECTOR = 'a, button, input, select, textarea, [role="button"]'
const elementIds = new WeakMap<Element, string>()
let nextElementId = 1

function getElementId(element: Element): string {
  let id = elementIds.get(element)
  if (!id) {
    id = `dom-target-${nextElementId++}`
    elementIds.set(element, id)
  }
  return id
}

function accessibleName(element: HTMLElement): string {
  const ariaLabel = element.getAttribute('aria-label')?.trim()
  if (ariaLabel) return ariaLabel

  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy) {
    const label = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ')
    if (label) return label
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    const labels = element.labels
      ? Array.from(element.labels, (label) => label.textContent?.trim() ?? '')
          .filter(Boolean)
          .join(' ')
      : ''
    if (labels) return labels
    const placeholder = element.getAttribute('placeholder')?.trim()
    if (placeholder) return placeholder
    if (element instanceof HTMLInputElement && element.value.trim()) return element.value.trim()
    return element instanceof HTMLInputElement
      ? `${element.type || 'text'} field`
      : element instanceof HTMLTextAreaElement
        ? 'text area'
        : 'selection list'
  }

  const text = element.innerText?.trim() || element.textContent?.trim()
  if (text) return text.replace(/\s+/g, ' ')

  const imageAlt = element.querySelector('img[alt]')?.getAttribute('alt')?.trim()
  if (imageAlt) return imageAlt

  const title = element.getAttribute('title')?.trim()
  if (title) return title

  return element instanceof HTMLButtonElement ? 'button' : 'link'
}

function isAvailable(
  element: HTMLElement,
  overlays: readonly HTMLElement[],
): boolean {
  if (!element.isConnected || element.matches(':disabled')) return false
  if (element.getAttribute('aria-disabled') === 'true') return false
  if (element.closest('[aria-hidden="true"]')) return false
  if (element.closest('[data-target-ignore]')) return false
  const style = window.getComputedStyle(element)
  const rect = element.getBoundingClientRect()
  const visible =
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    Number(style.opacity) !== 0 &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  if (!visible) return false

  return !overlays.some((overlay) => {
    const overlayRect = overlay.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    return (
      centerX >= overlayRect.left &&
      centerX <= overlayRect.right &&
      centerY >= overlayRect.top &&
      centerY <= overlayRect.bottom
    )
  })
}

function scan(): ScannedTarget[] {
  const overlays = Array.from(
    document.querySelectorAll<HTMLElement>('[data-target-occluder]'),
  ).filter((overlay) => window.getComputedStyle(overlay).position === 'fixed')

  return Array.from(document.querySelectorAll<HTMLElement>(SELECTOR))
    .filter((element) => isAvailable(element, overlays))
    .map((element) => {
      const rect = element.getBoundingClientRect()
      return {
        element,
        snapshot: {
          id: getElementId(element),
          number: 0,
          name: accessibleName(element),
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          tagName: element.tagName.toLowerCase(),
          inputType: element instanceof HTMLInputElement ? element.type : '',
          formText: element.closest('form')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          href: element instanceof HTMLAnchorElement ? element.href : '',
        },
      }
    })
    .sort((first, second) => {
      const firstCenter = first.snapshot.top + first.snapshot.height / 2
      const secondCenter = second.snapshot.top + second.snapshot.height / 2
      const verticalDifference = firstCenter - secondCenter
      return Math.abs(verticalDifference) > 8
        ? verticalDifference
        : first.snapshot.left - second.snapshot.left
    })
    .map((target, index) => ({
      ...target,
      snapshot: { ...target.snapshot, number: index + 1 },
    }))
}

function publishTargets(): ScannedTarget[] {
  const current = scan()
  bus.emit('TARGETS_UPDATED', {
    targets: current.map(({ snapshot }) => snapshot),
  })
  return current
}

export function startTargetScanner(): () => void {
  let frame: number | null = null
  const scheduleScan = () => {
    if (frame !== null) return
    frame = window.requestAnimationFrame(() => {
      frame = null
      publishTargets()
    })
  }

  const observer = new MutationObserver(scheduleScan)
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      'aria-disabled',
      'aria-hidden',
      'aria-label',
      'aria-labelledby',
      'class',
      'disabled',
      'hidden',
      'placeholder',
      'style',
      'title',
    ],
  })

  window.addEventListener('scroll', scheduleScan, true)
  window.addEventListener('resize', scheduleScan)
  document.addEventListener('load', scheduleScan, true)
  const offSelect = bus.on('TARGET_ACTIVATE_REQUESTED', ({ number, verb }) => {
    try {
      const target = publishTargets().find((item) => item.snapshot.number === number)
      if (!target) {
        bus.emit('ACTION_BLOCKED', { id: `number-${number}`, reason: 'target-not-found' })
        return
      }
      bus.emit('TARGET_SELECTED_BY_NUMBER', { id: target.snapshot.id, verb })
    } catch {
      bus.emit('ACTION_BLOCKED', { id: `number-${number}`, reason: 'activation-failed' })
    }
  })
  const offExecute = bus.on('TARGET_EXECUTE_REQUESTED', ({ id }) => {
    try {
      const target = publishTargets().find((item) => item.snapshot.id === id)
      if (!target) {
        bus.emit('ACTION_BLOCKED', { id, reason: 'target-not-found' })
        return
      }
      target.element.click()
      bus.emit('ACTION_EXECUTED', {
        id,
        verb: `click: ${target.snapshot.name}`,
      })
    } catch {
      bus.emit('ACTION_BLOCKED', { id, reason: 'activation-failed' })
    }
  })
  const offDictationFocus = bus.on('DICTATION_START_REQUESTED', ({ targetId }) => {
    try {
      const active = document.activeElement
      if (targetId) {
        // Explicit target (e.g. "type here" over a locked field): resolve it from
        // a fresh scan so we act on the intended element.
        const target = scan().find((item) => item.snapshot.id === targetId)
        if (!target || !['input', 'textarea'].includes(target.snapshot.tagName)) {
          bus.emit('ACTION_BLOCKED', { id: targetId, reason: 'text-field-not-available' })
          return
        }
        target.element.focus()
        bus.emit('DICTATION_TARGET_SELECTED', {
          targetId: target.snapshot.id,
          name: target.snapshot.name,
        })
        return
      }
      // No explicit target (e.g. "enter name" / "start typing"): use the field
      // that is already focused. Do not depend on the scanner re-discovering it,
      // which can fail transiently while the page is still scrolling it into view
      // or a HUD occluder briefly overlaps it.
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        bus.emit('DICTATION_TARGET_SELECTED', {
          targetId: getElementId(active),
          name: accessibleName(active),
        })
        return
      }
      bus.emit('ACTION_BLOCKED', { id: 'dictation', reason: 'text-field-not-available' })
    } catch {
      bus.emit('ACTION_BLOCKED', { id: targetId ?? 'dictation', reason: 'focus-failed' })
    }
  })

  publishTargets()
  return () => {
    observer.disconnect()
    window.removeEventListener('scroll', scheduleScan, true)
    window.removeEventListener('resize', scheduleScan)
    document.removeEventListener('load', scheduleScan, true)
    offSelect()
    offExecute()
    offDictationFocus()
    if (frame !== null) window.cancelAnimationFrame(frame)
  }
}