import { Link } from '@tanstack/react-router'
import { Button } from '../components/ui'

export function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="text-center">
        <p className="text-sm font-semibold text-brand-600">404</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Page not found</h1>
        <Link to="/" className="mt-6 inline-block">
          <Button variant="secondary">Back home</Button>
        </Link>
      </div>
    </div>
  )
}
