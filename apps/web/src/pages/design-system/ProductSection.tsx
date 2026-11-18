import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Play } from 'lucide-react'
import type { VoiceMode } from '@vozia/shared'
import { DubCard } from '../../components/DubCard'
import { VoiceSwitch, type VoiceTrack } from '../../components/DubPlayer'
import { LanguageName } from '../../components/LanguageName'
import { StageStepper } from '../../components/StageStepper'
import { TranscriptTable } from '../../components/TranscriptTable'
import { UploadDropzone } from '../../components/UploadDropzone'
import { VideoCard } from '../../components/VideoCard'
import { VoiceModePicker } from '../../components/VoiceModePicker'
import { VoiceprintPanel } from '../../components/VoiceprintPanel'
import { Badge, Button } from '../../components/ui'
import { Block, Section, ThemePanes } from './parts'
import { SAMPLE_DUBS, SAMPLE_SEGMENTS, SAMPLE_VIDEO } from './samples'

const SAMPLE_LANGUAGES = ['ja', 'pt', 'en', 'es', 'fr', 'de', 'ko', 'zh', 'hi', 'ar', 'ru', 'ta']

function Library() {
  return (
    <div className="grid gap-3">
      <VideoCard video={SAMPLE_VIDEO} />
      {SAMPLE_DUBS.map((dub) => (
        <DubCard key={dub.id} dub={dub} />
      ))}
    </div>
  )
}

function Voice() {
  const [voice, setVoice] = useState<{ voiceMode: VoiceMode; stockVoiceId: string | null }>({ voiceMode: 'clone', stockVoiceId: null })
  return <VoiceModePicker voiceMode={voice.voiceMode} stockVoiceId={voice.stockVoiceId} onChange={setVoice} />
}

/** The real switch under a sample frame: there is no video here, so it changes the words but plays no sound. */
function Player() {
  const [track, setTrack] = useState<VoiceTrack>('dub')
  return (
    <div className="dark max-w-2xl overflow-hidden rounded-xl border border-gray-800 bg-gray-950 text-gray-50">
      <div className="grid aspect-video place-items-center bg-black">
        <span className="grid size-14 place-items-center rounded-full bg-brand-500 text-gray-950">
          <Play className="size-6 translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
      <VoiceSwitch track={track} onChange={setTrack} dubLanguage="pt" originalLanguage="en" voiceMode="clone" />
    </div>
  )
}

const REAL_PAGES = [
  ['Landing', '/'],
  ['Pricing', '/pricing'],
  ['Log in', '/login'],
  ['Sign up', '/signup'],
  ['Library', '/app'],
  ['New dub', '/app/new'],
  ['Settings', '/app/settings'],
] as const

export function ProductSection() {
  return (
    <Section id="product" title="In the product" lead="The pieces that make Vozia Vozia, with sample content. The whole app already uses this system.">
      <Block title="See it in the real app">
        <div className="flex flex-wrap gap-2">
          {REAL_PAGES.map(([label, to]) => (
            <Button key={to} asChild variant="secondary" size="sm">
              <Link to={to}>{label}</Link>
            </Button>
          ))}
        </div>
      </Block>
      <Block
        title="The voice switch"
        note="Under every finished dub whose original Vozia kept. It changes the voice and keeps the moment, so you hear that it is the same person. This sample has no video, so it plays no sound."
      >
        <Player />
      </Block>
      <Block
        title="The line being spoken"
        note="The transcript reads like a script, in larger text, with a yellow marker on the line you are hearing. The marker follows the voice you chose, and each time plays the video from that line."
      >
        <ThemePanes className="p-0 sm:p-5">
          <TranscriptTable
            segments={SAMPLE_SEGMENTS}
            sourceLabel={<LanguageName code="en" />}
            targetLabel={<LanguageName code="pt" />}
            sourceLang="en"
            targetLang="pt"
            currentMs={3500}
          />
        </ThemePanes>
      </Block>
      <Block
        title="Languages"
        note="Each language by its own name, in its own script, never a flag: a language is not a country. Pickers add the English name, so a language you do not read is still easy to find. Geist has no Japanese, Korean, Hindi or Arabic, so those use the device's fonts for now."
      >
        <ThemePanes className="flex flex-wrap gap-2">
          {SAMPLE_LANGUAGES.map((code) => (
            <Badge key={code} variant="neutral" className="px-3 py-1 text-sm">
              <LanguageName code={code} />
            </Badge>
          ))}
        </ThemePanes>
      </Block>
      <Block
        title="Voiceprint"
        note="One voiceprint, unchanged, under each language: the person speaking does not change, so neither do the bars. A yellow panel on light pages, yellow bars on dark ones."
      >
        <ThemePanes>
          <VoiceprintPanel />
        </ThemePanes>
      </Block>
      <Block title="Library" note="A video with no thumbnail gets its own voiceprint on yellow: bars generated from its id, so each one looks different and never changes.">
        <ThemePanes>
          <Library />
        </ThemePanes>
      </Block>
      <Block title="Dub progress" note="Finished stages turn green, and the stage being made carries the yellow and its moving voiceprint.">
        <ThemePanes>
          <StageStepper pipeline="staged" status="translating" progress={60} failedStage={null} />
        </ThemePanes>
      </Block>
      <Block title="Choosing a voice">
        <ThemePanes>
          <Voice />
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
