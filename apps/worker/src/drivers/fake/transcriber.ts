import type { StageContext, Transcriber, TranscriptSegment } from '../../pipeline/contracts.js'

export const CANNED_SEGMENTS: readonly TranscriptSegment[] = [
  { idx: 0, startMs: 0, endMs: 1500, text: 'Hello there.', speaker: 'speaker_0' },
  { idx: 1, startMs: 1600, endMs: 4000, text: 'Welcome to this short demo of Vozia.', speaker: 'speaker_0' },
  { idx: 2, startMs: 4200, endMs: 6000, text: 'Enjoy the dubbed version!', speaker: 'speaker_0' },
]

export class FakeTranscriber implements Transcriber {
  constructor(private readonly opts: { segments?: TranscriptSegment[]; language?: string } = {}) {}

  async transcribe(
    _audioPath: string,
    opts: { languageHint: string | null },
    _ctx: StageContext,
  ): Promise<{ language: string; segments: TranscriptSegment[] }> {
    return {
      language: this.opts.language ?? opts.languageHint ?? 'en',
      segments: (this.opts.segments ?? CANNED_SEGMENTS).map((s) => ({ ...s })),
    }
  }
}
