import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DubQuality } from '@vozia/shared'
import { DubQualityPanel, qualitySummary } from '../DubQualityPanel'

const report: DubQuality = {
  version: 1,
  measured: true,
  lines: 14,
  inSync: 13,
  worstWordMs: 320,
  retaken: 4,
  revised: 2,
  pitchOffsetSt: 2.4,
  pitchCorrectedSt: -2.4,
  voiceMatched: true,
  bandwidthHz: 8807,
  room: false,
  captions: 1,
}

describe('DubQualityPanel', () => {
  it('says how close the dub came to the original, in plain words', () => {
    render(<DubQualityPanel quality={report} />)
    expect(screen.getByRole('heading', { name: 'How close the dub is' })).toBeInTheDocument()
    expect(screen.getByText('13 of 14 lines land within 0.15 s of the original; the farthest word is 0.3 s late')).toBeInTheDocument()
    expect(screen.getByText('4 lines recorded again, 2 with new words')).toBeInTheDocument()
    expect(
      screen.getByText("Moved down 2.4 semitones to the speaker's pitch; tone matched to the original recording, up to 8.8 kHz"),
    ).toBeInTheDocument()
    expect(screen.getByText('1 caption in the picture translated')).toBeInTheDocument()
  })

  it('says so when a dub could not be measured, and leaves out what did not happen', () => {
    const terms = qualitySummary({ ...report, measured: false, pitchOffsetSt: null, pitchCorrectedSt: 0, voiceMatched: false, captions: 0 })
    expect(terms).toEqual([{ term: 'On the picture', detail: 'Not measured for this dub: each line starts where the original did' }])
    expect(qualitySummary({ ...report, retaken: 0, worstWordMs: 90 }).slice(0, 2).map((item) => item.detail)).toEqual([
      '13 of 14 lines land within 0.15 s of the original',
      'Every line sounded right on the first take',
    ])
  })
})
