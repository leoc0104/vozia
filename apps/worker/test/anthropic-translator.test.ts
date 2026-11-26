import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  AnthropicTranslator,
  SYSTEM_PROMPT,
  WATCH_PROMPT,
  type ContentBlock,
  type ParseParams,
  type TranslationClient,
  type TranslationOutput,
  type WatchOutput,
} from '../src/drivers/anthropic-translator.js'
import type { TranscriptSegment, VideoBrief } from '../src/pipeline/contracts.js'
import { stageContext, tempDir } from './helpers/factories.js'

function segmentsOf(n: number): TranscriptSegment[] {
  return Array.from({ length: n }, (_, i) => ({ idx: i, startMs: i * 1000, endMs: i * 1000 + 900, text: `line ${i}` }))
}

const textOf = (content: ContentBlock[]) => content.map((block) => (block.type === 'text' ? block.text : '<image>')).join('\n')
const sentSegments = (params: ParseParams<never>) => JSON.parse(textOf(params.messages[0]!.content).split('Segments:\n')[1]!)

type Answer = Partial<Omit<TranslationOutput['translations'][number], 'idx' | 'text'>> & { text: string }

/** Answers every segment it is sent with `answer(idx, text)`, or skips it when that returns null. */
function echoClient(answer: (idx: number, text: string) => Answer | null = (_i, t) => ({ text: `PT ${t}` })) {
  const calls: ParseParams<never>[] = []
  const client: TranslationClient = {
    parse: vi.fn(async (params: ParseParams<never>) => {
      calls.push(params)
      const translations = (sentSegments(params) as { idx: number; text: string }[]).flatMap(({ idx, text }) => {
        const out = answer(idx, text)
        if (out === null) return []
        return [{ idx, performance: `[excited] ${out.text}`, performedSounds: [], anchors: [], ...out }]
      })
      return { parsed_output: { translations } as never, stop_reason: 'end_turn' }
    }) as TranslationClient['parse'],
  }
  return { client, calls }
}

describe('AnthropicTranslator.translate', () => {
  it('translates in batches with a cached system prompt and structured output', async () => {
    const { client, calls } = echoClient()
    const translator = new AnthropicTranslator({ model: 'claude-opus-5-5', client, batchSize: 40 })
    const ctx = await stageContext()
    const result = await translator.translate(segmentsOf(95), { sourceLanguage: 'en', targetLanguage: 'pt' }, ctx)
    expect(result).toHaveLength(95)
    expect(result[7]).toMatchObject({ idx: 7, text: 'line 7', translatedText: 'PT line 7', performanceText: '[excited] PT line 7' })
    expect(calls.map((c) => sentSegments(c).length)).toEqual([40, 40, 15])
    const first = calls[0]!
    expect(first.model).toBe('claude-opus-5-5')
    expect(first.max_tokens).toBe(16000)
    expect(first.system[0]).toEqual({ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } })
    expect(textOf(first.messages[0]!.content)).toContain('Source language: English (en)\nTarget language: Portuguese (pt)')
    expect(first.output_config.format).toBeTruthy()
    expect(ctx.progressValues.at(-1)).toBe(1)
  })

  it('tells the model when each line starts and how long it lasts, how it was said, its sounds, cuts and picture', async () => {
    const { client, calls } = echoClient()
    const translator = new AnthropicTranslator({ model: 'm', client })
    const lines = [
      { idx: 0, startMs: 5080, endMs: 8580, text: 'entrou uma barata voadora no meu quarto' },
      { idx: 1, startMs: 41_240, endMs: 42_540, text: 'Eu explodi passiva,' },
    ]
    const notes = new Map([
      [0, {
        delivery: { loudnessDb: 0.3, pitchSt: 5.6, pitchRangeSt: 6.1, peakSt: 12, endingSt: -1.2, pace: 1.2 },
        melody: 'raised voice',
        sounds: [{ id: 0, label: 'risos', position: 'after' as const, atSec: 3.6, seconds: 0.9 }],
        cuts: [0.9],
      }],
      [1, { delivery: {} }],
    ])
    const brief: VideoBrief = {
      summary: 'A meme about a flying cockroach.',
      glossary: [{ term: 'passiva', translation: 'passive' }],
      onScreen: new Map([[1, 'a missile is fired, then a nuclear explosion']]),
      captions: [],
    }
    await translator.translate(lines, { sourceLanguage: 'pt', targetLanguage: 'en', notes, brief }, await stageContext())
    expect(sentSegments(calls[0]!)).toEqual([
      {
        idx: 0,
        start: 5.1,
        text: 'entrou uma barata voadora no meu quarto',
        seconds: 3.5,
        delivery: { loudnessDb: 0.3, pitchSt: 5.6, pitchRangeSt: 6.1, peakSt: 12, endingSt: -1.2, pace: 1.2 },
        melody: 'raised voice',
        sounds: [{ id: 0, label: 'risos', position: 'after', atSec: 3.6, seconds: 0.9 }],
        cuts: [0.9],
      },
      { idx: 1, start: 41.2, text: 'Eu explodi passiva,', seconds: 1.3, onScreen: 'a missile is fired, then a nuclear explosion' },
    ])
    const sent = textOf(calls[0]!.messages[0]!.content)
    expect(sent).toContain('About this video: A meme about a flying cockroach.')
    expect(sent).toContain('Glossary: passiva → passive')
    for (const field of ['`performance`', '`anchors`', '`melody`', '`onScreen`', '`cuts`', '`sounds`', 'voice without words']) {
      expect(SYSTEM_PROMPT).toContain(field)
    }
  })

  it('returns plain words for the subtitles, a directed performance for the voice and the anchors that exist', async () => {
    const { client } = echoClient(() => ({
      text: 'I blew up my passive',
      performance: '[casual] I blew up my passive',
      anchors: [
        { source: 'Eu', target: 'I' },
        { source: 'explodi', target: 'blew' },
        { source: 'bomba', target: 'passive' }, // not in the original line
        { source: 'passiva', target: 'mana' }, // not in the translation
      ],
    }))
    const translator = new AnthropicTranslator({ model: 'm', client })
    const [line] = await translator.translate(
      [{ idx: 0, startMs: 0, endMs: 1300, text: 'Eu explodi passiva,' }],
      { sourceLanguage: 'pt', targetLanguage: 'en' },
      await stageContext(),
    )
    expect(line).toMatchObject({
      translatedText: 'I blew up my passive',
      performanceText: '[casual] I blew up my passive',
      anchors: [{ source: 'Eu', target: 'I' }, { source: 'explodi', target: 'blew' }],
    })
  })

  it('takes a sound off the start or the end of a line unless the original has one there', async () => {
    const sounds = [{ id: 0, label: 'risos', position: 'after' as const, atSec: 1, seconds: 1.5 }]
    const run = async (performance: string, performedSounds: number[]) => {
      const { client } = echoClient(() => ({ text: 'Oh my God', performance, performedSounds }))
      const [line] = await new AnthropicTranslator({ model: 'm', client }).translate(
        [{ idx: 0, startMs: 0, endMs: 900, text: 'Meu Deus' }],
        { sourceLanguage: 'pt', targetLanguage: 'en', notes: new Map([[0, { sounds }]]) },
        await stageContext(),
      )
      return line!
    }
    expect((await run('[gasps, terrified] Oh my GOD! [laughs]', [0])).performanceText).toBe('[terrified] Oh my GOD! [laughs]')
    expect((await run('[sighs] Oh my God [screams]', [])).performanceText).toBe('Oh my God')
    expect((await run('Oh my [gasps] God', [])).performanceText).toBe('Oh my [gasps] God')
  })

  it('reports the listed sounds the performance re-performs, and only those', async () => {
    const sounds = [
      { id: 0, label: 'risos', position: 'after' as const, atSec: 1, seconds: 1.5 },
      { id: 1, label: 'aplausos', position: 'after' as const, atSec: 2.5, seconds: 2 },
    ]
    const notes = new Map([[0, { sounds }], [1, { sounds }], [2, { sounds }]])
    const translate = async (performance: (t: string) => string, performedSounds: number[]) => {
      const { client } = echoClient((_i, t) => ({ text: t, performance: performance(t), performedSounds }))
      return new AnthropicTranslator({ model: 'm', client }).translate(segmentsOf(3), { sourceLanguage: 'pt', targetLanguage: 'en', notes }, await stageContext())
    }
    // The laugh is performed; the applause is not a voice, and 7 was never listed.
    expect((await translate((t) => `${t} [laughs harder]`, [0, 7, 0]))[0]!.performedSounds).toEqual([0])
    // A performance without any direction performs nothing, whatever the model claims.
    expect((await translate((t) => t, [0]))[0]!.performedSounds).toBeUndefined()
  })

  it('falls back to the plain words when a performance lost them', async () => {
    const { client } = echoClient((_i, t) => ({ text: `PT ${t}`, performance: '[laughs]' }))
    const [line] = await new AnthropicTranslator({ model: 'm', client }).translate(segmentsOf(1), { sourceLanguage: 'en', targetLanguage: 'pt' }, await stageContext())
    expect(line!.translatedText).toBe('PT line 0')
    expect(line!.performanceText).toBeUndefined()
  })

  it('retries segments the model skipped, once', async () => {
    let attempt = 0
    const { client, calls } = echoClient((idx, text) => (idx === 2 && attempt++ === 0 ? null : { text: `X ${text}` }))
    const result = await new AnthropicTranslator({ model: 'm', client }).translate(segmentsOf(4), { sourceLanguage: 'en', targetLanguage: 'es' }, await stageContext())
    expect(result.map((s) => s.translatedText)).toEqual(['X line 0', 'X line 1', 'X line 2', 'X line 3'])
    expect(calls).toHaveLength(2)
    expect(sentSegments(calls[1]!)).toEqual([{ idx: 2, start: 2, text: 'line 2', seconds: 0.9 }])
  })

  it('fails clearly when segments stay missing, on refusals and on unparsable answers', async () => {
    const ctx = await stageContext()
    const skipping = new AnthropicTranslator({ model: 'm', client: echoClient((idx) => (idx === 1 ? null : { text: 'ok' })).client })
    await expect(skipping.translate(segmentsOf(3), { sourceLanguage: 'en', targetLanguage: 'de' }, ctx)).rejects.toMatchObject({
      message: 'The translation model skipped 1 segment(s).',
      stage: 'translating',
    })
    const answering = (answer: { parsed_output: null; stop_reason: string }): TranslationClient => ({ parse: (async () => answer) as TranslationClient['parse'] })
    const refusing = new AnthropicTranslator({ model: 'm', client: answering({ parsed_output: null, stop_reason: 'refusal' }) })
    await expect(refusing.translate(segmentsOf(1), { sourceLanguage: 'en', targetLanguage: 'de' }, ctx)).rejects.toMatchObject({
      message: 'The translation model declined this content.',
    })
    const garbage = new AnthropicTranslator({ model: 'm', client: answering({ parsed_output: null, stop_reason: 'end_turn' }) })
    await expect(garbage.translate(segmentsOf(1), { sourceLanguage: 'en', targetLanguage: 'de' }, ctx)).rejects.toMatchObject({
      message: 'The translation model returned an unreadable answer.',
    })
  })
})

describe('AnthropicTranslator.watch', () => {
  async function framesAt(times: number[]) {
    const dir = await tempDir()
    return Promise.all(
      times.map(async (timeMs) => {
        const file = path.join(dir, `${timeMs}.jpg`)
        await writeFile(file, `jpeg ${timeMs}`)
        return { timeMs, path: file }
      }),
    )
  }

  const lines = [
    { idx: 0, startMs: 9040, endMs: 11_780, text: 'Meu Deus, meus pais não tão aqui em casa, me ajuda!' },
    { idx: 1, startMs: 41_240, endMs: 42_540, text: 'Eu explodi passiva,' },
  ]

  function watcher(answer: WatchOutput) {
    const calls: ParseParams<never>[] = []
    const client: TranslationClient = {
      parse: vi.fn(async (params: ParseParams<never>) => {
        calls.push(params)
        return { parsed_output: answer as never, stop_reason: 'end_turn' }
      }) as TranslationClient['parse'],
    }
    return { client, calls }
  }

  it('looks at the frames with the whole transcript and learns what each line shows and which captions to translate', async () => {
    const frames = await framesAt([9500, 10_380, 11_500, 41_800])
    const { client, calls } = watcher({
      summary: 'A meme: Kai’Sa panics about a flying cockroach, then brags about a game.',
      glossary: [{ term: 'passiva', translation: 'passive' }],
      lines: [
        { idx: 0, onScreen: 'the red caption "Nem tamo em casa"' },
        { idx: 1, onScreen: 'a missile is fired, then a nuclear explosion' },
        { idx: 9, onScreen: 'not a line of this video' },
      ],
      captions: [{ text: 'Nem tamo em casa', translation: "We're not even home", firstFrame: 2, lastFrame: 3 }],
    })
    const brief = await new AnthropicTranslator({ model: 'm', client }).watch(
      lines,
      { sourceLanguage: 'pt', targetLanguage: 'en', frames, cutsMs: [10_230, 12_276], durationMs: 49_500 },
      await stageContext(),
    )

    expect(brief).toEqual({
      summary: 'A meme: Kai’Sa panics about a flying cockroach, then brags about a game.',
      glossary: [{ term: 'passiva', translation: 'passive' }],
      onScreen: new Map([
        [0, 'the red caption "Nem tamo em casa"'],
        [1, 'a missile is fired, then a nuclear explosion'],
      ]),
      // Seen in frames 2 and 3: on screen from the cut before frame 2 to the cut after frame 3.
      captions: [{ startMs: 10_230, endMs: 12_276, text: 'Nem tamo em casa', translation: "We're not even home" }],
    })
    const params = calls[0]!
    expect(params.system[0]!.text).toBe(WATCH_PROMPT)
    const content = params.messages[0]!.content
    expect(content.filter((block) => block.type === 'image')).toHaveLength(4)
    expect(content[1]).toEqual({ type: 'text', text: 'Frame 1, at 9.5 s:' })
    expect(content[2]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: Buffer.from('jpeg 9500').toString('base64') } })
    expect(textOf(content)).toContain('The picture cuts at: 10.2 s, 12.3 s.')
    expect(textOf(content)).toContain('"text":"Eu explodi passiva,"')
  })

  it('sees nothing without frames, and goes on without the video when the request fails', async () => {
    const failing: TranslationClient = { parse: (async () => { throw new Error('image too large') }) as TranslationClient['parse'] }
    const ctx = await stageContext()
    const warn = vi.spyOn(ctx.log, 'warn')
    const opts = { sourceLanguage: 'pt', targetLanguage: 'en', cutsMs: [], durationMs: 49_500 }
    expect(await new AnthropicTranslator({ model: 'm', client: failing }).watch(lines, { ...opts, frames: [] }, ctx)).toBeNull()
    expect(await new AnthropicTranslator({ model: 'm', client: failing }).watch(lines, { ...opts, frames: await framesAt([9500]) }, ctx)).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
  })
})

describe('AnthropicTranslator.revise', () => {
  it('sends what was performed and what went wrong, and returns the new lines', async () => {
    const { client, calls } = echoClient(() => ({ text: 'it touched me', performance: '[disgusted] it touched me', anchors: [{ source: 'tocou', target: 'touched' }] }))
    const segment = {
      idx: 7,
      startMs: 27_000,
      endMs: 28_300,
      text: 'a barata me tocou.',
      translatedText: 'the cockroach touched me.',
      performanceText: '[disgusted, slowly] the cockroach TOUCHED me.',
      anchors: [{ source: 'barata', target: 'cockroach' }],
    }
    const revised = await new AnthropicTranslator({ model: 'm', client }).revise(
      [{ segment, feedback: ['The take lasts 2.5 s but the original line lasts 1.3 s: make it about 45% shorter.'] }],
      { sourceLanguage: 'pt', targetLanguage: 'en' },
      await stageContext(),
    )
    expect(revised).toEqual([
      {
        idx: 7,
        startMs: 27_000,
        endMs: 28_300,
        text: 'a barata me tocou.',
        translatedText: 'it touched me',
        performanceText: '[disgusted] it touched me',
        anchors: [{ source: 'tocou', target: 'touched' }],
      },
    ])
    expect(sentSegments(calls[0]!)).toEqual([
      {
        idx: 7,
        start: 27,
        text: 'a barata me tocou.',
        seconds: 1.3,
        current: { text: 'the cockroach touched me.', performance: '[disgusted, slowly] the cockroach TOUCHED me.' },
        feedback: ['The take lasts 2.5 s but the original line lasts 1.3 s: make it about 45% shorter.'],
      },
    ])
    expect(textOf(calls[0]!.messages[0]!.content)).toContain('the takes did not work')
  })

  it("keeps the person's own words: only their performance changes, and a performance that changed them is not used", async () => {
    const segment = { idx: 1, startMs: 0, endMs: 1000, text: 'Socorro!', translatedText: 'Help me, please!' }
    const run = async (answer: Answer) => {
      const { client, calls } = echoClient(() => answer)
      const [line] = await new AnthropicTranslator({ model: 'm', client }).revise(
        [{ segment, feedback: ['rewritten by the person'], keepWords: true }],
        { sourceLanguage: 'pt', targetLanguage: 'en' },
        await stageContext(),
      )
      return { line: line!, sent: sentSegments(calls[0]!)[0] }
    }
    const directed = await run({ text: 'Help me, please!', performance: '[panicked] HELP me, please!' })
    expect(directed.sent.keepWords).toBe(true)
    expect(directed.line).toMatchObject({ translatedText: 'Help me, please!', performanceText: '[panicked] HELP me, please!' })
    const reworded = await run({ text: 'Help!', performance: '[panicked] Help!' })
    expect(reworded.line.translatedText).toBe('Help me, please!')
    expect(reworded.line.performanceText).toBeUndefined()
  })
})
