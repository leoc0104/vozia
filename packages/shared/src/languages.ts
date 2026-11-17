export interface Language {
  code: string
  /** The English name, for prompts, logs and anywhere the reader's language is unknown. */
  label: string
  /** The language's own name, in its own script: people find their language by reading it. */
  nativeName: string
  /** Written right to left. */
  rtl?: boolean
}

/** Target languages supported by the speech providers (ISO 639-1, `fil` for Filipino). */
export const LANGUAGES: readonly Language[] = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'es', label: 'Spanish', nativeName: 'Español' },
  { code: 'pt', label: 'Portuguese', nativeName: 'Português' },
  { code: 'fr', label: 'French', nativeName: 'Français' },
  { code: 'de', label: 'German', nativeName: 'Deutsch' },
  { code: 'it', label: 'Italian', nativeName: 'Italiano' },
  { code: 'ja', label: 'Japanese', nativeName: '日本語' },
  { code: 'ko', label: 'Korean', nativeName: '한국어' },
  { code: 'zh', label: 'Chinese', nativeName: '中文' },
  { code: 'hi', label: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ar', label: 'Arabic', nativeName: 'العربية', rtl: true },
  { code: 'ru', label: 'Russian', nativeName: 'Русский' },
  { code: 'nl', label: 'Dutch', nativeName: 'Nederlands' },
  { code: 'pl', label: 'Polish', nativeName: 'Polski' },
  { code: 'tr', label: 'Turkish', nativeName: 'Türkçe' },
  { code: 'sv', label: 'Swedish', nativeName: 'Svenska' },
  { code: 'id', label: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'fil', label: 'Filipino', nativeName: 'Filipino' },
  { code: 'uk', label: 'Ukrainian', nativeName: 'Українська' },
  { code: 'el', label: 'Greek', nativeName: 'Ελληνικά' },
  { code: 'cs', label: 'Czech', nativeName: 'Čeština' },
  { code: 'fi', label: 'Finnish', nativeName: 'Suomi' },
  { code: 'ro', label: 'Romanian', nativeName: 'Română' },
  { code: 'da', label: 'Danish', nativeName: 'Dansk' },
  { code: 'bg', label: 'Bulgarian', nativeName: 'Български' },
  { code: 'ms', label: 'Malay', nativeName: 'Bahasa Melayu' },
  { code: 'sk', label: 'Slovak', nativeName: 'Slovenčina' },
  { code: 'hr', label: 'Croatian', nativeName: 'Hrvatski' },
  { code: 'ta', label: 'Tamil', nativeName: 'தமிழ்' },
]

const byCode = new Map(LANGUAGES.map((l) => [l.code, l]))

export function isLanguageCode(code: string): boolean {
  return byCode.has(code)
}

/** The English name, e.g. "Japanese". */
export function languageLabel(code: string): string {
  return byCode.get(code)?.label ?? code
}

/** The language's own name, e.g. "日本語". */
export function languageName(code: string): string {
  return byCode.get(code)?.nativeName ?? code
}

/** The writing direction, for the `dir` attribute. */
export function languageDir(code: string): 'ltr' | 'rtl' {
  return byCode.get(code)?.rtl ? 'rtl' : 'ltr'
}
