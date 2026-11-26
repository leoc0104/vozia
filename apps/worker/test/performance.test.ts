import { describe, expect, it } from 'vitest'
import type { VoiceAnalysis, VoiceMeasure } from '../src/pipeline/contracts.js'
import {
  attachSounds,
  describeMelody,
  dropEdgeSounds,
  hasDirections,
  lineNotes,
  normalizeWord,
  paceByLine,
  performedTiming,
  relativeDelivery,
  stripDirections,
  validAnchors,
  voiceAnalysisRequest,
  wordlessVoice,
  wordsOf,
} from '../src/pipeline/performance.js'

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

const measure = (over: Partial<VoiceMeasure> = {}): VoiceMeasure => ({
  loudnessDb: -13, pitchSt: 13, rangeSt: 6, peakSt: 18, endingSt: 0, voiced: 0.8, ...over,
})
const analysisOf = (lines: [number, VoiceMeasure][], sounds: VoiceAnalysis['sounds'] = []): VoiceAnalysis => ({
  usual: { loudnessDb: -13, pitchSt: 13 },
  lines: new Map(lines),
  sounds,
  envelope: { stepMs: 10, db: [] },
})

describe('lineNotes', () => {
  it('combines the measured delivery, its melody in words, the speed and the sounds of each line', () => {
    const lines = [line(0, 1000, 3000), line(1, 6000, 8000)]
    const attached = attachSounds(lines, [sound('risos', 3200, 4000)])
    const analysis = analysisOf([[0, measure({ loudnessDb: -7, pitchSt: 24.4, rangeSt: 14.2, peakSt: 28.3, endingSt: 3.5 })]])
    const notes = lineNotes(lines, attached, analysis)
    expect(notes.get(0)).toEqual({
      delivery: { loudnessDb: 6, pitchSt: 11.4, pitchRangeSt: 14.2, peakSt: 15.3, endingSt: 3.5, pace: 1 },
      melody: 'very high voice, loud, very animated, peaks in a scream or a shout, rises at the end',
      sounds: [{ id: 0, label: 'risos', position: 'after', atSec: 2.2, seconds: 0.8 }],
    })
    expect(notes.get(1)).toEqual({ delivery: { pace: 1 }, melody: 'ordinary, conversational' })
  })

  it('still gives the speed when the audio could not be measured', () => {
    expect(lineNotes([line(0, 0, 1000)], new Map(), null).get(0)).toEqual({ delivery: { pace: 1 }, melody: 'ordinary, conversational' })
  })

  it('tells where the picture cuts inside a line, counting a cut just before its first word', () => {
    const notes = lineNotes([line(0, 25_300, 26_260), line(1, 27_000, 28_300)], new Map(), null, [25_211, 26_900, 27_800, 30_000])
    expect(notes.get(0)!.cuts).toEqual([0])
    expect(notes.get(1)!.cuts).toEqual([0, 0.8])
  })
})

describe('describeMelody', () => {
  it('says flat lines are flat, so the dub does not over-act them', () => {
    expect(describeMelody({ pitchSt: -1.3, pitchRangeSt: 2.4, peakSt: 1.2, endingSt: -0.5 })).toBe('flat, almost monotone')
    expect(describeMelody({ pitchSt: -3.5, pitchRangeSt: 6.6, endingSt: -4, pace: 0.7 })).toBe('low voice, falls at the end, slow')
    expect(describeMelody({ pitchSt: 5, loudnessDb: -7, pitchRangeSt: 9, pace: 1.4 })).toBe('raised voice, quiet, lively, fast')
  })
})

describe('voice analysis glue', () => {
  it('asks to measure each line over its words, and where words and tagged sounds are', () => {
    const segments = [
      { ...line(0, 1000, 3000), words: [{ text: 'a', startMs: 1000, endMs: 1400 }, { text: 'b', startMs: 2000, endMs: 3000 }] },
      line(1, 6000, 8000),
    ]
    expect(voiceAnalysisRequest(segments, [sound('risos', 3200, 4000)])).toEqual({
      lines: [
        { idx: 0, spans: [{ startMs: 1000, endMs: 1400 }, { startMs: 2000, endMs: 3000 }] },
        { idx: 1, spans: [{ startMs: 6000, endMs: 8000 }] },
      ],
      words: [{ startMs: 1000, endMs: 1400 }, { startMs: 2000, endMs: 3000 }, { startMs: 6000, endMs: 8000 }],
      events: [{ startMs: 3200, endMs: 4000 }],
    })
  })

  it('turns wordless voice into sounds that know how loud and high they were', () => {
    const analysis = analysisOf([], [{ startMs: 11_818, endMs: 12_137, loudnessDb: -16.3, pitchSt: 31.4, voiced: 0.5 }])
    expect(wordlessVoice(analysis)).toEqual([
      { label: 'voice without words', startMs: 11_818, endMs: 12_137, untagged: { loudnessDb: -3.3, pitchSt: 18.4 } },
    ])
    const attached = attachSounds([line(0, 9000, 11_780)], wordlessVoice(analysis)).get(0)!
    expect(attached[0]).toMatchObject({ position: 'after', untagged: { loudnessDb: -3.3, pitchSt: 18.4 } })
    expect(wordlessVoice(null)).toEqual([])
  })

  it('reads measures against the usual line, skipping what could not be measured', () => {
    expect(relativeDelivery(measure({ pitchSt: null, peakSt: null, endingSt: null }), { loudnessDb: -13, pitchSt: 13 })).toEqual({
      loudnessDb: 0,
      pitchRangeSt: 6,
    })
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

describe('words across languages', () => {
  it('matches words without case, accents or punctuation', () => {
    expect(normalizeWord("Kai'Sa.")).toBe('kaisa')
    expect(normalizeWord('Ação!')).toBe('acao')
    expect(wordsOf('Meu Deus, gente —')).toEqual(['meu', 'deus', 'gente'])
  })

  it('keeps anchors whose words are in both lines, once per word, at most six', () => {
    const anchors = validAnchors(
      [
        { source: 'Deus,', target: 'God!' },
        { source: 'tocou', target: 'touched' },
        { source: 'gente', target: 'God' }, // God is anchored already
        { source: 'nada', target: 'me' }, // not in the original
      ],
      'Meu Deus, a barata me tocou',
      'Oh my God! The cockroach touched me',
    )
    expect(anchors).toEqual([{ source: 'Deus,', target: 'God!' }, { source: 'tocou', target: 'touched' }])
  })
})

describe('dropEdgeSounds', () => {
  it('takes sounds off the edges, keeps directions that shape the words, and keeps edges with a real sound', () => {
    expect(dropEdgeSounds('[gasps] [panicked, sighs] Help me! [screams]', { before: false, after: false })).toBe('[panicked] Help me!')
    expect(dropEdgeSounds('[starts laughing] Oh no [clears throat]', { before: false, after: false })).toBe('Oh no')
    expect(dropEdgeSounds('[laughing] Oh no [deep breath]', { before: false, after: false })).toBe('[laughing] Oh no')
    // Sounds with adjectives, as the first real run wrote them.
    expect(dropEdgeSounds('[soft breath] [fast, lively] Oh my God', { before: false, after: false })).toBe('[fast, lively] Oh my God')
    expect(dropEdgeSounds('[quick gasp] [screaming] Oh my God?! [sobbing]', { before: false, after: false })).toBe('[screaming] Oh my God?! [sobbing]')
    expect(dropEdgeSounds('[flat] No... [deep grunt]', { before: false, after: false })).toBe('[flat] No...')
    expect(dropEdgeSounds('[high-pitched] Help!', { before: false, after: false })).toBe('[high-pitched] Help!')
    expect(dropEdgeSounds('[gasps] Help me! [screams]', { before: true, after: true })).toBe('[gasps] Help me! [screams]')
    expect(dropEdgeSounds('Help [gasps] me!', { before: false, after: false })).toBe('Help [gasps] me!')
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
