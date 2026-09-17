import { describe, expect, it } from 'vitest'
import {
  BUCKETS,
  extensionForMime,
  outputObjectPath,
  ownerFromObjectPath,
  sourceObjectPath,
  thumbnailObjectPath,
} from '../storage-paths.js'

const owner = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const video = '16fd2706-8baf-433b-82eb-8c7fada847da'

describe('storage paths', () => {
  it('names buckets', () => {
    expect(BUCKETS).toEqual({ sources: 'sources', outputs: 'outputs' })
  })

  it('builds owner-scoped object paths', () => {
    expect(sourceObjectPath(owner, video, 'mp4')).toBe(`${owner}/${video}/original.mp4`)
    expect(thumbnailObjectPath(owner, video)).toBe(`${owner}/${video}/thumb.jpg`)
    expect(outputObjectPath(owner, video, 'translated.srt')).toBe(`${owner}/${video}/translated.srt`)
  })

  it('reads the owner back from a path', () => {
    expect(ownerFromObjectPath(`${owner}/${video}/original.mp4`)).toBe(owner)
    expect(ownerFromObjectPath('')).toBeNull()
    expect(ownerFromObjectPath('no-slash')).toBeNull()
  })

  it('maps mime types to extensions', () => {
    expect(extensionForMime('video/mp4')).toBe('mp4')
    expect(extensionForMime('video/quicktime')).toBe('mov')
    expect(extensionForMime('video/webm')).toBe('webm')
    expect(extensionForMime('video/x-matroska')).toBe('mkv')
    expect(extensionForMime('audio/mpeg')).toBeNull()
  })
})
