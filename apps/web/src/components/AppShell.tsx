import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { LogOut, Plus } from 'lucide-react'
import { useAuthStore } from '../stores/auth-store'
import { Logo } from './Logo'
import { Badge, Button } from './ui'

export function AppShell() {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const signOut = useAuthStore((s) => s.signOut)
  const minutesLeft = profile ? Math.max(0, profile.minutes_quota - profile.minutes_used) : null

  async function onSignOut() {
    await signOut()
    await navigate({ to: '/' })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Logo to="/app" />
            <nav className="hidden items-center gap-4 text-sm font-medium text-slate-600 sm:flex">
              <Link to="/app" activeOptions={{ exact: true }} activeProps={{ className: 'text-slate-900' }}>
                Library
              </Link>
              <Link to="/app/settings" activeProps={{ className: 'text-slate-900' }}>
                Settings
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {minutesLeft !== null ? (
              <Link to="/app/settings">
                <Badge tone={minutesLeft > 0 ? 'brand' : 'danger'}>{minutesLeft} min left</Badge>
              </Link>
            ) : null}
            <Link to="/app/new">
              <Button size="sm">
                <Plus className="size-4" aria-hidden="true" /> New dub
              </Button>
            </Link>
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
