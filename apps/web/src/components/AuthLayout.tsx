import { Logo } from './Logo'
import { Card, CardBody } from './ui'

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <Logo />
      <Card className="mt-6 w-full max-w-md">
        <CardBody className="p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </CardBody>
      </Card>
      {footer ? <p className="mt-4 text-sm text-slate-600">{footer}</p> : null}
    </div>
  )
}
