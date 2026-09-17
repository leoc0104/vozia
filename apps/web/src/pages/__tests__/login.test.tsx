import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, fakeSession, type FakeSupabase } from '../../test/fake-supabase'
import { renderWithProviders } from '../../test/render'

const { fake } = vi.hoisted(() => ({ fake: { current: null as FakeSupabase | null } }))
vi.mock('../../lib/supabase', () => ({
  get supabase() {
    return fake.current
  },
}))

import { LoginPage } from '../Login'
import { resetAuthStoreForTests } from '../../stores/auth-store'

describe('LoginPage', () => {
  beforeEach(() => {
    fake.current = createFakeSupabase()
    resetAuthStoreForTests()
  })

  it('submits credentials and navigates to the requested page', async () => {
    const session = fakeSession()
    fake.current!.auth.signInWithPassword.mockResolvedValueOnce({ data: { session, user: session.user }, error: null } as never)
    const { router } = await renderWithProviders(<LoginPage />, { path: '/login?next=%2Fapp%2Fsettings', routePath: '/login' })
    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(fake.current!.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'alice@example.com', password: 'secret123' })
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/settings'))
  })

  it('shows the error from Supabase', async () => {
    fake.current!.auth.signInWithPassword.mockResolvedValueOnce({ data: { session: null, user: null }, error: { message: 'Invalid login credentials' } } as never)
    await renderWithProviders(<LoginPage />, { path: '/login', routePath: '/login' })
    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials')
  })

  it('starts the Google flow', async () => {
    await renderWithProviders(<LoginPage />, { path: '/login', routePath: '/login' })
    await userEvent.click(screen.getByRole('button', { name: /continue with google/i }))
    expect(fake.current!.auth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ provider: 'google' }))
  })
})
