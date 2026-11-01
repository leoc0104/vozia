import { useState, type ReactNode } from 'react'
import { LogoLockup, LogoMark, Wordmark } from '../../components/Logo'
import { StageStepper } from '../../components/StageStepper'
import {
  Badge,
  Button,
  Callout,
  ProgressBar,
  RadioCardGroup,
  RadioCardIndicator,
  RadioCardItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from '../../components/ui'
import { contrastRatio, wcagLevel } from '../../lib/contrast'
import { LandingPage } from '../Landing'
import { Block, Mono, Section, ThemePane } from '../design-system/parts'
import { tokenValue } from '../design-system/tokens'
import { NextLogo, NextMark, NextWordmark } from './brand'
import { DubScreen, LandingAfter, LibraryScreen, NewDubScreen, ScaledScreen } from './screens'

/** Today's version and the proposed one, side by side. Only the "after" side gets the new tokens. */
function Compare({ before, after }: { before: ReactNode; after: ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="min-w-0">
        <p className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">Before</p>
        {before}
      </div>
      <div className="system-next min-w-0">
        <p className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">After</p>
        {after}
      </div>
    </div>
  )
}

const CHANGES = [
  ['The idea', 'On Air: a recording light, seen from the studio', 'Same Voice: the viewer keeps the voice', 'Your story is about the person watching, not the person producing.'],
  ['Main color', 'Orange', 'Subtitle yellow', "Orange is almost Crunchyroll's. Yellow is the color of the subtitles you read while hearing the real voice."],
  ['What the color means', 'Something is live right now', 'The voice itself', 'It marks the voiceprint, the line being spoken and the language you chose.'],
  ['On light surfaces', 'Orange does everything', 'Ink does text and thin lines, yellow fills panels and marks', 'Yellow is only 1.4:1 on white, so it cannot be text or a thin line there.'],
  ['Logo', 'V with an orange capsule, no tile', 'The same shape on a yellow tile', 'Yellow needs its own surface, and the tile stands out in a browser tab.'],
  ['Motif', 'Level bars for loading and live states', 'A voiceprint that stays the same under every language', 'The person speaking does not change, so neither do the bars.'],
  ['The promise', '"In your own voice"', '"Keep the original voice"', "You want the character's voice, not yours."],
  ['Languages', 'English names', 'Each in its own name and script, never a flag', 'People should find their language by reading it. A language is not a country.'],
  ['The player', 'A plain video player', 'A voice switch at the same moment, plus a marker on the line being spoken', 'This is where someone hears that it is the same voice. Not built yet.'],
  ['Warning color', 'Yellow', 'Orange', 'Yellow now means the voice, so warnings need another color.'],
]

const STAYS = ['Ink and paper neutrals', 'The V and capsule shape', 'Geist and the type scale', 'Spacing, corners and shadows', 'All components', 'Ink primary buttons', 'Success, danger and info colors', 'Light and dark themes']

function ChangesSection() {
  return (
    <Section id="changes" title="What changes" lead="Everything that moves between the system the app uses today and this proposal, and why.">
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
        <TableRoot className="whitespace-normal">
          <Table className="border-b-0">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Area</TableHeaderCell>
                <TableHeaderCell>Before</TableHeaderCell>
                <TableHeaderCell>After</TableHeaderCell>
                <TableHeaderCell>Why</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {CHANGES.map(([area, before, after, why]) => (
                <TableRow key={area} className="align-top">
                  <TableCell className="font-medium text-gray-900 dark:text-gray-50">{area}</TableCell>
                  <TableCell>{before}</TableCell>
                  <TableCell className="text-gray-900 dark:text-gray-50">{after}</TableCell>
                  <TableCell>{why}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableRoot>
      </div>
      <Block title="What stays">
        <ul className="flex flex-wrap gap-2">
          {STAYS.map((item) => (
            <li key={item}>
              <Badge variant="neutral">{item}</Badge>
            </li>
          ))}
        </ul>
      </Block>
    </Section>
  )
}

function ScreensSection() {
  return (
    <Section id="screens" title="Real screens" lead="The same sample content in both versions, using the real components. Switch the theme at the top to compare light and dark.">
      <Block title="Landing page">
        <Compare
          before={
            <ScaledScreen>
              <LandingPage />
            </ScaledScreen>
          }
          after={
            <ScaledScreen>
              <LandingAfter />
            </ScaledScreen>
          }
        />
      </Block>
      <Block title="Library" note="Thumbnails here are the placeholders. Real videos show their own image.">
        <Compare
          before={
            <ScaledScreen>
              <LibraryScreen />
            </ScaledScreen>
          }
          after={
            <ScaledScreen>
              <LibraryScreen after />
            </ScaledScreen>
          }
        />
      </Block>
      <Block title="New dub">
        <Compare
          before={
            <ScaledScreen>
              <NewDubScreen />
            </ScaledScreen>
          }
          after={
            <ScaledScreen>
              <NewDubScreen after />
            </ScaledScreen>
          }
        />
      </Block>
      <Block title="Watching a dub" note="The biggest change. The voice switch and the marker are a proposal, not built yet.">
        <Compare
          before={
            <ScaledScreen>
              <DubScreen />
            </ScaledScreen>
          }
          after={
            <ScaledScreen>
              <DubScreen after />
            </ScaledScreen>
          }
        />
      </Block>
    </Section>
  )
}

function LogoSection() {
  return (
    <Section id="compare-logo" title="Logo" lead="The shape stays. What changes is where the color sits, because a yellow capsule disappears on white.">
      <Block title="Full logo">
        <Compare
          before={
            <div className="grid gap-3 sm:grid-cols-2">
              <ThemePane theme="light" className="flex min-h-32 items-center justify-center">
                <LogoLockup />
              </ThemePane>
              <ThemePane theme="dark" className="flex min-h-32 items-center justify-center">
                <LogoLockup />
              </ThemePane>
            </div>
          }
          after={
            <div className="grid gap-3 sm:grid-cols-2">
              <ThemePane theme="light" className="flex min-h-32 items-center justify-center">
                <NextLogo />
              </ThemePane>
              <ThemePane theme="dark" className="flex min-h-32 items-center justify-center">
                <NextLogo />
              </ThemePane>
            </div>
          }
        />
      </Block>
      <Block title="Wordmark alone">
        <Compare
          before={
            <div className="grid gap-3 sm:grid-cols-2">
              <ThemePane theme="light" className="flex min-h-28 items-center justify-center">
                <Wordmark signal className="h-8 w-auto" />
              </ThemePane>
              <ThemePane theme="dark" className="flex min-h-28 items-center justify-center">
                <Wordmark signal className="h-8 w-auto" />
              </ThemePane>
            </div>
          }
          after={
            <div className="grid gap-3 sm:grid-cols-2">
              <ThemePane theme="light" className="flex min-h-28 items-center justify-center">
                <NextWordmark className="h-8" />
              </ThemePane>
              <ThemePane theme="dark" className="flex min-h-28 items-center justify-center">
                <NextWordmark className="h-8" />
              </ThemePane>
            </div>
          }
        />
      </Block>
      <Block title="Mark in small sizes">
        <Compare
          before={
            <div className="grid gap-3 sm:grid-cols-2">
              {(['light', 'dark'] as const).map((theme) => (
                <ThemePane key={theme} theme={theme} className="flex min-h-24 items-end justify-center gap-3">
                  <LogoMark className="size-12" />
                  <LogoMark className="size-8" />
                  <LogoMark className="size-5" />
                  <LogoMark className="size-4" />
                </ThemePane>
              ))}
            </div>
          }
          after={
            <div className="grid gap-3 sm:grid-cols-2">
              {(['light', 'dark'] as const).map((theme) => (
                <ThemePane key={theme} theme={theme} className="flex min-h-24 items-end justify-center gap-3">
                  <NextMark className="size-12" />
                  <NextMark className="size-8" />
                  <NextMark className="size-5" />
                  <NextMark className="size-4" />
                </ThemePane>
              ))}
            </div>
          }
        />
      </Block>
    </Section>
  )
}

const STEPS = ['50', '100', '200', '300', '400', '500']

function Strip({ color, values }: { color: string; values: string[] }) {
  return (
    <ol className="grid grid-cols-6 gap-1.5">
      {STEPS.map((step, index) => (
        <li key={step} className="min-w-0">
          <div className="h-12 rounded-md ring-1 ring-inset ring-black/5 dark:ring-white/10" style={{ backgroundColor: `var(--color-${color}-${step})` }} />
          <p className="mt-1 text-xs font-medium text-gray-900 dark:text-gray-50">{step}</p>
          <span className="block truncate font-mono text-[10px] text-gray-500 dark:text-gray-400">{values[index]}</span>
        </li>
      ))}
    </ol>
  )
}

type Pair = [foreground: string, background: string]
type Row = { role: string; before: [light: Pair, dark: Pair]; after: [light: Pair, dark: Pair] }

const ROLES: Row[] = [
  { role: 'Signal button', before: [['gray-950', 'brand-500'], ['gray-950', 'brand-500']], after: [['gray-950', 'brand-500'], ['gray-950', 'brand-500']] },
  { role: 'Links and accent text', before: [['brand-600', 'gray-50'], ['brand-400', 'gray-900']], after: [['gray-950', 'gray-50'], ['brand-400', 'gray-900']] },
  { role: 'Focus ring (needs 3:1)', before: [['brand-500', 'white'], ['brand-500', 'gray-950']], after: [['gray-950', 'white'], ['brand-500', 'gray-950']] },
  { role: 'Progress bar (needs 3:1)', before: [['brand-600', 'gray-200'], ['brand-500', 'gray-800']], after: [['gray-950', 'gray-200'], ['brand-500', 'gray-800']] },
  { role: 'Live badge', before: [['brand-900', 'brand-50'], ['brand-300', 'gray-950']], after: [['gray-950', 'brand-500'], ['brand-400', 'gray-950']] },
  { role: 'Warning badge', before: [['warning-900', 'warning-50'], ['warning-500', 'gray-950']], after: [['warning-900', 'warning-50'], ['warning-500', 'gray-950']] },
]

function Ratio({ pair, read }: { pair: Pair; read: (token: string) => string }) {
  const ratio = contrastRatio(read(pair[0]), read(pair[1]))
  if (ratio === null) return <TableCell>—</TableCell>
  return (
    <TableCell>
      <span className="font-mono text-gray-900 dark:text-gray-50">{ratio.toFixed(1)}</span> <Mono>{wcagLevel(ratio)}</Mono>
    </TableCell>
  )
}

function ColorSection() {
  const [scope, setScope] = useState<HTMLElement | null>(null)
  const readNext = (token: string) => (scope ? getComputedStyle(scope).getPropertyValue(`--color-${token}`).trim().toLowerCase() : '')
  return (
    <Section id="compare-color" title="Color" lead="Yellow takes over from orange, and warnings move to orange. Neutrals and the other status colors stay exactly as they are.">
      {/* Only used to read the proposed values from the live CSS, so these numbers cannot drift. */}
      <div ref={setScope} className="system-next hidden" />
      <Block title="The signal">
        <Compare before={<Strip color="brand" values={STEPS.map((step) => tokenValue(`brand-${step}`))} />} after={<Strip color="brand" values={STEPS.map((step) => readNext(`brand-${step}`))} />} />
      </Block>
      <Block title="Warning">
        <Compare before={<Strip color="warning" values={STEPS.map((step) => tokenValue(`warning-${step}`))} />} after={<Strip color="warning" values={STEPS.map((step) => readNext(`warning-${step}`))} />} />
      </Block>
      <Block title="Contrast" note="Measured live from both sets of colors. Higher is easier to read. Normal text needs 4.5.">
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
          <TableRoot>
            <Table className="border-b-0">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Role</TableHeaderCell>
                  <TableHeaderCell>Before, light</TableHeaderCell>
                  <TableHeaderCell>After, light</TableHeaderCell>
                  <TableHeaderCell>Before, dark</TableHeaderCell>
                  <TableHeaderCell>After, dark</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ROLES.map(({ role, before, after }) => (
                  <TableRow key={role}>
                    <TableCell className="font-medium text-gray-900 dark:text-gray-50">{role}</TableCell>
                    <Ratio pair={before[0]} read={tokenValue} />
                    <Ratio pair={after[0]} read={readNext} />
                    <Ratio pair={before[1]} read={tokenValue} />
                    <Ratio pair={after[1]} read={readNext} />
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

/** The same components in both columns: only the tokens around them differ. */
function KitSample() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Button variant="accent">Dub your first video free</Button>
        <Button>New dub</Button>
        <Button variant="secondary">See pricing</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="live">Translating</Badge>
        <Badge variant="success">Completed</Badge>
        <Badge variant="warning">1 minute left</Badge>
        <Badge variant="error">Failed</Badge>
        <Badge>Most popular</Badge>
      </div>
      <ProgressBar value={60} label="60%" aria-label="Sample progress" />
      <RadioCardGroup aria-label="Sample choice" defaultValue="one" className="grid-cols-2 gap-3">
        {['one', 'two'].map((value) => (
          <RadioCardItem key={value} value={value}>
            <div className="flex items-center gap-3">
              <RadioCardIndicator />
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-50">{value === 'one' ? 'Selected' : 'Not selected'}</span>
            </div>
          </RadioCardItem>
        ))}
      </RadioCardGroup>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <button type="button" className="rounded-md font-medium text-brand-600 hover:underline dark:text-brand-400">
          A link
        </button>
        <span
          className="rounded-md px-2 py-1 font-medium text-gray-900 dark:text-gray-50"
          style={{ outline: '2px solid var(--next-strong, var(--color-brand-500))', outlineOffset: 2 }}
        >
          Focus ring
        </span>
      </div>
      <StageStepper pipeline="staged" status="translating" progress={60} failedStage={null} />
      <Callout variant="warning">You have 1 dubbing minute left.</Callout>
    </div>
  )
}

function ComponentsSection() {
  return (
    <Section id="compare-components" title="Components" lead="The real components in both columns. The code is the same: only the colors around them change, plus a few rules for yellow on light surfaces.">
      <Block title="Light theme">
        <Compare
          before={
            <ThemePane theme="light">
              <KitSample />
            </ThemePane>
          }
          after={
            <ThemePane theme="light">
              <KitSample />
            </ThemePane>
          }
        />
      </Block>
      <Block title="Dark theme">
        <Compare
          before={
            <ThemePane theme="dark">
              <KitSample />
            </ThemePane>
          }
          after={
            <ThemePane theme="dark">
              <KitSample />
            </ThemePane>
          }
        />
      </Block>
    </Section>
  )
}

const WORDS = [
  ['Landing headline', 'Dub your videos into 29 languages — in your own voice.', 'Watch it in your language. Keep the original voice.'],
  ['Landing text', "Vozia transcribes, translates and re-voices your video while preserving the speaker's voice and the background music.", 'Some voices are part of the story. Vozia translates a video and keeps the voice of the person speaking, so it still sounds like them.'],
  ['Voice option', 'Keep my voice', 'Keep the original voice'],
  ['Other voice option', 'Stock voice', 'Use another voice'],
  ['Dub badge', 'Cloned voice', 'Original voice'],
  ['Language names', 'Portuguese, Japanese', 'Português, 日本語'],
  ['Footer', 'Dub your videos in your own voice.', 'Same voice, your language.'],
]

function WordsSection() {
  return (
    <Section id="compare-words" title="Words" lead="The promise changes from the person making the video to the person watching it. All of this is draft copy for you to rewrite.">
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
        <TableRoot className="whitespace-normal">
          <Table className="border-b-0">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Where</TableHeaderCell>
                <TableHeaderCell>Before</TableHeaderCell>
                <TableHeaderCell>After</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {WORDS.map(([where, before, after]) => (
                <TableRow key={where} className="align-top">
                  <TableCell className="font-medium text-gray-900 dark:text-gray-50">{where}</TableCell>
                  <TableCell>{before}</TableCell>
                  <TableCell className="text-gray-900 dark:text-gray-50">{after}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableRoot>
      </div>
    </Section>
  )
}

export function ComparisonView() {
  return (
    <>
      <ChangesSection />
      <ScreensSection />
      <LogoSection />
      <ColorSection />
      <ComponentsSection />
      <WordsSection />
    </>
  )
}
