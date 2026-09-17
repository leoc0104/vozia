import { cn } from '../../lib/cn'

export function Progress({ value, className, label }: { value: number; className?: string; label?: string }) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={label ?? 'Progress'}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-200', className)}
    >
      <div className="h-full rounded-full bg-brand-600 transition-[width] duration-500" style={{ width: `${clamped}%` }} />
    </div>
  )
}
