import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FakeSupabase } from '../../test/fake-supabase'
import { renderApp } from '../../test/render-app'

const { fake, api } = vi.hoisted(() => ({
  fake: { current: null as FakeSupabase | null },
  api: { listVideos: vi.fn(), signedUrls: vi.fn(async () => ({})) },
}))
vi.mock('../../lib/supabase', () => ({
  get supabase() {
    return fake.current
  },
}))
vi.mock('../../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../lib/api')>()), ...api }))

describe('LibraryPage', () => {
  beforeEach(() => {
    api.listVideos.mockReset()
  })

  it('renders video cards with dub badges', async () => {
    api.listVideos.mockResolvedValue([
      {
        id: 'v1',
        title: 'Product launch',
        duration_seconds: 125,
        created_at: '2026-09-17T00:00:00Z',
        thumbnail_path: null,
        dubs: [
          { id: 'd1', target_language: 'pt', status: 'completed', progress: 100, created_at: '2026-09-17T00:00:00Z', output_path: 'x' },
          { id: 'd2', target_language: 'ja', status: 'translating', progress: 45, created_at: '2026-09-17T00:00:00Z', output_path: null },
        ],
      },
    ])
    await renderApp('/app', fake)
    expect(await screen.findByRole('heading', { name: 'Product launch' })).toBeInTheDocument()
    expect(screen.getByText('Portuguese')).toBeInTheDocument()
    expect(screen.getByText('Japanese 45%')).toBeInTheDocument()
    expect(screen.getByText(/2:05/)).toBeInTheDocument()
    expect(screen.getByText('7 min left')).toBeInTheDocument()
  })

  it('shows an empty state with a call to action', async () => {
    api.listVideos.mockResolvedValue([])
    await renderApp('/app', fake)
    expect(await screen.findByText('No videos yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /create your first dub/i })).toHaveAttribute('href', '/app/new')
  })
})
