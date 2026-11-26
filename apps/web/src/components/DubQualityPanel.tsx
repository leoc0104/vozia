import { Fragment } from 'react'
import { IN_SYNC_MS, type DubQuality } from '@vozia/shared'
import { Card } from './ui'

const seconds = (ms: number) => `${(Math.abs(ms) / 1000).toFixed(1)} s`
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** What the dub page says about a dub's quality, line by line of the panel. */
export function qualitySummary(quality: DubQuality): { term: string; detail: string }[] {
  const items: { term: string; detail: string }[] = []
  if (quality.measured) {
    const worst = quality.worstWordMs
    const far = worst !== null && Math.abs(worst) > IN_SYNC_MS ? `; the farthest word is ${seconds(worst)} ${worst > 0 ? 'late' : 'early'}` : ''
    items.push({ term: 'On the picture', detail: `${quality.inSync} of ${plural(quality.lines, 'line')} land within ${IN_SYNC_MS / 1000} s of the original${far}` })
    items.push({
      term: 'Re-takes',
      detail:
        quality.retaken === 0
          ? 'Every line sounded right on the first take'
          : `${plural(quality.retaken, 'line')} recorded again, ${quality.revised} with new words`,
    })
  } else {
    items.push({ term: 'On the picture', detail: 'Not measured for this dub: each line starts where the original did' })
  }
  const voice: string[] = []
  if (quality.pitchCorrectedSt !== 0) {
    voice.push(`moved ${quality.pitchCorrectedSt > 0 ? 'up' : 'down'} ${Math.abs(quality.pitchCorrectedSt).toFixed(1)} semitones to the speaker's pitch`)
  } else if (quality.pitchOffsetSt !== null) {
    voice.push("at the speaker's own pitch")
  }
  if (quality.voiceMatched) {
    voice.push(
      quality.bandwidthHz
        ? `tone matched to the original recording, up to ${(quality.bandwidthHz / 1000).toFixed(1)} kHz`
        : 'tone matched to the original recording',
    )
  }
  if (quality.room) voice.push("with the original room's echo")
  if (voice.length > 0) items.push({ term: 'Voice', detail: voice.join('; ').replace(/^./, (c) => c.toUpperCase()) })
  if (quality.captions > 0) items.push({ term: 'Captions', detail: `${plural(quality.captions, 'caption')} in the picture translated` })
  return items
}

/** How close the dub came to the original: timing against the picture, re-takes, the voice and captions. */
export function DubQualityPanel({ quality }: { quality: DubQuality }) {
  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">How close the dub is</h2>
      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
        {qualitySummary(quality).map((item) => (
          <Fragment key={item.term}>
            <dt className="text-sm text-gray-500 dark:text-gray-400">{item.term}</dt>
            <dd className="text-sm text-gray-900 dark:text-gray-50">{item.detail}</dd>
          </Fragment>
        ))}
      </dl>
    </Card>
  )
}
