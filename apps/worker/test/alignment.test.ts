import { describe, expect, it } from 'vitest'
import { alignTake, knotsFor, type LineTarget, type TakeTiming } from '../src/pipeline/alignment.js'

const w = (text: string, startMs: number, endMs: number) => ({ text, startMs, endMs })

// "Meu Deus," at 13.84 s, the scream the first dub said half a second late.
const scream: LineTarget = {
  startMs: 13_840,
  endMs: 14_620,
  words: [w('Meu', 13_840, 14_200), w('Deus,', 14_240, 14_620)],
  anchors: [{ source: 'Deus', target: 'God' }],
  cutsMs: [],
  notBeforeMs: 12_000,
  notAfterMs: 15_200,
}
// Its take starts with 150 ms of silence.
const take: TakeTiming = { durationMs: 2000, words: [w('Oh', 150, 300), w('my', 320, 450), w('God,', 470, 900)], events: [] }

describe('alignTake', () => {
  it('puts the first word exactly on the original first word, without the silence before it', () => {
    const aligned = alignTake(take, scream)
    expect(aligned.pieces[0]).toEqual({ fromMs: 90, toMs: 150, outStartMs: 13_780, tempo: 1 })
    expect(aligned.pieces[1]).toMatchObject({ fromMs: 150, outStartMs: 13_840 })
    expect(aligned.outStartMs).toBe(13_780)
  })

  it('lands an anchored word on the moment the original said it', () => {
    const aligned = alignTake(take, scream)
    // "God" is 320 ms into the take and "Deus" 400 ms into the original: that stretch plays at 0.8.
    expect(aligned.pieces[1]).toEqual({ fromMs: 150, toMs: 470, outStartMs: 13_840, tempo: 0.8 })
    expect(aligned.pieces[2]).toMatchObject({ fromMs: 470, toMs: 900, outStartMs: 14_240 })
    expect(aligned.errors).toEqual([
      { label: 'God,', weight: 'firm', errorMs: 0 },
      { label: 'end', weight: 'soft', errorMs: 0 },
    ])
    expect(aligned.lengthRatio).toBe(0.962)
    expect(aligned.overflowMs).toBe(0)
  })

  it('pauses before a tied word that the take reaches too early even at the slowest tempo', () => {
    // "bedroom" comes 300 ms into the take but 1000 ms into the original: 0.8 stretches that to 375 ms, and a pause of
    // at most 500 ms brings it to 125 ms early instead of 625.
    const quick: TakeTiming = { durationMs: 1500, words: [w('my', 100, 300), w('bedroom', 400, 900)], events: [] }
    const target: LineTarget = {
      ...scream,
      startMs: 7000,
      endMs: 8600,
      words: [w('meu', 7000, 7500), w('quarto', 8000, 8600)],
      anchors: [{ source: 'quarto', target: 'bedroom' }],
      notBeforeMs: 0,
      notAfterMs: 9000,
    }
    const aligned = alignTake(quick, target)
    expect(aligned.pieces[1]).toEqual({ fromMs: 100, toMs: 400, outStartMs: 7000, tempo: 0.8 })
    expect(aligned.pieces[2]).toMatchObject({ fromMs: 400, outStartMs: 7875 })
    expect(aligned.errors[0]).toEqual({ label: 'bedroom', weight: 'firm', errorMs: -125 })
  })

  it('pins words said right at a cut', () => {
    const knots = knotsFor(take, { ...scream, cutsMs: [14_300] })
    expect(knots.map((k) => [k.label, k.weight])).toEqual([['Oh', 'pin'], ['God,', 'pin'], ['end', 'soft']])
  })

  it('never plays faster than the limit: what is left shows as lateness and overflow', () => {
    const long: TakeTiming = { durationMs: 4000, words: [w('a', 0, 500), w('b', 1500, 2000), w('c', 3500, 3900)], events: [] }
    const target: LineTarget = { ...scream, startMs: 1000, endMs: 3000, words: [w('x', 1000, 1200), w('z', 2800, 3000)], anchors: [], notBeforeMs: 0, notAfterMs: 3500 }
    const aligned = alignTake(long, target)
    expect(aligned.pieces.map((p) => p.tempo)).toEqual([1.35, 1.35])
    expect(aligned.lengthRatio).toBe(1.95)
    expect(aligned.errors).toEqual([{ label: 'end', weight: 'soft', errorMs: 889 }])
    expect(aligned.overflowMs).toBe(463)
  })

  it('squeezes a sound before the words into the room the previous line leaves, keeping the first word on time', () => {
    const gasp: TakeTiming = { durationMs: 1500, words: [w('Help', 900, 1300)], events: [{ startMs: 0, endMs: 800 }] }
    const target: LineTarget = {
      ...scream,
      startMs: 10_000,
      endMs: 10_600,
      words: [w('Socorro', 10_000, 10_600)],
      anchors: [],
      soundBefore: { startMs: 9300, endMs: 9900 },
      notBeforeMs: 9600,
      notAfterMs: 12_000,
    }
    const aligned = alignTake(gasp, target)
    // Only 400 ms are free before "Help": the gasp plays at 1.35 and loses its first 360 ms.
    expect(aligned.pieces[0]).toEqual({ fromMs: 360, toMs: 900, outStartMs: 9600, tempo: 1.35 })
    expect(aligned.pieces[1]).toMatchObject({ fromMs: 900, outStartMs: 10_000 })
    // With room to spare, the whole gasp plays and simply ends on the first word, even though it is longer than the
    // original's sound: the first word never waits for it.
    const roomy = alignTake(gasp, { ...target, notBeforeMs: 8000 })
    expect(roomy.pieces[0]).toEqual({ fromMs: 0, toMs: 900, outStartMs: 9100, tempo: 1 })
    expect(roomy.pieces[1]).toMatchObject({ fromMs: 900, outStartMs: 10_000 })
  })

  it('ends a re-performed laugh where the original laugh ended', () => {
    const laugh: TakeTiming = { durationMs: 2600, words: [w('Guys,', 100, 600)], events: [{ startMs: 700, endMs: 1900 }] }
    const target: LineTarget = {
      ...scream,
      startMs: 1740,
      endMs: 2940,
      words: [w('gente,', 1740, 2940)],
      anchors: [],
      soundAfter: { startMs: 2960, endMs: 5020 },
      notBeforeMs: 0,
      notAfterMs: 5040,
    }
    const knots = knotsFor(laugh, target)
    expect(knots.at(-1)).toEqual({ takeMs: 1900, outMs: 5020, weight: 'soft', label: 'sound after' })
    const aligned = alignTake(laugh, target)
    expect(aligned.errors.at(-1)!.label).toBe('sound after')
  })

  it('drops anchors that would run backwards, and places a take without words at the line start', () => {
    const knots = knotsFor(take, { ...scream, anchors: [{ source: 'Deus', target: 'my' }, { source: 'Meu', target: 'God' }] })
    expect(knots.map((k) => k.label)).toEqual(['Oh', 'my', 'end'])
    const silent = alignTake({ durationMs: 800, words: [], events: [] }, scream)
    expect(silent.pieces).toEqual([{ fromMs: 0, toMs: 800, outStartMs: 13_840, tempo: 1 }])
  })
})
