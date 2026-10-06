import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Logo } from './Logo'
import { ThemeSwitcher } from './ThemeSwitcher'
import { Button } from './ui'

const navLink = 'text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50'

export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
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
      <main>{children}</main>
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-gray-100 px-4 py-8 text-sm text-gray-500 sm:px-6 dark:border-gray-900 dark:text-gray-500">
        <span>© {new Date().getFullYear()} Vozia. Dub your videos in your own voice.</span>
        <ThemeSwitcher className="sm:hidden" />
      </footer>
    </div>
  )
}
