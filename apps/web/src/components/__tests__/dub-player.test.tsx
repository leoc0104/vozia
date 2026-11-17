import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { VoiceMode } from '@vozia/shared'
import { DubPlayer, type VoiceTrack } from '../DubPlayer'

const DUB = 'https://signed.test/dub.mp4'
const ORIGINAL = 'https://signed.test/original.mp4'

function Player({
  originalSrc = ORIGINAL,
  voiceMode = 'clone',
  onTime,
}: {
  originalSrc?: string | null
  voiceMode?: VoiceMode
  onTime?: (ms: number) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [track, setTrack] = useState<VoiceTrack>('dub')
  return (
    <DubPlayer
      videoRef={videoRef}
      dubSrc={DUB}
      originalSrc={originalSrc}
      dubLanguage="pt"
      originalLanguage="ja"
      voiceMode={voiceMode}
      track={track}
      onTrackChange={setTrack}
      onTime={onTime}
    />
  )
}

const video = () => document.querySelector('video')!
const playing = (element: HTMLVideoElement, value: boolean) => Object.defineProperty(element, 'paused', { configurable: true, get: () => !value })

let play: Mock<() => Promise<void>>
beforeEach(() => {
  play = vi.fn(() => Promise.resolve())
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play)
})
afterEach(() => vi.restoreAllMocks())

describe('DubPlayer', () => {
  it('plays the dub, with a switch to the original voice', () => {
    render(<Player />)
    expect(video()).toHaveAttribute('src', DUB)
    const group = screen.getByRole('group', { name: 'Voice track' })
    expect(within(group).getByRole('button', { name: 'Português Dub' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(group).getByRole('button', { name: '日本語 Original' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(/same voice, in/i)).toHaveTextContent('Same voice, in Português. Same moment, same timing.')
  })

  it('switches voice at the same moment and keeps playing', async () => {
    render(<Player />)
    const element = video()
    element.currentTime = 12.5
    playing(element, true)
    await userEvent.click(screen.getByRole('button', { name: '日本語 Original' }))
    expect(element).toHaveAttribute('src', ORIGINAL)
    expect(screen.getByRole('button', { name: '日本語 Original' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.loadedMetadata(element)
    expect(element.currentTime).toBe(12.5)
    expect(play).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/the original voice/i)).toBeInTheDocument()
  })

  it('stays paused when the switch happens on a paused video', async () => {
    render(<Player />)
    const element = video()
    element.currentTime = 4
    await userEvent.click(screen.getByRole('button', { name: '日本語 Original' }))
    fireEvent.loadedMetadata(element)
    expect(element.currentTime).toBe(4)
    expect(play).not.toHaveBeenCalled()
  })

  it('stays a plain player when the original video is not available', () => {
    render(<Player originalSrc={null} />)
    expect(video()).toHaveAttribute('src', DUB)
    expect(screen.queryByRole('group', { name: 'Voice track' })).not.toBeInTheDocument()
  })

  it('says so when the dub uses another voice', () => {
    render(<Player voiceMode="stock" />)
    expect(screen.getByText(/another voice, in/i)).toBeInTheDocument()
  })

  it('reports where playback is, for the transcript marker', () => {
    const onTime = vi.fn()
    render(<Player onTime={onTime} />)
    video().currentTime = 3
    fireEvent.timeUpdate(video())
    expect(onTime).toHaveBeenLastCalledWith(3000)
  })
})
