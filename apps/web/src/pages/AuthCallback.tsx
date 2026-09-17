import { useEffect } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { AuthLayout } from '../components/AuthLayout'
import { Alert, Spinner } from '../components/ui'
import { safeNext } from '../lib/auth-guard'
import { useAuthStore } from '../stores/auth-store'

/** Landing spot for OAuth and email links: supabase-js exchanges the code itself, we just wait for the session. */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const { next, error_description: errorDescription } = useSearch({ from: '/auth/callback' })
  const status = useAuthStore((s) => s.status)

  useEffect(() => {
    if (status === 'signed_in') void navigate({ to: safeNext(next), replace: true })
  }, [status, next, navigate])

  useEffect(() => {
    if (status !== 'signed_out') return
    const timer = setTimeout(() => void navigate({ to: '/login', replace: true }), 4000)
    return () => clearTimeout(timer)
  }, [status, navigate])

  return (
    <AuthLayout title="Signing you in…">
      {errorDescription ? (
        <Alert tone="error">{errorDescription}</Alert>
      ) : (
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Spinner className="size-5" /> Finishing authentication
        </div>
      )}
    </AuthLayout>
  )
}
