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

const YELLOW = 'var(--color-brand-500)'
const INK = 'var(--color-gray-950)'
const PAPER = 'var(--color-gray-50)'

function MarkStrokes({ v, capsule }: { v: string; capsule: string }) {
  return (
    <g fill="none" strokeWidth={MARK_STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d={MARK_V} stroke={v} />
      <path d={MARK_CAPSULE} stroke={capsule} />
    </g>
  )
}

/** The mark: the V and its capsule in ink on a yellow tile, the same in both themes. It is also the app icon and the favicon. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} className={className} aria-hidden="true">
      <rect width="32" height="32" rx="7.5" fill={YELLOW} />
      <g transform="translate(4.8 4.8) scale(0.7)">
        <MarkStrokes v={INK} capsule={INK} />
      </g>
    </svg>
  )
}

/** The mark without its tile, only for surfaces that are already ink: a yellow capsule always sits on ink. */
export function LogoMarkOnInk({ className }: { className?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} className={className} aria-hidden="true">
      <MarkStrokes v={PAPER} capsule={YELLOW} />
    </svg>
  )
}

/** The mark in one color (currentColor), for print, stamps or anything that cannot carry yellow. */
export function LogoMarkMono({ className }: { className?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} className={className} aria-hidden="true">
      <MarkStrokes v="currentColor" capsule="currentColor" />
    </svg>
  )
}

/** "vozia" as outlines in currentColor. `capsule` turns the dot on the i into the yellow capsule, for dark surfaces only. */
export function Wordmark({ className, capsule = false }: { className?: string; capsule?: boolean }) {
  return (
    <svg viewBox={WORDMARK_VIEWBOX} fill="currentColor" className={className} aria-hidden="true">
      <path d={WORDMARK_LETTERS} />
      {capsule ? <rect {...WORDMARK_CAPSULE} fill={YELLOW} /> : <circle {...WORDMARK_DOT} />}
    </svg>
  )
}

/** The wordmark standing alone: a plain ink dot on light surfaces, where yellow would vanish, and the yellow capsule on dark ones. */
export function StandaloneWordmark({ className }: { className?: string }) {
  return (
    <span className="inline-flex text-gray-950 dark:text-gray-50">
      <Wordmark className={cx('w-auto dark:hidden', className)} />
      <Wordmark capsule className={cx('hidden w-auto dark:block', className)} />
    </span>
  )
}

const LOCKUPS = {
  md: { mark: 'size-7', word: 'h-5', gap: 'gap-2' },
  lg: { mark: 'size-14', word: 'h-10', gap: 'gap-4' },
}

/** The full logo. The tile carries the yellow, so the wordmark stays plain and takes the text color. */
export function LogoLockup({ size = 'md' }: { size?: keyof typeof LOCKUPS }) {
  const { mark, word, gap } = LOCKUPS[size]
  return (
    <span className={cx('inline-flex items-center', gap)}>
      <LogoMark className={mark} />
      <Wordmark className={cx(word, 'w-auto')} />
    </span>
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
