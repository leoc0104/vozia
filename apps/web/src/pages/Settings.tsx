import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { Alert, Button, Card, CardBody, Field, Input, Progress } from '../components/ui'
import { updateProfile } from '../lib/api'
import { useAuthStore } from '../stores/auth-store'

export function SettingsPage() {
  const { profile, user, signOut } = useAuthStore()
  const used = profile?.minutes_used ?? 0
  const quota = profile?.minutes_quota ?? 0

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>

      <Card>
        <CardBody className="space-y-4">
          <h2 className="text-base font-semibold text-slate-900">Dubbing minutes</h2>
          <p className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">{used}</span> of {quota} minutes used
          </p>
          <Progress value={quota > 0 ? (used / quota) * 100 : 0} label="Minutes used" />
          <p className="text-xs text-slate-500">
            Need more?{' '}
            <Link to="/pricing" className="font-medium text-brand-600 hover:underline">
              See plans
            </Link>
          </p>
        </CardBody>
      </Card>

      {/* Keyed on the profile so the form re-initialises when the profile first loads. */}
      <ProfileForm key={profile?.id ?? 'none'} initialName={profile?.display_name ?? ''} email={user?.email ?? ''} />

      <Card>
        <CardBody className="flex items-center justify-between">
          <p className="text-sm text-slate-600">Signed in as {user?.email}</p>
          <Button variant="secondary" onClick={() => void signOut()}>
            Sign out
          </Button>
        </CardBody>
      </Card>
    </div>
  )
}

function ProfileForm({ initialName, email }: { initialName: string; email: string }) {
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
  const [displayName, setDisplayName] = useState(initialName)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await updateProfile({ display_name: displayName.trim() })
      await refreshProfile()
      setMessage({ tone: 'success', text: 'Profile saved.' })
    } catch (e) {
      setMessage({ tone: 'error', text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-4">
          <h2 className="text-base font-semibold text-slate-900">Profile</h2>
          {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
          <Field label="Display name" htmlFor="display-name">
            <Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" value={email} disabled />
          </Field>
          <Button type="submit" loading={busy}>
            Save
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}
