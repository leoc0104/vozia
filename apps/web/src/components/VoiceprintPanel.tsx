import { cx } from '../lib/utils'
import { LanguageName } from './LanguageName'
import { Levels } from './Levels'

const SEED = 'vozia-sample'

function Track({ code, tag, live = false }: { code: string; tag: string; live?: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <LanguageName code={code} className="font-semibold text-gray-950 dark:text-gray-50" />
        <span className="font-mono text-xs text-gray-950/70 dark:text-gray-400">{tag}</span>
      </div>
      {/* The same seed under every language: the person speaking does not change, so neither do the bars. */}
      <Levels seed={SEED} bars={40} animated={live} className="mt-3 h-14 w-full text-gray-950 dark:text-brand-500" />
    </div>
  )
}

/** The system's signature: one voiceprint, unchanged, under each language. A yellow panel on light pages, yellow bars on dark ones. */
export function VoiceprintPanel({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cx('rounded-xl bg-brand-500 p-6 dark:border dark:border-gray-800 dark:bg-gray-900', className)}>
      <div className="flex items-center justify-between font-mono text-xs text-gray-950/70 dark:text-gray-400">
        <span>product-launch.mp4</span>
        <span>00:42</span>
      </div>
      <div className="mt-6 space-y-6">
        <Track code="en" tag="Original" />
        <Track code="pt" tag="Same voice" live />
      </div>
    </div>
  )
}
