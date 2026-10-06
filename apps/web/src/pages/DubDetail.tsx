import { useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Download, FileText, RotateCcw, Trash2 } from 'lucide-react'
import { BUCKETS } from '@vozia/db'
import { languageLabel, type DubStatus } from '@vozia/shared'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { StageStepper } from '../components/StageStepper'
import { TranscriptTable } from '../components/TranscriptTable'
import { Badge, Button, Callout, Card, Spinner } from '../components/ui'
import { deleteDub, retryDub } from '../lib/api'
import { qk, useDub, useSegments, useSignedUrl, useVideo } from '../lib/queries'
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

  const title = video.data?.title ?? 'Video'
  const language = dub.data ? languageLabel(dub.data.target_language) : ''
  const fileName = `${title.replace(/[^\w.-]+/g, '_')}-${dub.data?.target_language ?? 'dub'}.mp4`
  const playback = useSignedUrl(BUCKETS.outputs, dub.data?.output_path)
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
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/app/videos/$videoId"
            params={{ videoId: d.video_id }}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
          >
            ← {title}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">{language} dub</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={badgeVariantForStatus(d.status)}>{statusLabel(d.status)}</Badge>
            <Badge variant="neutral">{d.voice_mode === 'clone' ? 'Cloned voice' : 'Stock voice'}</Badge>
            {d.detected_language ? <Badge variant="neutral">From {languageLabel(d.detected_language)}</Badge> : null}
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
              <Button variant="destructive">
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
          <div className="overflow-hidden rounded-lg bg-black">
            {playback.data ? (
              <video controls src={playback.data} className="aspect-video w-full" />
            ) : (
              <div className="grid aspect-video place-items-center">
                <Spinner className="size-6 text-white dark:text-white" />
              </div>
            )}
          </div>
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
                  <FileText className="size-4" aria-hidden="true" /> {language} subtitles
                </a>
              </Button>
            ) : null}
          </div>
        </section>
      ) : (
        <Card>
          <StageStepper pipeline={d.pipeline} status={d.status} progress={d.progress} failedStage={d.failed_stage} />
        </Card>
      )}

      {segments.data && segments.data.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Transcript</h2>
          <div className="mt-3">
            <TranscriptTable
              segments={segments.data}
              sourceLabel={d.detected_language ? languageLabel(d.detected_language) : 'Original'}
              targetLabel={language}
            />
          </div>
        </section>
      ) : null}
    </div>
  )
}
