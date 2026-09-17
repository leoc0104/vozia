import { readEnv } from '../env'

describe('readEnv', () => {
  it('reads the supabase settings', () => {
    expect(readEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' }, 'production')).toEqual({
      supabaseUrl: 'https://x.supabase.co',
      supabaseAnonKey: 'k',
    })
  })

  it('falls back to placeholders only in test mode', () => {
    expect(readEnv({}, 'test').supabaseAnonKey).toBe('test-anon-key')
    expect(() => readEnv({}, 'production')).toThrow(/VITE_SUPABASE_URL/)
  })
})
