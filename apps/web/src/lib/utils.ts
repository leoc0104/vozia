// Tremor cx, focusRing, focusInput, hasErrorInput (Apache-2.0), adapted for Vozia

import clsx, { type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cx(...args: ClassValue[]): string {
  return twMerge(clsx(...args))
}

// Yellow is only 1.4:1 on white, so on light surfaces ink draws focus and thin lines; on dark ones yellow does.
export const focusRing = [
  // base
  'outline outline-offset-2 outline-0 focus-visible:outline-2',
  // outline color
  'outline-gray-950 dark:outline-brand-500',
]

export const focusInput = [
  // base
  'focus:ring-2',
  // ring color
  'focus:ring-brand-200 dark:focus:ring-brand-500/30',
  // border color
  'focus:border-gray-950 dark:focus:border-brand-500',
]

/** Text links: ink with a yellow marker line under it on light surfaces, plain yellow on dark ones. */
export const link =
  'font-medium text-gray-950 underline decoration-brand-500 decoration-[3px] underline-offset-[3px] hover:decoration-gray-950 dark:text-brand-400 dark:no-underline dark:hover:underline dark:hover:decoration-brand-400'

export const hasErrorInput = [
  // base
  'ring-2',
  // border color
  'border-danger-500 dark:border-danger-700',
  // ring color
  'ring-danger-200 dark:ring-danger-700/30',
]
