import { describe, expect, it } from 'vitest'
import { createBrowserClient, createServiceClient } from '../client.js'

describe('client factories', () => {
  it('rejects missing configuration with readable errors', () => {
    expect(() => createBrowserClient('', 'key')).toThrow('Supabase URL is required')
    expect(() => createBrowserClient('https://x.supabase.co', '')).toThrow('Supabase anon key is required')
    expect(() => createServiceClient('https://x.supabase.co', '')).toThrow('Supabase service role key is required')
  })

  it('creates typed clients', () => {
    const browser = createBrowserClient('https://x.supabase.co', 'anon')
    const service = createServiceClient('https://x.supabase.co', 'service')
    expect(typeof browser.from).toBe('function')
    expect(typeof service.storage.from).toBe('function')
  })
})
