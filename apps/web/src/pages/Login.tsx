import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { AuthLayout } from '../components/AuthLayout'
import { GoogleButton } from '../components/GoogleButton'
import { Button, Callout, Divider, Field, Input } from '../components/ui'
import { safeNext } from '../lib/auth-guard'
import { useAuthStore } from '../stores/auth-store'

const authLink = 'font-medium text-brand-600 hover:underline dark:text-brand-400'

export function LoginPage() {
  const navigate = useNavigate()
  const { next } = useSearch({ from: '/login' })
  const { signIn, signInWithGoogle, error } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await signIn(email, password)
      await navigate({ to: safeNext(next) })
    } catch {
      // the store exposes the message
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to your library."
      footer={
        <>
          New to Vozia?{' '}
          <Link to="/signup" className={authLink}>
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? <Callout variant="error">{error}</Callout> : null}
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" className="w-full" isLoading={busy}>
          Log in
        </Button>
        <div className="text-right">
          <Link to="/forgot-password" className="text-sm text-gray-600 hover:underline dark:text-gray-400">
            Forgot your password?
          </Link>
        </div>
      </form>
      <Divider className="my-5 text-xs uppercase">or</Divider>
      <GoogleButton onClick={() => void signInWithGoogle(safeNext(next))} />
    </AuthLayout>
  )
}
