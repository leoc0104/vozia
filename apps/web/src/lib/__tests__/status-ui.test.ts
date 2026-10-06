import { describe, expect, it } from 'vitest'
import { badgeVariantForStatus } from '../status-ui'

describe('badgeVariantForStatus', () => {
  it('maps every dub status to a badge colour', () => {
    expect(badgeVariantForStatus('queued')).toBe('neutral')
    expect(badgeVariantForStatus('ingesting')).toBe('info')
    expect(badgeVariantForStatus('translating')).toBe('info')
    expect(badgeVariantForStatus('dubbing')).toBe('info')
    expect(badgeVariantForStatus('completed')).toBe('success')
    expect(badgeVariantForStatus('failed')).toBe('error')
  })
})
