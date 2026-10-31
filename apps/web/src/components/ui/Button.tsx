// Tremor Button (Apache-2.0), adapted for Vozia

import React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { tv, type VariantProps } from 'tailwind-variants'
import { cx, focusRing } from '../../lib/utils'
import { Levels } from '../Levels'

const buttonVariants = tv({
  base: [
    // base
    'relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-center font-medium shadow-xs transition-all duration-100 ease-in-out',
    // disabled
    'disabled:pointer-events-none disabled:shadow-none',
    // focus
    focusRing,
  ],
  variants: {
    variant: {
      primary: [
        // border
        'border-transparent',
        // text color
        'text-white dark:text-gray-950',
        // background color
        'bg-gray-950 dark:bg-gray-50',
        // hover color
        'hover:bg-gray-800 dark:hover:bg-white',
        // disabled
        'disabled:bg-gray-200 disabled:text-gray-500',
        'dark:disabled:bg-gray-800 dark:disabled:text-gray-400',
      ],
      // The signal color, for the one action that matters most on a page.
      accent: [
        // border
        'border-transparent',
        // text color
        'text-gray-950',
        // background color
        'bg-brand-500',
        // hover color
        'hover:bg-brand-400',
        // disabled
        'disabled:bg-brand-200 disabled:text-gray-500',
        'dark:disabled:bg-brand-950 dark:disabled:text-brand-700',
      ],
      secondary: [
        // border
        'border-gray-300 dark:border-gray-700',
        // text color
        'text-gray-900 dark:text-gray-50',
        // background color
        'bg-white dark:bg-gray-900',
        // hover color
        'hover:bg-gray-50 dark:hover:bg-gray-800',
        // disabled
        'disabled:text-gray-400',
        'dark:disabled:text-gray-600',
      ],
      light: [
        // base
        'shadow-none',
        // border
        'border-transparent',
        // text color
        'text-gray-900 dark:text-gray-50',
        // background color
        'bg-gray-100 dark:bg-gray-800',
        // hover color
        'hover:bg-gray-200 dark:hover:bg-gray-700',
        // disabled
        'disabled:bg-gray-100 disabled:text-gray-400',
        'dark:disabled:bg-gray-800 dark:disabled:text-gray-600',
      ],
      ghost: [
        // base
        'shadow-none',
        // border
        'border-transparent',
        // text color
        'text-gray-900 dark:text-gray-50',
        // hover color
        'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800/80',
        // disabled
        'disabled:text-gray-400',
        'dark:disabled:text-gray-600',
      ],
      destructive: [
        // text color
        'text-white',
        // border
        'border-transparent',
        // background color
        'bg-danger-600 dark:bg-danger-700',
        // hover color
        'hover:bg-danger-700 dark:hover:bg-danger-600',
        // disabled
        'disabled:bg-danger-300 disabled:text-white',
        'dark:disabled:bg-danger-950 dark:disabled:text-danger-400',
      ],
    },
    size: {
      sm: 'h-8 px-2.5 text-xs',
      md: 'h-9 px-3 text-sm',
      lg: 'h-11 px-5 text-base',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
})

interface ButtonProps extends React.ComponentPropsWithoutRef<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isLoading?: boolean
  loadingText?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { asChild, isLoading = false, loadingText, className, disabled, variant, size, type, children, ...props }: ButtonProps,
    forwardedRef,
  ) => {
    const Component = asChild ? Slot : 'button'
    return (
      <Component
        ref={forwardedRef}
        // A button inside a form defaults to "submit" in HTML; only submit when asked to.
        type={asChild ? undefined : (type ?? 'button')}
        className={cx(buttonVariants({ variant, size }), className)}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading ? (
          <span className="pointer-events-none flex shrink-0 items-center justify-center gap-1.5">
            <Levels bars={4} animated className="size-4 shrink-0" />
            <span className="sr-only">{loadingText ?? 'Loading'}</span>
            {loadingText ?? children}
          </span>
        ) : (
          children
        )}
      </Component>
    )
  },
)

Button.displayName = 'Button'

export { Button, type ButtonProps }
