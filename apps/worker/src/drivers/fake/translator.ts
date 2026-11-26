import type {
  RevisionRequest,
  StageContext,
  TranscriptSegment,
  TranslateOptions,
  TranslatedSegment,
  Translator,
  VideoBrief,
} from '../../pipeline/contracts.js'

export class FakeTranslator implements Translator {
  async watch(): Promise<VideoBrief | null> {
    return null
  }

  async translate(segments: TranscriptSegment[], opts: TranslateOptions, _ctx: StageContext): Promise<TranslatedSegment[]> {
    return segments.map((s) => {
      const translatedText = `[${opts.targetLanguage}] ${s.text}`
      // Like the real translator, it performs the speaker's own sounds where they happened.
      const sounds = opts.notes?.get(s.idx)?.sounds ?? []
      if (sounds.length === 0) return { ...s, translatedText }
      const tags = (before: boolean) =>
        sounds.filter((sound) => (sound.position === 'before') === before).map((sound) => `[${sound.label}]`)
      return {
        ...s,
        translatedText,
        performanceText: [...tags(true), s.text, ...tags(false)].join(' '),
        performedSounds: sounds.map((sound) => sound.id),
      }
    })
  }

  /** Says the line again in fewer words, which is what most feedback asks for. */
  async revise(requests: RevisionRequest[], _opts: TranslateOptions, _ctx: StageContext): Promise<TranslatedSegment[]> {
    return requests.map(({ segment, keepWords }) => {
      if (keepWords) return { ...segment }
      const words = segment.translatedText.split(' ')
      const shorter = words.slice(0, Math.max(1, Math.ceil(words.length * 0.75))).join(' ')
      const { performanceText: _performance, performedSounds: _sounds, anchors: _anchors, ...rest } = segment
      return { ...rest, translatedText: shorter }
    })
  }
}
