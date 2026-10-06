import { Link } from '@tanstack/react-router'
import { LANGUAGES } from '@vozia/shared'
import { MarketingLayout } from '../components/MarketingLayout'
import { Button } from '../components/ui'

const steps = [
  { title: 'Upload or paste a link', body: 'Drop a video file or paste a YouTube URL. Vozia keeps the original in your library.' },
  { title: 'Pick a language and a voice', body: `Choose one of ${LANGUAGES.length} languages and keep your own voice, or pick a curated stock voice.` },
  { title: 'Download the dubbed video', body: 'Watch progress live, then download the dub and subtitles in both languages.' },
]

export function LandingPage() {
  return (
    <MarketingLayout>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pt-20">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">AI dubbing with voice cloning</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl dark:text-gray-50">
          Dub your videos into {LANGUAGES.length} languages — in your own voice.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
          Vozia transcribes, translates and re-voices your video while preserving the speaker&apos;s voice and the background music.
          Minutes instead of weeks, a fraction of the cost of a studio.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/signup">Dub your first video free</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to="/pricing">See pricing</Link>
          </Button>
        </div>
      </section>
      <section className="border-t border-gray-100 bg-gray-50 dark:border-gray-900 dark:bg-gray-900/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:grid-cols-3 sm:px-6">
          {steps.map((step, i) => (
            <div key={step.title}>
              <span className="grid size-8 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                {i + 1}
              </span>
              <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-50">{step.title}</h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{step.body}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingLayout>
  )
}
