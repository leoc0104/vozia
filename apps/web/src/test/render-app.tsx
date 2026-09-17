import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import type { ProfileRow } from '@vozia/db'
import { routeTree } from '../router'
import { resetAuthStoreForTests, useAuthStore } from '../stores/auth-store'
import { createFakeSupabase, fakeSession, type FakeSupabase, type QueryResponder } from './fake-supabase'

export const TEST_PROFILE: ProfileRow = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  display_name: 'Alice',
  avatar_url: null,
  minutes_quota: 10,
  minutes_used: 3,
  created_at: '2026-09-17T00:00:00Z',
  updated_at: '2026-09-17T00:00:00Z',
}

/**
 * Renders the real route tree at `path` with a signed-in user whose profile query is answered by the
 * fake client. Tests mock `lib/api` for everything else. Returns the fake so tests can inspect it.
 */
export async function renderApp(path: string, holder: { current: FakeSupabase | null }, respond?: QueryResponder) {
  const session = fakeSession({ id: TEST_PROFILE.id })
  holder.current = createFakeSupabase({
    session,
    respond: (call) => {
      if (call.table === 'profiles' && call.op === 'select') return { data: TEST_PROFILE, error: null }
      return respond ? respond(call) : { data: call.single ? null : [], error: null }
    },
  })
  resetAuthStoreForTests()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  await router.load()
  await useAuthStore.getState().whenReady()
  return { ...view, router, queryClient, session }
}
