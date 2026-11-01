import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { routeTree } from '../../router'
import { resetAuthStoreForTests } from '../../stores/auth-store'
import { createFakeSupabase, type FakeSupabase } from '../../test/fake-supabase'

const { fake } = vi.hoisted(() => ({ fake: { current: null as FakeSupabase | null } }))
vi.mock('../../lib/supabase', () => ({
  get supabase() {
    return fake.current
  },
}))

vi.setConfig({ testTimeout: 20_000 })

async function openSignedOut() {
  fake.current = createFakeSupabase({ session: null })
  resetAuthStoreForTests()
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ['/design-system/next'] }) })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Same Voice' }, { timeout: 15_000 })
  return router
}

function expectNavigationToResolve() {
  const links = within(screen.getByRole('navigation', { name: 'Sections' })).getAllByRole('link')
  expect(links.length).toBeGreaterThan(3)
  for (const link of links) {
    expect(document.getElementById(link.getAttribute('href')!.slice(1))).toBeInTheDocument()
  }
}

describe('next design system page', () => {
  it('is open to signed-out visitors', async () => {
    const router = await openSignedOut()
    expect(router.state.location.pathname).toBe('/design-system/next')
  })

  it('opens on the comparison, showing both versions side by side', async () => {
    await openSignedOut()
    expect(screen.getByRole('button', { name: 'Comparison' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByText('Before').length).toBeGreaterThan(3)
    expect(screen.getAllByText('After').length).toBeGreaterThan(3)
    expect(screen.getAllByText('Before').length).toBe(screen.getAllByText('After').length)
  })

  it('After shows only the new system', async () => {
    await openSignedOut()
    await userEvent.click(screen.getByRole('button', { name: 'After' }))
    expect(screen.getByRole('button', { name: 'After' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { level: 2, name: 'Still open' })).toBeInTheDocument()
    // Only the view switch itself still says "Before".
    expect(screen.getAllByText('Before')).toHaveLength(1)
    expect(screen.queryByRole('heading', { name: 'Why orange' })).not.toBeInTheDocument()
  })

  it('Before shows the current system, the same one the app uses today', async () => {
    await openSignedOut()
    await userEvent.click(screen.getByRole('button', { name: 'Before' }))
    expect(screen.getByRole('heading', { level: 1, name: 'On Air' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Why orange' })).toBeInTheDocument()
    expect(document.querySelector('.system-next')).not.toBeInTheDocument()
  })

  it('links every navigation entry to a section, in every view', async () => {
    await openSignedOut()
    expectNavigationToResolve()
    await userEvent.click(screen.getByRole('button', { name: 'After' }))
    expectNavigationToResolve()
    await userEvent.click(screen.getByRole('button', { name: 'Before' }))
    expectNavigationToResolve()
  })

  it('never applies the new colors to the document itself', async () => {
    await openSignedOut()
    expect(document.documentElement).not.toHaveClass('system-next')
    expect(document.body).not.toHaveClass('system-next')
  })

  it('switches the voice in the player without changing the moment', async () => {
    await openSignedOut()
    await userEvent.click(screen.getByRole('button', { name: 'After' }))
    const switcher = screen.getByRole('group', { name: 'Voice track' })
    const original = within(switcher).getByRole('button', { name: /Original/ })
    expect(original).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(original)
    expect(original).toHaveAttribute('aria-pressed', 'true')
    expect(within(switcher).getByRole('button', { name: /Dub/ })).toHaveAttribute('aria-pressed', 'false')
  })
})
