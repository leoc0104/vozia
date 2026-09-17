import { describe, expect, it } from 'vitest'
import {
  DUB_STATUSES,
  STAGE_ORDER,
  canTransition,
  isTerminal,
  nextStage,
  progressAtStageStart,
  progressWithin,
} from '../status.js'

describe('status machine', () => {
  it('lists every status exactly once', () => {
    expect(new Set(DUB_STATUSES).size).toBe(DUB_STATUSES.length)
    expect(DUB_STATUSES).toContain('dubbing')
  })

  it('allows the staged happy path in order', () => {
    const order = STAGE_ORDER.staged
    for (let i = 0; i < order.length - 1; i++) {
      expect(canTransition(order[i]!, order[i + 1]!)).toBe(true)
    }
  })

  it('allows the elevenlabs happy path in order', () => {
    expect(canTransition('queued', 'ingesting')).toBe(true)
    expect(canTransition('ingesting', 'dubbing')).toBe(true)
    expect(canTransition('dubbing', 'completed')).toBe(true)
  })

  it('rejects skipping, mixing and leaving completed', () => {
    expect(canTransition('queued', 'transcribing')).toBe(false)
    expect(canTransition('muxing', 'dubbing')).toBe(false)
    expect(canTransition('completed', 'queued')).toBe(false)
    expect(canTransition('completed', 'failed')).toBe(false)
    expect(canTransition('synthesizing', 'translating')).toBe(false)
  })

  it('lets any in-progress stage fail and failed be retried', () => {
    expect(canTransition('queued', 'failed')).toBe(true)
    expect(canTransition('translating', 'failed')).toBe(true)
    expect(canTransition('dubbing', 'failed')).toBe(true)
    expect(canTransition('failed', 'queued')).toBe(true)
    expect(canTransition('failed', 'ingesting')).toBe(false)
  })

  it('knows terminal statuses', () => {
    expect(isTerminal('completed')).toBe(true)
    expect(isTerminal('failed')).toBe(true)
    expect(isTerminal('muxing')).toBe(false)
  })

  it('computes the next stage per pipeline', () => {
    expect(nextStage('staged', 'translating')).toBe('synthesizing')
    expect(nextStage('elevenlabs', 'dubbing')).toBe('completed')
    expect(nextStage('staged', 'completed')).toBeNull()
    expect(nextStage('elevenlabs', 'muxing')).toBeNull()
  })

  it('maps stages to progress ranges', () => {
    expect(progressAtStageStart('muxing')).toBe(85)
    expect(progressAtStageStart('queued')).toBe(0)
    expect(progressWithin('synthesizing', 0.5)).toBe(70)
    expect(progressWithin('synthesizing', 2)).toBe(85)
    expect(progressWithin('synthesizing', -1)).toBe(55)
    expect(progressWithin('completed', 0)).toBe(100)
  })
})
