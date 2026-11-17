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
      {/* Each language by its own name, with the English one beside it, so a language you do not read is still easy to find. */}
      {LANGUAGES.map(({ code, label, nativeName }) => (
        <option key={code} value={code}>
          {nativeName === label ? label : `${nativeName} · ${label}`}
        </option>
      ))}
    </SelectNative>
  )
}
