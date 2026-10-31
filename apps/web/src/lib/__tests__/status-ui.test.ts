import { describe, expect, it } from 'vitest'
import { badgeVariantForStatus } from '../status-ui'

describe('badgeVariantForStatus', () => {
  it('maps every dub status to a badge colour, with work in progress shown as live', () => {
    expect(badgeVariantForStatus('queued')).toBe('neutral')
    expect(badgeVariantForStatus('ingesting')).toBe('live')
    expect(badgeVariantForStatus('translating')).toBe('live')
    expect(badgeVariantForStatus('dubbing')).toBe('live')
    expect(badgeVariantForStatus('completed')).toBe('success')
    expect(badgeVariantForStatus('failed')).toBe('error')
  })
})
