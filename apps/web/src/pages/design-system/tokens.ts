export const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const

/** A theme color's real value, read from the page's CSS, so this page cannot drift from the tokens. */
export function tokenValue(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-${token}`).trim().toLowerCase()
}
