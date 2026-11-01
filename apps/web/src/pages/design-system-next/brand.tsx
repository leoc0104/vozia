import { useState } from 'react'
import { Play } from 'lucide-react'
import { Levels } from '../../components/Levels'
import { Wordmark } from '../../components/Logo'
import { levelHeights } from '../../lib/levels'
import { MARK_CAPSULE, MARK_STROKE, MARK_V, MARK_VIEWBOX } from '../../lib/logo-paths'
import { cx, focusRing } from '../../lib/utils'
import { SAMPLE_SEGMENTS } from './samples'

const VOICEPRINT_SEED = 'vozia-sample'

/** The logo mark on its yellow tile, the same in both themes. */
export function NextMark({ className }: { className?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} className={className} aria-hidden="true">
      <rect width="32" height="32" rx="7.5" fill="var(--color-brand-500)" />
      <g
        transform="translate(4.8 4.8) scale(0.7)"
        fill="none"
        stroke="var(--color-gray-950)"
        strokeWidth={MARK_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={MARK_V} />
        <path d={MARK_CAPSULE} />
      </g>
    </svg>
  )
}

/** The mark without a tile, only for surfaces that are already ink: the capsule always sits on ink. */
export function NextMarkOnInk({ className }: { className?: string }) {
  return (
    <svg
      viewBox={MARK_VIEWBOX}
      fill="none"
      strokeWidth={MARK_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={MARK_V} stroke="var(--color-gray-50)" />
      <path d={MARK_CAPSULE} stroke="var(--color-brand-500)" />
    </svg>
  )
}

export function NextLogo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const large = size === 'lg'
  return (
    <span className={cx('inline-flex items-center text-gray-900 dark:text-gray-50', large ? 'gap-4' : 'gap-2')}>
      <NextMark className={large ? 'size-14' : 'size-7'} />
      <Wordmark className={cx('w-auto', large ? 'h-10' : 'h-5')} />
    </span>
  )
}

/** The wordmark alone: the capsule on the i is yellow on dark surfaces, and an ink dot on light ones. */
export function NextWordmark({ className }: { className?: string }) {
  return (
    <span className="text-gray-900 dark:text-gray-50">
      <Wordmark className={cx('w-auto dark:hidden', className)} />
      <Wordmark signal className={cx('hidden w-auto dark:block', className)} />
    </span>
  )
}

export function LanguageChip({ code, name, rtl = false, note }: { code: string; name: string; rtl?: boolean; note?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1 text-sm font-medium text-gray-900 dark:border-gray-700 dark:text-gray-50">
      <span lang={code} dir={rtl ? 'rtl' : 'ltr'}>
        {name}
      </span>
      {note ? <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{note}</span> : null}
    </span>
  )
}

function Track({ code, name, note, bars, live = false }: { code: string; name: string; note: string; bars: number; live?: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span lang={code} className="font-semibold text-gray-950 dark:text-gray-50">
          {name}
        </span>
        <span className="font-mono text-xs text-gray-950/70 dark:text-gray-400">{note}</span>
      </div>
      <Levels seed={VOICEPRINT_SEED} bars={bars} animated={live} className="mt-3 h-14 w-full text-gray-950 dark:text-brand-500" />
    </div>
  )
}

/** The system's signature: one voiceprint, unchanged, under each language. */
export function VoiceprintPanel({ className, bars = 40 }: { className?: string; bars?: number }) {
  return (
    <div
      aria-hidden="true"
      className={cx('rounded-xl bg-brand-500 p-6 dark:border dark:border-gray-800 dark:bg-gray-900', className)}
    >
      <div className="flex items-center justify-between font-mono text-xs text-gray-950/70 dark:text-gray-400">
        <span>short-film.mp4</span>
        <span>00:42</span>
      </div>
      <div className="mt-6 space-y-6">
        <Track code="ja" name="日本語" note="Original" bars={bars} />
        <Track code="pt" name="Português" note="Same voice" bars={bars} live />
      </div>
    </div>
  )
}

const PLAYED = 0.38

function VoiceTimeline() {
  const heights = levelHeights(VOICEPRINT_SEED, 72)
  return (
    <div aria-hidden="true" className="flex h-10 items-center gap-[2px]">
      {heights.map((height, index) => (
        <span
          key={index}
          className={cx('block min-w-0 flex-1 rounded-full', index / heights.length < PLAYED ? 'bg-brand-500' : 'bg-gray-700')}
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  )
}

const VOICE_TRACKS = [
  { id: 'original', code: 'ja', name: '日本語', tag: 'Original' },
  { id: 'dub', code: 'pt', name: 'Português', tag: 'Dub' },
] as const

/** A picture of the proposed player: switching voice keeps the moment, so you hear that it is the same person. */
export function VoicePlayer() {
  const [track, setTrack] = useState<(typeof VOICE_TRACKS)[number]['id']>('dub')
  return (
    <div className="dark overflow-hidden rounded-xl border border-gray-800 bg-gray-950 text-gray-50">
      <div className="grid aspect-video place-items-center bg-black">
        <span className="grid size-14 place-items-center rounded-full bg-brand-500 text-gray-950">
          <Play className="size-6 translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
      <div className="space-y-3 p-4">
        <VoiceTimeline />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono text-xs text-gray-400">00:16 / 00:42</span>
          <div role="group" aria-label="Voice track" className="inline-flex rounded-full bg-gray-800 p-1">
            {VOICE_TRACKS.map(({ id, code, name, tag }) => (
              <button
                key={id}
                type="button"
                aria-pressed={track === id}
                onClick={() => setTrack(id)}
                className={cx(
                  'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                  track === id ? 'bg-brand-500 text-gray-950' : 'text-gray-300 hover:text-gray-50',
                  focusRing,
                )}
              >
                <span lang={code}>{name}</span> <span className="text-xs font-normal opacity-80">{tag}</span>
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-gray-400">
          {track === 'dub' ? 'Same voice, in Portuguese.' : 'The original performance.'} Same moment, same timing.
        </p>
      </div>
    </div>
  )
}

/** The transcript as a script being read: the line being spoken gets a marker. */
export function SpokenTranscript() {
  return (
    <ol className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
      {SAMPLE_SEGMENTS.map((segment, index) => {
        const spoken = index === 1
        return (
          <li key={segment.id} className="grid grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)] gap-4 p-4 text-base">
            <span className="pt-1 font-mono text-xs text-gray-500 dark:text-gray-400">0:0{segment.start_ms / 1000}</span>
            <span lang="ja" className="text-gray-600 dark:text-gray-400">
              {segment.text}
            </span>
            <span lang="pt" className="text-gray-900 dark:text-gray-50">
              {spoken ? <mark className="rounded-sm bg-brand-500 px-1 text-gray-950">{segment.translated_text}</mark> : segment.translated_text}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
