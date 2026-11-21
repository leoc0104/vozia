import type { LineNotes, StageContext, TranscriptSegment, TranslatedSegment, Translator } from '../../pipeline/contracts.js'

export class FakeTranslator implements Translator {
  async translate(
    segments: TranscriptSegment[],
    opts: { sourceLanguage: string; targetLanguage: string; notes?: ReadonlyMap<number, LineNotes> },
    _ctx: StageContext,
  ): Promise<TranslatedSegment[]> {
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
}
