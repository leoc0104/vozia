import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { VoiceMode } from '@vozia/shared'
import { DubCard } from '../../components/DubCard'
import { DubPreview } from '../../components/DubPreview'
import { StageStepper } from '../../components/StageStepper'
import { TranscriptTable } from '../../components/TranscriptTable'
import { UploadDropzone } from '../../components/UploadDropzone'
import { VideoCard } from '../../components/VideoCard'
import { VoiceModePicker } from '../../components/VoiceModePicker'
import { Button } from '../../components/ui'
import { Block, Section, ThemePanes } from './parts'
import { SAMPLE_DUBS, SAMPLE_SEGMENTS, SAMPLE_VIDEO } from './samples'

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
      <Block title="Library" note="A video with no thumbnail gets its own voiceprint: bars generated from its id, so each one looks different and never changes.">
        <ThemePanes>
          <Library />
        </ThemePanes>
      </Block>
      <Block title="Dub progress" note="Finished stages turn green, and the live stage carries the signal and its moving levels.">
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
      <Block title="Transcript" note="Timecodes in Geist Mono, and the line still being translated stays quiet.">
        <ThemePanes className="p-0 sm:p-5">
          <TranscriptTable segments={SAMPLE_SEGMENTS} sourceLabel="English" targetLabel="Portuguese" />
        </ThemePanes>
      </Block>
      <Block title="Landing illustration" note="One timeline, with the original above and the dub below. It stays honest about what a dub is: same rhythm, new language.">
        <ThemePanes>
          <DubPreview />
        </ThemePanes>
      </Block>
    </Section>
  )
}
