import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { LogOut, Plus } from 'lucide-react'
import { useRealtimeSync } from '../lib/realtime'
import { cx, focusRing } from '../lib/utils'
import { useAuthStore } from '../stores/auth-store'
import { Logo } from './Logo'
import { ThemeSwitcher } from './ThemeSwitcher'
import { Badge, Button } from './ui-next'

const navLink = cx('rounded-md hover:text-gray-900 dark:hover:text-gray-50', focusRing)
const activeNavLink = { className: 'text-gray-900 dark:text-gray-50' }

export function AppShell() {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const signOut = useAuthStore((s) => s.signOut)
  const minutesLeft = profile ? Math.max(0, profile.minutes_quota - profile.minutes_used) : null
  useRealtimeSync()

  async function onSignOut() {
    await signOut()
    await navigate({ to: '/' })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Logo to="/app" />
            <nav className="hidden items-center gap-4 text-sm font-medium text-gray-600 sm:flex dark:text-gray-400">
              <Link to="/app" activeOptions={{ exact: true }} activeProps={activeNavLink} className={navLink}>
                Library
              </Link>
              <Link to="/app/settings" activeProps={activeNavLink} className={navLink}>
                Settings
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeSwitcher className="hidden sm:inline-flex" />
            {minutesLeft !== null ? (
              <Link to="/app/settings" className={cx('rounded-md', focusRing)}>
                <Badge variant={minutesLeft > 0 ? 'default' : 'error'}>{minutesLeft} min left</Badge>
              </Link>
            ) : null}
            <Button asChild size="sm">
              <Link to="/app/new">
                <Plus className="size-4" aria-hidden="true" /> New dub
              </Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void onSignOut()} aria-label="Sign out">
              <LogOut className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
