# Vozia worker: Node 22 + ffmpeg + yt-dlp. Build from the repository root:
#   docker build -f apps/worker/Dockerfile -t vozia-worker .
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg python3 curl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
 && chmod +x /usr/local/bin/yt-dlp

RUN corepack enable && corepack prepare pnpm@11.10.0 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker
# The lockfile knows every workspace project; keep the web manifest so the install stays frozen.
COPY apps/web/package.json ./apps/web/package.json

RUN pnpm install --frozen-lockfile --filter @vozia/worker... \
 && pnpm --filter @vozia/worker... run build \
 && pnpm store prune

ENV NODE_ENV=production
CMD ["node", "apps/worker/dist/main.js"]
