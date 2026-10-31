// Tremor Callout (Apache-2.0), adapted for Vozia

import React from 'react'
import { tv, type VariantProps } from 'tailwind-variants'
import { cx } from '../../lib/utils'

const calloutVariants = tv({
  base: 'flex flex-col overflow-hidden rounded-lg p-4 text-sm',
  variants: {
    variant: {
      default: [
        // text color
        'text-brand-900 dark:text-brand-300',
        // background color
        'bg-brand-50 dark:bg-brand-950/70',
      ],
      success: [
        // text color
        'text-success-900 dark:text-success-500',
        // background color
        'bg-success-50 dark:bg-success-950/70',
      ],
      error: [
        // text color
        'text-danger-900 dark:text-danger-500',
        // background color
        'bg-danger-50 dark:bg-danger-950/70',
      ],
      warning: [
        // text color
        'text-warning-900 dark:text-warning-500',
        // background color
        'bg-warning-50 dark:bg-warning-950/70',
      ],
      neutral: [
        // text color
        'text-gray-900 dark:text-gray-400',
        // background color
        'bg-gray-100 dark:bg-gray-800/70',
      ],
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

interface CalloutProps extends React.ComponentPropsWithoutRef<'div'>, VariantProps<typeof calloutVariants> {
  title?: string
  icon?: React.ElementType | React.ReactElement
}

const Callout = React.forwardRef<HTMLDivElement, CalloutProps>(
  ({ title, icon: Icon, className, variant, role, children, ...props }: CalloutProps, forwardedRef) => {
    const hasHeading = Boolean(title || Icon)
    return (
      <div
        ref={forwardedRef}
        // Errors interrupt screen readers; everything else is announced politely.
        role={role ?? (variant === 'error' ? 'alert' : 'status')}
        className={cx(calloutVariants({ variant }), className)}
        {...props}
      >
        {hasHeading ? (
          <div className="flex items-start">
            {Icon ? (
              React.isValidElement(Icon) ? (
                Icon
              ) : (
                <Icon className="mr-1.5 h-5 w-5 shrink-0" aria-hidden="true" />
              )
            ) : null}
            {title ? <span className="font-semibold">{title}</span> : null}
          </div>
        ) : null}
        {children ? <div className={cx('overflow-y-auto', hasHeading ? 'mt-2' : '')}>{children}</div> : null}
      </div>
    )
  },
)

Callout.displayName = 'Callout'

export { Callout, type CalloutProps }
