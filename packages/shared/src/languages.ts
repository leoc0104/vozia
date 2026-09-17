export interface Language {
  code: string
  label: string
}

/** Target languages supported by the speech providers (ISO 639-1, `fil` for Filipino). */
export const LANGUAGES: readonly Language[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ar', label: 'Arabic' },
  { code: 'ru', label: 'Russian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'tr', label: 'Turkish' },
  { code: 'sv', label: 'Swedish' },
  { code: 'id', label: 'Indonesian' },
  { code: 'fil', label: 'Filipino' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'el', label: 'Greek' },
  { code: 'cs', label: 'Czech' },
  { code: 'fi', label: 'Finnish' },
  { code: 'ro', label: 'Romanian' },
  { code: 'da', label: 'Danish' },
  { code: 'bg', label: 'Bulgarian' },
  { code: 'ms', label: 'Malay' },
  { code: 'sk', label: 'Slovak' },
  { code: 'hr', label: 'Croatian' },
  { code: 'ta', label: 'Tamil' },
]

const byCode = new Map(LANGUAGES.map((l) => [l.code, l]))

export function isLanguageCode(code: string): boolean {
  return byCode.has(code)
}

export function languageLabel(code: string): string {
  return byCode.get(code)?.label ?? code
}
