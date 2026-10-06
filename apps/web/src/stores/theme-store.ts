import { create } from 'zustand'
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware'
import {
  THEME_STORAGE_KEY,
  applyTheme,
  isThemePreference,
  resolveTheme,
  subscribeToSystemTheme,
  type ResolvedTheme,
  type ThemePreference,
} from '../lib/theme'

interface PersistedTheme {
  preference: ThemePreference
}

export interface ThemeState extends PersistedTheme {
  resolved: ResolvedTheme
  setPreference(preference: ThemePreference): void
  /** Re-reads the OS setting; only has an effect while the preference is `system`. */
  syncWithSystem(): void
}

// Private browsing or blocked storage throws on access; the theme must still work without it.
const safeLocalStorage: PersistStorage<PersistedTheme> = {
  getItem(name) {
    try {
      const raw = localStorage.getItem(name)
      return raw ? (JSON.parse(raw) as StorageValue<PersistedTheme>) : null
    } catch {
      return null
    }
  },
  setItem(name, value) {
    try {
      localStorage.setItem(name, JSON.stringify(value))
    } catch {
      // storage unavailable: keep the choice for this page only
    }
  },
  removeItem(name) {
    try {
      localStorage.removeItem(name)
    } catch {
      // storage unavailable
    }
  },
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      preference: 'system',
      resolved: resolveTheme('system'),
      setPreference(preference) {
        const resolved = resolveTheme(preference)
        set({ preference, resolved })
        applyTheme(resolved)
      },
      syncWithSystem() {
        if (get().preference !== 'system') return
        const resolved = resolveTheme('system')
        set({ resolved })
        applyTheme(resolved)
      },
    }),
    {
      name: THEME_STORAGE_KEY,
      storage: safeLocalStorage,
      partialize: (state) => ({ preference: state.preference }),
      merge(persisted, current) {
        const preference = (persisted as Partial<PersistedTheme> | undefined)?.preference
        if (!isThemePreference(preference)) return current
        return { ...current, preference, resolved: resolveTheme(preference) }
      },
    },
  ),
)

/** Applies the stored theme and keeps `system` in sync with the OS. Returns the unsubscribe function. */
export function initTheme(): () => void {
  const { preference } = useThemeStore.getState()
  const resolved = resolveTheme(preference)
  useThemeStore.setState({ resolved })
  applyTheme(resolved)
  return subscribeToSystemTheme(() => useThemeStore.getState().syncWithSystem())
}
