# Vozia

AI video dubbing in the speaker's own voice. Upload a video or paste a YouTube link, pick one of 29
languages and a voice (cloned from the original or a curated stock voice), watch the dub progress live,
then download the dubbed video and subtitles in both languages. Every account has a library of videos
with one dub per language and a balance of dubbing minutes.

> **Status:** MVP built autonomously on 2026-09-17 from
> [`docs/superpowers/specs/2026-09-17-vozia-mvp-design.md`](docs/superpowers/specs/2026-09-17-vozia-mvp-design.md).
> Everything runs and is tested locally with **fake providers** (no API keys, no ffmpeg). The real
> ElevenLabs / Anthropic / Replicate / yt-dlp drivers are implemented and unit-tested against recorded
> request shapes, but have not yet been exercised against the live services — see
> [Known limitations](#known-limitations).

## How it works

```
Browser (React SPA) ──supabase-js──► Supabase: Auth │ Postgres (RLS) │ Storage (TUS) │ Realtime
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

Supabase provides authentication (email/password + Google), the database with row-level security,
private file storage, realtime updates and the job queue (pgmq). The only custom backend is the
worker, which is the one place that needs ffmpeg/yt-dlp and the provider API keys.

## Repository layout

| Path | What it is |
|---|---|
| `apps/web` | Vite + React 19 SPA (TanStack Router/Query, Zustand, Tailwind 4) |
| `apps/worker` | Node 22 worker: queue loop, pipelines, provider drivers, Dockerfile |
| `packages/shared` | Statuses/stages, languages, stock voices, plans, SRT formatting, zod schemas |
| `packages/db` | `Database` types, Supabase client factories, storage path helpers |
| `supabase/` | `config.toml`, migrations, SQL tests (`supabase/tests`) |
| `compose.yaml`, `Dockerfile.dev` | Local development containers: web, worker, package watchers |
| `docs/superpowers` | Design spec and implementation plan |

## Prerequisites

- Docker. Everything runs in containers.
- Supabase CLI, which starts and stops the Supabase containers and then exits
  ([install guide](https://supabase.com/docs/guides/local-development/cli/getting-started)). On Linux/WSL:
  `curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz -C ~/.local/bin supabase`
- Optional: Node 22 and pnpm 11 (`corepack enable`) to run the apps outside Docker.

## Quick start (local, in Docker, no API keys)

```bash
supabase start         # Supabase in Docker; applies supabase/migrations on first start
docker compose up -d   # the web app and the worker in Docker; the first run installs dependencies
```

| Open | What it is |
|---|---|
| http://localhost:5173 | Vozia. Sign up with any email; local accounts need no confirmation. |
| http://localhost:54323 | Supabase Studio: tables, auth users, storage buckets, SQL editor (try `select * from pgmq.q_dub_jobs`) |
| http://localhost:54324 | Mailpit: every email the local Supabase sends, such as password resets |
| http://localhost:54321 | Supabase API gateway (REST, Auth, Storage, Realtime) that the app calls |
| `postgresql://postgres:postgres@localhost:54322/postgres` | Postgres, for psql, DBeaver or TablePlus |

Create a dub from a YouTube link or an upload and watch it move through the stages. With the default fake
drivers the worker writes placeholder files, so thumbnails and the player stay empty; that is expected
until you switch to the real providers (below).

- `docker compose logs -f worker` follows the dubbing jobs; `docker compose ps` lists the containers.
- Code changes reload on their own: Vite hot-reloads the web app, `tsx watch` restarts the worker and the
  `packages` container rebuilds `packages/shared` and `packages/db`.
- `docker compose down` and `supabase stop` shut everything down; data survives in Docker volumes.
  `supabase db reset` wipes the local database and re-applies the migrations.

Without Docker for the apps: `pnpm install`, copy `apps/web/.env.example` and `apps/worker/.env.example`
to `.env` with the keys from `supabase status`, load the worker's variables with
`set -a; source apps/worker/.env; set +a`, then `pnpm dev`.

## Going live: drivers and keys

Every stage of the worker is a driver selected by environment variable, and every driver has a fake.
In `NODE_ENV=production` the defaults switch to the real implementations; otherwise set them explicitly.

| Variable | Values | Needs |
|---|---|---|
| `VOZIA_PIPELINE` | `staged` (default) · `elevenlabs` | `elevenlabs` needs only `ELEVENLABS_API_KEY` — the fastest way to a real dub |
| `VOZIA_INGESTOR_DRIVER` | `fake` · `ytdlp` | `yt-dlp` + ffmpeg binaries |
| `VOZIA_SEPARATOR_DRIVER` | `fake` · `ffmpeg-duck` · `replicate-demucs` | ffmpeg / `REPLICATE_API_TOKEN` + `REPLICATE_DEMUCS_VERSION` |
| `VOZIA_TRANSCRIBER_DRIVER` | `fake` · `elevenlabs` | `ELEVENLABS_API_KEY` |
| `VOZIA_TRANSLATOR_DRIVER` | `fake` · `anthropic` | `ANTHROPIC_API_KEY` (`VOZIA_TRANSLATION_MODEL`, default `claude-opus-5`) |
| `VOZIA_SYNTHESIZER_DRIVER` | `fake` · `elevenlabs` | `ELEVENLABS_API_KEY` |
| `VOZIA_MEDIA_DRIVER` | `fake` · `ffmpeg` | ffmpeg + ffprobe binaries |
| `VOZIA_STORAGE_DRIVER` | `fake` · `supabase` | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` |

The worker validates the selected drivers' settings and binaries at boot and refuses to start with a
clear message when something is missing. `apps/worker/.env.example` lists every variable. With Docker,
copy it to `apps/worker/.env`, fill in keys and drivers, and run `docker compose up -d worker`; the
container already has ffmpeg and yt-dlp, and `compose.yaml` keeps pointing it at the local Supabase.

- **Google sign-in.** Create an OAuth client in Google Cloud (Web application) with the redirect URI
  `https://<project-ref>.supabase.co/auth/v1/callback` (hosted) or `http://127.0.0.1:54321/auth/v1/callback`
  (local). Hosted: enable the Google provider in the Supabase dashboard and paste the client id/secret.
  Local: put them in `supabase/.env` (see `supabase/.env.example`), then `supabase stop && supabase start`.
  Until then the local Google button fails at Google, because the provider has no client id.
- **Uploads.** The `sources` bucket accepts mp4/mov/webm/mkv; raise the project's global file size limit
  in the Storage settings (free plans default to 50 MB) — the browser uploads with resumable TUS.
- **Replicate Demucs.** Pick a two-stem Demucs version on replicate.com (inputs `audio` + `stem: "vocals"`,
  outputs `vocals` and `no_vocals`) and set its version hash as `REPLICATE_DEMUCS_VERSION`.

## Deploying

1. **Supabase.** Create a project, then `pnpm dlx supabase link --project-ref <ref>` and
   `pnpm dlx supabase db push` to apply `supabase/migrations` (tables, RLS, credits trigger, `retry_dub`
   RPC, pgmq queue, storage buckets/policies, realtime publication). Enable Google under Authentication.
2. **Web.** `pnpm --filter @vozia/web build` → deploy `apps/web/dist` to any static host (Vercel, Netlify,
   Cloudflare Pages) with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Add the site URL and
   `https://<site>/auth/callback` + `https://<site>/reset-password` to the Supabase redirect allow-list.
3. **Worker.** Build the image from the repository root and run it on Fly.io, Railway or any Docker host:

   ```bash
   docker build -f apps/worker/Dockerfile -t vozia-worker .
   docker run --env-file apps/worker/.env -e NODE_ENV=production vozia-worker
   ```

   Use the Supabase **session pooler** connection string as `DATABASE_URL`. One replica is enough to
   start; raise `VOZIA_WORKER_CONCURRENCY` or add replicas to process more dubs in parallel — the queue
   hands each message to a single worker.

## Testing

```bash
docker compose run --rm web pnpm turbo typecheck lint test build   # all packages, inside Docker
pnpm turbo typecheck lint test build   # the same on your machine (145+ unit tests, fake providers)
pnpm db:test                           # migrations + SQL tests in a supabase/postgres Docker container
pnpm db:test --with-worker             # …plus the worker's Postgres/pgmq integration test
```

The SQL suite applies the migrations as the non-superuser `postgres` role (like `supabase db push`)
and asserts row-level security per user, sanitized dub inserts, the credit check, `retry_dub`, the
enqueue trigger and the storage policies. CI (`.github/workflows/ci.yml`) runs both.

## Known limitations

- The real provider drivers (ElevenLabs Scribe/IVC/TTS/Dubbing, Anthropic, Replicate, yt-dlp) follow the
  documented request shapes and are tested against stubs, but have not been run against the live APIs.
  Expect to adjust field names on first contact.
- `ffmpeg-duck` keeps the original mix under the dub at −14 dB (voices remain faintly audible). Real
  separation needs `replicate-demucs`.
- YouTube ingestion depends on yt-dlp; YouTube's bot detection may require cookies or a proxy at scale.
- The `elevenlabs` pipeline always clones the original voice; stock voices only apply to `staged`.
- The translator uses `messages.parse` with structured output and does not yet enable server-side
  refusal fallbacks.
- Billing (Stripe), teams, lip-sync and per-speaker voices are out of scope for the MVP.

## Creating the GitHub repository

```bash
gh repo create leoc0104/vozia --private --source=. --remote=origin --push
# or: create it in the GitHub UI, then
git remote add origin git@github.com:leoc0104/vozia.git && git push -u origin main feat/mvp
```
