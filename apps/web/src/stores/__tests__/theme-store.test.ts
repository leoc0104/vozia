import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockSystemTheme, type SystemThemeControl } from '../../test/match-media'
import { THEME_STORAGE_KEY } from '../../lib/theme'
import { initTheme, useThemeStore } from '../theme-store'

let system: SystemThemeControl

function htmlIsDark(): boolean {
  return document.documentElement.classList.contains('dark')
}

beforeEach(() => {
  localStorage.clear()
  system = mockSystemTheme(false)
  useThemeStore.setState({ preference: 'system', resolved: 'light' })
  document.documentElement.classList.remove('dark')
})

afterEach(() => {
  system.restore()
  vi.restoreAllMocks()
})

describe('theme store', () => {
  it('defaults to following the system', () => {
    system.setDark(true)
    useThemeStore.getState().syncWithSystem()
    expect(useThemeStore.getState()).toMatchObject({ preference: 'system', resolved: 'dark' })
    expect(htmlIsDark()).toBe(true)
  })

  it('applies and remembers an explicit choice', () => {
    useThemeStore.getState().setPreference('dark')
    expect(htmlIsDark()).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toContain('"preference":"dark"')
  })

  it('ignores an unknown stored preference and falls back to system', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ state: { preference: 'blue' }, version: 0 }))
    await useThemeStore.persist.rehydrate()
    expect(useThemeStore.getState().preference).toBe('system')
  })

  it('survives a stored value that is not JSON', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, '{not json')
    await expect(useThemeStore.persist.rehydrate()).resolves.toBeUndefined()
    expect(useThemeStore.getState().preference).toBe('system')
  })

  it('restores a valid stored preference', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ state: { preference: 'dark' }, version: 0 }))
    await useThemeStore.persist.rehydrate()
    expect(useThemeStore.getState()).toMatchObject({ preference: 'dark', resolved: 'dark' })
  })

  it('keeps working when storage is unavailable', () => {
    useThemeStore.getState().setPreference('dark')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is disabled', 'SecurityError')
    })
    expect(() => useThemeStore.getState().setPreference('light')).not.toThrow()
    expect(useThemeStore.getState().resolved).toBe('light')
    expect(htmlIsDark()).toBe(false)
  })

  it('follows OS changes only while on system', () => {
    const stop = initTheme()
    system.setDark(true)
    expect(htmlIsDark()).toBe(true)
    expect(useThemeStore.getState().resolved).toBe('dark')

    useThemeStore.getState().setPreference('light')
    system.setDark(false)
    system.setDark(true)
    expect(useThemeStore.getState().resolved).toBe('light')
    expect(htmlIsDark()).toBe(false)
    stop()
    expect(system.listenerCount()).toBe(0)
  })
})
