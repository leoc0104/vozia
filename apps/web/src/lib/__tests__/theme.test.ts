import { afterEach, describe, expect, it } from 'vitest'
import { mockSystemTheme, type SystemThemeControl } from '../../test/match-media'
import { applyTheme, isThemePreference, resolveTheme, subscribeToSystemTheme, systemPrefersDark } from '../theme'

let system: SystemThemeControl | null = null

afterEach(() => {
  system?.restore()
  system = null
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = ''
})

describe('theme helpers', () => {
  it('recognises only the three preferences', () => {
    expect(isThemePreference('light')).toBe(true)
    expect(isThemePreference('dark')).toBe(true)
    expect(isThemePreference('system')).toBe(true)
    expect(isThemePreference('blue')).toBe(false)
    expect(isThemePreference(undefined)).toBe(false)
  })

  it('resolves system from the OS setting and explicit choices as-is', () => {
    system = mockSystemTheme(true)
    expect(systemPrefersDark()).toBe(true)
    expect(resolveTheme('system')).toBe('dark')
    expect(resolveTheme('light')).toBe('light')
    system.setDark(false)
    expect(resolveTheme('system')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
  })

  it('treats a browser without matchMedia as light', () => {
    const original = window.matchMedia
    // @ts-expect-error simulating an environment without matchMedia
    window.matchMedia = undefined
    expect(systemPrefersDark()).toBe(false)
    window.matchMedia = original
  })

  it('applies the resolved theme to the root element', () => {
    applyTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
    applyTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('subscribes to OS theme changes and unsubscribes', () => {
    system = mockSystemTheme(false)
    const seen: boolean[] = []
    const unsubscribe = subscribeToSystemTheme((dark) => seen.push(dark))
    expect(system.listenerCount()).toBe(1)
    system.setDark(true)
    unsubscribe()
    expect(system.listenerCount()).toBe(0)
    system.setDark(false)
    expect(seen).toEqual([true])
  })
})
