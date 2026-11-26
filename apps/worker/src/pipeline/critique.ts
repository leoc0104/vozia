import type { Alignment } from './alignment.js'
import type { Delivery } from './contracts.js'

/** What a take did against the original line, and what to change: lower scores are better takes. */
export interface TakeReview {
  score: number
  /** In plain words, for the translator to act on; empty when the take is good. */
  feedback: string[]
}

export interface ReviewInput {
  /** The original line against the speaker's usual delivery. */
  original?: Delivery
  /** The take against the new voice's usual delivery. */
  take?: Delivery
  alignment: Alignment
  /** Sounds the take performs: the original's length, and the length heard in the take (null when not heard). */
  sounds?: { label: string; originalSec: number; takeSec: number | null }[]
}

/** How far a take may drift from the original before it is sent back. */
export const LIMITS = {
  longRatio: 1.3,
  shortRatio: 0.7,
  lateMs: 250,
  pitchSt: 3.5,
  loudnessDb: 6,
}

const s = (ms: number) => (Math.round(ms / 100) / 10).toFixed(1)
const st = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n)}`

/**
 * Reviews a take like a dubbing director: does it fit the time, do the tied words land with the picture, does it
 * sound like the original line (pitch, liveliness, a scream's peak, how it ends, loudness), and do its laughs last as
 * long. The numbers come from measuring both, so this works the same in every language.
 */
export function reviewTake(input: ReviewInput, limits = LIMITS): TakeReview {
  const feedback: string[] = []
  let score = 0
  const { alignment, original, take } = input

  const ratio = alignment.lengthRatio
  if (ratio > limits.longRatio) {
    feedback.push(`The take's words last ${Math.round((ratio - 1) * 100)}% longer than the original's, so they cannot keep up with the picture: make it about ${Math.round((1 - 1 / ratio) * 100)}% shorter.`)
  } else if (ratio < limits.shortRatio) {
    feedback.push(`The take's words last only ${Math.round(ratio * 100)}% of the original's time: make it about ${Math.round((1 / ratio - 1) * 100)}% longer, or slower.`)
  }
  score += Math.max(0, ratio - 1.15) * 10 + Math.max(0, 0.85 - ratio) * 10
  score += alignment.overflowMs / 200

  for (const error of alignment.errors) {
    if (error.weight === 'soft') continue
    score += Math.max(0, Math.abs(error.errorMs) - 100) / 100
    if (Math.abs(error.errorMs) > limits.lateMs) {
      const late = error.errorMs > 0
      feedback.push(`"${error.label}" lands ${s(Math.abs(error.errorMs))} s ${late ? 'after' : 'before'} the original's moment: move it ${late ? 'earlier' : 'later'} in the line.`)
    }
  }

  if (original && take) {
    if (original.pitchSt !== undefined && take.pitchSt !== undefined) {
      const diff = take.pitchSt - original.pitchSt
      score += Math.max(0, Math.abs(diff) - 2) / 2
      if (Math.abs(diff) > limits.pitchSt) {
        feedback.push(`It sounds ${diff > 0 ? 'higher' : 'lower'} than the original line (${st(take.pitchSt)} semitones against the voice's usual; the original is ${st(original.pitchSt)}).`)
      }
    }
    if (original.pitchRangeSt !== undefined && take.pitchRangeSt !== undefined) {
      const o = original.pitchRangeSt
      const t = take.pitchRangeSt
      if (o < 5 && t > o + 4) {
        feedback.push(`It is much more animated than the original, which is flat (pitch moves ${Math.round(t)} semitones, the original ${Math.round(o)}): play it flat and deadpan.`)
        score += (t - o - 4) / 2
      } else if (o >= 8 && t < o - 5) {
        feedback.push(`It is flatter than the original (pitch moves ${Math.round(t)} semitones, the original ${Math.round(o)}): play it livelier.`)
        score += (o - 5 - t) / 2
      } else if (t > o * 2 && t - o > 6) {
        feedback.push(`It is far more theatrical than the original (pitch moves ${Math.round(t)} semitones, the original ${Math.round(o)}): tone it down.`)
        score += (t - o - 6) / 2
      }
    }
    if (original.peakSt !== undefined && original.peakSt >= 12 && take.peakSt !== undefined && take.peakSt < original.peakSt - 4) {
      feedback.push(`The original peaks in a scream or a shout (${st(original.peakSt)} semitones); the take only reaches ${st(take.peakSt)}: make it a real scream or shout.`)
      score += (original.peakSt - 4 - take.peakSt) / 2
    }
    if (original.endingSt !== undefined && take.endingSt !== undefined && Math.abs(original.endingSt) >= 3) {
      const opposite = Math.sign(original.endingSt) !== Math.sign(take.endingSt) && Math.abs(take.endingSt - original.endingSt) > 4
      if (opposite) {
        feedback.push(`The original ${original.endingSt > 0 ? 'rises' : 'falls'} at the end; the take ${take.endingSt > 0 ? 'rises' : 'falls'}.`)
        score += 2
      }
    }
    if (original.loudnessDb !== undefined && take.loudnessDb !== undefined) {
      const diff = take.loudnessDb - original.loudnessDb
      if (Math.abs(diff) > limits.loudnessDb) {
        feedback.push(`It is ${diff > 0 ? 'louder' : 'softer'} than the original line, against each voice's usual: the original is ${original.loudnessDb >= 3 ? 'louder than usual' : original.loudnessDb <= -3 ? 'quieter than usual' : 'at its usual level'}.`)
        score += (Math.abs(diff) - limits.loudnessDb) / 3
      }
    }
  }

  for (const sound of input.sounds ?? []) {
    if (sound.takeSec === null) {
      feedback.push(`The ${sound.label} the original has here was not heard in the take: perform it clearly.`)
      score += 2
    } else if (sound.originalSec >= 0.8 && sound.takeSec < sound.originalSec * 0.5) {
      feedback.push(`The ${sound.label} lasts ${sound.takeSec.toFixed(1)} s in the take but ${sound.originalSec.toFixed(1)} s in the original: make it last longer (for laughter, [laughs harder] or [starts laughing]).`)
      score += 2
    }
  }

  return { score: Math.round(score * 100) / 100, feedback }
}
