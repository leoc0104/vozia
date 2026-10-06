import { vi } from 'vitest'

export interface SystemThemeControl {
  /** Changes the OS setting and notifies every `change` listener, like a real media query. */
  setDark(dark: boolean): void
  listenerCount(): number
  restore(): void
}

type Listener = (event: MediaQueryListEvent) => void

/** Replaces `window.matchMedia` with a fake whose `(prefers-color-scheme: dark)` answer the test controls. */
export function mockSystemTheme(initialDark: boolean): SystemThemeControl {
  const original = window.matchMedia
  let dark = initialDark
  const listeners = new Set<Listener>()

  window.matchMedia = vi.fn((query: string) => ({
    get matches() {
      return query === '(prefers-color-scheme: dark)' ? dark : false
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
    addListener: (listener: Listener) => listeners.add(listener),
    removeListener: (listener: Listener) => listeners.delete(listener),
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia

  return {
    setDark(next) {
      dark = next
      for (const listener of [...listeners]) listener({ matches: next } as MediaQueryListEvent)
    },
    listenerCount: () => listeners.size,
    restore() {
      window.matchMedia = original
    },
  }
}
