import { bus } from '../bus.ts'

export type TargetSnapshot = {
  id: string
  number: number
  name: string
  top: number
  left: number
  width: number
  height: number
}

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
    return (
      rect.left < overlayRect.right &&
      rect.right > overlayRect.left &&
      rect.top < overlayRect.bottom &&
      rect.bottom > overlayRect.top
    )
  })
}

function scan(): ScannedTarget[] {
  const overlays = Array.from(
    document.querySelectorAll<HTMLElement>('[data-target-ignore]'),
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
  const offActivate = bus.on('TARGET_ACTIVATE_REQUESTED', ({ number, verb }) => {
    try {
      const target = publishTargets().find((item) => item.snapshot.number === number)
      if (!target) {
        bus.emit('ACTION_BLOCKED', { id: `number-${number}`, reason: 'target-not-found' })
        return
      }
      target.element.click()
      bus.emit('ACTION_EXECUTED', {
        id: target.snapshot.id,
        verb: `${verb}: ${target.snapshot.name}`,
      })
    } catch {
      bus.emit('ACTION_BLOCKED', { id: `number-${number}`, reason: 'activation-failed' })
    }
  })

  publishTargets()
  return () => {
    observer.disconnect()
    window.removeEventListener('scroll', scheduleScan, true)
    window.removeEventListener('resize', scheduleScan)
    document.removeEventListener('load', scheduleScan, true)
    offActivate()
    if (frame !== null) window.cancelAnimationFrame(frame)
  }
}