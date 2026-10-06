import { Link } from '@tanstack/react-router'
import { Button } from '../components/ui'

export function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-white px-4 dark:bg-gray-950">
      <div className="text-center">
        <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">404</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-50">Page not found</h1>
        <Button asChild variant="secondary" className="mt-6">
          <Link to="/">Back home</Link>
        </Button>
      </div>
    </div>
  )
}
