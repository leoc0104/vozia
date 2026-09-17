import { z } from 'zod'

const EnvSchema = z.object({
  supabaseUrl: z.string().url(),
  supabaseAnonKey: z.string().min(1),
})

export type WebEnv = z.infer<typeof EnvSchema>

/** Reads the Vite environment; tests get harmless placeholders so modules can load without a project. */
export function readEnv(source: Record<string, string | undefined> = import.meta.env, mode: string = import.meta.env.MODE): WebEnv {
  const result = EnvSchema.safeParse({
    supabaseUrl: source.VITE_SUPABASE_URL,
    supabaseAnonKey: source.VITE_SUPABASE_ANON_KEY,
  })
  if (result.success) return result.data
  if (mode === 'test') return { supabaseUrl: 'http://localhost:54321', supabaseAnonKey: 'test-anon-key' }
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY; copy apps/web/.env.example to apps/web/.env and fill it in.')
}

export const env = readEnv()
