import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { extensionForMime, sourceObjectPath } from '@vozia/db'
import { extractYoutubeId } from '@vozia/shared'
import { LanguageSelect } from '../components/LanguageSelect'
import { UploadDropzone } from '../components/UploadDropzone'
import { VoiceModePicker } from '../components/VoiceModePicker'
import { Button, Callout, Field, Input, ProgressBar, Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui'
import { InsufficientMinutesError, createDub, createVideo } from '../lib/api'
import { useVideo } from '../lib/queries'
import { uploadSource } from '../lib/upload'
import { useAuthStore } from '../stores/auth-store'
import { useCreateDubStore, type CreateDubErrors } from '../stores/create-dub-store'
import { useUploadStore } from '../stores/upload-store'

const sectionTitle = 'text-base font-semibold text-gray-900 dark:text-gray-50'

export function NewDubPage() {
  const navigate = useNavigate()
  const { videoId: existingVideoId } = useSearch({ from: '/app/new' })
  const session = useAuthStore((s) => s.session)
  const form = useCreateDubStore()
  const uploads = useUploadStore()
  const existingVideo = useVideo(existingVideoId ?? '')
  const [errors, setErrors] = useState<CreateDubErrors>({})
  const [submitError, setSubmitError] = useState<'minutes' | string | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploadId, setUploadId] = useState<string | null>(null)

  useEffect(() => {
    form.reset(existingVideoId ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingVideoId])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitError(null)
    const result = form.validate()
    setErrors(result.errors)
    if (!result.ok || !session) return
    setBusy(true)
    try {
      let videoId = form.videoId
      if (!videoId) {
        if (form.sourceTab === 'upload' && form.file) {
          const id = crypto.randomUUID()
          const extension = extensionForMime(form.file.type) ?? 'mp4'
          const objectPath = sourceObjectPath(session.user.id, id, extension)
          setUploadId(id)
          uploads.start(id)
          await uploadSource({
            file: form.file,
            objectPath,
            accessToken: session.access_token,
            onProgress: (fraction) => useUploadStore.getState().progress(id, fraction),
          })
          uploads.finish(id)
          const video = await createVideo({ id, title: form.file.name.replace(/\.[^.]+$/, ''), sourceType: 'upload', sourceUrl: null, storagePath: objectPath })
          videoId = video.id
        } else {
          const url = form.youtubeUrl.trim()
          const video = await createVideo({ title: `YouTube video ${extractYoutubeId(url) ?? ''}`.trim(), sourceType: 'youtube', sourceUrl: url, storagePath: null })
          videoId = video.id
        }
      }
      const dub = await createDub({
        videoId,
        targetLanguage: form.targetLanguage,
        sourceLanguage: form.sourceLanguage,
        voiceMode: form.voiceMode,
        stockVoiceId: form.stockVoiceId,
      })
      form.reset()
      await navigate({ to: '/app/dubs/$dubId', params: { dubId: dub.id } })
    } catch (e) {
      if (uploadId) uploads.fail(uploadId, (e as Error).message)
      setSubmitError(e instanceof InsufficientMinutesError ? 'minutes' : (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const upload = uploadId ? uploads.uploads[uploadId] : undefined

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-8" noValidate>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
          {existingVideoId ? 'Add a language' : 'New dub'}
        </h1>
        {existingVideoId ? (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">Adding a dub to {existingVideo.data?.title ?? 'this video'}.</p>
        ) : (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Upload a video or paste a YouTube link, then choose the language and voice.
          </p>
        )}
      </div>

      {submitError === 'minutes' ? (
        <Callout variant="error">
          You have used all your dubbing minutes.{' '}
          <Link to="/pricing" className="font-medium underline">
            See plans
          </Link>
        </Callout>
      ) : submitError ? (
        <Callout variant="error">{submitError}</Callout>
      ) : null}

      {!existingVideoId ? (
        <section className="space-y-4">
          <h2 className={sectionTitle}>Source</h2>
          <Tabs
            value={form.sourceTab}
            onValueChange={(value) => {
              if (value === 'upload' || value === 'youtube') form.setField('sourceTab', value)
            }}
          >
            <TabsList variant="solid">
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="youtube">YouTube link</TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="mt-4">
              <UploadDropzone file={form.file} onFile={(file) => form.setField('file', file)} error={errors.source} />
            </TabsContent>
            <TabsContent value="youtube" className="mt-4">
              <Field label="YouTube URL" htmlFor="youtube-url" error={errors.source}>
                <Input
                  id="youtube-url"
                  placeholder="https://www.youtube.com/watch?v=…"
                  hasError={Boolean(errors.source)}
                  value={form.youtubeUrl}
                  onChange={(e) => form.setField('youtubeUrl', e.target.value)}
                />
              </Field>
            </TabsContent>
          </Tabs>
          {upload && upload.status === 'uploading' ? (
            <ProgressBar value={upload.fraction * 100} showAnimation aria-label="Upload progress" />
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Dub into" htmlFor="target-language" error={errors.targetLanguage}>
          <LanguageSelect id="target-language" value={form.targetLanguage} onChange={(code) => form.setField('targetLanguage', code ?? '')} />
        </Field>
        <Field label="Spoken language" htmlFor="source-language" hint="Leave on auto-detect unless it guesses wrong.">
          <LanguageSelect id="source-language" value={form.sourceLanguage} onChange={(code) => form.setField('sourceLanguage', code)} allowAuto />
        </Field>
      </section>

      <section className="space-y-3">
        <h2 className={sectionTitle}>Voice</h2>
        <VoiceModePicker
          voiceMode={form.voiceMode}
          stockVoiceId={form.stockVoiceId}
          onChange={(next) => {
            form.setField('voiceMode', next.voiceMode)
            form.setField('stockVoiceId', next.stockVoiceId)
          }}
          error={errors.stockVoiceId}
        />
      </section>

      <div className="flex justify-end gap-3">
        <Button asChild variant="secondary">
          <Link to="/app">Cancel</Link>
        </Button>
        <Button type="submit" isLoading={busy} loadingText={upload?.status === 'uploading' ? 'Uploading…' : undefined}>
          Start dubbing
        </Button>
      </div>
    </form>
  )
}
