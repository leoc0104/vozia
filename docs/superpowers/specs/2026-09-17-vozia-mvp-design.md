# Vozia — AI Video Dubbing SaaS (MVP Design)

**Date:** 2026-09-17
**Status:** Approved for autonomous build. The user validated the architecture in conversation
("Supabase + Turborepo, React + Zustand, login with Google, per-user library") and authorized the
remaining decisions to be taken by Claude. Each decision below records its rationale so the user can
veto it later; all of them are config-level swaps.

## Product

Vozia dubs videos into 20+ languages while preserving the speaker's voice (voice cloning) and the
background music/effects. A user signs up (email/password or Google), uploads a video or pastes a
YouTube link, picks a target language and a voice mode, and gets a dubbed video with live progress,
a downloadable output, and SRT subtitles (original and translated). Every user has a **library**:
their videos, each with one dub per target language. Usage is metered in **dubbing minutes**.

## Decisions & Rationale

| Decision | Choice | Why |
|---|---|---|
| Repo shape | pnpm + Turborepo monorepo: `apps/web`, `apps/worker`, `packages/shared`, `packages/db`, `supabase/` | Two deployables (SPA + worker) that must share the `DubStatus` enum, stage map, language list and `Database` types. Mirrors the user's league-platform skeleton. Nothing else (no `packages/ui`, no `apps/api`, no Redis, no Next.js) — YAGNI. |
| Backend platform | Supabase: Auth, Postgres (RLS), Storage, Realtime, Queues (pgmq) | Covers login and the per-user library with no custom API. The only custom backend is the worker. |
| Worker | Node 22 + TypeScript, Docker image with ffmpeg + yt-dlp, deployed to Fly.io/Railway | The pipeline runs for minutes and needs ffmpeg/yt-dlp binaries; Supabase Edge Functions (Deno, short wall-clock, no binaries) cannot host it. |
| Queue | pgmq via a Postgres trigger on `dubs`; worker reads over a direct Postgres connection with visibility timeout + heartbeat | Zero extra infrastructure, queue visible in the Supabase dashboard, works identically against `supabase start` locally. |
| Web | Vite 8 + React 19 + TanStack Router (code-based) + Zustand (client state) + TanStack Query (server state) + Tailwind 4 with hand-rolled primitives | React + Zustand is a user requirement. SPA because Supabase + worker are the whole backend. Code-based routes and hand-rolled primitives avoid generators and interactive CLIs (shadcn) in an autonomous build. |
| Pipeline strategies | `staged` (six stage contracts) and `elevenlabs` (ElevenLabs Dubbing API end-to-end), both behind one `DubbingPipeline` interface, chosen by `VOZIA_PIPELINE` | The hybrid the user was recommended: own pipeline for margin/control and transcript features; the end-to-end call lets the product ship with a single API key. |
| Drivers | Every contract has a fake driver; fakes are the default outside production | Whole system runs and is tested locally with no API keys and no ffmpeg (same approach that worked for EchoDub). |
| Speech providers | ElevenLabs: Scribe (STT with word timestamps + diarization), Instant Voice Cloning, multilingual TTS | One vendor for all speech; best-in-class cloning. |
| Translation LLM | Anthropic TypeScript SDK, model `claude-opus-5` (env `VOZIA_TRANSLATION_MODEL`), structured JSON output keyed by segment index, adaptive thinking, server-side refusal fallbacks enabled | Structured output guarantees every segment comes back aligned; Opus is the documented default; the model is a config value. |
| Audio separation | `replicate-demucs` (hosted Demucs, opt-in) and `ffmpeg-duck` (original bed at reduced gain, no vendor) | Real source separation without running GPUs; the duck driver is a no-vendor fallback and the local default. |
| Auth | Supabase Auth: email/password with confirmation, Google OAuth (PKCE, `/auth/callback`), password reset | Dashboard toggle + one SDK call; no auth code to maintain. |
| Storage | Private buckets `sources` and `outputs`; owner-scoped paths `{owner_id}/...`; TUS resumable uploads from the browser; signed URLs for playback/download | Videos are large; resumable uploads and private buckets are the Supabase-recommended shape. |
| Credits | `profiles.minutes_quota` (default 10) / `minutes_used`; insert blocked at DB level when exhausted; charged `ceil(duration/60)` on completion | Same metering as EchoDub phase 2; enforced in the database so the UI check is only a courtesy. |
| Realtime | `dubs` and `videos` in the `supabase_realtime` publication; web subscribes filtered by owner | Replaces polling; progress reaches the UI as the worker writes it. |
| Testing | Vitest everywhere; worker fakes + injected process runner; SQL validated against the `supabase/postgres` Docker image with role-switching RLS tests; web with Testing Library and a mocked Supabase client | Everything verifiable on a machine with no keys, no ffmpeg, no Supabase CLI. |
| Deferred | Stripe billing, teams/orgs, lip-sync, per-speaker voice mapping, public API/webhooks, UI i18n (English only), mobile | YAGNI for MVP. Schema keeps `duration_seconds` and `speaker` so these are retrofit-friendly. |

## Architecture

```
Browser (React SPA) ──supabase-js──► Supabase: Auth │ PostgREST (RLS) │ Storage (TUS) │ Realtime
        │ insert videos + dubs (status 'queued')
        ▼
Postgres trigger ──► pgmq.send('dub_jobs', {dub_id})
        │
        ▼
apps/worker (Node) ── pgmq.read + heartbeat ──► DubbingPipeline.run(dub)
        ├─ staged:     Ingest → Separate → Transcribe → Translate → Synthesize → Mux
        └─ elevenlabs: Ingest → ElevenLabs Dubbing API (create → poll → download video + SRTs)
        │ writes status/progress to dubs (Realtime → UI), uploads outputs to Storage
        ▼
User streams/downloads via signed URLs; SRTs exported from dub_segments
```

### Workspace layout

```
vozia/
├── apps/
│   ├── web/        @vozia/web    Vite SPA
│   └── worker/     @vozia/worker Node service (Dockerfile)
├── packages/
│   ├── shared/     @vozia/shared DubStatus, stages, progress map, languages, plans, zod schemas, SRT formatter
│   └── db/         @vozia/db     Database types, client factories, storage path helpers
├── supabase/       config.toml, migrations/, tests/ (SQL), seed.sql
├── docs/superpowers/{specs,plans}
├── .github/workflows/ci.yml
├── turbo.json · pnpm-workspace.yaml · tsconfig.base.json · package.json
```

### Domain model (Postgres, schema `public`)

- **`profiles`** — one row per `auth.users` row, created by trigger. `id` (pk, fk auth.users), `display_name`, `avatar_url`, `minutes_quota int default 10`, `minutes_used int default 0`, `created_at`, `updated_at`.
- **`videos`** — a user's source media. `id uuid`, `owner_id` (fk profiles), `title`, `source_type` (`'upload' | 'youtube'`), `source_url` (YouTube URL, null for uploads), `storage_path` (object path in bucket `sources`; set by the client for uploads, by the worker after the first ingest for YouTube), `duration_seconds`, `thumbnail_path`, `created_at`, `updated_at`.
- **`dubs`** — one rendering of a video into one target language. `id uuid`, `video_id` (fk videos, cascade), `owner_id`, `source_language` (null = auto-detect), `target_language`, `voice_mode` (`'clone' | 'stock'`), `stock_voice_id`, `pipeline` (`'staged' | 'elevenlabs'`, written by the worker when it starts), `status`, `progress int 0..100`, `failed_stage`, `error_message`, `attempts int`, `provider_ref` (e.g. ElevenLabs dubbing id), `detected_language`, `output_path`, `dubbed_audio_path`, `srt_original_path`, `srt_translated_path`, `started_at`, `completed_at`, `created_at`, `updated_at`. Unique `(video_id, target_language)`.
- **`dub_segments`** — timed transcript for a dub. `id bigint`, `dub_id` (fk, cascade), `idx`, `start_ms`, `end_ms`, `speaker`, `text`, `translated_text`. Unique `(dub_id, idx)`.

Ownership: every table carries `owner_id` (or reaches it through `dub_id`), and RLS restricts owners to their own rows. The worker uses the service role and bypasses RLS.

### Status state machine

`queued → ingesting → separating → transcribing → translating → synthesizing → muxing → completed`, and
`failed` is reachable from every in-progress stage (recording `failed_stage` and `error_message`).
The `elevenlabs` pipeline walks `queued → ingesting → dubbing → completed | failed`.
`failed → queued` is the retry transition. Transitions are defined once in `@vozia/shared`
(`canTransition(from, to)`) and enforced by the worker; the database only lets owners reach `queued`
through the `retry_dub` RPC.

### What owners may write (RLS + triggers)

- `profiles`: select/update own row (`display_name`, `avatar_url` only — a trigger rejects changes to quota columns from non-service roles).
- `videos`: select/insert/update/delete own rows; insert requires `owner_id = auth.uid()`.
- `dubs`: select/insert/delete own rows. Insert requires `owner_id = auth.uid()` and that `video_id` belongs to the caller. A `before insert` trigger forces `status = 'queued'`, `progress = 0`, `attempts = 0`, clears worker-owned columns, and raises `insufficient_minutes` when `minutes_used >= minutes_quota`. There is **no** owner update policy: the only owner-initiated change is `retry_dub(dub_id)`, a `security definer` RPC that resets the error fields and sets `status = 'queued'` for a failed dub the caller owns.
- `dub_segments`: select own (via `dubs.owner_id`); worker-only writes.
- Storage: buckets `sources` and `outputs` are private; owners may read/write/delete objects whose first path segment is their own `auth.uid()`.

### Queue and worker loop

- Migration: `create extension pgmq`, `pgmq.create('dub_jobs')`, trigger `enqueue_dub` (security definer) after insert with `status = 'queued'` and after update when status changes to `queued` → `pgmq.send('dub_jobs', jsonb_build_object('dub_id', new.id))`.
- Worker loop (per slot, `VOZIA_WORKER_CONCURRENCY`, default 1): `pgmq.read('dub_jobs', vt => 120, qty => 1)`; idle poll every 2 s; a heartbeat extends the visibility timeout (`pgmq.set_vt`) every 30 s while a job runs; `pgmq.archive` on success **and** on failure (paid providers — no automatic re-run; the user retries from the UI). Crash safety: a message re-appears after `vt` expires; when `read_ct` exceeds `VOZIA_MAX_ATTEMPTS` (default 2) the dub is marked failed with "worker crashed repeatedly" and archived. Stages overwrite their artifacts, so a re-run is idempotent.
- Job context: a workdir `os.tmpdir()/vozia/<dub_id>` removed after the job; stage timeouts `VOZIA_STAGE_TIMEOUT_MS` (default 30 min); graceful shutdown on SIGTERM waits for the running job.
- Progress: `@vozia/shared` maps each stage to a progress range; the worker writes `status` + `progress` when a stage starts and finer progress inside synthesis (per segment) and the ElevenLabs poll.
- Completion: uploads `dubbed.mp4`, `dubbed_vocals.wav` (staged only), `original.srt`, `translated.srt` to `outputs/{owner_id}/{dub_id}/`; sets paths, `completed_at`, `progress = 100`; charges `ceil(duration_seconds / 60)` minutes; for a YouTube video whose `storage_path` is null, uploads the downloaded original to `sources/{owner_id}/{video_id}/original.mp4` and sets `videos.storage_path`, `duration_seconds`, `title`, `thumbnail_path`.

### Stage contracts (`apps/worker/src/pipeline/contracts.ts`)

| Contract | Essence | Real driver(s) | Fake driver |
|---|---|---|---|
| `VideoIngestor` | `upload`: download the stored source; `youtube`: yt-dlp → mp4. Then ffmpeg extracts `audio.wav` (44.1 kHz stereo), probes duration, grabs a thumbnail | `ytdlp` (yt-dlp + ffmpeg via injected process runner, Storage adapter) | writes stub files, duration 42 s |
| `AudioSeparator` | audio → `vocals.wav` + `background.wav` | `replicate-demucs` (create prediction, poll, download stems), `ffmpeg-duck` (vocals = original; background = original at −14 dB) | copies the input to both outputs |
| `Transcriber` | vocals → detected language + timed segments (`start_ms`, `end_ms`, `text`, `speaker`) | `elevenlabs` (Scribe `scribe_v1`, word timestamps + diarization; words grouped into segments at sentence punctuation, pauses > 700 ms, speaker changes, or 15 s max) | canned English segments |
| `Translator` | segments + target language → `translatedText` per segment | `anthropic` (batches of ≤ 40 segments, structured JSON `{ translations: [{ idx, text }] }`, instructions to keep names and similar spoken length; cached system prompt) | `"[<lang>] " + text` |
| `SpeechSynthesizer` | translated segments + voice choice → `dubbed_vocals.wav` on the original timeline | `elevenlabs` (`clone`: Instant Voice Clone from up to 60 s of vocals, deleted after the job; `stock`: `stock_voice_id`; per-segment TTS `eleven_multilingual_v2`; ffmpeg timeline assembly — each clip at its `start_ms`, clips longer than their slot sped up with `atempo` up to 1.35×, gaps filled with silence) | writes a stub wav |
| `MediaProcessor` | mix `background + dubbed_vocals` → AAC, remux onto the video with `-c:v copy`; probe duration; thumbnail | `ffmpeg` | copies the source video |
| `DubbingPipeline` | runs a dub end-to-end and reports stage/progress | `staged` (composes the six above), `elevenlabs` (Dubbing API: `POST /v1/dubbing` with file or `source_url`, poll `GET /v1/dubbing/{id}` until `dubbed`, download `GET /v1/dubbing/{id}/audio/{lang}` and SRT transcripts) | — (both strategies run with fake stage drivers / mocked HTTP) |
| `ObjectStorage` (adapter, not a stage) | download/upload/remove objects in a bucket | `supabase` (service role) | local directory |

Driver resolution is by environment: `VOZIA_PIPELINE` (`staged` \| `elevenlabs`), `VOZIA_INGESTOR_DRIVER` (`fake` \| `ytdlp`), `VOZIA_SEPARATOR_DRIVER` (`fake` \| `ffmpeg-duck` \| `replicate-demucs`), `VOZIA_TRANSCRIBER_DRIVER` (`fake` \| `elevenlabs`), `VOZIA_TRANSLATOR_DRIVER` (`fake` \| `anthropic`), `VOZIA_SYNTHESIZER_DRIVER` (`fake` \| `elevenlabs`), `VOZIA_MEDIA_DRIVER` (`fake` \| `ffmpeg`), `VOZIA_STORAGE_DRIVER` (`fake` \| `supabase`). Every driver defaults to `fake` unless `NODE_ENV=production`, where every driver defaults to its real implementation and a missing key or binary fails at boot, not mid-pipeline. Limitation recorded: the ElevenLabs Dubbing API always clones the speaker's voice, so under `VOZIA_PIPELINE=elevenlabs` a `stock` voice request proceeds with cloning; the worker logs this and the pricing/FAQ page documents it.

### Web app

- Routes: `/` (landing), `/pricing`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/app` (library), `/app/new`, `/app/videos/$videoId`, `/app/dubs/$dubId`, `/app/settings`. `/app/*` requires a session (redirect to `/login?next=`); auth pages redirect signed-in users to `/app`.
- Client state (Zustand): `authStore` (session, user, profile; `init()` subscribes to `onAuthStateChange`; `signIn`, `signUp`, `signInWithGoogle`, `signOut`, `requestPasswordReset`, `updatePassword`), `uploadStore` (TUS upload progress per file), `createDubStore` (wizard form state).
- Server state (TanStack Query): `useProfile`, `useVideos`, `useVideo`, `useDubs(videoId)`, `useDub(id)`, `useSegments(dubId)`; one Realtime channel per signed-in user patches the query cache for `dubs` and `videos` changes.
- Data access (`src/lib/api.ts`): typed functions over supabase-js — `uploadSource` (TUS), `createVideo`, `createDub`, `retryDub` (RPC), `deleteDub`, `deleteVideo`, `signedUrl(s)`, `updateProfile`.
- Pages: library grid (video cards with per-language dub badges), create flow (tabs Upload \| YouTube; target language; source language auto/explicit; voice mode clone \| stock with a curated stock-voice list from `@vozia/shared`), video detail (preview + dubs list + "add language"), dub detail (stepper for `staged`, single progress bar for `elevenlabs`; transcript side-by-side; download; SRT buttons; retry on failure; delete), settings (display name, minutes used/quota), landing and pricing (plans from `@vozia/shared`).
- UI primitives (hand-rolled, Tailwind): Button, Input, Select, Textarea, Card, Badge, Progress, Tabs, Spinner, EmptyState, Alert.

### Error handling

- Worker: a stage error marks the dub `failed` with `failed_stage` and a human-readable `error_message` (`ProviderError.userMessage` for known provider failures; generic text otherwise), archives the message, and logs the full error with pino. Timeouts are per stage. Missing configuration fails at boot.
- Web: zod validation for URL, file type (mp4/mov/webm/mkv), file size (config), language codes; the `insufficient_minutes` database error is mapped to a friendly message with a link to pricing; failed dubs show the message and a retry button.
- Database: check constraints on enums and ranges; `insufficient_minutes` raised from the insert trigger; `retry_dub` raises when the dub is not failed or not owned.

### Testing

- `@vozia/shared`: state machine, progress map, language list integrity, SRT formatting, zod schemas.
- `@vozia/db`: storage path helpers, client factory input validation.
- `@vozia/worker`: each fake honors its contract; ffmpeg/yt-dlp drivers assert the exact argument lists through a recording process runner; HTTP drivers (ElevenLabs, Anthropic, Replicate) run against a mocked `fetch`/SDK; `StagedPipeline` end-to-end with all fakes reaches `completed` with artifacts and persisted segments (in-memory repositories and storage); `ElevenLabsDubbingPipeline` with mocked HTTP; queue loop with the in-memory queue covers success, failure, heartbeat, crash-retry limit, and shutdown; config resolution and boot validation.
- SQL (`supabase/tests/*.sql`, `pnpm db:test`): applies the migrations to a `supabase/postgres` container and asserts, switching to the `authenticated` role with a fake JWT claim: owners see only their rows; inserting a dub for another user's video fails; direct status updates are rejected; `retry_dub` works only for own failed dubs; the credit check blocks inserts; the enqueue trigger writes a `dub_jobs` message; the profile trigger fires.
- `@vozia/web`: Vitest + Testing Library + jsdom with a mocked Supabase client — auth store transitions, route guard, create-dub validation and submission, dub page rendering per status, Realtime patching the cache, SRT/download link building.
- CI (GitHub Actions): install, `turbo typecheck lint test build`; a second job runs the SQL tests with the Postgres image as a service.

### Deployment

- Web: static build (`apps/web/dist`) on Vercel/Netlify/Cloudflare Pages with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Worker: `apps/worker/Dockerfile` (node:22-slim + ffmpeg + yt-dlp) on Fly.io or Railway with `DATABASE_URL` (session pooler), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ELEVENLABS_API_KEY`, `ANTHROPIC_API_KEY`, `REPLICATE_API_TOKEN` (only for `replicate-demucs`), and the `VOZIA_*` driver selectors.
- Supabase: hosted project; `supabase db push` applies `supabase/migrations`; Google provider enabled in the dashboard with the Google Cloud OAuth client; buckets created by migration.

## Non-goals (MVP)

Billing/Stripe, teams, lip-sync, per-speaker voices, batch multi-language creation (one dub per language, added one at a time), public API, webhooks, UI translations, mobile apps.
