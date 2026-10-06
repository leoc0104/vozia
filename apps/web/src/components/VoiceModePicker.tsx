import { STOCK_VOICES, VOICE_MODES, type VoiceMode } from '@vozia/shared'
import { Field, RadioCardGroup, RadioCardIndicator, RadioCardItem, SelectNative } from './ui-next'

const options: { value: VoiceMode; title: string; body: string }[] = [
  { value: 'clone', title: 'Keep my voice', body: 'Clones the speaker from the original audio.' },
  { value: 'stock', title: 'Stock voice', body: 'Pick a curated professional voice.' },
]

function isVoiceMode(value: string): value is VoiceMode {
  return (VOICE_MODES as readonly string[]).includes(value)
}

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
      <RadioCardGroup
        aria-label="Voice"
        value={voiceMode}
        onValueChange={(value) => {
          if (!isVoiceMode(value)) return
          onChange({ voiceMode: value, stockVoiceId: value === 'stock' ? (stockVoiceId ?? STOCK_VOICES[0]!.id) : null })
        }}
        className="grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {options.map((option) => (
          <RadioCardItem key={option.value} value={option.value}>
            <div className="flex items-start gap-3">
              <RadioCardIndicator className="mt-0.5" />
              <div>
                <span className="block text-sm font-semibold text-gray-900 dark:text-gray-50">{option.title}</span>
                <span className="mt-1 block text-xs text-gray-600 dark:text-gray-400">{option.body}</span>
              </div>
            </div>
          </RadioCardItem>
        ))}
      </RadioCardGroup>
      {voiceMode === 'stock' ? (
        <Field label="Stock voice" htmlFor="stock-voice" error={error}>
          <SelectNative
            id="stock-voice"
            value={stockVoiceId ?? ''}
            hasError={Boolean(error)}
            onChange={(e) => onChange({ voiceMode: 'stock', stockVoiceId: e.target.value })}
          >
            {STOCK_VOICES.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name} — {voice.description}
              </option>
            ))}
          </SelectNative>
        </Field>
      ) : null}
    </div>
  )
}
