import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { AuthLayout } from '../components/AuthLayout'
import { Alert, Button, Field, Input } from '../components/ui'
import { useAuthStore } from '../stores/auth-store'

export function ForgotPasswordPage() {
  const { requestPasswordReset, error } = useAuthStore()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch {
      // the store exposes the message
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one."
      footer={
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Back to log in
        </Link>
      }
    >
      {sent ? (
        <Alert tone="success">If an account exists for {email}, a reset link is on its way.</Alert>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
