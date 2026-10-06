import type { ReactNode } from 'react'
import { Label } from './Label'

export interface FieldProps {
  label: string
  htmlFor: string
  hint?: string
  error?: string | null
  children: ReactNode
}

export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="font-medium">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-500" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-gray-500 dark:text-gray-500">{hint}</p>
      ) : null}
    </div>
  )
}
