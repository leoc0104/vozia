import { Download } from 'lucide-react'
import { LogoLockup, LogoMark, LogoMarkMono, LogoMarkOnInk, StandaloneWordmark, Wordmark } from '../../components/Logo'
import { Button } from '../../components/ui'
import { MARK_CAPSULE, MARK_STROKE, MARK_V, MARK_VIEWBOX } from '../../lib/logo-paths'
import { Block, Mono, Section, ThemePane, ThemePanes } from './parts'

const MARK_SIZES = [16, 20, 24, 32, 48]

const DOWNLOADS = [
  ['Full logo, light backgrounds', 'vozia-logo-ink.svg'],
  ['Full logo, dark backgrounds', 'vozia-logo-paper.svg'],
  ['App icon', 'vozia-app-icon.svg'],
  ['App icon, ink', 'vozia-app-icon-ink.svg'],
  ['Mark on ink', 'vozia-mark-on-ink.svg'],
  ['Wordmark, ink', 'vozia-wordmark-ink.svg'],
  ['Wordmark, paper', 'vozia-wordmark-paper.svg'],
  ['One color, ink', 'vozia-mark-ink.svg'],
  ['One color, paper', 'vozia-mark-paper.svg'],
]

function Construction() {
  const lines = Array.from({ length: 9 }, (_, i) => i * 4)
  return (
    <svg viewBox={MARK_VIEWBOX} className="size-56 max-w-full sm:size-72" fill="none" role="img" aria-label="The logo mark on its 32 unit grid">
      <rect width="32" height="32" rx="7.5" fill="var(--color-brand-500)" />
      {lines.map((at) => (
        <g key={at} stroke="var(--color-gray-950)" strokeOpacity="0.25" strokeWidth="0.05">
          <path d={`M${at} 0V32`} />
          <path d={`M0 ${at}H32`} />
        </g>
      ))}
      <rect x="6.55" y="6.55" width="18.9" height="18.9" stroke="var(--color-gray-950)" strokeWidth="0.1" strokeDasharray="0.5 0.5" />
      <g transform="translate(4.8 4.8) scale(0.7)" strokeWidth={MARK_STROKE} strokeLinecap="round" strokeLinejoin="round" stroke="var(--color-gray-950)">
        <path d={MARK_V} />
        <path d={MARK_CAPSULE} />
      </g>
    </svg>
  )
}

export function LogoSection() {
  return (
    <Section
      id="logo"
      title="Logo"
      lead="A V with one capsule rising from its center, on a yellow tile. The capsule is a microphone and one bar of a voiceprint."
    >
      <Block title="The full logo" note="The same in both themes, which keeps the rule simple and makes it stand out in a browser tab. The tile carries the yellow, so the wordmark stays plain.">
        <ThemePanes className="flex min-h-44 items-center justify-center">
          <LogoLockup size="lg" />
        </ThemePanes>
      </Block>

      <Block title="Wordmark alone" note="Yellow disappears on white, so on light surfaces the i keeps a plain ink dot. On dark surfaces it gets the yellow capsule.">
        <ThemePanes className="flex min-h-40 items-center justify-center">
          <StandaloneWordmark className="h-14" />
        </ThemePanes>
      </Block>

      <Block title="Mark on ink" note="Only on surfaces that are already ink. The rule: a yellow capsule always sits on ink.">
        <ThemePane theme="dark" className="flex min-h-32 items-center justify-center gap-8">
          <LogoMarkOnInk className="size-16" />
          <LogoMarkOnInk className="size-8" />
          <LogoMarkOnInk className="size-4" />
        </ThemePane>
      </Block>

      <Block title="One color" note="For print, stamps or anything that cannot carry yellow.">
        <div className="grid gap-4 sm:grid-cols-3">
          {(['light', 'dark'] as const).map((theme) => (
            <ThemePane key={theme} theme={theme} className="flex min-h-32 items-center justify-center gap-3">
              <LogoMarkMono className="size-12" />
              <Wordmark className="h-10 w-auto" />
            </ThemePane>
          ))}
          <div className="flex min-h-32 items-center justify-center gap-3 rounded-lg bg-brand-500 p-5 text-gray-950">
            <LogoMarkMono className="size-12" />
            <Wordmark className="h-10 w-auto" />
          </div>
        </div>
      </Block>

      <Block title="Construction">
        <div className="flex flex-wrap items-center gap-8 rounded-lg border border-gray-200 p-6 text-gray-900 dark:border-gray-800 dark:text-gray-50">
          <Construction />
          <dl className="min-w-56 flex-1 space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <dt className="font-medium text-gray-900 dark:text-gray-50">Grid</dt>
              <dd>32 units, with 7.5 unit corners on the tile. The mark is scaled to 70% and centered, so the same yellow margin surrounds it on every side.</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-900 dark:text-gray-50">Stroke</dt>
              <dd>Round ends, the same weight on the V and on the capsule.</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-900 dark:text-gray-50">Capsule</dt>
              <dd>Rises above the arms, so the voice leads the shape.</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-900 dark:text-gray-50">Wordmark</dt>
              <dd>Geist Semibold, converted to outlines, so it needs no font to render.</dd>
            </div>
          </dl>
        </div>
      </Block>

      <Block title="App icon and favicon" note="The tile is the app icon and the favicon, so the browser tab shows the same yellow as the page.">
        <div className="flex flex-wrap items-end gap-6 rounded-lg bg-gray-100 p-6 dark:bg-gray-800">
          <LogoMark className="size-24" />
          <LogoMark className="size-12" />
          <LogoMark className="size-8" />
          <LogoMark className="size-4" />
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
          <div className="border border-dashed border-gray-400 p-3.5 dark:border-gray-600">
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
