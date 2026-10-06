# Vozia — Tremor UI and Light/Dark Theme (Design)

**Date:** 2026-10-06
**Status:** Approved for autonomous build. The user asked for a shadcn-like component kit "from Vercel",
chose the recommendation (Tremor + Vercel's Geist font) and asked for it to be implemented overnight.
The decisions below were made by Claude; each records why so the user can veto it later.

## Goal

Give the Vozia web app a shadcn-like look using Vercel's component kit (Tremor) and Vercel's Geist
font, with light, dark and system themes. Behaviour does not change: same pages, same flows, same data.

## Decisions & Rationale

| Decision | Choice | Why |
|---|---|---|
| Component kit | Tremor (Tremor Raw) components copied into `apps/web/src/components/ui` | User asked for a UI from Vercel; Tremor is Vercel-owned, uses the same copy-the-code model as shadcn, and is built on Tailwind 4 + Radix like our stack. Upstream has been quiet since Oct 2025, so owning the code removes that risk. |
| Components ported | Button, Input, Textarea, SelectNative, Label, Card, Badge, Callout, ProgressBar, Tabs, Dialog, RadioCardGroup, Table, Divider | Exactly what the existing screens use or replace. DropdownMenu, Toast and charts are not ported (YAGNI). |
| License | Tremor is Apache-2.0; its license text ships as `components/ui/LICENSE-tremor` and each ported file keeps a one-line origin header | Required attribution for copied source. |
| Brand colour | Tremor's `blue-*` accents become `brand-*` (our purple scale, plus a new `brand-950`) | Keeps Vozia's identity in both themes. |
| Icons | Tremor's Remix icons replaced with `lucide-react` | One icon set; lucide is already a dependency. |
| Component adaptations | Button gains `size` (`sm`/`md`/`lg`) and defaults to `type="button"`; SelectNative gets a chevron; ProgressBar reports the clamped value and accepts the caller's `aria-label`; Callout title becomes optional and errors get `role="alert"` (others `role="status"`); Badge gains an `info` (blue) variant for in-progress statuses; `tremor-id` attributes dropped; `React.ElementRef` → `React.ComponentRef` | Fit Vozia's screens and keep accessibility (tests rely on roles and names); a submit-by-default Button inside forms would be a bug. |
| Utilities | `cx`, `focusRing`, `focusInput`, `hasErrorInput` in `src/lib/utils.ts`, replacing `src/lib/cn.ts` | Tremor's helpers (clsx + tailwind-merge); one class-joining helper app-wide. |
| Font | Geist and Geist Mono via `@fontsource-variable/geist` and `@fontsource-variable/geist-mono` | Vercel's typeface; the `geist` npm package targets Next.js, fontsource works in Vite. |
| Theme mechanism | Class strategy: `.dark` on `<html>` through `@custom-variant dark (&:where(.dark, .dark *))` | Lets the user override the OS setting; Tremor's `dark:` classes work unchanged. |
| Theme state | Zustand store `useThemeStore` with `persist` (localStorage key `vozia-theme`): `preference: 'light' \| 'dark' \| 'system'`, `resolved: 'light' \| 'dark'`; follows `prefers-color-scheme` live while on `system` | React + Zustand is the project's state convention; persisted per browser as agreed. |
| No flash on load | Inline script in `index.html` applies the stored theme before the first paint | Avoids a white flash for dark-mode users. |
| Theme switcher | Three-way segmented control (System / Light / Dark icons) with radiogroup semantics, in the marketing header, on auth pages and in the app header | The switcher style Vercel itself uses; works without a menu. |
| Surfaces | Light: `gray-50` app background, white cards. Dark: `gray-950` background, Tremor's `#090E1A` cards. Marketing pages white / `gray-950`. Slate classes become Tremor's gray + `dark:` pairs | Matches Tremor's palette so ported components and pages look like one system. |
| Delete confirmation | Tremor Dialog (via a `ConfirmDialog` composition) replaces `window.confirm` on the video and dub pages | Themed, accessible, testable. |
| Screen mapping | Voice choice → RadioCardGroup; transcript → Table (wrapping text); Upload / YouTube switch → Tabs (solid); auth "or" separator → Divider; alerts → Callout; progress → ProgressBar | Use the kit's native pieces instead of hand-rolled ones. |

## File map (apps/web/src)

- `lib/utils.ts` — `cx`, `focusRing`, `focusInput`, `hasErrorInput` (replaces `lib/cn.ts`).
- `lib/theme.ts` — `systemPrefersDark()`, `applyTheme(resolved)`, `subscribeToSystemTheme(cb)`.
- `stores/theme-store.ts` — `useThemeStore`, `initTheme()`.
- `components/ui/` — the 14 Tremor ports, plus our `Field`, `Spinner`, `EmptyState`, and `index.ts`; `LICENSE-tremor`.
- `components/ThemeSwitcher.tsx`, `components/ConfirmDialog.tsx`.
- `index.css` — dark variant, brand scale incl. `brand-950`, Geist font stacks, Tremor animations, base colours.
- `index.html` — no-flash theme script. `main.tsx` — font imports and `initTheme()`.
- Every page and shared component restyled (13 pages, 12 components).

## Testing

- Unit (Vitest + Testing Library): theme store (persistence, system resolution, class on `<html>`, reacting to OS changes), ThemeSwitcher, ConfirmDialog, Button (default type, loading, sizes), ProgressBar (clamping, accessible name), Callout roles, status → badge variant mapping.
- The existing 49 web tests stay green, adjusted only where a component API changed.
- jsdom setup gains `ResizeObserver` and `matchMedia` stubs (Radix and the theme store need them).
- Visual check: Playwright screenshots of landing, pricing, login, library, new dub, video detail, dub detail (in progress / completed / failed) and settings, in light and dark, with Supabase mocked at the network layer; reviewed for leftover light surfaces and contrast problems. The harness lives outside the repo.
- Gate: `pnpm turbo typecheck lint test build` green across the workspace.

## Non-goals

No behaviour changes, no new pages, no account dropdown, no toasts, no charts, no server-side theme preference.
