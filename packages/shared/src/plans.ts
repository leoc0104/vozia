export interface Plan {
  id: 'free' | 'creator' | 'studio'
  name: string
  minutesPerMonth: number
  priceUsd: number
  features: readonly string[]
}

/** Minutes every new account starts with (matches the database default). */
export const FREE_MINUTES = 10

export const PLANS: readonly Plan[] = [
  {
    id: 'free',
    name: 'Free',
    minutesPerMonth: FREE_MINUTES,
    priceUsd: 0,
    features: ['10 dubbing minutes', 'Voice cloning', 'Original + translated subtitles'],
  },
  {
    id: 'creator',
    name: 'Creator',
    minutesPerMonth: 120,
    priceUsd: 29,
    features: ['120 dubbing minutes / month', 'Voice cloning', 'YouTube link import', 'Priority processing'],
  },
  {
    id: 'studio',
    name: 'Studio',
    minutesPerMonth: 600,
    priceUsd: 99,
    features: ['600 dubbing minutes / month', 'Everything in Creator', 'Background music separation', 'Email support'],
  },
]

/** Billable minutes for a video: whole minutes, rounded up, never less than one. */
export function minutesToCharge(durationSeconds: number): number {
  return Math.max(1, Math.ceil(Math.max(0, durationSeconds) / 60))
}
