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
  /** Words of the translation tied to the word of the original said at the same moment, so the dub can land them there. */
  anchors?: Anchor[]
}

/** `target` (a word of the translation) belongs at the moment `source` (a word of the original line) was said. */
export interface Anchor {
  source: string
  target: string
}

/** Text written in the picture, translated, and when it is visible. */
export interface Caption {
  startMs: number
  endMs: number
  text: string
  translation: string
}

/** What the translator learned from watching the video before translating it. */
export interface VideoBrief {
  /** What the video is, who speaks, the tone and any running joke. */
  summary: string
  /** Names, slang and jargon to translate consistently. */
  glossary: { term: string; translation: string }[]
  /** What is on screen while each line is said. */
  onScreen: Map<number, string>
  captions: Caption[]
}

/** A line sent back to the translator because its take did not fit or did not sound like the original. */
export interface RevisionRequest {
  segment: TranslatedSegment
  notes?: LineNotes
  /** What went wrong, measured from the take, in plain words. */
  feedback: string[]
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
  /** What is on screen while the line is said, from watching the video. */
  onScreen?: string
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
  /** The timed words and tagged sounds of an audio file as they are, for measuring takes; one voice, no grouping. */
  words?(audioPath: string, opts: { languageHint: string | null }, ctx: StageContext): Promise<{ words: Word[]; events: SoundEvent[] }>
}

export interface TranslateOptions {
  sourceLanguage: string
  targetLanguage: string
  notes?: ReadonlyMap<number, LineNotes>
  brief?: VideoBrief | null
}

export interface Translator {
  /** Watches the video (frames and the whole transcript) before translating it; null when it cannot see. */
  watch?(
    segments: TranscriptSegment[],
    opts: { sourceLanguage: string; targetLanguage: string; frames: Frame[]; cutsMs: number[]; durationMs: number },
    ctx: StageContext,
  ): Promise<VideoBrief | null>
  translate(segments: TranscriptSegment[], opts: TranslateOptions, ctx: StageContext): Promise<TranslatedSegment[]>
  /** Rewrites lines whose takes did not fit their time or did not sound like the original, from measured feedback. */
  revise?(requests: RevisionRequest[], opts: TranslateOptions, ctx: StageContext): Promise<TranslatedSegment[]>
}

export interface VoiceRequest {
  voiceMode: VoiceMode
  stockVoiceId: string | null
  /** A clip of the speaker's own voice to clone from, for voiceMode 'clone'. */
  samplePath: string | null
  targetLanguage: string
}

/** One take of one line. */
export interface SpokenLine {
  text: string
  /** The lines around it, so the voice carries one continuous performance across lines. */
  previousText?: string
  nextText?: string
  /** Different seeds give different takes of the same line. */
  seed?: number
}

export interface VoiceSession {
  speak(line: SpokenLine, destPath: string, ctx: StageContext): Promise<void>
  /** Releases the voice (deletes a clone made for this dub). */
  close(ctx: StageContext): Promise<void>
}

export interface SpeechSynthesizer {
  /**
   * True when the voice speaks `performanceText` and performs its directions, like [laughs] or [whispering]. The dub
   * then leaves the speaker's own laughs and sighs next to each line to the new voice instead of the original audio.
   */
  readonly performsDirections?: boolean
  /** Prepares the voice for one dub: a clone of the speaker made from `samplePath`, or the chosen stock voice. */
  openVoice(req: VoiceRequest, ctx: StageContext): Promise<VoiceSession>
}

/** Where a synthesized clip lands on the original timeline and how much it must be sped up. */
export interface Placement {
  idx: number
  startMs: number
  tempo: number
}

/** A stretch of a take (`fromMs` to `toMs` of the clip) laid on the timeline at `outStartMs`, at `tempo` speed. */
export interface Piece {
  path: string
  fromMs: number
  toMs: number
  outStartMs: number
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
  buildDubBackground(input: DubBackgroundInput, ctx: StageContext): Promise<string>
  /**
   * The dubbed voice made to sound recorded where the original was: its tone and frequency range matched to the
   * original voice, a matching room when the original rings on, and its pitch moved by `pitchShiftSt` (a clone that
   * speaks higher or lower than the speaker). Null when it cannot be done: the dub keeps the voice as it is.
   */
  matchVoice(
    input: { originalVocalsPath: string; originalSpeech: TimeWindow[]; dubVocalsPath: string; dubSpeech: TimeWindow[]; pitchShiftSt?: number },
    ctx: StageContext,
  ): Promise<{ path: string; report: VoiceMatchReport } | null>
  /** Joins stretches of one file into a short MP3 with brief pauses between them, like a voice sample to clone. */
  joinSpans(inputPath: string, spans: TimeWindow[], ctx: StageContext): Promise<string>
  /**
   * Joins clips end to end into one WAV with `gapMs` of silence between them, so a single pass can measure them all;
   * returns where each clip landed in it.
   */
  joinClips(paths: string[], gapMs: number, ctx: StageContext): Promise<{ path: string; spans: TimeWindow[] }>
  /** Lays the pieces on a silent track as long as the video. */
  assembleTimeline(pieces: Piece[], totalDurationMs: number, ctx: StageContext): Promise<string>
  /** Integrated loudness (EBU R128) in LUFS, which ignores silence between lines; null for silence or on failure. */
  loudness(path: string, ctx: StageContext): Promise<number | null>
  /**
   * `voiceGainDb` raises or lowers the new voice, so it can speak as loud as the original speaker did; `captions`
   * are drawn over the picture while they are on screen (the video is re-encoded only then).
   */
  mux(
    input: { videoPath: string; backgroundPath: string; dubbedVocalsPath: string; voiceGainDb?: number; captions?: Caption[] },
    ctx: StageContext,
  ): Promise<{ outputPath: string }>
}

export interface DubBackgroundInput {
  originalPath: string
  backgroundPath: string
  /** Where the original voice gives way to the dub. */
  speech: TimeWindow[]
  /** The separated voice track and where its words and voice sounds are, to carry its own noise into `speech`. */
  vocalsPath?: string
  busy?: TimeWindow[]
}

/** What matching the dubbed voice to the original did. */
export interface VoiceMatchReport {
  /** The tone change at a few frequencies, in dB. */
  eq: Record<string, number> | null
  /** The original's highest useful frequency, above which the dub was cut. */
  bandwidthHz: number | null
  room: { decaySec: number; wetDb: number; dropAfterDb: number } | null
  pitchShiftSt: number
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
