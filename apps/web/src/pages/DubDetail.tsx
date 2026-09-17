import { useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Download, FileText, RotateCcw, Trash2 } from 'lucide-react'
import { BUCKETS } from '@vozia/db'
import { languageLabel } from '@vozia/shared'
import { StageStepper } from '../components/StageStepper'
import { TranscriptTable } from '../components/TranscriptTable'
import { Alert, Badge, Button, Card, CardBody, Spinner } from '../components/ui'
import { deleteDub, retryDub } from '../lib/api'
import { qk, useDub, useSegments, useSignedUrl, useVideo } from '../lib/queries'
import { statusLabel, toneForStatus } from '../lib/status-ui'

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
    if (!dub.data || !window.confirm('Delete this dub? This cannot be undone.')) return
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
    return <Alert tone="error">This dub could not be found.</Alert>
  }

  const d = dub.data
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/app/videos/$videoId" params={{ videoId: d.video_id }} className="text-sm text-slate-500 hover:underline">
            ← {title}
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{language} dub</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={toneForStatus(d.status)}>{statusLabel(d.status)}</Badge>
            <Badge>{d.voice_mode === 'clone' ? 'Cloned voice' : 'Stock voice'}</Badge>
            {d.detected_language ? <Badge>From {languageLabel(d.detected_language)}</Badge> : null}
          </div>
        </div>
        <div className="flex gap-2">
          {d.status === 'failed' ? (
            <Button onClick={() => void onRetry()} loading={busy === 'retry'}>
              <RotateCcw className="size-4" aria-hidden="true" /> Retry
            </Button>
          ) : null}
          <Button variant="danger" onClick={() => void onDelete()} loading={busy === 'delete'}>
            <Trash2 className="size-4" aria-hidden="true" /> Delete
          </Button>
        </div>
      </div>

      {actionError ? <Alert tone="error">{actionError}</Alert> : null}

      {d.status === 'failed' ? (
        <Alert tone="error">
          <p className="font-medium">Dubbing failed{d.failed_stage ? ` while ${statusLabel(d.failed_stage as never).toLowerCase()}` : ''}.</p>
          <p className="mt-1">{d.error_message ?? 'Unknown error.'}</p>
        </Alert>
      ) : null}

      {d.status === 'completed' ? (
        <section className="space-y-4">
          <div className="overflow-hidden rounded-xl bg-black">
            {playback.data ? (
              <video controls src={playback.data} className="aspect-video w-full" />
            ) : (
              <div className="grid aspect-video place-items-center">
                <Spinner className="size-6 text-white" />
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={download.data ?? '#'} aria-disabled={!download.data}>
              <Button disabled={!download.data}>
                <Download className="size-4" aria-hidden="true" /> Download video
              </Button>
            </a>
            {srtOriginal.data ? (
              <a href={srtOriginal.data}>
                <Button variant="secondary">
                  <FileText className="size-4" aria-hidden="true" /> Original subtitles
                </Button>
              </a>
            ) : null}
            {srtTranslated.data ? (
              <a href={srtTranslated.data}>
                <Button variant="secondary">
                  <FileText className="size-4" aria-hidden="true" /> {language} subtitles
                </Button>
              </a>
            ) : null}
          </div>
        </section>
      ) : (
        <Card>
          <CardBody>
            <StageStepper pipeline={d.pipeline} status={d.status} progress={d.progress} failedStage={d.failed_stage} />
          </CardBody>
        </Card>
      )}

      {segments.data && segments.data.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Transcript</h2>
          <div className="mt-3">
            <TranscriptTable segments={segments.data} sourceLabel={d.detected_language ? languageLabel(d.detected_language) : 'Original'} targetLabel={language} />
          </div>
        </section>
      ) : null}
    </div>
  )
}
