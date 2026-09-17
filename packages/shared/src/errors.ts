/** Error text raised by the `dubs` insert trigger when the owner has no dubbing minutes left. */
export const INSUFFICIENT_MINUTES_CODE = 'insufficient_minutes'

export function isInsufficientMinutesError(error: unknown): boolean {
  if (!error) return false
  const text =
    typeof error === 'string'
      ? error
      : [(error as { message?: unknown }).message, (error as { details?: unknown }).details]
          .filter((v): v is string => typeof v === 'string')
          .join(' ')
  return text.includes(INSUFFICIENT_MINUTES_CODE)
}
