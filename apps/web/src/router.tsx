import { Outlet, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { AppShell } from './components/AppShell'
import { redirectIfSignedIn, requireAuth } from './lib/auth-guard'
import { useAuthStore } from './stores/auth-store'
import { AuthCallbackPage } from './pages/AuthCallback'
import { DubDetailPage } from './pages/DubDetail'
import { ForgotPasswordPage } from './pages/ForgotPassword'
import { LandingPage } from './pages/Landing'
import { LibraryPage } from './pages/Library'
import { LoginPage } from './pages/Login'
import { NewDubPage } from './pages/NewDub'
import { NotFoundPage } from './pages/NotFound'
import { PricingPage } from './pages/Pricing'
import { ResetPasswordPage } from './pages/ResetPassword'
import { SettingsPage } from './pages/Settings'
import { SignupPage } from './pages/Signup'
import { VideoDetailPage } from './pages/VideoDetail'

const nextSearch = z.object({ next: z.string().optional() })
const callbackSearch = z.object({ next: z.string().optional(), error_description: z.string().optional() })
const newDubSearch = z.object({ videoId: z.string().optional() })

export const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: NotFoundPage,
})

export const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: LandingPage })
export const pricingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/pricing', component: PricingPage })

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: nextSearch,
  beforeLoad: redirectIfSignedIn,
  component: LoginPage,
})
export const signupRoute = createRoute({ getParentRoute: () => rootRoute, path: '/signup', beforeLoad: redirectIfSignedIn, component: SignupPage })
export const forgotPasswordRoute = createRoute({ getParentRoute: () => rootRoute, path: '/forgot-password', component: ForgotPasswordPage })
export const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  beforeLoad: awaitAuthReady,
  component: ResetPasswordPage,
})
export const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/callback',
  validateSearch: callbackSearch,
  beforeLoad: awaitAuthReady,
  component: AuthCallbackPage,
})

export const appRoute = createRoute({ getParentRoute: () => rootRoute, path: '/app', beforeLoad: requireAuth, component: AppShell })
export const libraryRoute = createRoute({ getParentRoute: () => appRoute, path: '/', component: LibraryPage })
export const newDubRoute = createRoute({ getParentRoute: () => appRoute, path: '/new', validateSearch: newDubSearch, component: NewDubPage })
export const videoDetailRoute = createRoute({ getParentRoute: () => appRoute, path: '/videos/$videoId', component: VideoDetailPage })
export const dubDetailRoute = createRoute({ getParentRoute: () => appRoute, path: '/dubs/$dubId', component: DubDetailPage })
export const settingsRoute = createRoute({ getParentRoute: () => appRoute, path: '/settings', component: SettingsPage })

export const routeTree = rootRoute.addChildren([
  indexRoute,
  pricingRoute,
  loginRoute,
  signupRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  authCallbackRoute,
  appRoute.addChildren([libraryRoute, newDubRoute, videoDetailRoute, dubDetailRoute, settingsRoute]),
])

async function awaitAuthReady(): Promise<void> {
  await useAuthStore.getState().whenReady()
}

export function createAppRouter() {
  return createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
