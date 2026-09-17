import type { StageContext, TranscriptSegment, TranslatedSegment, Translator } from '../../pipeline/contracts.js'

export class FakeTranslator implements Translator {
  async translate(
    segments: TranscriptSegment[],
    opts: { sourceLanguage: string; targetLanguage: string },
    _ctx: StageContext,
  ): Promise<TranslatedSegment[]> {
    return segments.map((s) => ({ ...s, translatedText: `[${opts.targetLanguage}] ${s.text}` }))
  }
}
