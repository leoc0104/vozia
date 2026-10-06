import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { ThemeSwitcher } from '../components/ThemeSwitcher'
import { Button, Callout, Card, Field, Input, ProgressBar } from '../components/ui'
import { updateProfile } from '../lib/api'
import { useAuthStore } from '../stores/auth-store'

const cardTitle = 'text-base font-semibold text-gray-900 dark:text-gray-50'

export function SettingsPage() {
  const { profile, user, signOut } = useAuthStore()
  const used = profile?.minutes_used ?? 0
  const quota = profile?.minutes_quota ?? 0

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">Settings</h1>

      <Card className="space-y-4">
        <h2 className={cardTitle}>Dubbing minutes</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium text-gray-900 dark:text-gray-50">{used}</span> of {quota} minutes used
        </p>
        <ProgressBar value={quota > 0 ? (used / quota) * 100 : 0} aria-label="Minutes used" />
        <p className="text-xs text-gray-500 dark:text-gray-500">
          Need more?{' '}
          <Link to="/pricing" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            See plans
          </Link>
        </p>
      </Card>

      <Card asChild>
        <section aria-labelledby="appearance-title" className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="appearance-title" className={cardTitle}>
              Appearance
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Use light or dark mode, or follow your device.</p>
          </div>
          <ThemeSwitcher />
        </section>
      </Card>

      {/* Keyed on the profile so the form re-initialises when the profile first loads. */}
      <ProfileForm key={profile?.id ?? 'none'} initialName={profile?.display_name ?? ''} email={user?.email ?? ''} />

      <Card className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">Signed in as {user?.email}</p>
        <Button variant="secondary" onClick={() => void signOut()}>
          Sign out
        </Button>
      </Card>
    </div>
  )
}

function ProfileForm({ initialName, email }: { initialName: string; email: string }) {
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
  const [displayName, setDisplayName] = useState(initialName)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ variant: 'success' | 'error'; text: string } | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await updateProfile({ display_name: displayName.trim() })
      await refreshProfile()
      setMessage({ variant: 'success', text: 'Profile saved.' })
    } catch (e) {
      setMessage({ variant: 'error', text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-4">
        <h2 className={cardTitle}>Profile</h2>
        {message ? <Callout variant={message.variant}>{message.text}</Callout> : null}
        <Field label="Display name" htmlFor="display-name">
          <Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" value={email} disabled />
        </Field>
        <Button type="submit" isLoading={busy}>
          Save
        </Button>
      </form>
    </Card>
  )
}
