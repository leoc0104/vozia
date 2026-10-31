// Tremor Badge (Apache-2.0), adapted for Vozia

import React from 'react'
import { tv, type VariantProps } from 'tailwind-variants'
import { cx } from '../../lib/utils'
import { Levels } from '../Levels'

const badgeVariants = tv({
  base: 'inline-flex items-center gap-x-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
  variants: {
    variant: {
      default: [
        'bg-brand-50 text-brand-900 ring-brand-500/30',
        'dark:bg-brand-400/10 dark:text-brand-300 dark:ring-brand-400/30',
      ],
      // Work in progress: the signal color with moving voice levels.
      live: [
        'bg-brand-50 text-brand-900 ring-brand-500/30',
        'dark:bg-brand-400/10 dark:text-brand-300 dark:ring-brand-400/30',
      ],
      info: ['bg-info-50 text-info-900 ring-info-500/30', 'dark:bg-info-400/10 dark:text-info-400 dark:ring-info-400/30'],
      neutral: ['bg-gray-50 text-gray-900 ring-gray-500/30', 'dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20'],
      success: [
        'bg-success-50 text-success-900 ring-success-600/30',
        'dark:bg-success-400/10 dark:text-success-400 dark:ring-success-400/20',
      ],
      error: ['bg-danger-50 text-danger-900 ring-danger-600/20', 'dark:bg-danger-400/10 dark:text-danger-400 dark:ring-danger-400/20'],
      warning: [
        'bg-warning-50 text-warning-900 ring-warning-600/30',
        'dark:bg-warning-400/10 dark:text-warning-500 dark:ring-warning-400/20',
      ],
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

interface BadgeProps extends React.ComponentPropsWithoutRef<'span'>, VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant, children, ...props }: BadgeProps, forwardedRef) => {
  return (
    <span ref={forwardedRef} className={cx(badgeVariants({ variant }), className)} {...props}>
      {variant === 'live' ? <Levels bars={3} animated className="size-3 shrink-0" /> : null}
      {children}
    </span>
  )
})

Badge.displayName = 'Badge'

export { Badge, type BadgeProps }
