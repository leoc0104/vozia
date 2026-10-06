import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AuthLayout } from '../components/AuthLayout'
import { Button, Callout, Field, Input } from '../components/ui'
import { useAuthStore } from '../stores/auth-store'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { updatePassword, error, status } = useAuthStore()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setLocalError(null)
    if (password.length < 8) {
      setLocalError('Use at least 8 characters for your password.')
      return
    }
    setBusy(true)
    try {
      await updatePassword(password)
      await navigate({ to: '/app' })
    } catch {
      // the store exposes the message
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="This link signed you in; set your new password below.">
      {status === 'signed_out' ? (
        <Callout variant="error">This reset link is invalid or has expired. Request a new one from the login page.</Callout>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error || localError ? <Callout variant="error">{localError ?? error}</Callout> : null}
          <Field label="New password" htmlFor="password" hint="At least 8 characters.">
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" className="w-full" isLoading={busy}>
            Save password
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
