// Tremor cx, focusRing, focusInput, hasErrorInput (Apache-2.0), adapted for Vozia

import clsx, { type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cx(...args: ClassValue[]): string {
  return twMerge(clsx(...args))
}

export const focusRing = [
  // base
  'outline outline-offset-2 outline-0 focus-visible:outline-2',
  // outline color
  'outline-brand-500 dark:outline-brand-500',
]

export const focusInput = [
  // base
  'focus:ring-2',
  // ring color
  'focus:ring-brand-200 dark:focus:ring-brand-500/30',
  // border color
  'focus:border-brand-500 dark:focus:border-brand-500',
]

export const hasErrorInput = [
  // base
  'ring-2',
  // border color
  'border-danger-500 dark:border-danger-700',
  // ring color
  'ring-danger-200 dark:ring-danger-700/30',
]
