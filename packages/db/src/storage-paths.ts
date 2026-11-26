export const BUCKETS = { sources: 'sources', outputs: 'outputs' } as const
export type Bucket = (typeof BUCKETS)[keyof typeof BUCKETS]

export type OutputFile =
  | 'dubbed.mp4'
  | 'dubbed_vocals.wav'
  | 'original.srt'
  | 'translated.srt'
  // What a finished dub keeps so its lines can be re-taken: its state, the voice sample and each line's take.
  | 'work/state.json'
  | 'work/sample.mp3'
  | `work/takes/${number}.mp3`
export type SourceExtension = 'mp4' | 'mov' | 'webm' | 'mkv'

const MIME_TO_EXTENSION: Record<string, SourceExtension> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-matroska': 'mkv',
}

/** Object paths always start with the owner's user id: storage policies key on that first segment. */
export function sourceObjectPath(ownerId: string, videoId: string, extension: string): string {
  return `${ownerId}/${videoId}/original.${extension}`
}

export function thumbnailObjectPath(ownerId: string, videoId: string): string {
  return `${ownerId}/${videoId}/thumb.jpg`
}

export function outputObjectPath(ownerId: string, dubId: string, file: OutputFile): string {
  return `${ownerId}/${dubId}/${file}`
}

export function ownerFromObjectPath(objectPath: string): string | null {
  const [owner, ...rest] = objectPath.split('/')
  return owner && rest.length > 0 ? owner : null
}

export function extensionForMime(mime: string): SourceExtension | null {
  return MIME_TO_EXTENSION[mime] ?? null
}
