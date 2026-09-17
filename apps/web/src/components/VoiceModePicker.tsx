import { STOCK_VOICES, type VoiceMode } from '@vozia/shared'
import { cn } from '../lib/cn'
import { Field, Select } from './ui'

const options: { value: VoiceMode; title: string; body: string }[] = [
  { value: 'clone', title: 'Keep my voice', body: 'Clones the speaker from the original audio.' },
  { value: 'stock', title: 'Stock voice', body: 'Pick a curated professional voice.' },
]

export function VoiceModePicker({
  voiceMode,
  stockVoiceId,
  onChange,
  error,
}: {
  voiceMode: VoiceMode
  stockVoiceId: string | null
  onChange: (next: { voiceMode: VoiceMode; stockVoiceId: string | null }) => void
  error?: string | null
}) {
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Voice" className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={voiceMode === option.value}
            onClick={() => onChange({ voiceMode: option.value, stockVoiceId: option.value === 'stock' ? (stockVoiceId ?? STOCK_VOICES[0]!.id) : null })}
            className={cn(
              'rounded-lg border p-4 text-left transition-colors',
              voiceMode === option.value ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 bg-white hover:border-slate-300',
            )}
          >
            <span className="block text-sm font-semibold text-slate-900">{option.title}</span>
            <span className="mt-1 block text-xs text-slate-600">{option.body}</span>
          </button>
        ))}
      </div>
      {voiceMode === 'stock' ? (
        <Field label="Stock voice" htmlFor="stock-voice" error={error}>
          <Select id="stock-voice" value={stockVoiceId ?? ''} onChange={(e) => onChange({ voiceMode: 'stock', stockVoiceId: e.target.value })}>
            {STOCK_VOICES.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name} — {voice.description}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
    </div>
  )
}
