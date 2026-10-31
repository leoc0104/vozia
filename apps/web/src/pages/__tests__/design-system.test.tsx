import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

const TOKENS = {
  '--color-white': '#ffffff',
  '--color-gray-900': '#000000',
  '--color-brand-500': '#ff5a1f',
}

async function openSignedOut() {
  fake.current = createFakeSupabase({ session: null })
  resetAuthStoreForTests()
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ['/design-system'] }) })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  await screen.findByRole('heading', { level: 1, name: 'On Air' }, { timeout: 15_000 })
  return router
}

describe('design system page', () => {
  beforeEach(() => {
    for (const [name, value] of Object.entries(TOKENS)) document.documentElement.style.setProperty(name, value)
  })

  afterEach(() => {
    for (const name of Object.keys(TOKENS)) document.documentElement.style.removeProperty(name)
  })

  it('is open to signed-out visitors', async () => {
    const router = await openSignedOut()
    expect(router.state.location.pathname).toBe('/design-system')
  })

  it('links every navigation entry to a section on the page', async () => {
    await openSignedOut()
    const links = within(screen.getByRole('navigation', { name: 'Sections' })).getAllByRole('link')
    const targets = links.map((link) => link.getAttribute('href'))
    expect(targets).toEqual(['#concept', '#logo', '#color', '#type', '#layout', '#motion', '#icons', '#components', '#product', '#open'])
    for (const target of targets) {
      expect(document.getElementById(target!.slice(1))).toBeInTheDocument()
    }
  })

  it('reads color values from the live theme, so the page cannot drift from the tokens', async () => {
    await openSignedOut()
    expect(screen.getAllByText('#ff5a1f').length).toBeGreaterThan(0)
  })

  it('computes contrast from the live theme', async () => {
    await openSignedOut()
    const row = screen.getByRole('row', { name: /primary text/i })
    expect(within(row).getByText('21.0')).toBeInTheDocument()
  })

  it('states that the identity is still a proposal', async () => {
    await openSignedOut()
    expect(screen.getAllByText(/proposal/i).length).toBeGreaterThan(0)
  })
})
