import { isRedirect } from '@tanstack/react-router'
import { describe, expect, it, vi } from 'vitest'
import { redirectIfSignedIn, requireAuth, safeNext } from '../auth-guard'
import { useAuthStore } from '../../stores/auth-store'

function ready(status: 'signed_in' | 'signed_out') {
  vi.spyOn(useAuthStore.getState(), 'whenReady').mockResolvedValue({ ...useAuthStore.getState(), status })
}

async function thrownBy(fn: () => Promise<void>): Promise<unknown> {
  try {
    await fn()
  } catch (error) {
    return error
  }
  return null
}

describe('route guards', () => {
  it('sends signed-out visitors to login with the requested location', async () => {
    ready('signed_out')
    const thrown = await thrownBy(() => requireAuth({ location: { href: '/app/dubs/1' } }))
    expect(isRedirect(thrown)).toBe(true)
    const options = (thrown as { options: { to: string; search: { next: string } } }).options
    expect(options.to).toBe('/login')
    expect(options.search.next).toBe('/app/dubs/1')
  })

  it('lets signed-in users through and keeps them away from auth pages', async () => {
    ready('signed_in')
    expect(await thrownBy(() => requireAuth({ location: { href: '/app' } }))).toBeNull()
    const thrown = await thrownBy(() => redirectIfSignedIn())
    expect(isRedirect(thrown)).toBe(true)
    expect((thrown as { options: { to: string } }).options.to).toBe('/app')
  })

  it('only follows same-origin next targets', () => {
    expect(safeNext('/app/videos/1')).toBe('/app/videos/1')
    expect(safeNext('https://evil.example')).toBe('/app')
    expect(safeNext('//evil.example')).toBe('/app')
    expect(safeNext(undefined, '/x')).toBe('/x')
  })
})
