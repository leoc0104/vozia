import { Badge, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRoot, TableRow } from '../../components/ui'
import { contrastRatio, wcagLevel } from '../../lib/contrast'
import { cx } from '../../lib/utils'
import { Block, Mono, Section } from './parts'
import { STEPS, tokenValue } from './tokens'

function Scale({ name, tiny = false }: { name: string; tiny?: boolean }) {
  return (
    <ol className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11">
      {STEPS.map((step) => (
        <li key={step} className="min-w-0">
          <div
            className={cx('rounded-md ring-1 ring-inset ring-black/5 dark:ring-white/10', tiny ? 'h-8' : 'h-16')}
            style={{ backgroundColor: `var(--color-${name}-${step})` }}
          />
          <p className="mt-1.5 text-xs font-medium text-gray-900 dark:text-gray-50">{step}</p>
          <Mono>{tokenValue(`${name}-${step}`)}</Mono>
        </li>
      ))}
    </ol>
  )
}

type Pair = [foreground: string, background: string]

const ROLES: { role: string; light: Pair; dark: Pair }[] = [
  { role: 'Primary text', light: ['gray-900', 'white'], dark: ['gray-50', 'gray-950'] },
  { role: 'Secondary text', light: ['gray-600', 'white'], dark: ['gray-400', 'gray-950'] },
  { role: 'Quiet text', light: ['gray-500', 'gray-50'], dark: ['gray-400', 'gray-900'] },
  { role: 'Link and accent text', light: ['brand-600', 'gray-50'], dark: ['brand-400', 'gray-900'] },
  { role: 'Primary button', light: ['white', 'gray-950'], dark: ['gray-950', 'gray-50'] },
  { role: 'Signal button', light: ['gray-950', 'brand-500'], dark: ['gray-950', 'brand-500'] },
  { role: 'Danger button', light: ['white', 'danger-600'], dark: ['white', 'danger-700'] },
  { role: 'Live badge', light: ['brand-900', 'brand-50'], dark: ['brand-300', 'gray-950'] },
  { role: 'Success badge', light: ['success-900', 'success-50'], dark: ['success-400', 'gray-950'] },
  { role: 'Warning badge', light: ['warning-900', 'warning-50'], dark: ['warning-500', 'gray-950'] },
  { role: 'Error badge', light: ['danger-900', 'danger-50'], dark: ['danger-400', 'gray-950'] },
  { role: 'Focus ring (needs 3:1)', light: ['brand-500', 'white'], dark: ['brand-500', 'gray-950'] },
]

function PairCell({ pair: [foreground, background] }: { pair: Pair }) {
  const ratio = contrastRatio(tokenValue(foreground), tokenValue(background))
  return (
    <TableCell>
      <div className="flex items-center gap-3">
        <span
          className="grid h-9 w-12 shrink-0 place-items-center rounded-md text-sm font-semibold ring-1 ring-inset ring-black/5 dark:ring-white/10"
          style={{ color: `var(--color-${foreground})`, backgroundColor: `var(--color-${background})` }}
        >
          Aa
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-gray-900 dark:text-gray-50">{ratio === null ? '—' : ratio.toFixed(1)}</span>
            {ratio === null ? null : (
              <Badge variant={ratio >= 3 ? 'neutral' : 'error'} className="px-2 py-0">
                {wcagLevel(ratio)}
              </Badge>
            )}
          </div>
          <Mono>
            {foreground} on {background}
          </Mono>
        </div>
      </div>
    </TableCell>
  )
}

export function ColorSection() {
  return (
    <Section id="color" title="Color" lead="Warm ink and paper for almost everything, and one hot signal. Status colors appear only when they carry a status.">
      <Block title="Signal" note="The recording light. Use 500 for fills, with ink text on top. As text, use 600 on light surfaces and 400 on dark ones.">
        <Scale name="brand" />
      </Block>
      <Block title="Ink and paper" note="Warm neutrals for text, surfaces and borders. As text, use 500 or darker on light surfaces, and 400 or lighter on dark ones.">
        <Scale name="gray" />
      </Block>
      <Block title="Status" note="Danger leans crimson, so it never reads as the orange signal.">
        <div className="space-y-6">
          {['success', 'warning', 'danger', 'info'].map((name) => (
            <div key={name}>
              <p className="mb-2 text-sm font-medium capitalize text-gray-900 dark:text-gray-50">{name}</p>
              <Scale name={name} tiny />
            </div>
          ))}
        </div>
      </Block>
      <Block
        title="Roles and contrast"
        note="Which colors go together, measured from the live theme against WCAG. Normal text needs AA, which means 4.5 or more."
      >
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
          <TableRoot>
            <Table className="border-b-0">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Role</TableHeaderCell>
                  <TableHeaderCell>Light theme</TableHeaderCell>
                  <TableHeaderCell>Dark theme</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ROLES.map(({ role, light, dark }) => (
                  <TableRow key={role}>
                    <TableCell className="font-medium text-gray-900 dark:text-gray-50">{role}</TableCell>
                    <PairCell pair={light} />
                    <PairCell pair={dark} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableRoot>
        </div>
      </Block>
    </Section>
  )
}
