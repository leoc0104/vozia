import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FakeSupabase } from '../../test/fake-supabase'
import { renderApp, TEST_PROFILE } from '../../test/render-app'

const { fake, api, upload } = vi.hoisted(() => ({
  fake: { current: null as FakeSupabase | null },
  api: { createVideo: vi.fn(), createDub: vi.fn(), getVideo: vi.fn(async () => null) },
  upload: { uploadSource: vi.fn(async (_opts: { file: File; objectPath: string; accessToken: string }) => undefined) },
}))
vi.mock('../../lib/supabase', () => ({
  get supabase() {
    return fake.current
  },
}))
vi.mock('../../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../lib/api')>()), ...api }))
vi.mock('../../lib/upload', () => upload)

import { InsufficientMinutesError } from '../../lib/api'

describe('NewDubPage', () => {
  beforeEach(() => {
    api.createVideo.mockReset()
    api.createDub.mockReset()
    upload.uploadSource.mockClear()
  })

  it('creates a video from a YouTube link, then the dub, and opens it', async () => {
    api.createVideo.mockResolvedValue({ id: 'v1' })
    api.createDub.mockResolvedValue({ id: 'd1' })
    const { router } = await renderApp('/app/new', fake)
    await userEvent.click(await screen.findByRole('tab', { name: 'YouTube link' }))
    await userEvent.type(screen.getByLabelText('YouTube URL'), 'https://youtu.be/dQw4w9WgXcQ')
    await userEvent.selectOptions(screen.getByLabelText('Dub into'), 'pt')
    await userEvent.click(screen.getByRole('button', { name: 'Start dubbing' }))

    await waitFor(() => expect(api.createDub).toHaveBeenCalled())
    expect(api.createVideo).toHaveBeenCalledWith({ title: 'YouTube video dQw4w9WgXcQ', sourceType: 'youtube', sourceUrl: 'https://youtu.be/dQw4w9WgXcQ', storagePath: null })
    expect(api.createDub).toHaveBeenCalledWith({ videoId: 'v1', targetLanguage: 'pt', sourceLanguage: null, voiceMode: 'clone', stockVoiceId: null })
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/dubs/d1'))
  })

  it('uploads a file to the owner folder before creating the video', async () => {
    api.createVideo.mockResolvedValue({ id: 'v2' })
    api.createDub.mockResolvedValue({ id: 'd2' })
    await renderApp('/app/new', fake)
    const file = new File(['video'], 'keynote.mp4', { type: 'video/mp4' })
    await userEvent.upload(await screen.findByLabelText('Video file'), file)
    expect(screen.getByText('keynote.mp4')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Start dubbing' }))

    await waitFor(() => expect(api.createDub).toHaveBeenCalled())
    const call = upload.uploadSource.mock.calls[0]![0]
    expect(call.file).toBe(file)
    expect(call.accessToken).toBe('access-token')
    expect(call.objectPath).toMatch(new RegExp(`^${TEST_PROFILE.id}/[0-9a-f-]{36}/original\\.mp4$`))
    expect(api.createVideo).toHaveBeenCalledWith(expect.objectContaining({ title: 'keynote', sourceType: 'upload', storagePath: call.objectPath }))
  })

  it('validates before submitting and explains exhausted minutes', async () => {
    await renderApp('/app/new', fake)
    await userEvent.click(await screen.findByRole('button', { name: 'Start dubbing' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a video file to upload.')
    expect(api.createVideo).not.toHaveBeenCalled()

    api.createVideo.mockResolvedValue({ id: 'v3' })
    api.createDub.mockRejectedValue(new InsufficientMinutesError())
    await userEvent.click(screen.getByRole('tab', { name: 'YouTube link' }))
    await userEvent.type(screen.getByLabelText('YouTube URL'), 'https://youtu.be/dQw4w9WgXcQ')
    await userEvent.click(screen.getByRole('button', { name: 'Start dubbing' }))
    expect(await screen.findByText(/used all your dubbing minutes/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See plans' })).toHaveAttribute('href', '/pricing')
  })

  it('skips the source step when adding a language to an existing video', async () => {
    api.getVideo.mockResolvedValueOnce({ id: 'v9', title: 'Existing talk', dubs: [] } as never)
    api.createDub.mockResolvedValue({ id: 'd9' })
    await renderApp('/app/new?videoId=v9', fake)
    expect(await screen.findByRole('heading', { name: 'Add a language' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Upload' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Start dubbing' }))
    await waitFor(() => expect(api.createDub).toHaveBeenCalledWith(expect.objectContaining({ videoId: 'v9' })))
    expect(api.createVideo).not.toHaveBeenCalled()
  })
})
