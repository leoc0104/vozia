// Tremor SelectNative (Apache-2.0), adapted for Vozia

import React from 'react'
import { ChevronDown } from 'lucide-react'
import { tv, type VariantProps } from 'tailwind-variants'
import { cx, focusInput, hasErrorInput } from '../../lib/utils'

const selectNativeStyles = tv({
  base: [
    // base
    'peer w-full cursor-pointer appearance-none truncate rounded-md border py-2 pl-3 pr-8 shadow-xs outline-hidden transition-all sm:text-sm',
    // background color
    'bg-white dark:bg-gray-950',
    // border color
    'border-gray-300 dark:border-gray-800',
    // text color
    'text-gray-900 dark:text-gray-50',
    // placeholder color
    'placeholder-gray-400 dark:placeholder-gray-500',
    // hover
    'hover:bg-gray-50 dark:hover:bg-gray-950/50',
    // disabled
    'disabled:pointer-events-none',
    'disabled:bg-gray-100 disabled:text-gray-400',
    'dark:disabled:border-gray-700 dark:disabled:bg-gray-800 dark:disabled:text-gray-500',
    // focus
    focusInput,
  ],
  variants: {
    hasError: {
      true: hasErrorInput,
    },
  },
})

interface SelectNativeProps
  extends React.SelectHTMLAttributes<HTMLSelectElement>,
    VariantProps<typeof selectNativeStyles> {}

const SelectNative = React.forwardRef<HTMLSelectElement, SelectNativeProps>(
  ({ className, hasError, ...props }: SelectNativeProps, forwardedRef) => {
    return (
      <div className="relative w-full">
        <select ref={forwardedRef} className={cx(selectNativeStyles({ hasError }), className)} {...props} />
        {/* appearance-none hides the native arrow, so draw one */}
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400 dark:text-gray-600"
        />
      </div>
    )
  },
)

SelectNative.displayName = 'SelectNative'

export { SelectNative, type SelectNativeProps }
