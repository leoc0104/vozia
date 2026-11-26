import type { DubStatus, Pipeline, SourceType, VoiceMode } from '@vozia/shared'
import type { DubRow, ProfileRow, VideoRow } from '@vozia/db'
import type { Logger } from '../logger.js'
import type { TimeWindow } from './speech-windows.js'

export interface Word {
  text: string
  startMs: number
  endMs: number
  speaker?: string | null
}

export interface TranscriptSegment {
  idx: number
  startMs: number
  endMs: number
  text: string
  speaker?: string | null
  /** The line's words with their timing, when the transcriber gives them. */
  words?: Word[]
}

export interface TranslatedSegment extends TranscriptSegment {
  /** The translation as plain words, for subtitles and the transcript. */
  translatedText: string
  /** The same translation with performance directions for an expressive voice, like "[panicked] Oh no! [laughs]". */
  performanceText?: string
  /** The ids of the line's sounds (see LineNotes) that the performance re-performs in the new voice. */
  performedSounds?: number[]
}

/** A non-speech sound the transcriber heard, labeled in the language of the video, like "risos" or "applause". */
export interface SoundEvent {
  label: string
  startMs: number
  endMs: number
  /** Who made it, when the transcriber could tell. */
  speaker?: string | null
  /**
   * Set for voice without words that no tag explains, found by measuring the voice track (crying, a scream...):
   * how loud and how high it was against the speaker's usual line.
   */
  untagged?: { loudnessDb?: number; pitchSt?: number }
}

/** A sound heard during or right next to a line, which the dub re-performs when it came from the speaker's voice. */
export interface LineSound {
  /** Its number within the line. */
  id: number
  label: string
  position: 'before' | 'within' | 'after'
  /** Seconds from the start of the line; negative when the sound comes before it. */
  atSec: number
  /** How long the sound lasts. */
  seconds: number
  /** For a sound found by measurement rather than tagged: how loud and how high, against the usual line. */
  untagged?: { loudnessDb?: number; pitchSt?: number }
}

/** How a line was said, measured from the original audio relative to the speaker's usual delivery. */
export interface Delivery {
  /** dB louder (+) or softer (−) than usual. */
  loudnessDb?: number
  /** Semitones higher (+) or lower (−) than the usual pitch. */
  pitchSt?: number
  /** How far the pitch moves within the line, in semitones: about 4 is flat, 10 or more is very lively. */
  pitchRangeSt?: number
  /** The top of the line against the usual pitch, in semitones: a scream or a shouted word reaches +10 or more. */
  peakSt?: number
  /** How the line ends, in semitones: + rises at the end, − falls. */
  endingSt?: number
  /** Speaking speed relative to usual: 1 is usual, 1.3 is 30% faster. */
  pace?: number
}

/** What the translator needs to direct the dubbed performance of one line. */
export interface LineNotes {
  delivery?: Delivery
  /** The delivery in plain words, like "raised voice, very lively, rises at the end". */
  melody?: string
  sounds?: LineSound[]
  /** Seconds from the start of the line where the picture cuts: words spoken there are tied to the picture. */
  cuts?: number[]
}

/** Absolute measures of a stretch of voice: dBFS and semitones above 100 Hz (see scripts/voice_analysis.py). */
export interface VoiceMeasure {
  loudnessDb: number | null
  pitchSt: number | null
  rangeSt: number | null
  peakSt: number | null
  endingSt: number | null
  /** Share of the audible frames that are voiced. */
  voiced: number | null
}

/** Voice without words that no tag explains, like crying or a scream. */
export interface VoiceSound {
  startMs: number
  endMs: number
  loudnessDb: number | null
  pitchSt: number | null
  voiced: number | null
}

export interface VoiceAnalysisRequest {
  /** What to measure: each line over its spans (its words when known, else the whole line). */
  lines: { idx: number; spans: TimeWindow[] }[]
  /** Every spoken word and every tagged sound, which the search for wordless voice skips. */
  words?: TimeWindow[]
  events?: TimeWindow[]
}

export interface VoiceAnalysis {
  /** The speaker's usual line: medians over the lines. */
  usual: { loudnessDb: number | null; pitchSt: number | null }
  lines: Map<number, VoiceMeasure>
  sounds: VoiceSound[]
  /** The track's level every `stepMs`, in dB, so edits can cut where it is quiet. */
  envelope: { stepMs: number; db: number[] }
}

/** A frame of the video, as a JPEG, for the translator to see. */
export interface Frame {
  timeMs: number
  path: string
}

/** What every driver receives: a scratch directory, a logger, an abort signal and a progress sink. */
export interface StageContext {
  workdir: string
  log: Logger
  signal: AbortSignal
  progress(fraction: number): void
}

export interface IngestInput {
  sourceType: SourceType
  sourceUrl: string | null
  storagePath: string | null
}

export interface IngestResult {
  videoPath: string
  audioPath: string
  durationSeconds: number
  title: string | null
  thumbnailPath: string | null
  /** True when the video was fetched from the internet (YouTube) rather than from Storage. */
  downloaded: boolean
}

export interface VideoIngestor {
  ingest(input: IngestInput, ctx: StageContext): Promise<IngestResult>
}

export interface AudioSeparator {
  separate(audioPath: string, ctx: StageContext): Promise<{ vocalsPath: string; backgroundPath: string }>
}

export interface Transcriber {
  transcribe(
    audioPath: string,
    opts: { languageHint: string | null },
    ctx: StageContext,
  ): Promise<{ language: string; segments: TranscriptSegment[]; events?: SoundEvent[] }>
}

export interface Translator {
  translate(
    segments: TranscriptSegment[],
    opts: { sourceLanguage: string; targetLanguage: string; notes?: ReadonlyMap<number, LineNotes> },
    ctx: StageContext,
  ): Promise<TranslatedSegment[]>
}

export interface SynthesisRequest {
  segments: TranslatedSegment[]
  vocalsPath: string
  voiceMode: VoiceMode
  stockVoiceId: string | null
  targetLanguage: string
  totalDurationMs: number
}

export interface SpeechSynthesizer {
  /**
   * True when the voice speaks `performanceText` and performs its directions, like [laughs] or [whispering]. The dub
   * then leaves the speaker's own laughs and sighs next to each line to the new voice instead of the original audio.
   */
  readonly performsDirections?: boolean
  synthesize(req: SynthesisRequest, ctx: StageContext): Promise<{ dubbedVocalsPath: string }>
}

/** Where a synthesized clip lands on the original timeline and how much it must be sped up. */
export interface Placement {
  idx: number
  startMs: number
  tempo: number
}

export interface MediaProcessor {
  extractAudio(videoPath: string, ctx: StageContext): Promise<string>
  probeDurationSeconds(path: string, ctx: StageContext): Promise<number>
  thumbnail(videoPath: string, ctx: StageContext): Promise<string>
  clipAudio(inputPath: string, opts: { startSec: number; durationSec: number }, ctx: StageContext): Promise<string>
  duck(audioPath: string, gainDb: number, ctx: StageContext): Promise<string>
  /** How each line of a voice track was performed, plus its wordless voice and level curve; null when unavailable. */
  analyzeVoice(vocalsPath: string, request: VoiceAnalysisRequest, ctx: StageContext): Promise<VoiceAnalysis | null>
  /** Where the picture cuts to a new shot, in milliseconds; empty when unknown. */
  sceneCuts(videoPath: string, ctx: StageContext): Promise<number[]>
  /** Small JPEG frames of the video at the given times; times that cannot be read are skipped. */
  frames(videoPath: string, timesMs: number[], ctx: StageContext): Promise<Frame[]>
  /**
   * The bed under the dub: the original audio outside `speech`; inside it, the separated background plus the
   * original's steady noise floor, so the room keeps sounding the same while the new voice speaks. Short fades.
   */
  buildDubBackground(
    input: { originalPath: string; backgroundPath: string; speech: TimeWindow[] },
    ctx: StageContext,
  ): Promise<string>
  assembleTimeline(
    clips: { placement: Placement; path: string }[],
    totalDurationMs: number,
    ctx: StageContext,
  ): Promise<string>
  /** Integrated loudness (EBU R128) in LUFS, which ignores silence between lines; null for silence or on failure. */
  loudness(path: string, ctx: StageContext): Promise<number | null>
  /** `voiceGainDb` raises or lowers the new voice, so it can speak as loud as the original speaker did. */
  mux(
    input: { videoPath: string; backgroundPath: string; dubbedVocalsPath: string; voiceGainDb?: number },
    ctx: StageContext,
  ): Promise<{ outputPath: string }>
}

export interface ObjectStorage {
  download(bucket: string, objectPath: string, destPath: string): Promise<void>
  upload(bucket: string, objectPath: string, filePath: string, contentType: string): Promise<void>
  remove(bucket: string, objectPaths: string[]): Promise<void>
}

export interface DubJob {
  dub: DubRow
  video: VideoRow
  profile: ProfileRow
}

export interface JobContext extends StageContext {
  readonly currentStage: DubStatus
  setStage(status: DubStatus): Promise<void>
}

export interface DubbingPipeline {
  readonly name: Pipeline
  run(job: DubJob, ctx: JobContext): Promise<void>
}
