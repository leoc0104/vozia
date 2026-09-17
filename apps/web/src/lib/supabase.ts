import { createBrowserClient } from '@vozia/db'
import { env } from './env'

/** Single browser client for the whole app (mocked in tests). */
export const supabase = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey)
