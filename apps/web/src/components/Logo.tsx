import { Link } from '@tanstack/react-router'

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
      <span className="grid size-7 place-items-center rounded-lg bg-brand-600 text-white">
        <svg viewBox="0 0 32 32" className="size-4" aria-hidden="true">
          <path d="M9 10l7 12 7-12" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      vozia
    </Link>
  )
}
