import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { FakeMedia, FakeSynthesizer, FakeTranscriber, FakeTranslator } from '../src/drivers/fake/index.js'
import type { StageContext, Transcriber, TranslatedSegment, VoiceAnalysis, VoiceAnalysisRequest } from '../src/pipeline/contracts.js'
import { cloneOffset, directPerformance, stabilityFor, toTimeline, type DirectorInput } from '../src/pipeline/director.js'
import { stageContext } from './helpers/factories.js'

const MS_PER_WORD = 400

/** The words the stand-in voice said in a take, without its directions. */
async function wordsOfTake(file: string): Promise<string[]> {
  const text = (await readFile(file, 'utf8')).split(': ').slice(1).join(': ').trim()
  return text.split(/\s+/).filter((word) => word !== '' && !word.startsWith('[') && !word.endsWith(']'))
}

/** Joins takes on paper: each lasts 100 ms of silence plus 400 ms per word. */
class TestMedia extends FakeMedia {
  private joins = 0
  override async joinClips(paths: string[], gapMs: number, ctx: StageContext) {
    const spans = []
    const takes = []
    let at = 0
    for (const file of paths) {
      const words = await wordsOfTake(file)
      const length = 100 + words.length * MS_PER_WORD
      spans.push({ startMs: at, endMs: at + length })
      takes.push({ words, startMs: at })
      at += length + gapMs
    }
    const out = path.join(ctx.workdir, `takes-${this.joins++}.json`)
    await writeFile(out, JSON.stringify(takes))
    return { path: out, spans }
  }

  override async analyzeVoice(_path: string, request: VoiceAnalysisRequest): Promise<VoiceAnalysis> {
    return {
      usual: { loudnessDb: -13, pitchSt: 15 },
      lines: new Map(request.lines.map((l) => [l.idx, { loudnessDb: -13, pitchSt: 15, rangeSt: 5, peakSt: 18, endingSt: -1, voiced: 0.9 }])),
      sounds: [],
      envelope: { stepMs: 10, db: [] },
    }
  }
}

/** Hears each joined take's words, one every 400 ms after 100 ms of silence. */
class TestTranscriber extends FakeTranscriber {
  async words(joinedPath: string) {
    const takes = JSON.parse(await readFile(joinedPath, 'utf8')) as { words: string[]; startMs: number }[]
    return {
      words: takes.flatMap((take) =>
        take.words.map((text, i) => ({
          text,
          startMs: take.startMs + 100 + i * MS_PER_WORD,
          endMs: take.startMs + 100 + (i + 1) * MS_PER_WORD - 50,
        })),
      ),
      events: [],
    }
  }
}

const w = (text: string, startMs: number, endMs: number) => ({ text, startMs, endMs })
const segments: TranslatedSegment[] = [
  {
    idx: 0,
    startMs: 1000,
    endMs: 2000,
    text: 'Meu Deus',
    words: [w('Meu', 1000, 1400), w('Deus', 1500, 2000)],
    translatedText: 'Oh my God',
    anchors: [{ source: 'Deus', target: 'God' }],
  },
  // Seven words for a line of 0.8 s: the take cannot keep up.
  { idx: 1, startMs: 3000, endMs: 3800, text: 'Socorro', words: [w('Socorro', 3000, 3800)], translatedText: 'Help me please somebody help me now' },
]

function inputFor(over: Partial<DirectorInput> = {}): DirectorInput {
  return {
    segments,
    notes: new Map(),
    sounds: new Map(),
    analysis: {
      usual: { loudnessDb: -13, pitchSt: 13 },
      lines: new Map([0, 1].map((idx) => [idx, { loudnessDb: -13, pitchSt: 13, rangeSt: 5, peakSt: 16, endingSt: 0, voiced: 0.9 }])),
      sounds: [],
      envelope: { stepMs: 10, db: [] },
    },
    cutsMs: [],
    vocalsPath: '/w/vocals.wav',
    voiceMode: 'clone',
    stockVoiceId: null,
    totalDurationMs: 10_000,
    translateOptions: { sourceLanguage: 'pt', targetLanguage: 'en' },
    retakeRounds: 1,
    ...over,
  }
}

async function direct(over: Partial<DirectorInput> = {}, transcriber: Transcriber = new TestTranscriber()) {
  const media = new TestMedia()
  const synthesizer = new FakeSynthesizer()
  const translator = new FakeTranslator()
  const spies = {
    revise: vi.spyOn(translator, 'revise'),
    sample: vi.spyOn(media, 'joinSpans'),
    assemble: vi.spyOn(media, 'assembleTimeline'),
  }
  const ctx = await stageContext()
  const performance = await directPerformance({ synthesizer, transcriber, translator, media }, inputFor(over), ctx)
  return { performance, synthesizer, ctx, ...spies }
}

describe('directPerformance', () => {
  it('clones from calm speech and speaks every line with the lines around it as context', async () => {
    const { synthesizer, sample } = await direct()
    expect(sample.mock.calls[0]![1]).toEqual([{ startMs: 950, endMs: 2120 }, { startMs: 2950, endMs: 3920 }])
    expect(synthesizer.spoken[0]).toEqual({ text: 'Oh my God', nextText: 'Help me please somebody help me now', stability: 0.5 })
    expect(synthesizer.spoken[1]).toMatchObject({ previousText: 'Oh my God' })
  })

  it("puts each take's first word on the original's, and its anchored words on theirs", async () => {
    const { performance } = await direct()
    const [first] = performance.lines
    // The 60 ms before the first word, then "Oh" exactly at 1.0 s.
    expect(first!.pieces[0]).toMatchObject({ fromMs: 40, toMs: 100, outStartMs: 940 })
    expect(first!.pieces[1]).toMatchObject({ fromMs: 100, outStartMs: 1000 })
    expect(toTimeline(first!.pieces, 100)).toBe(1000)
    // "God" is 800 ms into the take but 500 ms into the original: as close as the speed limit allows.
    expect(first!.alignment!.errors[0]).toEqual({ label: 'God', weight: 'firm', errorMs: 93 })
    expect(first!.review!.feedback).toEqual([])
  })

  it('sends a take that cannot keep up back to the translator, re-takes it, and keeps the better take', async () => {
    const { performance, synthesizer, revise, assemble } = await direct()
    expect(revise).toHaveBeenCalledOnce()
    const [requests] = revise.mock.calls[0]!
    expect(requests.map((r) => r.segment.idx)).toEqual([1])
    expect(requests[0]!.feedback[0]).toMatch(/longer than the original's, so they cannot keep up with the picture: make it about \d+% shorter/)
    expect(synthesizer.spoken.map((line) => line.text)).toEqual(['Oh my God', 'Help me please somebody help me now', 'Help me please somebody help me'])
    expect(synthesizer.spoken[2]!.seed).toBeDefined()

    const second = performance.lines[1]!
    expect(second).toMatchObject({ takes: 2, revised: true })
    expect(second.segment.translatedText).toBe('Help me please somebody help me')
    expect(second.pieces.every((piece) => piece.path.endsWith('1-2.mp3'))).toBe(true)
    expect(assemble.mock.calls[0]![0]).toHaveLength(performance.lines.flatMap((line) => line.pieces).length)
    expect(performance).toMatchObject({ measured: true, pitchOffsetSt: 2 })
  })

  it('re-takes only the lines asked for, keeping the others exactly where they were, in the same voice', async () => {
    const kept = {
      segment: segments[0]!,
      spoken: 'Oh my God',
      pieces: [{ path: '/w/kept/0.mp3', fromMs: 40, toMs: 1200, outStartMs: 940, tempo: 1 }],
      takes: 1,
      revised: false,
      review: null,
      alignment: null,
      delivery: {},
      soundSpans: [],
    }
    const { performance, synthesizer, sample } = await direct({ only: [1], kept: [kept], samplePath: '/w/sample.mp3', retakeRounds: 0 })
    expect(sample).not.toHaveBeenCalled()
    expect(synthesizer.spoken.map((line) => line.text)).toEqual(['Help me please somebody help me now'])
    expect(performance.lines[0]).toBe(kept)
    expect(performance.performedIdx).toEqual([1])
    expect(performance.samplePath).toBe('/w/sample.mp3')
    // The re-taken line still starts on its original first word, after the kept line ends.
    expect(performance.lines[1]!.pieces.some((piece) => piece.outStartMs === 3000)).toBe(true)
  })

  it('keeps every first take when re-takes are off', async () => {
    const { performance, revise } = await direct({ retakeRounds: 0 })
    expect(revise).not.toHaveBeenCalled()
    expect(performance.lines.map((line) => line.takes)).toEqual([1, 1])
  })

  it('starts each take where its line did when takes cannot be measured, and uses a stock voice without a sample', async () => {
    const { performance, sample } = await direct({ voiceMode: 'stock', stockVoiceId: 'stock-9' }, new FakeTranscriber())
    expect(sample).not.toHaveBeenCalled()
    expect(performance.measured).toBe(false)
    expect(performance.lines.map((line) => line.pieces[0]!.outStartMs)).toEqual([1000, 3000])
  })
})

describe('stabilityFor', () => {
  it('keeps the voice steady for flat lines and free for screams, and moves a re-take the way the review asks', () => {
    expect(stabilityFor({ pitchRangeSt: 2.4 })).toBe(0.75)
    expect(stabilityFor({ pitchRangeSt: 7 })).toBe(0.5)
    expect(stabilityFor({ pitchRangeSt: 9, peakSt: 19.6 })).toBe(0.35)
    expect(stabilityFor(undefined)).toBe(0.5)
    expect(stabilityFor({ pitchRangeSt: 2.4 }, { stability: 0.75, direction: 'calmer' })).toBe(0.9)
    expect(stabilityFor({ pitchRangeSt: 15 }, { stability: 0.35, direction: 'livelier' })).toBe(0.2)
    expect(stabilityFor({}, { stability: 0.5 })).toBe(0.5)
  })
})

describe('cloneOffset', () => {
  const m = (pitchSt: number | null) => ({ loudnessDb: -13, pitchSt, rangeSt: 5, peakSt: 16, endingSt: 0, voiced: 0.9 })
  it("compares the voices on the speaker's calm lines, where a difference is the voice and not the acting", () => {
    const lines = [
      { original: m(13), dub: m(14), delivery: { pitchSt: 0, pitchRangeSt: 5 } },
      { original: m(12), dub: m(13), delivery: { pitchSt: -1, pitchRangeSt: 3 } },
      // Screamed lines come out far higher in the dub: acting, left out while there are calm lines.
      { original: m(24), dub: m(33), delivery: { pitchSt: 11, pitchRangeSt: 15 } },
      { original: m(20), dub: m(29), delivery: { pitchSt: 7, pitchRangeSt: 12 } },
    ]
    expect(cloneOffset(lines)).toBe(1)
    expect(cloneOffset(lines.slice(1))).toBe(9)
    expect(cloneOffset([{ original: m(null), dub: m(14) }])).toBeNull()
  })
})
