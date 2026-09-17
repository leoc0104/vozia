import { Link } from '@tanstack/react-router'
import { PLANS } from '@vozia/shared'
import { MarketingLayout } from '../components/MarketingLayout'
import { Button, Card, CardBody } from '../components/ui'

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
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Simple, minute-based pricing</h1>
        <p className="mt-3 max-w-2xl text-slate-600">Start free. Upgrade when your library grows.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <Card key={plan.id} className={plan.id === 'creator' ? 'ring-2 ring-brand-500' : undefined}>
              <CardBody className="flex h-full flex-col">
                <h2 className="text-lg font-semibold text-slate-900">{plan.name}</h2>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  ${plan.priceUsd}
                  <span className="text-base font-normal text-slate-500">/month</span>
                </p>
                <p className="mt-1 text-sm text-slate-600">{plan.minutesPerMonth} dubbing minutes</p>
                <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-700">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span aria-hidden="true" className="text-brand-600">
                        ✓
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link to="/signup" className="mt-6">
                  <Button className="w-full" variant={plan.id === 'creator' ? 'primary' : 'secondary'}>
                    {plan.id === 'free' ? 'Start for free' : `Choose ${plan.name}`}
                  </Button>
                </Link>
              </CardBody>
            </Card>
          ))}
        </div>
        <div className="mt-16 max-w-3xl">
          <h2 className="text-2xl font-semibold text-slate-900">Questions</h2>
          <dl className="mt-6 divide-y divide-slate-200">
            {faq.map((item) => (
              <div key={item.q} className="py-4">
                <dt className="font-medium text-slate-900">{item.q}</dt>
                <dd className="mt-1 text-sm text-slate-600">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </MarketingLayout>
  )
}
