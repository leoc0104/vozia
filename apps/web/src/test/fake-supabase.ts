import { vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'

export interface QueryCall {
  table: string
  op: 'select' | 'insert' | 'update' | 'delete'
  columns?: string
  payload?: unknown
  filters: { kind: string; column?: string; value?: unknown }[]
  single: boolean
}

export type QueryResponder = (call: QueryCall) => { data: unknown; error: { message: string; code?: string } | null }

/**
 * A hand-rolled double for the slice of supabase-js the app uses: auth, PostgREST query builder
 * (thenable chain), rpc, storage signed urls and realtime channels.
 */
export function createFakeSupabase(opts: { session?: Session | null; respond?: QueryResponder } = {}) {
  const listeners: ((event: string, session: Session | null) => void)[] = []
  const state = { session: opts.session ?? null }
  const calls: QueryCall[] = []
  let respond: QueryResponder = opts.respond ?? ((call) => ({ data: call.single ? null : [], error: null }))

  const builder = (table: string) => {
    const call: QueryCall = { table, op: 'select', filters: [], single: false }
    const api: Record<string, unknown> = {}
    const chain = (fn: () => void) => () => {
      fn()
      return api
    }
    Object.assign(api, {
      select: (columns?: string) => {
        if (call.op === 'select') call.columns = columns
        return api
      },
      insert: (payload: unknown) => {
        call.op = 'insert'
        call.payload = payload
        return api
      },
      update: (payload: unknown) => {
        call.op = 'update'
        call.payload = payload
        return api
      },
      delete: () => {
        call.op = 'delete'
        return api
      },
      eq: (column: string, value: unknown) => {
        call.filters.push({ kind: 'eq', column, value })
        return api
      },
      in: (column: string, value: unknown) => {
        call.filters.push({ kind: 'in', column, value })
        return api
      },
      order: chain(() => call.filters.push({ kind: 'order' })),
      limit: chain(() => call.filters.push({ kind: 'limit' })),
      single: () => {
        call.single = true
        return api
      },
      maybeSingle: () => {
        call.single = true
        return api
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        calls.push(call)
        return Promise.resolve(respond(call)).then(resolve, reject)
      },
    })
    return api
  }

  const storageBucket = {
    createSignedUrl: vi.fn(async (path: string) => ({ data: { signedUrl: `https://signed.test/${path}` }, error: null })),
    createSignedUrls: vi.fn(async (paths: string[]) => ({
      data: paths.map((path) => ({ path, signedUrl: `https://signed.test/${path}`, error: null })),
      error: null,
    })),
    remove: vi.fn(async () => ({ data: [], error: null })),
  }

  const channel = {
    on: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(async () => 'ok'),
    handlers: [] as { table: string; cb: (payload: unknown) => void }[],
  }
  channel.on.mockImplementation((_type: string, filter: { table: string }, cb: (payload: unknown) => void) => {
    channel.handlers.push({ table: filter.table, cb })
    return channel
  })
  channel.subscribe.mockImplementation(() => channel)

  const fake = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: state.session }, error: null })),
      onAuthStateChange: vi.fn((cb: (event: string, session: Session | null) => void) => {
        listeners.push(cb)
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      }),
      signInWithPassword: vi.fn(async () => ({ data: { session: state.session, user: state.session?.user ?? null }, error: null })),
      signUp: vi.fn(async () => ({ data: { session: null, user: null }, error: null })),
      signInWithOAuth: vi.fn(async () => ({ data: { url: 'https://accounts.google.com/x', provider: 'google' }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
      resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
      updateUser: vi.fn(async () => ({ data: { user: state.session?.user ?? null }, error: null })),
    },
    from: vi.fn((table: string) => builder(table)),
    rpc: vi.fn(async () => ({ data: null, error: null })),
    storage: { from: vi.fn(() => storageBucket) },
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(async () => 'ok'),
    // test controls
    calls,
    storageBucket,
    realtime: channel,
    setSession(session: Session | null) {
      state.session = session
    },
    emitAuth(event: string, session: Session | null) {
      state.session = session
      for (const cb of listeners) cb(event, session)
    },
    setResponder(next: QueryResponder) {
      respond = next
    },
  }
  return fake
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>

export function fakeSession(overrides: { id?: string; email?: string } = {}): Session {
  const id = overrides.id ?? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  return {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id,
      aud: 'authenticated',
      role: 'authenticated',
      email: overrides.email ?? 'alice@example.com',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-09-17T00:00:00Z',
    },
  } as Session
}
