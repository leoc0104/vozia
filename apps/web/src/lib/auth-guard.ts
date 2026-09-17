import { redirect } from '@tanstack/react-router'
import { useAuthStore } from '../stores/auth-store'

/** `beforeLoad` for `/app/*`: bounce signed-out visitors to the login page, remembering where they were going. */
export async function requireAuth({ location }: { location: { href: string } }): Promise<void> {
  const state = await useAuthStore.getState().whenReady()
  if (state.status !== 'signed_in') {
    throw redirect({ to: '/login', search: { next: location.href } })
  }
}

/** `beforeLoad` for auth pages: signed-in users go straight to the app. */
export async function redirectIfSignedIn(): Promise<void> {
  const state = await useAuthStore.getState().whenReady()
  if (state.status === 'signed_in') {
    throw redirect({ to: '/app' })
  }
}

/** Only allow same-origin relative targets for post-login redirects. */
export function safeNext(next: string | undefined, fallback = '/app'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback
  return next
}
