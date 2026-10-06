import { Link } from '@tanstack/react-router'
import { cx, focusRing } from '../lib/utils'

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link
      to={to}
      className={cx(
        'inline-flex items-center gap-2 rounded-md text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-50',
        focusRing,
      )}
    >
      <span className="grid size-7 place-items-center rounded-lg bg-brand-600 text-white">
        <svg viewBox="0 0 32 32" className="size-4" aria-hidden="true">
          <path d="M9 10l7 12 7-12" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      vozia
    </Link>
  )
}
