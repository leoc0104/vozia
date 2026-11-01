import { useEffect, useId, useState, type ReactNode } from 'react'
import { Download, FileText, LogOut, Plus, Trash2 } from 'lucide-react'
import { Levels } from '../../components/Levels'
import { LogoLockup } from '../../components/Logo'
import { ThemeSwitcher } from '../../components/ThemeSwitcher'
import { TranscriptTable } from '../../components/TranscriptTable'
import { UploadDropzone } from '../../components/UploadDropzone'
import { VideoCard } from '../../components/VideoCard'
import {
  Badge,
  Button,
  Card,
  Field,
  RadioCardGroup,
  RadioCardIndicator,
  RadioCardItem,
  SelectNative,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../components/ui'
import type { VideoWithDubs } from '../../lib/api'
import { formatDate, formatDuration } from '../../lib/format'
import { badgeVariantForStatus } from '../../lib/status-ui'
import { NextLogo, SpokenTranscript, VoicePlayer, VoiceprintPanel } from './brand'
import { SAMPLE_SEGMENTS, SAMPLE_VIDEOS, languageName } from './samples'

/** A full app screen shrunk to fit its column. It is a picture of the screen, so it takes no clicks. */
export function ScaledScreen({ width = 1200, children }: { width?: number; children: ReactNode }) {
  const [frame, setFrame] = useState<HTMLDivElement | null>(null)
  const [inner, setInner] = useState<HTMLDivElement | null>(null)
  const [fit, setFit] = useState({ scale: 1, height: 0 })

  useEffect(() => {
    if (!frame || !inner) return
    const observer = new ResizeObserver(() => {
      const scale = frame.clientWidth / width
      setFit({ scale, height: inner.offsetHeight * scale })
    })
    observer.observe(frame)
    observer.observe(inner)
    return () => observer.disconnect()
  }, [frame, inner, width])

  return (
    <div
      ref={setFrame}
      className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
      style={{ height: fit.height || undefined }}
    >
      <div ref={setInner} inert aria-hidden="true" style={{ width, transform: `scale(${fit.scale})`, transformOrigin: 'top left' }}>
        {children}
      </div>
    </div>
  )
}

const quiet = 'text-gray-600 dark:text-gray-400'
const title = 'text-gray-900 dark:text-gray-50'

function AppFrame({ after, children }: { after: boolean; children: ReactNode }) {
  return (
    <div className="min-h-[720px] bg-gray-50 dark:bg-gray-950">
      <div className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-6">
            {after ? (
              <NextLogo />
            ) : (
              <span className={title}>
                <LogoLockup />
              </span>
            )}
            <div className={`flex items-center gap-4 text-sm font-medium ${quiet}`}>
              <span className={title}>Library</span>
              <span>Settings</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <Badge variant="neutral">7 min left</Badge>
            <Button size="sm">
              <Plus className="size-4" aria-hidden="true" /> New dub
            </Button>
            <Button size="sm" variant="ghost" aria-label="Sign out">
              <LogOut className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </div>
  )
}

export function LandingAfter() {
  return (
    <div className="bg-white dark:bg-gray-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-5">
        <NextLogo />
        <div className={`flex items-center gap-5 text-sm font-medium ${quiet}`}>
          <span>Pricing</span>
          <span>Log in</span>
          <Button size="sm">Start for free</Button>
          <ThemeSwitcher />
        </div>
      </div>
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,7fr)_minmax(0,5fr)] items-center gap-12 px-6 pb-20 pt-20">
        <div>
          <p className={`text-6xl font-semibold ${title}`}>Watch it in your language. Keep the original voice.</p>
          <p className={`mt-5 max-w-2xl text-lg ${quiet}`}>
            Some voices are part of the story. Vozia translates a video and keeps the voice of the person speaking, so it still sounds like them.
          </p>
          <div className="mt-8 flex gap-3">
            <Button size="lg" variant="accent">
              Dub your first video free
            </Button>
            <Button size="lg" variant="secondary">
              See pricing
            </Button>
          </div>
        </div>
        <VoiceprintPanel />
      </div>
      <div className="border-t border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/40">
        <div className="mx-auto grid max-w-6xl grid-cols-3 gap-8 px-6 py-16">
          {[
            ['01', 'Paste a link or upload a video', 'Whatever you want to watch. Vozia keeps the original in your library.'],
            ['02', 'Choose your language', 'One of 29, each shown by its own name. Keep the original voice, or pick another.'],
            ['03', 'Hear the same voice', 'Switch between the original and your language at any moment, and read along.'],
          ].map(([number, heading, body]) => (
            <div key={number}>
              <span className="font-mono text-sm text-gray-500 dark:text-gray-400">{number}</span>
              <p className={`mt-3 text-lg font-semibold ${title}`}>{heading}</p>
              <p className={`mt-2 text-sm ${quiet}`}>{body}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-gray-200 dark:border-gray-800">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-gray-500 dark:text-gray-400">© 2026 Vozia. Same voice, your language.</div>
      </div>
    </div>
  )
}

function VideoCardAfter({ video }: { video: VideoWithDubs }) {
  return (
    <Card className="h-full overflow-hidden p-0">
      <div className="aspect-video bg-brand-500 dark:bg-gray-800/60">
        <div className="flex size-full items-center px-6 py-8 text-gray-950 dark:text-brand-500">
          <Levels seed={video.id} bars={32} className="size-full" />
        </div>
      </div>
      <div className="space-y-2 p-4">
        <p className={`truncate text-sm font-semibold ${title}`}>{video.title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {formatDuration(video.duration_seconds)} · {formatDate(video.created_at)}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {video.dubs.map((dub) => (
            <Badge key={dub.id} variant={badgeVariantForStatus(dub.status)}>
              <span lang={dub.target_language}>{languageName(dub.target_language)}</span>
              {dub.status === 'failed' ? ' · failed' : dub.status === 'completed' ? '' : ` ${dub.progress}%`}
            </Badge>
          ))}
        </div>
      </div>
    </Card>
  )
}

export function LibraryScreen({ after = false }: { after?: boolean }) {
  return (
    <AppFrame after={after}>
      <p className={`text-2xl font-semibold ${title}`}>Library</p>
      <div className="mt-6 grid grid-cols-3 gap-5">
        {SAMPLE_VIDEOS.map((video) => (after ? <VideoCardAfter key={video.id} video={video} /> : <VideoCard key={video.id} video={video} />))}
      </div>
    </AppFrame>
  )
}

const LANGUAGE_OPTIONS = ['pt', 'es', 'en']
const ENGLISH_NAMES: Record<string, string> = { pt: 'Portuguese', es: 'Spanish', en: 'English' }

export function NewDubScreen({ after = false }: { after?: boolean }) {
  const id = useId()
  const voices = after
    ? [
        ['clone', 'Keep the original voice', 'The person speaking keeps their voice, in the new language.'],
        ['stock', 'Use another voice', 'Pick a curated professional voice.'],
      ]
    : [
        ['clone', 'Keep my voice', 'Clones the speaker from the original audio.'],
        ['stock', 'Stock voice', 'Pick a curated professional voice.'],
      ]
  return (
    <AppFrame after={after}>
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <p className={`text-2xl font-semibold ${title}`}>New dub</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Upload a video or paste a YouTube link, then choose the language and voice.</p>
        </div>
        <div className="space-y-4">
          <p className={`text-base font-semibold ${title}`}>Source</p>
          <Tabs defaultValue="upload">
            <TabsList variant="solid">
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="youtube">YouTube link</TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="mt-4">
              <UploadDropzone file={null} onFile={() => undefined} />
            </TabsContent>
          </Tabs>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Dub into" htmlFor={`${id}-target`}>
            <SelectNative id={`${id}-target`} defaultValue="pt">
              {LANGUAGE_OPTIONS.map((code) => (
                <option key={code} value={code}>
                  {after ? languageName(code) : ENGLISH_NAMES[code]}
                </option>
              ))}
            </SelectNative>
          </Field>
          <Field label="Spoken language" htmlFor={`${id}-source`} hint="Leave on auto-detect unless it guesses wrong.">
            <SelectNative id={`${id}-source`} defaultValue="auto">
              <option value="auto">Auto-detect</option>
            </SelectNative>
          </Field>
        </div>
        <div className="space-y-3">
          <p className={`text-base font-semibold ${title}`}>Voice</p>
          <RadioCardGroup aria-label="Voice" defaultValue="clone" className="grid-cols-2 gap-3">
            {voices.map(([value, heading, body]) => (
              <RadioCardItem key={value} value={value!}>
                <div className="flex items-start gap-3">
                  <RadioCardIndicator className="mt-0.5" />
                  <div>
                    <span className={`block text-sm font-semibold ${title}`}>{heading}</span>
                    <span className={`mt-1 block text-xs ${quiet}`}>{body}</span>
                  </div>
                </div>
              </RadioCardItem>
            ))}
          </RadioCardGroup>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary">Cancel</Button>
          <Button>Start dubbing</Button>
        </div>
      </div>
    </AppFrame>
  )
}

export function DubScreen({ after = false }: { after?: boolean }) {
  return (
    <AppFrame after={after}>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">← A short film</p>
            <p className={`mt-1 text-2xl font-semibold ${title}`}>{after ? 'Português' : 'Portuguese dub'}</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="success">Completed</Badge>
              <Badge variant="neutral">{after ? 'Original voice' : 'Cloned voice'}</Badge>
              <Badge variant="neutral">{after ? 'From 日本語' : 'From Japanese'}</Badge>
            </div>
          </div>
          <Button variant="secondary">
            <Trash2 className="size-4" aria-hidden="true" /> Delete
          </Button>
        </div>
        {after ? (
          <VoicePlayer />
        ) : (
          <div className="overflow-hidden rounded-lg bg-black">
            <video controls className="aspect-video w-full" />
          </div>
        )}
        <div className="flex gap-2">
          <Button>
            <Download className="size-4" aria-hidden="true" /> Download video
          </Button>
          <Button variant="secondary">
            <FileText className="size-4" aria-hidden="true" /> Original subtitles
          </Button>
          <Button variant="secondary">
            <FileText className="size-4" aria-hidden="true" /> {after ? 'Legendas em português' : 'Portuguese subtitles'}
          </Button>
        </div>
        <div>
          <p className={`mb-3 text-lg font-semibold ${title}`}>Transcript</p>
          {after ? <SpokenTranscript /> : <TranscriptTable segments={SAMPLE_SEGMENTS} sourceLabel="Japanese" targetLabel="Portuguese" />}
        </div>
      </div>
    </AppFrame>
  )
}
