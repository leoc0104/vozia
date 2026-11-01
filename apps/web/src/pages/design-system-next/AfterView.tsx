import { useState } from 'react'
import { Levels } from '../../components/Levels'
import { LogoMark, Wordmark } from '../../components/Logo'
import { StageStepper } from '../../components/StageStepper'
import { UploadDropzone } from '../../components/UploadDropzone'
import { Badge, Spinner, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRoot, TableRow } from '../../components/ui'
import { contrastRatio, wcagLevel } from '../../lib/contrast'
import { ComponentsSection } from '../design-system/ComponentsSection'
import { IconsSection, LayoutSection } from '../design-system/FoundationsSections'
import { TypeSection } from '../design-system/TypeSection'
import { Block, Mono, Rule, Section, ThemePane, ThemePanes } from '../design-system/parts'
import { STEPS } from '../design-system/tokens'
import { LanguageChip, NextLogo, NextMark, NextMarkOnInk, NextWordmark, SpokenTranscript, VoicePlayer, VoiceprintPanel } from './brand'
import { LANGUAGE_NAMES } from './samples'
import { DubScreen, LandingAfter, LibraryScreen, NewDubScreen, ScaledScreen } from './screens'

function IdeaSection() {
  return (
    <Section
      id="concept"
      title="The idea"
      lead="When you know a voice, you know who is speaking. A dub usually replaces it with a stranger's. Vozia keeps it, so what changes is the language and not the person."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Rule title="One voice">
          Yellow marks the voice itself: the voiceprint, the line being spoken, the language you chose. Everything else stays ink and paper.
        </Rule>
        <Rule title="Same voice, new language">
          A voiceprint is like a fingerprint. The same bars stay under every language, because the person speaking does not change.
        </Rule>
        <Rule title="Made for watching">
          Built for the person watching, not for a studio. Strong contrast and clear type come first, because some people cannot follow subtitles at all.
        </Rule>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Rule title="Why yellow">
          It is the classic color of subtitles, the thing you read while hearing the real voice. Vozia is what comes next. And ink on yellow is very easy to read: 13.5:1.
        </Rule>
        <Rule title="Why ink and paper">
          It is what manga is printed with, where you read a line and hear the voice in your head. Yellow sits on top like a highlighter.
        </Rule>
        <Rule title="Not an anime brand">
          Anime is the story that started this, but the need is universal. So no sakura, no Japan clichés and no character art. Languages and voices are the visuals.
        </Rule>
      </div>
    </Section>
  )
}

function ScreensSection() {
  return (
    <Section id="screens-after" title="Real screens" lead="The main screens in the new system, with sample content.">
      <Block title="Landing page">
        <ScaledScreen>
          <LandingAfter />
        </ScaledScreen>
      </Block>
      <Block title="Watching a dub" note="The voice switch and the marker are a proposal, not built yet.">
        <ScaledScreen>
          <DubScreen after />
        </ScaledScreen>
      </Block>
      <Block title="Library" note="Thumbnails here are the placeholders. Real videos show their own image.">
        <ScaledScreen>
          <LibraryScreen after />
        </ScaledScreen>
      </Block>
      <Block title="New dub">
        <ScaledScreen>
          <NewDubScreen after />
        </ScaledScreen>
      </Block>
    </Section>
  )
}

function LogoSection() {
  return (
    <Section id="logo" title="Logo" lead="The same V and capsule on a yellow tile. A capsule is a microphone and one bar of a voiceprint.">
      <Block title="The full logo" note="The same in both themes, which keeps the rule simple and makes it stand out in a browser tab.">
        <ThemePanes className="flex min-h-44 items-center justify-center">
          <NextLogo size="lg" />
        </ThemePanes>
      </Block>
      <Block title="Wordmark alone" note="Yellow disappears on white, so on light surfaces the i keeps a plain ink dot. On dark surfaces it gets the yellow capsule.">
        <ThemePanes className="flex min-h-40 items-center justify-center">
          <NextWordmark className="h-14" />
        </ThemePanes>
      </Block>
      <Block title="Mark on ink" note="Only on surfaces that are already ink. The rule: a yellow capsule always sits on ink.">
        <ThemePane theme="dark" className="flex min-h-32 items-center justify-center gap-8">
          <NextMarkOnInk className="size-16" />
          <NextMarkOnInk className="size-8" />
          <NextMarkOnInk className="size-4" />
        </ThemePane>
      </Block>
      <Block title="One color" note="For print, stamps or anything that cannot carry yellow.">
        <div className="grid gap-4 sm:grid-cols-2">
          {(['light', 'dark'] as const).map((theme) => (
            <ThemePane key={theme} theme={theme} className="flex min-h-28 items-center justify-center gap-3">
              <LogoMark mono className="size-12" />
              <Wordmark className="h-10 w-auto" />
            </ThemePane>
          ))}
        </div>
      </Block>
      <Block title="App icon and favicon" note="The shape and its 32 unit grid do not change from the current logo.">
        <div className="flex flex-wrap items-end gap-6 rounded-lg bg-gray-100 p-6 dark:bg-gray-800">
          <NextMark className="size-24" />
          <NextMark className="size-12" />
          <NextMark className="size-8" />
          <NextMark className="size-4" />
        </div>
      </Block>
    </Section>
  )
}

const SIGNAL_STEPS = ['50', '100', '200', '300', '400', '500']

type Pair = [foreground: string, background: string]

const ROLES: { role: string; light: Pair; dark: Pair }[] = [
  { role: 'Primary text', light: ['gray-900', 'white'], dark: ['gray-50', 'gray-950'] },
  { role: 'Secondary text', light: ['gray-600', 'white'], dark: ['gray-400', 'gray-950'] },
  { role: 'Quiet text', light: ['gray-500', 'gray-50'], dark: ['gray-400', 'gray-900'] },
  { role: 'Links and accent text', light: ['gray-950', 'gray-50'], dark: ['brand-400', 'gray-900'] },
  { role: 'Ink on yellow', light: ['gray-950', 'brand-500'], dark: ['gray-950', 'brand-500'] },
  { role: 'Yellow on ink', light: ['brand-500', 'gray-950'], dark: ['brand-500', 'gray-950'] },
  { role: 'Primary button', light: ['white', 'gray-950'], dark: ['gray-950', 'gray-50'] },
  { role: 'Danger button', light: ['white', 'danger-600'], dark: ['white', 'danger-700'] },
  { role: 'Warning badge', light: ['warning-900', 'warning-50'], dark: ['warning-500', 'gray-950'] },
  { role: 'Focus ring (needs 3:1)', light: ['gray-950', 'white'], dark: ['brand-500', 'gray-950'] },
]

function ColorSection() {
  const [scope, setScope] = useState<HTMLElement | null>(null)
  const read = (token: string) => (scope ? getComputedStyle(scope).getPropertyValue(`--color-${token}`).trim().toLowerCase() : '')

  const scale = (name: string, steps: readonly string[]) => (
    <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {steps.map((step) => (
        <li key={step} className="min-w-0">
          <div className="h-16 rounded-md ring-1 ring-inset ring-black/5 dark:ring-white/10" style={{ backgroundColor: `var(--color-${name}-${step})` }} />
          <p className="mt-1.5 text-xs font-medium text-gray-900 dark:text-gray-50">{step}</p>
          <Mono>{read(`${name}-${step}`)}</Mono>
        </li>
      ))}
    </ol>
  )

  const cell = ([foreground, background]: Pair) => {
    const ratio = contrastRatio(read(foreground), read(background))
    return (
      <TableCell>
        <div className="flex items-center gap-3">
          <span
            className="grid h-9 w-12 shrink-0 place-items-center rounded-md text-sm font-semibold ring-1 ring-inset ring-black/5 dark:ring-white/10"
            style={{ color: `var(--color-${foreground})`, backgroundColor: `var(--color-${background})` }}
          >
            Aa
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-gray-900 dark:text-gray-50">{ratio === null ? '—' : ratio.toFixed(1)}</span>
              {ratio === null ? null : (
                <Badge variant={ratio >= 3 ? 'neutral' : 'error'} className="px-2 py-0">
                  {wcagLevel(ratio)}
                </Badge>
              )}
            </div>
            <Mono>
              {foreground} on {background}
            </Mono>
          </div>
        </div>
      </TableCell>
    )
  }

  return (
    <Section id="color" title="Color" lead="Ink and paper for almost everything, and one yellow for the voice.">
      <div ref={setScope} className="hidden" />
      <Block
        title="Subtitle yellow"
        note="Use 500 for fills, always with ink on top. On dark surfaces it can also be text and thin lines. On light surfaces it never is: ink takes those jobs."
      >
        {scale('brand', SIGNAL_STEPS)}
      </Block>
      <Block title="Ink and paper" note="Unchanged. As text, use 500 or darker on light surfaces, and 400 or lighter on dark ones.">
        <ol className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11">
          {STEPS.map((step) => (
            <li key={step} className="min-w-0">
              <div className="h-12 rounded-md ring-1 ring-inset ring-black/5 dark:ring-white/10" style={{ backgroundColor: `var(--color-gray-${step})` }} />
              <p className="mt-1.5 text-xs font-medium text-gray-900 dark:text-gray-50">{step}</p>
              <span className="block truncate font-mono text-[10px] text-gray-500 dark:text-gray-400">{read(`gray-${step}`)}</span>
            </li>
          ))}
        </ol>
      </Block>
      <Block title="Warning" note="Moves to orange, because yellow now means the voice. Success, danger and info do not change.">
        {scale('warning', SIGNAL_STEPS)}
      </Block>
      <Block title="Roles and contrast" note="Which colors go together, measured from the live theme against WCAG. Normal text needs AA, which means 4.5 or more.">
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
          <TableRoot>
            <Table className="border-b-0">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Role</TableHeaderCell>
                  <TableHeaderCell>Light theme</TableHeaderCell>
                  <TableHeaderCell>Dark theme</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ROLES.map(({ role, light, dark }) => (
                  <TableRow key={role}>
                    <TableCell className="font-medium text-gray-900 dark:text-gray-50">{role}</TableCell>
                    {cell(light)}
                    {cell(dark)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableRoot>
        </div>
      </Block>
    </Section>
  )
}

function MotionSection() {
  return (
    <Section id="motion" title="Motion" lead="Quick and quiet. The voiceprint moves only while a voice is really playing or being made, and it stops for people who ask their device to reduce motion.">
      <Block title="Voiceprint">
        <ThemePanes className="space-y-6">
          <VoiceprintPanel />
          <div className="flex flex-wrap items-center gap-6">
            <Spinner />
            <Badge variant="live">Translating</Badge>
          </div>
        </ThemePanes>
      </Block>
      <Block title="Timing" note="Unchanged: 100 ms for presses and hovers, 150 ms for menus and dialogs, 300 ms for progress.">
        <Levels seed="vozia-sample" bars={64} animated className="h-12 w-full text-gray-400 dark:text-gray-600" />
      </Block>
    </Section>
  )
}

function Stepper() {
  return <StageStepper pipeline="staged" status="translating" progress={60} failedStage={null} />
}

function ProductSection() {
  return (
    <Section id="product" title="In the product" lead="New patterns that come from the idea, and existing pieces in the new colors.">
      <Block title="The voice switch" note="New, and not built yet. Try it: it keeps the moment and changes only the language. This is a picture of the idea, so it plays no sound.">
        <div className="max-w-2xl">
          <VoicePlayer />
        </div>
      </Block>
      <Block title="The line being spoken" note="New. The transcript reads like a script, with a marker on the current line and larger text for reading.">
        <ThemePanes>
          <SpokenTranscript />
        </ThemePanes>
      </Block>
      <Block title="Languages" note="New. Each language by its own name, in its own script, never a flag. Geist has no Japanese, Korean, Hindi or Arabic, so these use the device's fonts for now.">
        <ThemePanes className="flex flex-wrap gap-2">
          {LANGUAGE_NAMES.map(({ code, name, rtl }) => (
            <LanguageChip key={code} code={code} name={name} rtl={rtl} />
          ))}
        </ThemePanes>
      </Block>
      <Block title="Dub progress">
        <ThemePanes>
          <Stepper />
        </ThemePanes>
      </Block>
      <Block title="Upload">
        <ThemePanes>
          <UploadDropzone file={null} onFile={() => undefined} />
        </ThemePanes>
      </Block>
    </Section>
  )
}

function OpenSection() {
  return (
    <Section id="open" title="Still open" lead="This is a proposal to react to. Nothing in the app has changed yet, and these are not decided.">
      <div className="grid gap-4 md:grid-cols-2">
        <Rule title="The name of the idea">&quot;Same Voice&quot; is a working name for this direction, and the copy on this page is a draft for you to rewrite.</Rule>
        <Rule title="Voices belong to people">
          Keeping an actor&apos;s voice raises consent and legal questions, and voice actors are pushing back on unauthorized AI voices. Vozia needs a clear stance before it promises this publicly.
        </Rule>
        <Rule title="Plan names">&quot;Creator&quot; and &quot;Studio&quot; come from the old idea of a tool for people making videos. They need new names if Vozia is for people watching.</Rule>
        <Rule title="Portuguese and other scripts">The site is English only today. It needs Portuguese, and probably added fonts for Japanese and other scripts Geist does not cover.</Rule>
        <Rule title="Risks of yellow">Too much black and yellow can look like a road sign, so large yellow areas stay rare. Name, logo and color still need a trademark and domain check.</Rule>
        <Rule title="Not designed yet">Email templates, social media images, PNG app icons, and new SVG logo files. The voice switch also needs real audio tracks to work.</Rule>
      </div>
    </Section>
  )
}

export function AfterView() {
  return (
    <div className="system-next">
      <IdeaSection />
      <ScreensSection />
      <LogoSection />
      <ColorSection />
      <TypeSection />
      <LayoutSection />
      <MotionSection />
      <IconsSection />
      <ComponentsSection />
      <ProductSection />
      <OpenSection />
    </div>
  )
}
