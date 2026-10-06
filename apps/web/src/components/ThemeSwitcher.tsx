import { useRef, type KeyboardEvent } from 'react'
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import type { ThemePreference } from '../lib/theme'
import { cx, focusRing } from '../lib/utils'
import { useThemeStore } from '../stores/theme-store'

const OPTIONS: { value: ThemePreference; label: string; Icon: LucideIcon }[] = [
  { value: 'system', label: 'System theme', Icon: Monitor },
  { value: 'light', label: 'Light theme', Icon: Sun },
  { value: 'dark', label: 'Dark theme', Icon: Moon },
]

const NEXT_KEYS = ['ArrowRight', 'ArrowDown']
const PREVIOUS_KEYS = ['ArrowLeft', 'ArrowUp']

/** System / light / dark switch, a radio group with roving focus like the WAI-ARIA radio pattern. */
export function ThemeSwitcher({ className }: { className?: string }) {
  const preference = useThemeStore((s) => s.preference)
  const setPreference = useThemeStore((s) => s.setPreference)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = NEXT_KEYS.includes(event.key) ? 1 : PREVIOUS_KEYS.includes(event.key) ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const current = OPTIONS.findIndex((option) => option.value === preference)
    const next = (current + step + OPTIONS.length) % OPTIONS.length
    setPreference(OPTIONS[next]!.value)
    buttons.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      onKeyDown={onKeyDown}
      className={cx(
        'inline-flex items-center gap-0.5 rounded-full border border-gray-200 bg-white p-0.5 dark:border-gray-800 dark:bg-gray-950',
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }, index) => {
        const selected = preference === value
        return (
          <button
            key={value}
            ref={(element) => {
              buttons.current[index] = element
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            tabIndex={selected ? 0 : -1}
            onClick={() => setPreference(value)}
            className={cx(
              'grid size-7 place-items-center rounded-full transition-colors',
              selected
                ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50'
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50',
              focusRing,
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}
