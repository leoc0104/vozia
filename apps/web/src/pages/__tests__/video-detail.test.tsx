import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FakeSupabase } from '../../test/fake-supabase'
import { renderApp } from '../../test/render-app'

const video = {
  id: 'v1',
  owner_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  title: 'Launch video',
  source_type: 'youtube',
  source_url: 'https://youtu.be/dQw4w9WgXcQ',
  storage_path: null,
  duration_seconds: 125,
  thumbnail_path: null,
  created_at: '2026-09-17T00:00:00Z',
  updated_at: '2026-09-17T00:00:00Z',
  dubs: [{ id: 'd1', target_language: 'pt', status: 'completed', progress: 100, created_at: '2026-09-17T00:00:00Z', output_path: 'o/d1/dubbed.mp4' }],
}

const { fake, api } = vi.hoisted(() => ({
  fake: { current: null as FakeSupabase | null },
  api: {
    getVideo: vi.fn(),
    deleteVideo: vi.fn(async () => undefined),
    listVideos: vi.fn(async () => []),
    signedUrl: vi.fn(async (_bucket: string, path: string) => `https://signed.test/${path}`),
  },
}))
vi.mock('../../lib/supabase', () => ({
  get supabase() {
    return fake.current
  },
}))
vi.mock('../../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../lib/api')>()), ...api }))

describe('VideoDetailPage', () => {
  beforeEach(() => {
    api.getVideo.mockReset()
    api.getVideo.mockResolvedValue(video)
    api.deleteVideo.mockClear()
  })

  it('lists the dubs and links to adding another language', async () => {
    await renderApp('/app/videos/v1', fake)
    expect(await screen.findByRole('heading', { name: 'Launch video' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /add language/i })).toHaveAttribute('href', '/app/new?videoId=v1')
    expect(screen.getByText('Portuguese')).toBeInTheDocument()
  })

  it('asks before deleting the video and returns to the library', async () => {
    const { router } = await renderApp('/app/videos/v1', fake)
    await userEvent.click(await screen.findByRole('button', { name: /delete/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete this video?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(api.deleteVideo).toHaveBeenCalledWith(expect.objectContaining({ id: 'v1' })))
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'))
  })

  it('does nothing when the deletion is cancelled', async () => {
    await renderApp('/app/videos/v1', fake)
    await userEvent.click(await screen.findByRole('button', { name: /delete/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete this video?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.deleteVideo).not.toHaveBeenCalled()
  })
})
