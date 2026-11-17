import { languageDir, languageLabel, languageName } from '@vozia/shared'

/**
 * A language by its own name, in its own script, never a flag: a language is not a country. It carries `lang` and
 * `dir` so browsers pick the right font and screen readers the right voice, and hovering shows the English name.
 */
export function LanguageName({ code, className }: { code: string; className?: string }) {
  const name = languageName(code)
  const english = languageLabel(code)
  return (
    <span lang={code} dir={languageDir(code)} title={english === name ? undefined : english} className={className}>
      {name}
    </span>
  )
}
