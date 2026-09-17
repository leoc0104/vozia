import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FakeSupabase } from '../../test/fake-supabase'
import { renderApp } from '../../test/render-app'

const { fake, api } = vi.hoisted(() => ({
  fake: { current: null as FakeSupabase | null },
  api: { updateProfile: vi.fn(async () => undefined) },
}))
vi.mock('../../lib/supabase', () => ({
  get supabase() {
    return fake.current
  },
}))
vi.mock('../../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../lib/api')>()), ...api }))

describe('SettingsPage', () => {
  it('shows usage and saves the display name', async () => {
    await renderApp('/app/settings', fake)
    expect(await screen.findByText('of 10 minutes used')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Minutes used' })).toHaveAttribute('aria-valuenow', '30')
    const input = await screen.findByLabelText('Display name')
    await waitFor(() => expect(input).toHaveValue('Alice'))
    await userEvent.clear(input)
    await userEvent.type(input, 'Alice Doe')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith({ display_name: 'Alice Doe' }))
    expect(await screen.findByText('Profile saved.')).toBeInTheDocument()
  })
})
