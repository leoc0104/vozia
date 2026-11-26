# Vozia worker: Node 22 + ffmpeg + yt-dlp + Demucs. Build from the repository root:
#   docker build -f apps/worker/Dockerfile -t vozia-worker .
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core python3 python3-venv curl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
 && chmod +x /usr/local/bin/yt-dlp

# Voice separation for the `demucs` separator (the production default): Demucs (MIT) on CPU-only PyTorch, in its own
# virtualenv. The htdemucs model is downloaded at build time into a shared cache, so a dub never waits for it.
# Demucs 4.1.0 imports numpy without declaring it on Linux, hence the explicit pin. Keep in sync with Dockerfile.dev.
ENV HF_HOME=/opt/huggingface TORCH_HOME=/opt/torch
RUN python3 -m venv /opt/demucs \
 && /opt/demucs/bin/pip install --no-cache-dir pip==25.2 \
 && /opt/demucs/bin/pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.14.1+cpu \
 && /opt/demucs/bin/pip install --no-cache-dir demucs==4.1.0 numpy==2.3.2 \
 && ln -s /opt/demucs/bin/demucs /usr/local/bin/demucs \
 && mkdir -p /opt/huggingface /opt/torch \
 && /opt/demucs/bin/python -c "from demucs.pretrained import get_model; get_model('htdemucs')" \
 && chmod -R a+rX /opt/huggingface /opt/torch
# From here on, use only the cached model: separation never touches the network.
ENV HF_HUB_OFFLINE=1

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
