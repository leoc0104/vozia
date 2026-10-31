import { useState } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { VideoWithDubs } from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import { VideoCard } from '../VideoCard'

const video: VideoWithDubs = {
  id: 'v1',
  owner_id: 'u1',
  title: 'Product launch',
  source_type: 'upload',
  source_url: null,
  storage_path: 'u1/v1/original.mp4',
  duration_seconds: 125,
  thumbnail_path: 'u1/v1/thumb.jpg',
  created_at: '2026-09-17T00:00:00Z',
  updated_at: '2026-09-17T00:00:00Z',
  dubs: [],
}

function Harness() {
  const [url, setUrl] = useState('http://storage.test/expired.jpg')
  return (
    <>
      <button type="button" onClick={() => setUrl('http://storage.test/fresh.jpg')}>
        New url
      </button>
      <VideoCard video={video} thumbnailUrl={url} />
    </>
  )
}

describe('VideoCard thumbnail', () => {
  it('shows the thumbnail when there is one', async () => {
    const { container } = await renderWithProviders(<VideoCard video={video} thumbnailUrl="http://storage.test/thumb.jpg" />)
    expect(container.querySelector('img')).toHaveAttribute('src', 'http://storage.test/thumb.jpg')
    expect(container.querySelector('[data-levels]')).not.toBeInTheDocument()
  })

  it('shows a voiceprint when the video has no thumbnail yet', async () => {
    const { container } = await renderWithProviders(<VideoCard video={video} />)
    expect(container.querySelector('img')).not.toBeInTheDocument()
    expect(container.querySelector('[data-levels]')).toBeInTheDocument()
  })

  it('replaces a thumbnail that fails to load, instead of showing a broken image', async () => {
    const { container } = await renderWithProviders(<VideoCard video={video} thumbnailUrl="http://storage.test/broken.jpg" />)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')).not.toBeInTheDocument()
    expect(container.querySelector('[data-levels]')).toBeInTheDocument()
  })

  it('tries again when a new url arrives', async () => {
    const { container } = await renderWithProviders(<Harness />)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'New url' }))
    expect(container.querySelector('img')).toHaveAttribute('src', 'http://storage.test/fresh.jpg')
  })
})
