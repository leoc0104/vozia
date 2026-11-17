import { useRef, type RefObject } from 'react'
import type { VoiceMode } from '@vozia/shared'
import { cx, focusRing } from '../lib/utils'
import { LanguageName } from './LanguageName'

export type VoiceTrack = 'dub' | 'original'

export interface DubPlayerProps {
  videoRef: RefObject<HTMLVideoElement | null>
  dubSrc: string
  /** The original video. Without it there is nothing to switch to, so the player stays plain. */
  originalSrc?: string | null
  dubLanguage: string
  originalLanguage?: string | null
  voiceMode: VoiceMode
  track: VoiceTrack
  onTrackChange: (track: VoiceTrack) => void
  /** The playback position in milliseconds, while the video plays and after each seek. */
  onTime?: (ms: number) => void
}

/**
 * The dub, with a switch to the original at the same moment: the place where someone hears that it is the same
 * voice. Switching swaps the video file, then puts it back at the same second and keeps playing if it was.
 */
export function DubPlayer({ videoRef, dubSrc, originalSrc, dubLanguage, originalLanguage, voiceMode, track, onTrackChange, onTime }: DubPlayerProps) {
  const resume = useRef<{ time: number; playing: boolean } | null>(null)
  const canSwitch = Boolean(originalSrc)
  const current: VoiceTrack = canSwitch ? track : 'dub'

  function choose(next: VoiceTrack) {
    if (next === current) return
    const video = videoRef.current
    if (video) resume.current = { time: video.currentTime, playing: !video.paused && !video.ended }
    onTrackChange(next)
  }

  function onLoadedMetadata(video: HTMLVideoElement) {
    const moment = resume.current
    if (!moment) return
    resume.current = null
    video.currentTime = Number.isFinite(video.duration) ? Math.min(moment.time, video.duration) : moment.time
    if (moment.playing) void video.play()?.catch(() => undefined)
  }

  const tracks = [
    { id: 'original', language: originalLanguage ?? null, tag: 'Original' },
    { id: 'dub', language: dubLanguage, tag: 'Dub' },
  ] as const

  return (
    <div className="dark overflow-hidden rounded-xl border border-gray-800 bg-gray-950 text-gray-50">
      <video
        ref={videoRef}
        src={current === 'original' && originalSrc ? originalSrc : dubSrc}
        controls
        playsInline
        preload="metadata"
        className="aspect-video w-full bg-black"
        onLoadedMetadata={(e) => onLoadedMetadata(e.currentTarget)}
        onTimeUpdate={(e) => onTime?.(e.currentTarget.currentTime * 1000)}
        onSeeked={(e) => onTime?.(e.currentTarget.currentTime * 1000)}
      />
      {canSwitch ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 p-4">
          <p className="text-sm text-gray-400" aria-live="polite">
            {current === 'original' ? (
              'The original voice.'
            ) : (
              <>
                {voiceMode === 'clone' ? 'Same voice' : 'Another voice'}, in <LanguageName code={dubLanguage} />.
              </>
            )}{' '}
            Same moment, same timing.
          </p>
          <div role="group" aria-label="Voice track" className="inline-flex rounded-full bg-gray-800 p-1">
            {tracks.map(({ id, language, tag }) => (
              <button
                key={id}
                type="button"
                aria-pressed={current === id}
                onClick={() => choose(id)}
                className={cx(
                  'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                  current === id ? 'bg-brand-500 text-gray-950' : 'text-gray-300 hover:text-gray-50',
                  focusRing,
                )}
              >
                {language ? (
                  <>
                    <LanguageName code={language} />{' '}
                  </>
                ) : null}
                <span className="text-xs font-normal opacity-80">{tag}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
