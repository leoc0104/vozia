import { LANGUAGES } from '@vozia/shared'
import { SelectNative } from './ui'

export function LanguageSelect({
  id,
  value,
  onChange,
  allowAuto = false,
}: {
  id: string
  value: string | null
  onChange: (code: string | null) => void
  allowAuto?: boolean
}) {
  return (
    <SelectNative id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}>
      {allowAuto ? <option value="">Auto-detect</option> : null}
      {LANGUAGES.map((language) => (
        <option key={language.code} value={language.code}>
          {language.label}
        </option>
      ))}
    </SelectNative>
  )
}
