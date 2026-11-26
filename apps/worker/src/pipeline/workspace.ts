import { outputObjectPath } from '@vozia/db'
import type { Alignment } from './alignment.js'
import type { Caption, LineNotes, Piece, SoundEvent, TranslatedSegment, VideoBrief } from './contracts.js'
import type { TakeReview } from './critique.js'
import type { PerformedLine } from './director.js'
import type { AttachedSound } from './performance.js'
import type { TimeWindow } from './speech-windows.js'

/** One line as it was laid: its take lives next to the state, at workspacePaths(...).take(idx). */
export interface WorkspaceLine {
  idx: number
  spoken: string
  takes: number
  revised: boolean
  pieces: Omit<Piece, 'path'>[]
  review: TakeReview | null
  alignment: Alignment | null
  delivery: PerformedLine['delivery']
  soundSpans: TimeWindow[]
}

/**
 * What a finished dub keeps so one of its lines can be re-taken later without dubbing the whole video again: what was
 * learned about the original, how each line was performed and laid, and the voice the clone was made from. The
 * separated voice and background are not kept: they are separated again from the source, which costs time, not
 * storage.
 */
export interface DubWorkspace {
  version: 1
  sourceLanguage: string
  targetLanguage: string
  totalDurationMs: number
  segments: TranslatedSegment[]
  notes: [number, LineNotes][]
  sounds: [number, AttachedSound[]][]
  tagged: SoundEvent[]
  cutsMs: number[]
  brief: { summary: string; glossary: VideoBrief['glossary']; onScreen: [number, string][]; captions: Caption[] } | null
  /** The pitch correction applied to the voice, kept so a re-take sounds the same. */
  pitchShiftSt: number
  hasSample: boolean
  lines: WorkspaceLine[]
}

export function workspacePaths(ownerId: string, dubId: string) {
  return {
    state: outputObjectPath(ownerId, dubId, 'work/state.json'),
    sample: outputObjectPath(ownerId, dubId, 'work/sample.mp3'),
    take: (idx: number) => outputObjectPath(ownerId, dubId, `work/takes/${idx}.mp3`),
  }
}

export function briefToWorkspace(brief: VideoBrief | null): DubWorkspace['brief'] {
  return brief ? { summary: brief.summary, glossary: brief.glossary, onScreen: [...brief.onScreen], captions: brief.captions } : null
}

export function briefFromWorkspace(brief: DubWorkspace['brief']): VideoBrief | null {
  return brief ? { ...brief, onScreen: new Map(brief.onScreen) } : null
}

export function toWorkspaceLine(line: PerformedLine): WorkspaceLine {
  return {
    idx: line.segment.idx,
    spoken: line.spoken,
    takes: line.takes,
    revised: line.revised,
    pieces: line.pieces.map(({ fromMs, toMs, outStartMs, tempo }) => ({ fromMs, toMs, outStartMs, tempo })),
    review: line.review,
    alignment: line.alignment,
    delivery: line.delivery,
    soundSpans: line.soundSpans,
  }
}

/** A kept line, ready to lay again, with its take downloaded to `takePath`. */
export function fromWorkspaceLine(line: WorkspaceLine, segment: TranslatedSegment, takePath: string): PerformedLine {
  return {
    segment,
    spoken: line.spoken,
    pieces: line.pieces.map((piece) => ({ ...piece, path: takePath })),
    takes: line.takes,
    revised: line.revised,
    review: line.review,
    alignment: line.alignment,
    delivery: line.delivery,
    soundSpans: line.soundSpans,
  }
}
