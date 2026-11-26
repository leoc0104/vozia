import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Download, FileText, RotateCcw, Trash2 } from 'lucide-react'
import { BUCKETS, type DubSegmentRow } from '@vozia/db'
import { readDubQuality, type DubStatus } from '@vozia/shared'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DubQualityPanel } from '../components/DubQualityPanel'
import { RetakeDialog } from '../components/RetakeDialog'
import { DubPlayer, type VoiceTrack } from '../components/DubPlayer'
import { LanguageName } from '../components/LanguageName'
import { StageStepper } from '../components/StageStepper'
import { TranscriptTable } from '../components/TranscriptTable'
import { Badge, Button, Callout, Card, Spinner } from '../components/ui'
import { deleteDub, requestRetake, retryDub } from '../lib/api'
import { qk, useDub, useRetakes, useSegments, useSignedUrl, useVideo } from '../lib/queries'
import { badgeVariantForStatus, statusLabel } from '../lib/status-ui'

export function DubDetailPage() {
  const { dubId } = useParams({ from: '/app/dubs/$dubId' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const dub = useDub(dubId)
  const video = useVideo(dub.data?.video_id ?? '')
  const segments = useSegments(dubId, dub.data?.pipeline !== 'elevenlabs' && dub.data?.status !== 'queued')
  const [busy, setBusy] = useState<'retry' | 'delete' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Re-taking one line of a finished dub: the line asked about, and the re-takes waiting, running or done.
  const canRetake = dub.data?.status === 'completed' && dub.data.pipeline === 'staged'
  const retakes = useRetakes(dubId, canRetake)
  const [retakeLine, setRetakeLine] = useState<DubSegmentRow | null>(null)
  const pendingRetake = retakes.data?.find((r) => r.status === 'queued' || r.status === 'running') ?? null
  const lastRetake = retakes.data?.[0] ?? null
  // When a re-take this page saw waiting finishes, the dub's files and lines have changed: fetch them again.
  const waitingRetakes = useRef(new Set<string>())
  useEffect(() => {
    for (const retake of retakes.data ?? []) {
      if (retake.status === 'queued' || retake.status === 'running') waitingRetakes.current.add(retake.id)
      else if (waitingRetakes.current.delete(retake.id)) {
        void queryClient.invalidateQueries({ queryKey: qk.dub(dubId) })
        void queryClient.invalidateQueries({ queryKey: qk.segments(dubId) })
        void queryClient.invalidateQueries({ queryKey: ['signed-url'] })
        void queryClient.invalidateQueries({ queryKey: ['signed-urls'] })
      }
    }
  }, [retakes.data, queryClient, dubId])

  async function onRetake(text: string) {
    if (!retakeLine) return
    await requestRetake(dubId, retakeLine.idx, text)
    await queryClient.invalidateQueries({ queryKey: qk.retakes(dubId) })
  }

  const [track, setTrack] = useState<VoiceTrack>('dub')
  const [currentMs, setCurrentMs] = useState<number | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const title = video.data?.title ?? 'Video'
  const fileName = `${title.replace(/[^\w.-]+/g, '_')}-${dub.data?.target_language ?? 'dub'}.mp4`
  const playback = useSignedUrl(BUCKETS.outputs, dub.data?.output_path)
  // The original video, kept for uploads and for links Vozia downloaded itself: what the voice switch plays.
  const original = useSignedUrl(BUCKETS.sources, dub.data?.status === 'completed' ? video.data?.storage_path : null)
  const download = useSignedUrl(BUCKETS.outputs, dub.data?.output_path, fileName)
  const srtOriginal = useSignedUrl(BUCKETS.outputs, dub.data?.srt_original_path, 'original.srt')
  const srtTranslated = useSignedUrl(BUCKETS.outputs, dub.data?.srt_translated_path, `${dub.data?.target_language ?? 'translated'}.srt`)

  async function onRetry() {
    setBusy('retry')
    setActionError(null)
    try {
      await retryDub(dubId)
      await queryClient.invalidateQueries({ queryKey: qk.dub(dubId) })
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  function playFrom(ms: number) {
    const player = videoRef.current
    if (!player) return
    player.currentTime = ms / 1000
    void player.play()?.catch(() => undefined)
  }

  async function onDelete() {
    if (!dub.data) return
    setBusy('delete')
    try {
      await deleteDub(dub.data)
      await queryClient.invalidateQueries({ queryKey: qk.videos() })
      await navigate({ to: '/app/videos/$videoId', params: { videoId: dub.data.video_id } })
    } catch (e) {
      setActionError((e as Error).message)
      setBusy(null)
    }
  }

  if (dub.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }
  if (dub.isError || !dub.data) {
    return <Callout variant="error">This dub could not be found.</Callout>
  }

  const d = dub.data
  const failedWhile = d.failed_stage ? ` while ${statusLabel(d.failed_stage as DubStatus).toLowerCase()}` : ''
  const quality = readDubQuality(d.quality)
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/app/videos/$videoId"
            params={{ videoId: d.video_id }}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            ← {title}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-50">
            <LanguageName code={d.target_language} />
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={badgeVariantForStatus(d.status)}>{statusLabel(d.status)}</Badge>
            <Badge variant="neutral">{d.voice_mode === 'clone' ? 'Cloned voice' : 'Stock voice'}</Badge>
            {d.detected_language ? (
              <Badge variant="neutral">
                <span>
                  From <LanguageName code={d.detected_language} />
                </span>
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex gap-2">
          {d.status === 'failed' ? (
            <Button onClick={() => void onRetry()} isLoading={busy === 'retry'}>
              <RotateCcw className="size-4" aria-hidden="true" /> Retry
            </Button>
          ) : null}
          <ConfirmDialog
            trigger={
              <Button variant="secondary">
                <Trash2 className="size-4" aria-hidden="true" /> Delete
              </Button>
            }
            title="Delete this dub?"
            description="This removes the dubbed video, its audio and subtitles. It cannot be undone."
            confirmLabel="Delete"
            onConfirm={onDelete}
            busy={busy === 'delete'}
          />
        </div>
      </div>

      {actionError ? <Callout variant="error">{actionError}</Callout> : null}

      {d.status === 'failed' ? (
        <Callout variant="error" title={`Dubbing failed${failedWhile}.`}>
          {d.error_message ?? 'Unknown error.'}
        </Callout>
      ) : null}

      {d.status === 'completed' ? (
        <section className="space-y-4">
          {playback.data ? (
            <DubPlayer
              videoRef={videoRef}
              dubSrc={playback.data}
              originalSrc={original.data ?? null}
              dubLanguage={d.target_language}
              originalLanguage={d.detected_language}
              voiceMode={d.voice_mode}
              track={track}
              onTrackChange={setTrack}
              onTime={setCurrentMs}
            />
          ) : (
            <div className="grid aspect-video place-items-center rounded-xl bg-black">
              <Spinner className="size-6 text-white dark:text-white" />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {download.data ? (
              <Button asChild>
                <a href={download.data}>
                  <Download className="size-4" aria-hidden="true" /> Download video
                </a>
              </Button>
            ) : (
              <Button disabled>
                <Download className="size-4" aria-hidden="true" /> Download video
              </Button>
            )}
            {srtOriginal.data ? (
              <Button asChild variant="secondary">
                <a href={srtOriginal.data}>
                  <FileText className="size-4" aria-hidden="true" /> Original subtitles
                </a>
              </Button>
            ) : null}
            {srtTranslated.data ? (
              <Button asChild variant="secondary">
                <a href={srtTranslated.data}>
                  <FileText className="size-4" aria-hidden="true" />
                  <span>
                    Subtitles in <LanguageName code={d.target_language} />
                  </span>
                </a>
              </Button>
            ) : null}
          </div>
          {quality ? <DubQualityPanel quality={quality} /> : null}
        </section>
      ) : (
        <Card>
          <StageStepper pipeline={d.pipeline} status={d.status} progress={d.progress} failedStage={d.failed_stage} />
        </Card>
      )}

      {segments.data && segments.data.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Transcript</h2>
          {pendingRetake ? (
            <Callout variant="neutral" title="Re-taking a line." className="mt-3">
              The new voice is recording it now. The dub updates here when it is ready; the one you have keeps playing.
            </Callout>
          ) : lastRetake?.status === 'failed' ? (
            <Callout variant="error" title="That line could not be re-taken." className="mt-3">
              {lastRetake.error_message ?? 'Something went wrong.'}
            </Callout>
          ) : null}
          <div className="mt-3">
            <TranscriptTable
              segments={segments.data}
              sourceLabel={d.detected_language ? <LanguageName code={d.detected_language} /> : 'Original'}
              targetLabel={<LanguageName code={d.target_language} />}
              sourceLang={d.detected_language}
              targetLang={d.target_language}
              currentMs={d.status === 'completed' ? currentMs : null}
              markColumn={track === 'original' && original.data ? 'source' : 'target'}
              onSeek={d.status === 'completed' && playback.data ? playFrom : undefined}
              onRetake={canRetake ? setRetakeLine : undefined}
              retakingIdx={pendingRetake?.idx ?? null}
            />
          </div>
          <RetakeDialog
            key={retakeLine?.id ?? 'closed'}
            segment={retakeLine}
            sourceLang={d.detected_language}
            targetLang={d.target_language}
            onClose={() => setRetakeLine(null)}
            onSubmit={onRetake}
          />
        </section>
      ) : null}
    </div>
  )
}
