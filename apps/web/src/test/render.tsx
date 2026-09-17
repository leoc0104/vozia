import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Outlet, RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { render } from '@testing-library/react'

/** Renders a component inside a real router (memory history) and a query client, at the given path. */
export async function renderWithProviders(ui: ReactNode, opts: { path?: string; routePath?: string; search?: Record<string, unknown> } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const targetRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: opts.routePath ?? '/',
    component: () => <>{ui}</>,
    validateSearch: (search: Record<string, unknown>) => search,
  })
  const catchAll = createRoute({ getParentRoute: () => rootRoute, path: '$', component: () => <div data-testid="elsewhere" /> })
  const router = createRouter({
    routeTree: rootRoute.addChildren([targetRoute, catchAll]),
    history: createMemoryHistory({ initialEntries: [opts.path ?? '/'] }),
  })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  await router.load()
  return { ...view, router, queryClient }
}
