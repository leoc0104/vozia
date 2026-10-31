import { Link } from '@tanstack/react-router'
import {
  MARK_CAPSULE,
  MARK_STROKE,
  MARK_V,
  MARK_VIEWBOX,
  WORDMARK_CAPSULE,
  WORDMARK_DOT,
  WORDMARK_LETTERS,
  WORDMARK_VIEWBOX,
} from '../lib/logo-paths'
import { cx, focusRing } from '../lib/utils'

const SIGNAL = 'var(--color-brand-500)'

/** The V and the capsule rising from it. `mono` draws both in currentColor, for one-color uses. */
export function LogoMark({ className, mono = false }: { className?: string; mono?: boolean }) {
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
      <path d={MARK_V} stroke="currentColor" />
      <path d={MARK_CAPSULE} stroke={mono ? 'currentColor' : SIGNAL} />
    </svg>
  )
}

/** "vozia" as outlines. `signal` puts the capsule on the i, for when the wordmark stands alone. */
export function Wordmark({ className, signal = false }: { className?: string; signal?: boolean }) {
  return (
    <svg viewBox={WORDMARK_VIEWBOX} fill="currentColor" className={className} aria-hidden="true">
      <path d={WORDMARK_LETTERS} />
      {signal ? <rect {...WORDMARK_CAPSULE} fill={SIGNAL} /> : <circle {...WORDMARK_DOT} />}
    </svg>
  )
}

const LOCKUPS = {
  md: { mark: 'size-7', word: 'h-5', gap: 'gap-2' },
  lg: { mark: 'size-14', word: 'h-10', gap: 'gap-4' },
}

/** The full logo. The mark carries the signal, so the wordmark stays plain: one light per logo. */
export function LogoLockup({ size = 'md' }: { size?: keyof typeof LOCKUPS }) {
  const { mark, word, gap } = LOCKUPS[size]
  return (
    <span className={cx('inline-flex items-center', gap)}>
      <LogoMark className={mark} />
      <Wordmark className={cx(word, 'w-auto')} />
    </span>
  )
}

/** The app icon: the mark on an ink tile, or on a signal tile. */
export function AppIcon({ className, signal = false }: { className?: string; signal?: boolean }) {
  return (
    <svg viewBox={MARK_VIEWBOX} className={className} aria-hidden="true">
      <rect width="32" height="32" rx="7.5" fill={signal ? SIGNAL : 'var(--color-gray-950)'} />
      <g
        transform="translate(5.6 5.6) scale(0.65)"
        fill="none"
        strokeWidth={MARK_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={MARK_V} stroke={signal ? 'var(--color-gray-950)' : 'var(--color-gray-50)'} />
        <path d={MARK_CAPSULE} stroke={signal ? 'var(--color-gray-50)' : SIGNAL} />
      </g>
    </svg>
  )
}

/** The full logo as a home link. */
export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} aria-label="Vozia" className={cx('inline-flex rounded-md text-gray-900 dark:text-gray-50', focusRing)}>
      <LogoLockup />
    </Link>
  )
}
