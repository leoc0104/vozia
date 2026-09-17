import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { AuthLayout } from '../components/AuthLayout'
import { GoogleButton } from '../components/GoogleButton'
import { Alert, Button, Field, Input } from '../components/ui'
import { safeNext } from '../lib/auth-guard'
import { useAuthStore } from '../stores/auth-store'

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
          <Link to="/signup" className="font-medium text-brand-600 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full" loading={busy}>
          Log in
        </Button>
        <div className="text-right">
          <Link to="/forgot-password" className="text-sm text-slate-600 hover:underline">
            Forgot your password?
          </Link>
        </div>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs uppercase text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <GoogleButton onClick={() => void signInWithGoogle(safeNext(next))} />
    </AuthLayout>
  )
}
