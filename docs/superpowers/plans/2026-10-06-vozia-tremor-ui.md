# Vozia Tremor UI and Theming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Executed natively by the session that wrote it: the user asked for the build to run overnight without check-ins. Every task still ends green (tests, typecheck, lint) and with a commit. All commits land on the existing `feat/mvp` branch — no separate feature branch.

**Goal:** Replace Vozia's hand-rolled UI primitives with Vercel's Tremor components and Geist font, and add light / dark / system themes, without changing behaviour.

**Architecture:** Tremor component source is copied into the web app (brand-purple accents, lucide icons, small accessibility fixes). A persisted Zustand theme store toggles `.dark` on `<html>`; Tailwind's `dark:` variant is bound to that class; an inline script applies the stored theme before first paint. Pages swap slate classes for Tremor's gray + `dark:` pairs.

**Tech Stack:** React 19, Vite 8, Tailwind 4.3, TanStack Router/Query, Zustand 5, Radix (slot, label, tabs, dialog, radio-group), tailwind-variants 3, tailwind-merge 3, clsx 2, @fontsource-variable/geist(-mono) 5, Vitest 5 + Testing Library, Playwright (outside the repo) for screenshots.

**Spec:** `docs/superpowers/specs/2026-10-06-vozia-tremor-ui-design.md`

## Global Constraints

- No behaviour changes: routes, data calls, validation and copy stay as they are unless a spec row says otherwise.
- Tremor's `blue-*` → `brand-*` everywhere in ported code; Badge keeps Tremor's blue only as the new `info` variant.
- Icons only from `lucide-react`.
- Ported files start with `// Tremor <Name> (Apache-2.0), adapted for Vozia`; `components/ui/LICENSE-tremor` holds the Apache-2.0 text.
- Theme storage key `vozia-theme`; persisted shape is zustand's `{"state":{"preference":...},"version":0}`; preference values exactly `light`, `dark`, `system`; default `system`.
- `Button` renders `type="button"` unless a `type` prop is passed.
- Commits: one conventional-commit line, no body, no trailers.

## Review Focus

1. A corrupted or unknown stored theme (`{"state":{"preference":"blue"}}`, invalid JSON) must fall back to `system` in both the store and the inline script — never a crash or a stuck theme.
2. `localStorage` throwing (private mode, blocked storage) must not break rendering; the theme still follows the OS.
3. While on `system`, an OS theme change updates the page live; with an explicit `light`/`dark` choice, OS changes are ignored.
4. Buttons that are not submit buttons (theme switcher, Google sign-in, Cancel, dialog triggers) must never submit the surrounding form.
5. Long transcript sentences and long video titles must wrap or truncate instead of forcing horizontal page scroll, in both themes.

Tests pinning 1–3 live in Task 2, 4 in Tasks 2 and 3, 5 in Task 4.

---

## File Structure

```
apps/web/
├── index.html                         + no-flash theme script
├── package.json                       + radix/tailwind-variants/tailwind-merge/clsx/fontsource deps
└── src/
    ├── main.tsx                       + font imports, initTheme()
    ├── index.css                      dark variant, brand-950, fonts, Tremor animations, base colours
    ├── lib/utils.ts                   cx, focusRing, focusInput, hasErrorInput      (replaces lib/cn.ts)
    ├── lib/theme.ts                   theme types, resolve/apply helpers, OS subscription
    ├── lib/status-ui.ts               toneForStatus → badgeVariantForStatus
    ├── stores/theme-store.ts          useThemeStore, initTheme
    ├── components/ThemeSwitcher.tsx
    ├── components/ConfirmDialog.tsx
    ├── components/ui/                 Tremor ports + Field, Spinner, EmptyState, index.ts, LICENSE-tremor
    ├── components/*.tsx               restyled shared components and layouts
    ├── pages/*.tsx                    restyled pages
    └── test/setup.ts                  + ResizeObserver, matchMedia stubs
```

## Class mapping (used by Tasks 4 and 5)

| Old | New |
|---|---|
| `bg-slate-50` (page) | `bg-gray-50 dark:bg-gray-950` |
| `bg-white` (surface, header) | `bg-white dark:bg-gray-950` (cards use `Card`) |
| `text-slate-900` | `text-gray-900 dark:text-gray-50` |
| `text-slate-800` | `text-gray-800 dark:text-gray-200` |
| `text-slate-700` | `text-gray-700 dark:text-gray-300` |
| `text-slate-600` | `text-gray-600 dark:text-gray-400` |
| `text-slate-500` | `text-gray-500 dark:text-gray-500` |
| `text-slate-400` | `text-gray-400 dark:text-gray-600` |
| `border-slate-100` | `border-gray-100 dark:border-gray-900` |
| `border-slate-200` | `border-gray-200 dark:border-gray-800` |
| `border-slate-300` | `border-gray-300 dark:border-gray-700` |
| `bg-slate-100` | `bg-gray-100 dark:bg-gray-900` |
| `bg-slate-200` | `bg-gray-200 dark:bg-gray-800` |
| `divide-slate-100` | `divide-gray-100 dark:divide-gray-800` |
| `hover:bg-slate-50` / `hover:bg-slate-100` | `hover:bg-gray-50 dark:hover:bg-gray-900` / `hover:bg-gray-100 dark:hover:bg-gray-800` |
| `text-brand-600` (links) | `text-brand-600 dark:text-brand-400` |
| `bg-brand-100 text-brand-700` | `bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300` |

## Component mapping (used by Tasks 4 and 5)

| Old | New |
|---|---|
| `Button variant="danger"` | `Button variant="destructive"` |
| `Button loading` | `Button isLoading` |
| `Alert tone="error\|success\|info"` | `Callout variant="error\|success\|default"` |
| `Progress value label` | `ProgressBar value aria-label` |
| `Card` + `CardBody` | `Card` (own padding; `className="p-0"` where an image bleeds to the edges) |
| `Badge tone=…` | `Badge variant=…` via `badgeVariantForStatus` |
| `Select` (native) | `SelectNative` |
| `Tabs items value onChange` | `Tabs value onValueChange` + `TabsList variant="solid"` + `TabsTrigger` |
| `Field` (from `ui/Input`) | `Field` (own file, Tremor `Label`) |
| `window.confirm(...)` | `ConfirmDialog` |
| `cn(...)` | `cx(...)` |

---

### Task 1: Foundation — dependencies, utilities, CSS base, test stubs

**Files:** Modify `apps/web/package.json`, `apps/web/src/index.css`, `apps/web/src/test/setup.ts`. Create `apps/web/src/lib/utils.ts`, `apps/web/src/lib/__tests__/utils.test.ts`.

**Produces:** `cx(...classes: ClassValue[]): string`, `focusRing: string[]`, `focusInput: string[]`, `hasErrorInput: string[]` (brand-coloured).

- [ ] Add deps: `pnpm --filter @vozia/web add @radix-ui/react-slot @radix-ui/react-label @radix-ui/react-tabs @radix-ui/react-dialog @radix-ui/react-radio-group tailwind-variants tailwind-merge clsx @fontsource-variable/geist @fontsource-variable/geist-mono`.
- [ ] Failing test `utils.test.ts`:

```ts
import { cx, focusInput, focusRing, hasErrorInput } from '../utils'

describe('cx', () => {
  it('joins truthy classes and lets later Tailwind classes win', () => {
    expect(cx('px-2 py-1', false, null, 'px-4')).toBe('py-1 px-4')
    expect(cx('text-gray-500', { 'text-red-600': true })).toBe('text-red-600')
  })

  it('exposes brand-coloured focus helpers', () => {
    expect(focusRing.join(' ')).toContain('outline-brand-500')
    expect(focusInput.join(' ')).toContain('focus:border-brand-500')
    expect(hasErrorInput.join(' ')).toContain('border-red-500')
  })
})
```

- [ ] Implement `utils.ts` (Tremor's helpers with `blue` → `brand`).
- [ ] `index.css`: `@custom-variant dark (&:where(.dark, .dark *));`, `--color-brand-950: #1c1850;`, `--font-sans: "Geist Variable", ui-sans-serif, system-ui, sans-serif;`, `--font-mono: "Geist Mono Variable", ui-monospace, monospace;`, Tremor's `--animate-*` tokens + keyframes (hide, slide*AndFade, dialogOverlayShow, dialogContentShow), `html { color-scheme: light } html.dark { color-scheme: dark }`, `body { @apply bg-white text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-50 }`.
- [ ] `test/setup.ts`: `ResizeObserver` stub class (observe/unobserve/disconnect no-ops); `window.matchMedia` stub returning `{ matches: false, media, addEventListener, removeEventListener, addListener, removeListener, onchange: null, dispatchEvent }` when missing.
- [ ] Run web tests, typecheck, lint → green. Commit `chore(web): add Tremor utilities, Geist font and dark-mode foundation`.

### Task 2: Theme store, no-flash script, ThemeSwitcher

**Files:** Create `src/lib/theme.ts`, `src/stores/theme-store.ts`, `src/components/ThemeSwitcher.tsx`, tests `src/lib/__tests__/theme.test.ts`, `src/stores/__tests__/theme-store.test.ts`, `src/components/__tests__/theme-switcher.test.tsx`. Modify `index.html`, `src/main.tsx`.

**Produces:**

```ts
export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
export const THEME_STORAGE_KEY = 'vozia-theme'
export function isThemePreference(value: unknown): value is ThemePreference
export function systemPrefersDark(): boolean                       // false when matchMedia is missing
export function resolveTheme(preference: ThemePreference): ResolvedTheme
export function applyTheme(resolved: ResolvedTheme, root?: HTMLElement): void   // toggles .dark + style.colorScheme
export function subscribeToSystemTheme(onChange: (dark: boolean) => void): () => void
// store
export const useThemeStore  // { preference, resolved, setPreference(p), syncWithSystem() }
export function initTheme(): () => void   // applies once, subscribes to OS changes; returns unsubscribe
// component
export function ThemeSwitcher(props: { className?: string }): JSX.Element   // radiogroup "Theme": "System theme" | "Light theme" | "Dark theme"
```

Store: `persist` with `name: THEME_STORAGE_KEY`, `partialize: (s) => ({ preference: s.preference })`, a `merge` that ignores invalid stored values (Review Focus 1), and a JSON storage whose `getItem`/`setItem`/`removeItem` swallow exceptions (Review Focus 2). `setPreference` sets preference + resolved and calls `applyTheme`. `syncWithSystem` recomputes `resolved` only when preference is `system` (Review Focus 3).

- [ ] Failing tests (theme-store):
  - default preference `system`; resolved follows a mocked `matchMedia('(prefers-color-scheme: dark)').matches`.
  - `setPreference('dark')` → `<html>` has `.dark`, `style.colorScheme === 'dark'`, and `localStorage['vozia-theme']` contains `"preference":"dark"`.
  - stored `{"state":{"preference":"blue"},"version":0}` → after `persist.rehydrate()` preference is `system` (RF1).
  - `localStorage.setItem` throwing → `setPreference('light')` still applies the theme without throwing (RF2).
  - with preference `system`, an OS change event flips `resolved` and the class; with preference `light`, the same event leaves it light (RF3).
- [ ] Failing tests (theme lib): `resolveTheme('system')` mirrors `systemPrefersDark()`; `applyTheme` toggles class and colorScheme; `subscribeToSystemTheme` adds/removes a `change` listener.
- [ ] Failing tests (ThemeSwitcher): radiogroup named `Theme` with three radios; clicking `Dark theme` sets the store preference and `aria-checked`; inside a `<form onSubmit>` it never submits the form (RF4).
- [ ] Implement `theme.ts`, `theme-store.ts`, `ThemeSwitcher.tsx` (lucide `Monitor`, `Sun`, `Moon`; pill container `inline-flex rounded-full border border-gray-200 p-0.5 dark:border-gray-800`; selected `bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50`).
- [ ] `index.html`: inline script before the module script reading `localStorage['vozia-theme']`, validating the preference, resolving `system` via `matchMedia`, setting `.dark` and `colorScheme`, all inside `try/catch`.
- [ ] `main.tsx`: `import '@fontsource-variable/geist'`, `import '@fontsource-variable/geist-mono'`, call `initTheme()` before rendering.
- [ ] Tests, typecheck, lint green. Commit `feat(web): light, dark and system theme with a persisted switcher`.

### Task 3: Tremor component kit and ConfirmDialog

**Files:** Create `src/components/ui-next/{Button,Input,Textarea,SelectNative,Label,Card,Badge,Callout,ProgressBar,Tabs,Dialog,RadioCardGroup,Table,Divider,Field,Spinner,EmptyState}.tsx`, `src/components/ui-next/index.ts`, `src/components/ui-next/LICENSE-tremor`, `src/components/ConfirmDialog.tsx`, tests `src/components/ui-next/__tests__/kit.test.tsx`, `src/components/__tests__/confirm-dialog.test.tsx`. (The folder becomes `ui` in Task 5 once the old kit is gone.)

**Produces (public API):**

```ts
Button       // ComponentPropsWithoutRef<'button'> & { variant?: 'primary'|'secondary'|'light'|'ghost'|'destructive'; size?: 'sm'|'md'|'lg'; asChild?: boolean; isLoading?: boolean; loadingText?: string }
Input        // InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean; enableStepper?: boolean; inputClassName?: string }  (className → wrapper)
Textarea     // { hasError?: boolean }
SelectNative // SelectHTMLAttributes<HTMLSelectElement> & { hasError?: boolean }  (wrapped with a ChevronDown)
Label, Card ({ asChild? }), Divider
Badge        // { variant?: 'default'|'neutral'|'success'|'error'|'warning'|'info' }
Callout      // { variant?: 'default'|'success'|'error'|'warning'|'neutral'; title?: string; icon?: ElementType|ReactElement }  role alert for error, status otherwise
ProgressBar  // { value?; max?; variant?: 'default'|'neutral'|'warning'|'error'|'success'; showAnimation?; label?; 'aria-label'? }  aria-valuenow = clamped value
Tabs, TabsList ({ variant?: 'line'|'solid' }), TabsTrigger, TabsContent
Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
RadioCardGroup, RadioCardItem, RadioCardIndicator
TableRoot, Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell
Field({ label, htmlFor, hint?, error?, children }); Spinner({ className? }); EmptyState({ title, description?, action? })
ConfirmDialog({ trigger: ReactElement; title: string; description: string; confirmLabel: string; onConfirm(): Promise<void> | void; busy?: boolean })
```

- [ ] Port each component from Tremor with the spec's adaptations (blue→brand, lucide icons, `React.ComponentRef`, no `tremor-id`, origin header). Button: padding/text move into `size` variants (`sm: 'h-8 px-2.5 text-xs'`, `md: 'h-9 px-3 text-sm'`, `lg: 'h-11 px-5 text-base'`), `type={asChild ? undefined : (type ?? 'button')}`, `aria-busy` while loading, `LoaderCircle` spinner. Badge: `info` = Tremor's original blue default. Callout: optional title, `role={props.role ?? (variant === 'error' ? 'alert' : 'status')}`. ProgressBar: `aria-valuenow={safeValue}`, `aria-valuemin={0}`, default `aria-label` "Progress", overridable. Table: callers pass `whitespace-normal` to wrap text.
- [ ] Failing kit tests:
  - Button defaults to `type="button"`; inside `<form onSubmit={spy}>` clicking it does not call `spy` (RF4) while `type="submit"` does; `isLoading` disables, sets `aria-busy`, keeps the label; `size="lg"` adds `h-11`; `variant="destructive"` adds `bg-red-600`.
  - ProgressBar clamps 140 → `aria-valuenow="100"` and exposes its `aria-label`.
  - Callout error has `role="alert"`, success `role="status"`, renders without a title.
  - Badge `info` uses blue, `default` uses brand.
  - SelectNative renders options and an `aria-hidden` chevron.
  - Field links label and control; shows `error` with `role="alert"` instead of `hint`.
- [ ] Failing ConfirmDialog tests: trigger opens a dialog titled `title`; Cancel closes without calling `onConfirm`; Escape closes without calling it; confirm calls it once.
- [ ] Implement; tests, typecheck, lint green. Commit `feat(web): add Tremor component kit and confirm dialog`.

### Task 4: Shared components and layouts on the new kit

**Files:** Modify `src/components/{Logo,MarketingLayout,AuthLayout,AppShell,GoogleButton,VideoCard,DubCard,LanguageSelect,VoiceModePicker,UploadDropzone,StageStepper,TranscriptTable}.tsx`, `src/lib/status-ui.ts`, tests `src/components/__tests__/stage-stepper.test.tsx`, `src/components/ui/__tests__/ui.test.tsx` (status mapping part), new `src/components/__tests__/transcript-table.test.tsx`.

**Produces:** `badgeVariantForStatus(status: DubStatus): 'neutral' | 'info' | 'success' | 'error'` (replaces `toneForStatus`).

- [ ] Failing tests: `badgeVariantForStatus` (queued→neutral, translating→info, completed→success, failed→error); TranscriptTable renders a 300-character sentence in a `whitespace-normal` container with `break-words` cells (RF5).
- [ ] Migrate each component with the class and component mappings: `ThemeSwitcher` in MarketingLayout (right side), AuthLayout (top-right corner) and AppShell (next to the minutes badge); VideoCard uses `Card className="p-0 overflow-hidden"` and a `truncate` title (RF5); VoiceModePicker uses `RadioCardGroup`; StageStepper and DubCard use `ProgressBar`; TranscriptTable uses Tremor Table with `whitespace-normal`; LanguageSelect uses `SelectNative`; UploadDropzone gets dashed-border pairs.
- [ ] Web tests, typecheck, lint green. Commit `feat(web): move shared components and layouts to Tremor with dark mode`.

### Task 5: Pages on the new kit; remove the old kit

**Files:** Modify all 13 pages in `src/pages`, page tests in `src/pages/__tests__`; delete the old `src/components/ui/*` and `src/lib/cn.ts`; rename `src/components/ui-next` → `src/components/ui` and update imports.

- [ ] Migrate pages with the mappings. Video and dub pages delete through `ConfirmDialog` ("Delete this video?" / "Delete this dub?", confirm label "Delete"). NewDub uses `Tabs value={form.sourceTab} onValueChange` with `TabsList variant="solid"`. Auth pages use `Divider` ("or") and `Callout` errors. Settings uses `Callout` for save messages and `ProgressBar` for minutes.
- [ ] Update page tests for API changes only, plus new dialog tests: on the dub page "Delete" → dialog → "Delete" calls `deleteDub`; Cancel does not.
- [ ] Remove the old kit + `cn.ts`, `git mv src/components/ui-next src/components/ui`, rewrite imports.
- [ ] `pnpm turbo typecheck lint test build` green. Commit `feat(web): restyle every page with Tremor components and dark mode`.

### Task 6: Visual verification in both themes

**Files:** none in the repo (harness in the session's tmp folder).

- [ ] `vite build` + `vite preview` with dummy `VITE_SUPABASE_*`; Playwright (Chromium) intercepts `**/auth/v1/**`, `**/rest/v1/**`, `**/storage/v1/**` with fixtures (signed-in session seeded in localStorage; one video with completed, in-progress and failed dubs; transcript segments).
- [ ] Screenshot at 1280×900 and 390×844, light and dark: `/`, `/pricing`, `/login`, `/app`, `/app/new`, `/app/videos/<id>`, `/app/dubs/<completed | in-progress | failed>`, `/app/settings`, plus the open delete dialog.
- [ ] Review every screenshot: no white surfaces in dark mode, readable text, visible selection states, no horizontal scroll on mobile. Fix issues in the owning component, re-run tests, commit `fix(web): …` per issue.

### Task 7: Final gate, push, memory

- [ ] `pnpm turbo typecheck lint test build` and `pnpm db:test --with-worker` green.
- [ ] Land everything on the single branch `feat/mvp` (user's instruction): push this worktree's `HEAD` to `origin/feat/mvp` as a fast-forward (never force); no other branch is pushed. The user's checkout gets it with `git pull`.
- [ ] Update the Vozia memory note (UI kit, theme store, branch).

---

## Self-review

- Spec coverage: kit + adaptations (T3), license (T3), brand colour (T1/T3), icons (T3), utilities (T1), font (T1/T2), theme mechanism/state/no-flash/switcher (T1/T2), surfaces + mappings (T4/T5), confirm dialog (T3/T5), screen mapping (T4/T5), testing + visual check (T2–T6), gate (T7). No gaps.
- Placeholders: none.
- Type consistency: `ThemePreference`, `useThemeStore`, `initTheme`, `badgeVariantForStatus`, `ConfirmDialog` props and the kit's prop names are used identically in later tasks.
- Review Focus: RF1–RF3 in Task 2 tests, RF4 in Task 2 (switcher) and Task 3 (Button), RF5 in Task 4.
