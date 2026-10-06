import type { ReactNode } from 'react'
import { Logo } from './Logo'
import { ThemeSwitcher } from './ThemeSwitcher'
import { Card } from './ui'

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-16 dark:bg-gray-950">
      <ThemeSwitcher className="absolute right-4 top-4" />
      <Logo />
      <Card className="mt-6 w-full max-w-md p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </Card>
      {footer ? <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">{footer}</p> : null}
    </div>
  )
}
