import { levelHeights } from '../lib/levels'
import { cx } from '../lib/utils'

export interface LevelsProps {
  /** The same seed always draws the same bars. */
  seed?: string
  bars?: number
  animated?: boolean
  /** Give it a height and a text color: the bars fill the box and use currentColor. */
  className?: string
}

/** The Vozia motif: capsule bars like a voice's levels. It is decoration, so screen readers skip it. */
export function Levels({ seed = 'vozia', bars = 5, animated = false, className }: LevelsProps) {
  return (
    <span
      data-levels
      aria-hidden="true"
      className={cx('flex items-center', className)}
      style={{ columnGap: `calc(100% / ${bars * 2.5})` }}
    >
      {levelHeights(seed, bars).map((height, index) => (
        <span
          key={index}
          className={cx('block min-w-0 flex-1 rounded-full bg-current', animated && 'animate-level motion-reduce:animate-none')}
          style={{ height: `${height}%`, animationDelay: animated ? `${index * -140}ms` : undefined }}
        />
      ))}
    </span>
  )
}
