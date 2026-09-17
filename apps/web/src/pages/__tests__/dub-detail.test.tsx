import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FakeSupabase } from '../../test/fake-supabase'
import { renderApp } from '../../test/render-app'

const { fake, api } = vi.hoisted(() => ({
  fake: { current: null as FakeSupabase | null },
  api: {
    getDub: vi.fn(),
    getVideo: vi.fn(async () => ({ id: 'v1', title: 'Launch video', dubs: [] })),
    listSegments: vi.fn(async () => [
      { id: 1, dub_id: 'd1', idx: 0, start_ms: 0, end_ms: 1500, speaker: null, text: 'Hello there.', translated_text: 'Olá.' },
    ]),
    retryDub: vi.fn(async () => undefined),
    deleteDub: vi.fn(async () => undefined),
    signedUrl: vi.fn(async (_bucket: string, path: string, opts?: { download?: string }) => `https://signed.test/${path}${opts?.download ? `?download=${opts.download}` : ''}`),
  },
}))
vi.mock('../../lib/supabase', () => ({
  get supabase() {
    return fake.current
  },
}))
vi.mock('../../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../lib/api')>()), ...api }))

const baseDub = {
  id: 'd1',
  video_id: 'v1',
  owner_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  target_language: 'pt',
  voice_mode: 'clone',
  pipeline: 'staged',
  status: 'translating',
  progress: 48,
  failed_stage: null,
  error_message: null,
  detected_language: 'en',
  output_path: null,
  dubbed_audio_path: null,
  srt_original_path: null,
  srt_translated_path: null,
}

describe('DubDetailPage', () => {
  beforeEach(() => {
    api.getDub.mockReset()
    api.retryDub.mockClear()
  })

  it('shows live progress and the transcript for an in-progress dub', async () => {
    api.getDub.mockResolvedValue(baseDub)
    await renderApp('/app/dubs/d1', fake)
    expect(await screen.findByRole('heading', { name: 'Portuguese dub' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map((li) => li.dataset.state)).toEqual(['done', 'done', 'done', 'current', 'pending', 'pending'])
    expect(await screen.findByText('Olá.')).toBeInTheDocument()
    expect(screen.getByText('From English')).toBeInTheDocument()
  })

  it('explains failures and retries through the api', async () => {
    api.getDub.mockResolvedValue({ ...baseDub, status: 'failed', failed_stage: 'muxing', error_message: 'Muxing failed: Invalid data' })
    await renderApp('/app/dubs/d1', fake)
    expect(await screen.findByText('Muxing failed: Invalid data')).toBeInTheDocument()
    expect(screen.getByText(/failed while rendering video/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    await waitFor(() => expect(api.retryDub).toHaveBeenCalledWith('d1'))
  })

  it('offers downloads for a completed dub', async () => {
    api.getDub.mockResolvedValue({
      ...baseDub,
      status: 'completed',
      progress: 100,
      output_path: 'o/d1/dubbed.mp4',
      srt_original_path: 'o/d1/original.srt',
      srt_translated_path: 'o/d1/translated.srt',
    })
    await renderApp('/app/dubs/d1', fake)
    const download = await screen.findByRole('link', { name: /download video/i })
    await waitFor(() => expect(download).toHaveAttribute('href', 'https://signed.test/o/d1/dubbed.mp4?download=Launch_video-pt.mp4'))
    expect(await screen.findByRole('link', { name: /portuguese subtitles/i })).toHaveAttribute('href', 'https://signed.test/o/d1/translated.srt?download=pt.srt')
    expect(screen.queryByRole('list', { name: 'Dubbing stages' })).not.toBeInTheDocument()
  })
})
