import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import type { ProfileRow } from '@vozia/db'
import { supabase } from '../lib/supabase'

export type AuthStatus = 'loading' | 'signed_out' | 'signed_in'

export interface AuthState {
  status: AuthStatus
  session: Session | null
  user: User | null
  profile: ProfileRow | null
  error: string | null
  /** Loads the persisted session once and keeps the store in sync with Supabase auth events. */
  init(): Promise<void>
  whenReady(): Promise<AuthState>
  refreshProfile(): Promise<void>
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string, displayName: string): Promise<{ needsConfirmation: boolean }>
  signInWithGoogle(next?: string): Promise<void>
  signOut(): Promise<void>
  requestPasswordReset(email: string): Promise<void>
  updatePassword(newPassword: string): Promise<void>
  clearError(): void
}

function origin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin
}

function fail(set: (partial: Partial<AuthState>) => void, message: string): never {
  set({ error: message })
  throw new Error(message)
}

let initPromise: Promise<void> | null = null

export const useAuthStore = create<AuthState>()((set, get) => {
  async function applySession(session: Session | null): Promise<void> {
    if (!session) {
      set({ status: 'signed_out', session: null, user: null, profile: null })
      return
    }
    set({ status: 'signed_in', session, user: session.user })
    await get().refreshProfile()
  }

  return {
    status: 'loading',
    session: null,
    user: null,
    profile: null,
    error: null,

    init() {
      initPromise ??= (async () => {
        const { data } = await supabase.auth.getSession()
        await applySession(data.session)
        supabase.auth.onAuthStateChange((_event, session) => {
          // Supabase warns against awaiting client calls inside this callback; defer them.
          setTimeout(() => void applySession(session), 0)
        })
      })()
      return initPromise
    },

    async whenReady() {
      await get().init()
      return get()
    },

    async refreshProfile() {
      const user = get().user
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      set({ profile: data ?? null })
    },

    async signIn(email, password) {
      set({ error: null })
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) fail(set, error.message)
      await applySession(data.session)
    },

    async signUp(email, password, displayName) {
      set({ error: null })
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: displayName }, emailRedirectTo: `${origin()}/auth/callback` },
      })
      if (error) fail(set, error.message)
      if (data.session) await applySession(data.session)
      return { needsConfirmation: !data.session }
    },

    async signInWithGoogle(next) {
      set({ error: null })
      const redirectTo = `${origin()}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
      if (error) fail(set, error.message)
    },

    async signOut() {
      const { error } = await supabase.auth.signOut()
      if (error) fail(set, error.message)
      await applySession(null)
    },

    async requestPasswordReset(email) {
      set({ error: null })
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/reset-password` })
      if (error) fail(set, error.message)
    },

    async updatePassword(newPassword) {
      set({ error: null })
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) fail(set, error.message)
    },

    clearError() {
      set({ error: null })
    },
  }
})

/** Test hook: forget the cached initialization so a fresh fake client is observed. */
export function resetAuthStoreForTests(): void {
  initPromise = null
  useAuthStore.setState({ status: 'loading', session: null, user: null, profile: null, error: null })
}
