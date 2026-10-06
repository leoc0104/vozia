import { LoaderCircle } from 'lucide-react'
import { cx } from '../../lib/utils'

export function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle
      role="status"
      aria-label="Loading"
      className={cx('animate-spin text-gray-400 dark:text-gray-600', className ?? 'size-5')}
    />
  )
}
