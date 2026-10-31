import { cx } from '../../lib/utils'
import { Levels } from '../Levels'

export function Spinner({ className }: { className?: string }) {
  return (
    <span role="status" aria-label="Loading" className={cx('inline-flex text-gray-500 dark:text-gray-400', className ?? 'size-5')}>
      <Levels bars={4} animated className="size-full" />
    </span>
  )
}
