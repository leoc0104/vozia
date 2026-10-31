import { cx } from '../../lib/utils'
import { Block, Mono, Section } from './parts'

const SCALE = [
  { name: 'Display', spec: '60 px · semibold · −4%', use: 'Landing hero only', className: 'text-4xl font-semibold sm:text-6xl', sample: 'Dub your videos' },
  { name: 'Headline', spec: '36 px · semibold · −3%', use: 'Marketing page titles', className: 'text-4xl font-semibold', sample: 'Simple pricing' },
  { name: 'Section', spec: '30 px · semibold · −2.5%', use: 'Large section titles', className: 'text-3xl font-semibold', sample: 'Every language' },
  { name: 'Title', spec: '24 px · semibold · −2%', use: 'App page titles', className: 'text-2xl font-semibold', sample: 'Your library' },
  { name: 'Heading', spec: '18 px · semibold · −1%', use: 'Cards and groups', className: 'text-lg font-semibold', sample: 'Portuguese dub' },
  { name: 'Body', spec: '16 px · regular', use: 'Reading text', className: 'text-base', sample: 'Upload a video or paste a YouTube link.' },
  { name: 'Interface', spec: '14 px · regular or medium', use: 'The default in the app', className: 'text-sm', sample: 'Choose a language and a voice.' },
  { name: 'Caption', spec: '12 px · regular', use: 'Hints and metadata', className: 'text-xs', sample: 'MP4, MOV, WebM or MKV up to 2 GB' },
  { name: 'Data', spec: 'Geist Mono · 12 px', use: 'Timecodes and technical values', className: 'font-mono text-xs', sample: '00:42 · 1280×720 · 48 kHz' },
]

const GREETINGS = [
  ['Portuguese', 'Olá'],
  ['Spanish', 'Hola'],
  ['Russian', 'Привет'],
  ['Greek', 'Γειά σου'],
  ['Japanese', 'こんにちは'],
  ['Korean', '안녕하세요'],
  ['Chinese', '你好'],
  ['Hindi', 'नमस्ते'],
  ['Tamil', 'வணக்கம்'],
  ['Arabic', 'مرحبا'],
]

export function TypeSection() {
  return (
    <Section id="type" title="Typography" lead="One family, set tight. Weight stops at semibold: size and space create the hierarchy, not heavy type.">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0 rounded-lg border border-gray-200 p-6 dark:border-gray-800">
          <p className="text-5xl font-semibold text-gray-900 dark:text-gray-50">Geist</p>
          <p className="mt-4 break-words text-sm text-gray-600 dark:text-gray-400">
            AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz 0123456789
          </p>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">For everything you read.</p>
        </div>
        <div className="min-w-0 rounded-lg border border-gray-200 p-6 dark:border-gray-800">
          <p className="font-mono text-5xl font-medium tracking-tight text-gray-900 dark:text-gray-50">00:42</p>
          <p className="mt-4 break-words font-mono text-sm text-gray-600 dark:text-gray-400">
            AaBbCcDdEeFfGgHhIiJjKkLlMm 0123456789
          </p>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Geist Mono, for timecodes and technical values, like a studio console.</p>
        </div>
      </div>

      <Block title="Scale" note="Tracking and line height are part of the size token, so a heading needs only a size and a weight.">
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {SCALE.map(({ name, spec, use, className, sample }) => (
            <li key={name} className="grid gap-x-6 gap-y-2 p-5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{name}</p>
                <Mono>{spec}</Mono>
                <p className="text-xs text-gray-500 dark:text-gray-400">{use}</p>
              </div>
              <p className={cx('min-w-0 break-words text-gray-900 dark:text-gray-50', className)}>{sample}</p>
            </li>
          ))}
        </ul>
      </Block>

      <Block
        title="Every script"
        note="The interface is English, but transcripts can be in any of the 29 languages. Geist covers Latin, so other scripts use the device's own fonts and will look a little different from one device to another."
      >
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {GREETINGS.map(([language, greeting]) => (
            <li key={language} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
              <p dir="auto" className="text-xl font-semibold text-gray-900 dark:text-gray-50">
                {greeting}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{language}</p>
            </li>
          ))}
        </ul>
      </Block>
    </Section>
  )
}
