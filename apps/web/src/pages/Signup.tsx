import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { AuthLayout } from '../components/AuthLayout'
import { GoogleButton } from '../components/GoogleButton'
import { Button, Callout, Divider, Field, Input } from '../components/ui'
import { useAuthStore } from '../stores/auth-store'

const authLink = 'font-medium text-brand-600 hover:underline dark:text-brand-400'

export function SignupPage() {
  const navigate = useNavigate()
  const { signUp, signInWithGoogle, error } = useAuthStore()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
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
      const { needsConfirmation } = await signUp(email, password, displayName.trim())
      if (needsConfirmation) setSent(true)
      else await navigate({ to: '/app' })
    } catch {
      // the store exposes the message
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <AuthLayout title="Check your inbox" subtitle={`We sent a confirmation link to ${email}.`}>
        <Callout variant="success">Open the link to activate your account, then log in.</Callout>
        <Link to="/login" className={`mt-4 inline-block text-sm ${authLink}`}>
          Back to log in
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="10 free dubbing minutes, no card required."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className={authLink}>
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error || localError ? <Callout variant="error">{localError ?? error}</Callout> : null}
        <Field label="Name" htmlFor="name">
          <Input id="name" autoComplete="name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters.">
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
          Create account
        </Button>
      </form>
      <Divider className="my-5 text-xs uppercase">or</Divider>
      <GoogleButton onClick={() => void signInWithGoogle()} />
    </AuthLayout>
  )
}
