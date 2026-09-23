import type { Unsubscribe } from './types'

/** The smallest listener set that can't be broken by a listener unsubscribing mid-emit. */
export class Emitter<T> {
  private listeners = new Set<(value: T) => void>()

  on(listener: (value: T) => void): Unsubscribe {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  emit(value: T): void {
    for (const listener of [...this.listeners]) listener(value)
  }
}
