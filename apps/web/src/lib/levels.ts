/** FNV-1a: a small, stable string hash, so a video keeps its voiceprint across renders and sessions. */
function hash(seed: string): number {
  let value = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    value ^= seed.charCodeAt(i)
    value = Math.imul(value, 0x01000193)
  }
  return value >>> 0
}

const MIN_HEIGHT = 20
const MAX_HEIGHT = 100

/**
 * Bar heights in percent for a seed: a voiceprint that is stable for a given video. Speech comes in
 * phrases, so each bar mixes a slow swell with its own noise.
 */
export function levelHeights(seed: string, count: number): number[] {
  const start = hash(seed) || 1
  const phase = (start % 628) / 100
  let state = start
  return Array.from({ length: count }, (_, i) => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    const noise = (state % 1000) / 999
    const swell = 0.5 + 0.5 * Math.sin((i / Math.max(count, 1)) * Math.PI * 3 + phase)
    return Math.round(MIN_HEIGHT + (MAX_HEIGHT - MIN_HEIGHT) * (0.4 * swell + 0.6 * noise))
  })
}
