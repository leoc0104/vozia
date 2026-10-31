import {
  Check,
  ChevronDown,
  Download,
  Eye,
  FileText,
  LogOut,
  Monitor,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Sun,
  Trash2,
  UploadCloud,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Levels } from '../../components/Levels'
import { Badge, Spinner } from '../../components/ui'
import { cx } from '../../lib/utils'
import { Block, Mono, Section, ThemePanes } from './parts'

const SPACING = [
  ['1', 4],
  ['2', 8],
  ['3', 12],
  ['4', 16],
  ['6', 24],
  ['8', 32],
  ['12', 48],
  ['16', 64],
] as const

const RADII = [
  ['rounded-sm', '6 px', 'Tabs inside a control'],
  ['rounded-md', '8 px', 'Buttons, inputs'],
  ['rounded-lg', '12 px', 'Cards, callouts'],
  ['rounded-xl', '16 px', 'Dialogs, large panels'],
  ['rounded-full', 'capsule', 'Badges, progress, switches'],
] as const

const SHADOWS = [
  ['shadow-xs', 'Controls and resting cards'],
  ['shadow-md', 'Cards on hover'],
  ['shadow-lg', 'Dialogs'],
] as const

export function LayoutSection() {
  return (
    <Section id="layout" title="Space and shape" lead="A 4 px grid, hairline borders and soft corners. Depth comes from borders first. Shadows are rare, and dark mode relies on borders alone.">
      <Block title="Spacing" note="Tailwind's scale, where one step is 4 px.">
        <ul className="space-y-2">
          {SPACING.map(([name, px]) => (
            <li key={name} className="flex items-center gap-4">
              <span className="w-24 shrink-0">
                <Mono>
                  {name} · {px} px
                </Mono>
              </span>
              <span className="h-3 rounded-full bg-gray-300 dark:bg-gray-700" style={{ width: px }} />
            </li>
          ))}
        </ul>
      </Block>
      <Block title="Corners">
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {RADII.map(([name, size, use]) => (
            <li key={name}>
              <div className={cx('h-16 border border-gray-300 bg-gray-100 dark:border-gray-700 dark:bg-gray-800', name)} />
              <p className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-50">{size}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{use}</p>
            </li>
          ))}
        </ul>
      </Block>
      <Block title="Elevation">
        <ul className="grid gap-4 sm:grid-cols-3">
          {SHADOWS.map(([name, use]) => (
            <li key={name} className={cx('rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900', name)}>
              <Mono>{name}</Mono>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{use}</p>
            </li>
          ))}
        </ul>
      </Block>
      <Block title="Page widths">
        <p className="max-w-2xl text-sm text-gray-600 dark:text-gray-400">
          Pages use <Mono>max-w-6xl</Mono> (1152 px) with a 16 px gutter on phones and 24 px from small tablets up. Forms narrow to <Mono>max-w-2xl</Mono> and auth
          cards to <Mono>max-w-md</Mono>.
        </p>
      </Block>
    </Section>
  )
}

export function MotionSection() {
  return (
    <Section id="motion" title="Motion" lead="Quick and quiet. Only one thing keeps moving on its own: voice levels, and only while something is really live.">
      <Block title="Voice levels" note="The signature motion, for work in progress. It stops for people who ask their device to reduce motion.">
        <ThemePanes className="space-y-6">
          <Levels seed="vozia-sample" bars={40} animated className="h-14 w-full text-brand-500" />
          <div className="flex flex-wrap items-center gap-6">
            <Spinner />
            <Spinner className="size-8 text-brand-500 dark:text-brand-500" />
            <Badge variant="live">Translating</Badge>
          </div>
        </ThemePanes>
      </Block>
      <Block title="Timing">
        <ul className="grid gap-4 sm:grid-cols-3">
          {[
            ['100 ms', 'Presses and hovers'],
            ['150 ms', 'Menus and dialogs appearing'],
            ['300 ms', 'Progress moving'],
          ].map(([time, use]) => (
            <li key={time} className="rounded-lg border border-gray-200 p-5 dark:border-gray-800">
              <p className="font-mono text-sm text-gray-900 dark:text-gray-50">{time}</p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{use}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Things that appear use the easing <Mono>cubic-bezier(0.16, 1, 0.3, 1)</Mono>: fast at first, settling softly.
        </p>
      </Block>
    </Section>
  )
}

const ICONS: [string, LucideIcon][] = [
  ['Plus', Plus],
  ['Trash2', Trash2],
  ['Download', Download],
  ['FileText', FileText],
  ['RotateCcw', RotateCcw],
  ['UploadCloud', UploadCloud],
  ['Check', Check],
  ['X', X],
  ['ChevronDown', ChevronDown],
  ['Search', Search],
  ['Eye', Eye],
  ['LogOut', LogOut],
  ['Monitor', Monitor],
  ['Sun', Sun],
  ['Moon', Moon],
]

export function IconsSection() {
  return (
    <Section id="icons" title="Icons" lead="Lucide, with its default 2 px stroke and round ends, which match the logo. Icons take the color of the text beside them.">
      <Block title="In use" note="16 px inside buttons and controls, 20 px beside larger text, 32 px for a big moment such as the upload area.">
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {ICONS.map(([name, Icon]) => (
            <li key={name} className="flex flex-col items-center gap-3 rounded-lg border border-gray-200 p-4 text-gray-900 dark:border-gray-800 dark:text-gray-50">
              <Icon className="size-5" aria-hidden="true" />
              <Mono>{name}</Mono>
            </li>
          ))}
        </ul>
      </Block>
    </Section>
  )
}
