import type { StageContext, Transcriber, TranscriptSegment } from '../../pipeline/contracts.js'
import { groupWordsIntoSegments, type GroupOptions } from '../../pipeline/segments.js'
import type { ElevenLabsClient } from './client.js'

const ISO3_TO_ISO1: Record<string, string> = {
  eng: 'en', spa: 'es', por: 'pt', fra: 'fr', fre: 'fr', deu: 'de', ger: 'de', ita: 'it', jpn: 'ja', kor: 'ko',
  zho: 'zh', cmn: 'zh', chi: 'zh', hin: 'hi', ara: 'ar', rus: 'ru', nld: 'nl', dut: 'nl', pol: 'pl', tur: 'tr',
  swe: 'sv', ind: 'id', fil: 'fil', tgl: 'fil', ukr: 'uk', ell: 'el', gre: 'el', ces: 'cs', cze: 'cs', fin: 'fi',
  ron: 'ro', rum: 'ro', dan: 'da', bul: 'bg', msa: 'ms', may: 'ms', slk: 'sk', slo: 'sk', hrv: 'hr', tam: 'ta',
}

/** ElevenLabs may answer with ISO 639-3 codes; the rest of the system speaks ISO 639-1. */
export function normalizeLanguageCode(code: string): string {
  const base = code.trim().toLowerCase().split(/[-_]/)[0] ?? ''
  if (base.length === 2 || base === 'fil') return base
  return ISO3_TO_ISO1[base] ?? base
}

export class ElevenLabsTranscriber implements Transcriber {
  constructor(
    private readonly client: Pick<ElevenLabsClient, 'speechToText'>,
    private readonly groupOptions: GroupOptions = {},
  ) {}

  async transcribe(
    audioPath: string,
    opts: { languageHint: string | null },
    ctx: StageContext,
  ): Promise<{ language: string; segments: TranscriptSegment[] }> {
    const { languageCode, words } = await this.client.speechToText(
      audioPath,
      { languageCode: opts.languageHint, diarize: true },
      ctx.signal,
    )
    const segments = groupWordsIntoSegments(words, this.groupOptions)
    ctx.progress(1)
    return { language: normalizeLanguageCode(languageCode || opts.languageHint || 'en'), segments }
  }
}
