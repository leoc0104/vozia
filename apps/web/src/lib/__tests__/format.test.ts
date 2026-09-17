import { formatBytes, formatDuration } from '../format'
import { useUploadStore } from '../../stores/upload-store'

describe('formatters', () => {
  it('formats durations', () => {
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(3723)).toBe('1:02:03')
    expect(formatDuration(null)).toBe('—')
  })

  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(15 * 1024 ** 2)).toBe('15 MB')
    expect(formatBytes(3.5 * 1024 ** 3)).toBe('3.5 GB')
  })
})

describe('upload store', () => {
  it('tracks progress monotonically and clears entries', () => {
    const store = useUploadStore.getState()
    store.start('a')
    store.progress('a', 0.4)
    store.progress('a', 0.2)
    expect(useUploadStore.getState().uploads.a).toEqual({ fraction: 0.4, status: 'uploading', error: null })
    store.fail('a', 'network')
    expect(useUploadStore.getState().uploads.a?.status).toBe('error')
    store.finish('a')
    expect(useUploadStore.getState().uploads.a?.fraction).toBe(1)
    store.clear('a')
    expect(useUploadStore.getState().uploads.a).toBeUndefined()
  })
})
