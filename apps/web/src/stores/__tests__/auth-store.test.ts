import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, fakeSession, type FakeSupabase } from '../../test/fake-supabase'

const { fake } = vi.hoisted(() => ({ fake: { current: null as FakeSupabase | null } }))
vi.mock('../../lib/supabase', () => ({
  get supabase() {
    return fake.current
  },
}))

import { resetAuthStoreForTests, useAuthStore } from '../auth-store'

describe('auth store', () => {
  beforeEach(() => {
    fake.current = createFakeSupabase()
    resetAuthStoreForTests()
  })

  it('starts signed out when there is no persisted session', async () => {
    const state = await useAuthStore.getState().whenReady()
    expect(state.status).toBe('signed_out')
    expect(fake.current!.auth.getSession).toHaveBeenCalledTimes(1)
    await useAuthStore.getState().whenReady()
    expect(fake.current!.auth.getSession).toHaveBeenCalledTimes(1)
  })

  it('restores a persisted session and loads the profile', async () => {
    const session = fakeSession()
    fake.current!.setSession(session)
    fake.current!.setResponder(() => ({ data: { id: session.user.id, display_name: 'Alice', minutes_quota: 10, minutes_used: 3 }, error: null }))
    const state = await useAuthStore.getState().whenReady()
    expect(state.status).toBe('signed_in')
    expect(state.user?.email).toBe('alice@example.com')
    expect(state.profile?.display_name).toBe('Alice')
    expect(fake.current!.calls[0]).toMatchObject({ table: 'profiles', op: 'select', single: true, filters: [{ kind: 'eq', column: 'id', value: session.user.id }] })
  })

  it('signs in with a password and surfaces failures', async () => {
    await useAuthStore.getState().whenReady()
    const session = fakeSession()
    fake.current!.auth.signInWithPassword.mockResolvedValueOnce({ data: { session, user: session.user }, error: null } as never)
    await useAuthStore.getState().signIn('alice@example.com', 'secret123')
    expect(useAuthStore.getState().status).toBe('signed_in')
    expect(fake.current!.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'alice@example.com', password: 'secret123' })

    fake.current!.auth.signInWithPassword.mockResolvedValueOnce({ data: { session: null, user: null }, error: { message: 'Invalid login credentials' } } as never)
    await expect(useAuthStore.getState().signIn('alice@example.com', 'nope')).rejects.toThrow('Invalid login credentials')
    expect(useAuthStore.getState().error).toBe('Invalid login credentials')
  })

  it('reports when signup needs email confirmation and signs out cleanly', async () => {
    await useAuthStore.getState().whenReady()
    const result = await useAuthStore.getState().signUp('bob@example.com', 'secret123', 'Bob')
    expect(result.needsConfirmation).toBe(true)
    expect(fake.current!.auth.signUp).toHaveBeenCalledWith({
      email: 'bob@example.com',
      password: 'secret123',
      options: { data: { full_name: 'Bob' }, emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    fake.current!.emitAuth('SIGNED_IN', fakeSession({ email: 'bob@example.com' }))
    await vi.waitFor(() => expect(useAuthStore.getState().status).toBe('signed_in'))
    await useAuthStore.getState().signOut()
    expect(useAuthStore.getState()).toMatchObject({ status: 'signed_out', user: null, profile: null })
  })

  it('starts the Google flow with a callback that remembers the destination', async () => {
    await useAuthStore.getState().signInWithGoogle('/app/dubs/1')
    expect(fake.current!.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=%2Fapp%2Fdubs%2F1` },
    })
    await useAuthStore.getState().requestPasswordReset('a@b.c')
    expect(fake.current!.auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.c', { redirectTo: `${window.location.origin}/reset-password` })
  })
})
