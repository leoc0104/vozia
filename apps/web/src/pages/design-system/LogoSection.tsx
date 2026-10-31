import { Download } from 'lucide-react'
import { AppIcon, LogoLockup, LogoMark, Wordmark } from '../../components/Logo'
import { Button } from '../../components/ui'
import { MARK_CAPSULE, MARK_STROKE, MARK_V, MARK_VIEWBOX } from '../../lib/logo-paths'
import { Block, Mono, Section, ThemePane, ThemePanes } from './parts'

const MARK_SIZES = [16, 20, 24, 32, 48]

const DOWNLOADS = [
  ['Full logo, ink', 'vozia-logo-ink.svg'],
  ['Full logo, paper', 'vozia-logo-paper.svg'],
  ['Mark, ink', 'vozia-mark-ink.svg'],
  ['Mark, paper', 'vozia-mark-paper.svg'],
  ['Wordmark, ink', 'vozia-wordmark-ink.svg'],
  ['Wordmark, paper', 'vozia-wordmark-paper.svg'],
  ['App icon', 'vozia-app-icon.svg'],
  ['App icon, signal', 'vozia-app-icon-signal.svg'],
]

function Construction() {
  const lines = Array.from({ length: 9 }, (_, i) => i * 4)
  return (
    <svg viewBox={MARK_VIEWBOX} className="size-56 max-w-full sm:size-72" fill="none" role="img" aria-label="The logo mark on its 32 unit grid">
      {lines.map((at) => (
        <g key={at} stroke="currentColor" strokeWidth="0.05" className="text-gray-400 dark:text-gray-600">
          <path d={`M${at} 0V32`} />
          <path d={`M0 ${at}H32`} />
        </g>
      ))}
      <rect x="2.5" y="2.5" width="27" height="27" stroke="var(--color-brand-500)" strokeWidth="0.1" strokeDasharray="0.5 0.5" />
      <g strokeWidth={MARK_STROKE} strokeLinecap="round" strokeLinejoin="round">
        <path d={MARK_V} stroke="currentColor" />
        <path d={MARK_CAPSULE} stroke="var(--color-brand-500)" />
      </g>
    </svg>
  )
}

export function LogoSection() {
  return (
    <Section
      id="logo"
      title="Logo"
      lead="A V with one capsule rising from its center. The capsule is a microphone, a voice-level bar and the on-air light at once."
    >
      <Block title="The full logo" note="The everyday version. The mark carries the signal, so the wordmark stays plain: one light per logo.">
        <ThemePanes className="flex min-h-44 items-center justify-center">
          <LogoLockup size="lg" />
        </ThemePanes>
      </Block>

      <Block title="Mark and wordmark" note="The mark alone works where space is tight. When the wordmark stands alone, the dot on the i becomes the capsule.">
        <ThemePanes className="flex min-h-44 flex-wrap items-center justify-center gap-x-12 gap-y-6">
          <LogoMark className="size-20" />
          <Wordmark signal className="h-14 w-auto" />
        </ThemePanes>
      </Block>

      <Block title="One color" note="For print, stamps or anything that cannot carry the orange. The gap around the capsule keeps it readable.">
        <div className="grid gap-4 sm:grid-cols-3">
          <ThemePane theme="light" className="flex min-h-32 items-center justify-center">
            <LogoMark mono className="size-14" />
          </ThemePane>
          <ThemePane theme="dark" className="flex min-h-32 items-center justify-center">
            <LogoMark mono className="size-14" />
          </ThemePane>
          <div className="flex min-h-32 items-center justify-center rounded-lg bg-brand-500 p-5 text-gray-950">
            <LogoMark mono className="size-14" />
          </div>
        </div>
      </Block>

      <Block title="Construction">
        <div className="flex flex-wrap items-center gap-8 rounded-lg border border-gray-200 p-6 text-gray-900 dark:border-gray-800 dark:text-gray-50">
          <Construction />
          <dl className="min-w-56 flex-1 space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <dt className="font-medium text-gray-900 dark:text-gray-50">Grid</dt>
              <dd>32 units. The shape fills an exact 27 by 27 square, centered, so it sits evenly in any tile.</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-900 dark:text-gray-50">Stroke</dt>
              <dd>5 units with round ends, on the V and on the capsule alike.</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-900 dark:text-gray-50">Capsule</dt>
              <dd>Rises 2 units above the arms, so the voice leads the shape.</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-900 dark:text-gray-50">Wordmark</dt>
              <dd>Geist Semibold, converted to outlines, so it needs no font to render.</dd>
            </div>
          </dl>
        </div>
      </Block>

      <Block title="App icon and favicon">
        <div className="flex flex-wrap items-end gap-6 rounded-lg bg-gray-100 p-6 dark:bg-gray-800">
          <AppIcon className="size-24" />
          <AppIcon signal className="size-24" />
          <AppIcon className="size-12" />
          <AppIcon className="size-8" />
          <AppIcon className="size-4" />
        </div>
      </Block>

      <Block title="Smallest sizes and clear space" note="Keep the mark at 16 px or larger and the full logo at 20 px tall or larger. Leave at least one capsule of space on every side.">
        <div className="flex flex-wrap items-center gap-8 rounded-lg border border-gray-200 p-6 text-gray-900 dark:border-gray-800 dark:text-gray-50">
          <div className="flex items-end gap-4">
            {MARK_SIZES.map((size) => (
              <div key={size} className="flex flex-col items-center gap-2">
                <span className="block" style={{ width: size, height: size }}>
                  <LogoMark className="size-full" />
                </span>
                <Mono>{size}</Mono>
              </div>
            ))}
          </div>
          <div className="border border-dashed border-brand-500 p-3.5">
            <LogoLockup />
          </div>
        </div>
      </Block>

      <Block title="Downloads" note="Vector files, ready for the web or any design tool.">
        <div className="flex flex-wrap gap-2">
          {DOWNLOADS.map(([label, file]) => (
            <Button key={file} asChild variant="secondary" size="sm">
              <a href={`/brand/${file}`} download>
                <Download className="size-3.5" aria-hidden="true" /> {label}
              </a>
            </Button>
          ))}
        </div>
      </Block>
    </Section>
  )
}
