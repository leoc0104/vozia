import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { cx } from '../lib/utils'
import { Logo } from './Logo'
import { ThemeSwitcher } from './ThemeSwitcher'
import { Button } from './ui'

const navLink = 'text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50'

/**
 * Header, page and footer, at least one window tall, so the footer always sits at the bottom. With `fill`, the page
 * itself becomes a column that stretches to the window, so a page whose content fits never scrolls.
 */
export function MarketingLayout({ children, fill = false }: { children: ReactNode; fill?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white dark:bg-gray-950">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-3 sm:gap-5">
          <Link to="/pricing" className={navLink}>
            Pricing
          </Link>
          <Link to="/login" className={navLink}>
            Log in
          </Link>
          <Button asChild size="sm">
            <Link to="/signup">Start for free</Link>
          </Button>
          <ThemeSwitcher className="hidden sm:inline-flex" />
        </nav>
      </header>
      <main className={cx('flex-1', fill && 'flex flex-col')}>{children}</main>
      <footer className="border-t border-gray-200 dark:border-gray-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-gray-500 short:py-4 sm:px-6 dark:text-gray-400">
          <span>© {new Date().getFullYear()} Vozia. Dub your videos in your own voice.</span>
          <ThemeSwitcher className="sm:hidden" />
        </div>
      </footer>
    </div>
  )
}
