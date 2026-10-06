import type { ReactNode } from 'react'

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-14 text-center dark:border-gray-800 dark:bg-gray-950">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">{title}</h3>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-500 dark:text-gray-500">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
