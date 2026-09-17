import { Link } from '@tanstack/react-router'
import { Logo } from './Logo'
import { Button } from './ui'

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link to="/pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Pricing
          </Link>
          <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Log in
          </Link>
          <Link to="/signup">
            <Button size="sm">Start for free</Button>
          </Link>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="mx-auto max-w-6xl px-4 py-10 text-sm text-slate-500 sm:px-6">© {new Date().getFullYear()} Vozia. Dub your videos in your own voice.</footer>
    </div>
  )
}
