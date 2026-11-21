import { describe, expect, it } from 'vitest'
import { attachSounds, hasDirections, lineNotes, paceByLine, performedTiming, stripDirections } from '../src/pipeline/performance.js'

const line = (idx: number, startMs: number, endMs: number, text = 'hello world', speaker: string | null = null) => ({
  idx,
  startMs,
  endMs,
  text,
  speaker,
})
const sound = (label: string, startMs: number, endMs: number, speaker: string | null = null) => ({ label, startMs, endMs, speaker })

describe('attachSounds', () => {
  const lines = [line(0, 1000, 3000), line(1, 6000, 8000)]

  it('ties a sound during a line to it', () => {
    expect(attachSounds(lines, [sound('risos', 1500, 2000)]).get(0)).toEqual([
      { id: 0, label: 'risos', position: 'within', atSec: 0.5, seconds: 0.5, startMs: 1500, endMs: 2000 },
    ])
  })

  it('ties a sound just after or just before a line to it', () => {
    const attached = attachSounds(lines, [sound('laughter', 3200, 4000), sound('gasp', 5300, 5800)])
    expect(attached.get(0)).toEqual([{ id: 0, label: 'laughter', position: 'after', atSec: 2.2, seconds: 0.8, startMs: 3200, endMs: 4000 }])
    expect(attached.get(1)).toEqual([{ id: 0, label: 'gasp', position: 'before', atSec: -0.7, seconds: 0.5, startMs: 5300, endMs: 5800 }])
  })

  it('numbers the sounds of a line in order', () => {
    const attached = attachSounds(lines, [sound('b', 3100, 3500), sound('a', 1200, 1400)]).get(0)!
    expect(attached.map((s) => [s.id, s.label])).toEqual([[0, 'a'], [1, 'b']])
  })

  it('picks the nearest line, and leaves sounds far from every line to the original audio', () => {
    const attached = attachSounds(lines, [sound('laughter', 3500, 3800), sound('laughter', 4500, 4700), sound('sighs', 10_000, 10_500)])
    expect(attached.get(0)!.map((s) => s.atSec)).toEqual([2.5])
    expect(attached.get(1)).toEqual([])
  })

  it("never gives a line someone else's laugh", () => {
    const dialogue = [line(0, 1000, 3000, 'joke', 'speaker_0'), line(1, 6000, 8000, 'reply', 'speaker_1')]
    const attached = attachSounds(dialogue, [sound('risos', 3100, 4000, 'speaker_1'), sound('risos', 4500, 5600, 'speaker_0')])
    // speaker_1 laughs right after speaker_0's joke: too far from speaker_1's own line, so it stays original.
    expect(attached.get(0)).toEqual([])
    expect(attached.get(1)).toEqual([])
    expect(attachSounds(dialogue, [sound('risos', 5200, 5900, 'speaker_1')]).get(1)!.map((s) => s.position)).toEqual(['before'])
  })
})

describe('paceByLine', () => {
  it("measures each line's speed against the speaker's usual", () => {
    const pace = paceByLine([line(0, 0, 1000, 'abcde'), line(1, 0, 1000, 'abcdefghij'), line(2, 0, 2000, 'abcdefghij')])
    expect([...pace.values()]).toEqual([1, 2, 1])
  })

  it('counts characters, so scripts without spaces and punctuation do not skew it', () => {
    const pace = paceByLine([line(0, 0, 1000, 'こんにちは'), line(1, 0, 1000, 'a, b! c? d e')])
    expect([...pace.values()]).toEqual([1, 1])
  })
})

describe('lineNotes', () => {
  it('combines the measured delivery, the speed and the sounds of each line', () => {
    const lines = [line(0, 1000, 3000), line(1, 6000, 8000)]
    const attached = attachSounds(lines, [sound('risos', 3200, 4000)])
    const notes = lineNotes(lines, attached, new Map([[0, { loudnessDb: 6, pitchSt: 3 }]]))
    expect(notes.get(0)).toEqual({
      delivery: { loudnessDb: 6, pitchSt: 3, pace: 1 },
      sounds: [{ id: 0, label: 'risos', position: 'after', atSec: 2.2, seconds: 0.8 }],
    })
    expect(notes.get(1)).toEqual({ delivery: { pace: 1 } })
  })

  it('still gives the speed when the audio could not be measured', () => {
    expect(lineNotes([line(0, 0, 1000)], new Map(), null).get(0)).toEqual({ delivery: { pace: 1 } })
  })
})

describe('performance scripts', () => {
  it('finds and removes the directions', () => {
    expect(hasDirections('[panicked] Oh my God… [laughs]')).toBe(true)
    expect(hasDirections('Oh my God… []')).toBe(false)
    expect(stripDirections('[panicked] Oh my God… [laughs]')).toBe('Oh my God…')
    expect(stripDirections('I [whispering, scared] told you')).toBe('I told you')
  })
})

describe('performedTiming', () => {
  const lines = [line(0, 1000, 3000), line(1, 6000, 8000)]
  const attached = attachSounds(lines, [sound('risos', 3200, 4000), sound('aplausos', 500, 900)])

  it('spans the sounds a line performs, so the original laugh gives way to the dub', () => {
    const timed = performedTiming([{ ...lines[0]!, performedSounds: [1] }, lines[1]!], attached)
    expect(timed.map((s) => [s.startMs, s.endMs])).toEqual([[1000, 4000], [6000, 8000]])
  })

  it('keeps the timing of the words for sounds the voice does not perform', () => {
    expect(performedTiming([lines[0]!], attached)[0]).toMatchObject({ startMs: 1000, endMs: 3000 })
    expect(performedTiming([{ ...lines[0]!, performedSounds: [7] }], attached)[0]).toMatchObject({ startMs: 1000, endMs: 3000 })
  })
})
