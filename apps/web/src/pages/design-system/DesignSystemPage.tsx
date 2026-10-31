import { Levels } from '../../components/Levels'
import { Logo } from '../../components/Logo'
import { ThemeSwitcher } from '../../components/ThemeSwitcher'
import { Badge } from '../../components/ui'
import { cx, focusRing } from '../../lib/utils'
import { ColorSection } from './ColorSection'
import { ComponentsSection } from './ComponentsSection'
import { ConceptSection } from './ConceptSection'
import { IconsSection, LayoutSection, MotionSection } from './FoundationsSections'
import { LogoSection } from './LogoSection'
import { OpenSection } from './OpenSection'
import { ProductSection } from './ProductSection'
import { TypeSection } from './TypeSection'

const SECTIONS = [
  ['concept', 'The idea'],
  ['logo', 'Logo'],
  ['color', 'Color'],
  ['type', 'Typography'],
  ['layout', 'Space and shape'],
  ['motion', 'Motion'],
  ['icons', 'Icons'],
  ['components', 'Components'],
  ['product', 'In the product'],
  ['open', 'Still open'],
] as const

export function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Logo />
            <span className="hidden font-mono text-xs text-gray-500 sm:inline dark:text-gray-400">Design system</span>
          </div>
          <ThemeSwitcher />
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:grid lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-12">
        <nav
          aria-label="Sections"
          className="flex flex-wrap gap-x-4 gap-y-1 border-b border-gray-200 py-4 text-sm lg:sticky lg:top-16 lg:block lg:space-y-1 lg:self-start lg:border-0 lg:py-14 dark:border-gray-800"
        >
          {SECTIONS.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className={cx('block rounded-md py-1 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50', focusRing)}
            >
              {label}
            </a>
          ))}
        </nav>

        <main className="min-w-0">
          <div className="py-14">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-xs text-gray-500 dark:text-gray-400">Vozia design system</span>
              <Badge variant="neutral">v0.1 · Proposal</Badge>
            </div>
            <h1 className="mt-4 text-5xl font-semibold text-gray-900 sm:text-6xl dark:text-gray-50">On Air</h1>
            <p className="mt-5 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
              The moment a recording light turns on, a voice is live. Vozia&apos;s identity is built around that moment: calm ink and paper, and one hot
              signal reserved for what is live right now.
            </p>
            <Levels seed="vozia-sample" bars={64} animated className="mt-10 h-20 w-full text-brand-500" />
            <p className="mt-6 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              A first proposal to react to, not a final brand. Everything here is live code from the app, and each decision can change with one edit.
            </p>
          </div>
          <ConceptSection />
          <LogoSection />
          <ColorSection />
          <TypeSection />
          <LayoutSection />
          <MotionSection />
          <IconsSection />
          <ComponentsSection />
          <ProductSection />
          <OpenSection />
        </main>
      </div>
    </div>
  )
}
