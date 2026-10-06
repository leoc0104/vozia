import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { PLANS } from '@vozia/shared'
import { MarketingLayout } from '../components/MarketingLayout'
import { Badge, Button, Card } from '../components/ui'
import { cx } from '../lib/utils'

const faq = [
  {
    q: 'What counts as a dubbing minute?',
    a: 'Every completed dub charges the length of the video, rounded up to whole minutes. Failed dubs are not charged.',
  },
  {
    q: 'Is the voice really mine?',
    a: 'Yes. Vozia clones the speaker from the original audio for each dub and deletes the clone afterwards. You can pick a curated stock voice instead.',
  },
  {
    q: 'Can I use a stock voice with the fast dubbing engine?',
    a: 'The end-to-end ElevenLabs dubbing engine always clones the original voice; stock voices apply to the staged pipeline only.',
  },
  {
    q: 'Which videos can I paste as links?',
    a: 'Public YouTube videos. Private, age-gated or region-locked videos cannot be fetched — upload the file instead.',
  },
]

export function PricingPage() {
  return (
    <MarketingLayout>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-gray-50">Simple, minute-based pricing</h1>
        <p className="mt-3 max-w-2xl text-gray-600 dark:text-gray-400">Start free. Upgrade when your library grows.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const featured = plan.id === 'creator'
            return (
              <Card key={plan.id} className={cx('flex h-full flex-col', featured && 'ring-2 ring-brand-500 dark:ring-brand-500')}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">{plan.name}</h2>
                  {featured ? <Badge>Most popular</Badge> : null}
                </div>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-50">
                  ${plan.priceUsd}
                  <span className="text-base font-normal text-gray-500 dark:text-gray-500">/month</span>
                </p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{plan.minutesPerMonth} dubbing minutes</p>
                <ul className="mt-5 flex-1 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-6 w-full" variant={featured ? 'primary' : 'secondary'}>
                  <Link to="/signup">{plan.id === 'free' ? 'Start for free' : `Choose ${plan.name}`}</Link>
                </Button>
              </Card>
            )
          })}
        </div>
        <div className="mt-16 max-w-3xl">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Questions</h2>
          <dl className="mt-6 divide-y divide-gray-200 dark:divide-gray-800">
            {faq.map((item) => (
              <div key={item.q} className="py-4">
                <dt className="font-medium text-gray-900 dark:text-gray-50">{item.q}</dt>
                <dd className="mt-1 text-sm text-gray-600 dark:text-gray-400">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </MarketingLayout>
  )
}
