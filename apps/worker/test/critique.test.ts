import { describe, expect, it } from 'vitest'
import type { Alignment } from '../src/pipeline/alignment.js'
import { reviewTake } from '../src/pipeline/critique.js'

const fits = (over: Partial<Alignment> = {}): Alignment => ({
  pieces: [],
  errors: [],
  lengthRatio: 1,
  overflowMs: 0,
  outStartMs: 0,
  outEndMs: 1000,
  ...over,
})

describe('reviewTake', () => {
  it('passes a take that fits and sounds like the original', () => {
    const review = reviewTake({
      original: { pitchSt: 1, pitchRangeSt: 6, endingSt: -4, loudnessDb: 0 },
      take: { pitchSt: 2, pitchRangeSt: 7, endingSt: -3, loudnessDb: 1 },
      alignment: fits(),
    })
    expect(review).toEqual({ score: 0, feedback: [] })
  })

  it('asks for fewer words when a take cannot keep up with the picture', () => {
    const review = reviewTake({ alignment: fits({ lengthRatio: 1.9, overflowMs: 400 }) })
    expect(review.feedback).toEqual([
      "The take's words last 90% longer than the original's, so they cannot keep up with the picture: make it about 47% shorter.",
    ])
    expect(review.score).toBe(9.5)
  })

  it('says when a word tied to the picture still lands late', () => {
    const review = reviewTake({ alignment: fits({ errors: [{ label: 'touched', weight: 'firm', errorMs: 420 }, { label: 'end', weight: 'soft', errorMs: 900 }] }) })
    expect(review.feedback).toEqual([`"touched" lands 0.4 s after the original's moment: move it earlier in the line.`])
  })

  it('hears an over-acted deadpan line and a scream that fell short, like on the first test video', () => {
    const deadpan = reviewTake({ original: { pitchRangeSt: 2.4 }, take: { pitchRangeSt: 7.4 }, alignment: fits() })
    expect(deadpan.feedback).toEqual([
      'It is much more animated than the original, which is flat (pitch moves 7 semitones, the original 2): play it flat and deadpan.',
    ])
    expect(deadpan.direction).toBe('calmer')
    const theatrical = reviewTake({ original: { pitchRangeSt: 6.9 }, take: { pitchRangeSt: 18.5 }, alignment: fits() })
    expect(theatrical.feedback[0]).toMatch(/^It is far more theatrical than the original/)
    expect(theatrical.direction).toBe('calmer')
    const scream = reviewTake({ original: { peakSt: 19.6, endingSt: 15.3 }, take: { peakSt: 14.7, endingSt: -14.9 }, alignment: fits() })
    expect(scream.feedback).toEqual([
      'The original peaks in a scream or a shout (+20 semitones); the take only reaches +15: make it a real scream or shout.',
      'The original rises at the end; the take falls.',
    ])
    expect(scream.direction).toBe('livelier')
  })

  it('asks for a longer laugh when the take laughs for much less time, or not at all', () => {
    const review = reviewTake({
      alignment: fits(),
      sounds: [
        { label: 'risos', originalSec: 2.1, takeSec: 0.5 },
        { label: 'grito', originalSec: 0.4, takeSec: null },
      ],
    })
    expect(review.feedback).toEqual([
      'The risos lasts 0.5 s in the take but 2.1 s in the original: make it last longer (for laughter, [laughs harder] or [starts laughing]).',
      'The grito the original has here was not heard in the take: perform it clearly.',
    ])
    expect(review.score).toBe(4)
  })
})
