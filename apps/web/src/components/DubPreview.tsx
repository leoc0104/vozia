import { cx } from '../lib/utils'
import { Levels } from './Levels'

function Track({ label, tag, live = false }: { label: string; tag: string; live?: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-gray-900 dark:text-gray-50">{label}</span>
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{tag}</span>
      </div>
      <Levels
        seed="vozia-sample"
        bars={40}
        animated={live}
        className={cx('mt-3 h-14 w-full', live ? 'text-brand-500' : 'text-gray-300 dark:text-gray-700')}
      />
    </div>
  )
}

/** The landing page's illustration: one timeline, with the original above and the dub below. */
export function DubPreview({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx('rounded-xl border border-gray-200 bg-white p-6 shadow-md dark:border-gray-800 dark:bg-gray-900', className)}
    >
      <div className="flex items-center justify-between font-mono text-xs text-gray-500 dark:text-gray-400">
        <span>product-launch.mp4</span>
        <span>00:42</span>
      </div>
      <div className="mt-6 space-y-6">
        <Track label="English" tag="Original" />
        <Track label="Português" tag="Dubbing" live />
      </div>
    </div>
  )
}
