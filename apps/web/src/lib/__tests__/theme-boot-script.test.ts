import { afterEach, describe, expect, it, vi } from 'vitest'
import indexHtml from '../../../index.html?raw'
import { mockSystemTheme, type SystemThemeControl } from '../../test/match-media'

/** The inline script in index.html that sets the theme before React loads. */
function bootScript(): string {
  const match = indexHtml.match(/<script>([\s\S]*?)<\/script>/)
  if (!match) throw new Error('index.html has no inline theme script')
  return match[1]!
}

function runBootScript(): void {
  new Function(bootScript())()
}

let system: SystemThemeControl | null = null

afterEach(() => {
  system?.restore()
  system = null
  localStorage.clear()
  vi.restoreAllMocks()
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = ''
})

const isDark = () => document.documentElement.classList.contains('dark')

describe('no-flash theme script', () => {
  it('applies a stored dark preference', () => {
    system = mockSystemTheme(false)
    localStorage.setItem('vozia-theme', JSON.stringify({ state: { preference: 'dark' }, version: 0 }))
    runBootScript()
    expect(isDark()).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('keeps an explicit light preference even when the OS is dark', () => {
    system = mockSystemTheme(true)
    localStorage.setItem('vozia-theme', JSON.stringify({ state: { preference: 'light' }, version: 0 }))
    runBootScript()
    expect(isDark()).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('follows the OS when nothing is stored', () => {
    system = mockSystemTheme(true)
    runBootScript()
    expect(isDark()).toBe(true)
  })

  it('falls back to the OS for unknown or corrupted values', () => {
    system = mockSystemTheme(true)
    localStorage.setItem('vozia-theme', JSON.stringify({ state: { preference: 'blue' }, version: 0 }))
    runBootScript()
    expect(isDark()).toBe(true)
    document.documentElement.classList.remove('dark')
    localStorage.setItem('vozia-theme', '{not json')
    runBootScript()
    expect(isDark()).toBe(true)
  })

  it('follows the OS when storage throws', () => {
    system = mockSystemTheme(true)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage is disabled', 'SecurityError')
    })
    runBootScript()
    expect(isDark()).toBe(true)
  })
})
