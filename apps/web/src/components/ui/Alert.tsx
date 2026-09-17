import { cn } from '../../lib/cn'

type Tone = 'info' | 'error' | 'success'

const tones: Record<Tone, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
}

export function Alert({ tone = 'info', className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-lg border px-4 py-3 text-sm', tones[tone], className)}>
      {children}
    </div>
  )
}
