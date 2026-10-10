import type { AppEvent, EventType } from './events.ts'

type EventMap = {
  [E in AppEvent as E['type']]: E extends { payload: infer P } ? P : undefined
}

type Handler<T extends EventType> = EventMap[T] extends undefined
  ? () => void
  : (payload: EventMap[T]) => void

class EventBus {
  private readonly listeners = new Map<
    EventType,
    Set<(payload?: unknown) => void>
  >()

  on<T extends EventType>(type: T, handler: Handler<T>): () => void {
    let set = this.listeners.get(type)
    if (!set) {
      set = new Set()
      this.listeners.set(type, set)
    }
    const wrapped = handler as (payload?: unknown) => void
    set.add(wrapped)
    return () => {
      set.delete(wrapped)
    }
  }

  emit<T extends EventType>(
    type: T,
    ...args: EventMap[T] extends undefined ? [] : [payload: EventMap[T]]
  ): void {
    const set = this.listeners.get(type)
    if (!set) return
    const payload = args[0]
    for (const handler of set) {
      try {
        handler(payload)
      } catch {
        // Subscriber errors must never leave the bus.
      }
    }
  }

  clear(): void {
    this.listeners.clear()
  }
}

export const bus = new EventBus()
