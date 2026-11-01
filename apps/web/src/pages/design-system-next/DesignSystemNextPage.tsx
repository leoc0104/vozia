import { useState } from 'react'
import { Logo } from '../../components/Logo'
import { Levels } from '../../components/Levels'
import { ThemeSwitcher } from '../../components/ThemeSwitcher'
import { Badge } from '../../components/ui'
import { cx, focusRing } from '../../lib/utils'
import { ColorSection } from '../design-system/ColorSection'
import { ComponentsSection } from '../design-system/ComponentsSection'
import { ConceptSection } from '../design-system/ConceptSection'
import { IconsSection, LayoutSection, MotionSection } from '../design-system/FoundationsSections'
import { LogoSection } from '../design-system/LogoSection'
import { OpenSection } from '../design-system/OpenSection'
import { ProductSection } from '../design-system/ProductSection'
import { TypeSection } from '../design-system/TypeSection'
import { AfterView } from './AfterView'
import { ComparisonView } from './ComparisonView'
import { NextLogo, VoiceprintPanel } from './brand'
import { AFTER_NAV, BEFORE_NAV, COMPARISON_NAV } from './nav'
import './next.css'

type View = 'after' | 'before' | 'comparison'

const VIEWS: { id: View; label: string }[] = [
  { id: 'after', label: 'After' },
  { id: 'before', label: 'Before' },
  { id: 'comparison', label: 'Comparison' },
]

const NAV = { after: AFTER_NAV, before: BEFORE_NAV, comparison: COMPARISON_NAV }

const LEAD: Record<View, string> = {
  after: "When you know a voice, you know who is speaking. Vozia's identity is built around keeping that voice: calm ink and paper, and one yellow for the voice itself.",
  before: 'The design system the app uses today, exactly as it is. The moment a recording light turns on, a voice is live: calm ink and paper, and one hot signal for what is live.',
  comparison: 'The design system the app uses today next to the proposed one, using the real components. Nothing in the app has changed: the new system exists only on this page.',
}

function BeforeView() {
  return (
    <>
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
    </>
  )
}

function scrollToTop() {
  document.documentElement.scrollTop = 0
}

export function DesignSystemNextPage() {
  const [view, setView] = useState<View>('comparison')
  // The "before" view must look exactly like today's page, so it stays outside the new colors entirely.
  const scope = view === 'before' ? undefined : 'system-next'

  function choose(next: View) {
    setView(next)
    scrollToTop()
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className={cx(scope, 'sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90')}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {view === 'before' ? <Logo to="/design-system/next" /> : <NextLogo />}
            <span className="hidden font-mono text-xs text-gray-500 sm:inline dark:text-gray-400">Design system</span>
          </div>
          <div className="flex items-center gap-3">
            <div role="group" aria-label="View" className="inline-flex rounded-md bg-gray-100 p-1 dark:bg-gray-900">
              {VIEWS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={view === id}
                  onClick={() => choose(id)}
                  className={cx(
                    'rounded-sm px-3 py-1 text-sm font-medium transition-colors',
                    view === id
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-950 dark:text-gray-50'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50',
                    focusRing,
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:grid lg:grid-cols-[9rem_minmax(0,1fr)] lg:gap-10">
        <nav
          aria-label="Sections"
          className={cx(
            scope,
            'flex flex-wrap gap-x-4 gap-y-1 border-b border-gray-200 py-4 text-sm lg:sticky lg:top-16 lg:block lg:space-y-1 lg:self-start lg:border-0 lg:py-14 dark:border-gray-800',
          )}
        >
          {NAV[view].map(([id, label]) => (
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
          <div className={cx(scope, 'py-14')}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-xs text-gray-500 dark:text-gray-400">Vozia design system</span>
              <Badge variant="neutral">{view === 'before' ? 'v0.1 · In the app today' : 'v0.2 · Proposal'}</Badge>
            </div>
            <h1 className="mt-4 text-5xl font-semibold text-gray-900 sm:text-6xl dark:text-gray-50">{view === 'before' ? 'On Air' : 'Same Voice'}</h1>
            <p className="mt-5 max-w-3xl text-lg text-gray-600 dark:text-gray-400">{LEAD[view]}</p>
            {view === 'before' ? (
              <Levels seed="vozia-sample" bars={64} animated className="mt-10 h-20 w-full text-brand-500" />
            ) : (
              <VoiceprintPanel bars={96} className="mt-10" />
            )}
          </div>
          {view === 'after' ? <AfterView /> : null}
          {view === 'before' ? <BeforeView /> : null}
          {view === 'comparison' ? <ComparisonView /> : null}
        </main>
      </div>
    </div>
  )
}
