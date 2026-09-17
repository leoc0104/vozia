import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types.js'

export type VoziaClient = SupabaseClient<Database>

function assertConfig(url: string, key: string, keyName: string): void {
  if (!url) throw new Error('Supabase URL is required')
  if (!key) throw new Error(`Supabase ${keyName} is required`)
}

/** Browser client: PKCE flow, persisted session, handles the OAuth callback URL. */
export function createBrowserClient(url: string, anonKey: string): VoziaClient {
  assertConfig(url, anonKey, 'anon key')
  return createClient<Database>(url, anonKey, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
}

/** Server client for the worker: service role, no session handling. */
export function createServiceClient(url: string, serviceRoleKey: string): VoziaClient {
  assertConfig(url, serviceRoleKey, 'service role key')
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
