import type { ReactNode } from 'react'
import { cx } from '../../lib/utils'

export function Section({ id, title, lead, children }: { id: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 border-t border-gray-200 py-14 dark:border-gray-800">
      <h2 id={`${id}-title`} className="text-3xl font-semibold text-gray-900 dark:text-gray-50">
        {title}
      </h2>
      {lead ? <p className="mt-3 max-w-2xl text-gray-600 dark:text-gray-400">{lead}</p> : null}
      <div className="mt-10 space-y-12">{children}</div>
    </section>
  )
}

export function Block({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">{title}</h3>
      {note ? <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-400">{note}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  )
}

const PANE = {
  light: 'border-gray-200 bg-white text-gray-900',
  dark: 'border-gray-800 bg-gray-950 text-gray-50',
}

/** A surface that stays in one theme, whatever the page's theme is. */
export function ThemePane({ theme, className, children }: { theme: 'light' | 'dark'; className?: string; children: ReactNode }) {
  return (
    <div data-theme-pane={theme} className={cx(theme, 'min-w-0 rounded-lg border p-5', PANE[theme], className)}>
      {children}
    </div>
  )
}

/**
 * The same content in light and dark, side by side. Anything inside that needs an id must generate it
 * with useId, because the content renders twice.
 */
export function ThemePanes({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ThemePane theme="light" className={className}>
        {children}
      </ThemePane>
      <ThemePane theme="dark" className={className}>
        {children}
      </ThemePane>
    </div>
  )
}

/** A short rule with its reason, used across the sections. */
export function Rule({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 p-5 dark:border-gray-800">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">{title}</h3>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{children}</p>
    </div>
  )
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{children}</span>
}
