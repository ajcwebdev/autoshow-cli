# syntax=docker/dockerfile:1.6

ARG BUN_BASE_IMAGE=oven/bun:1.4.0-slim@sha256:e0ee68d16ccb9927bf02aa7dd8fd4bf3369ee6d46da04faa72b05ce8bfd135f6

FROM ${BUN_BASE_IMAGE} AS deps

WORKDIR /app

COPY package.json bun.lock* bunfig.toml ./

RUN bun --no-env-file install --frozen-lockfile --production

FROM ${BUN_BASE_IMAGE} AS build-deps

WORKDIR /app

COPY package.json bun.lock* bunfig.toml ./

RUN bun --no-env-file install --frozen-lockfile

COPY tsconfig.json ./
COPY config ./config
COPY src ./src

RUN bun --no-env-file build src/cli/create-cli.ts \
      --compile \
      --bytecode \
      --format=esm \
      --no-compile-autoload-dotenv \
      --no-compile-autoload-bunfig \
      --no-compile-autoload-tsconfig \
      --no-compile-autoload-package-json \
      --compile-exec-argv=--no-orphans \
      --asset=src/prompts/entries/chapters \
      --asset=src/prompts/entries/creative-writing \
      --asset=src/prompts/entries/marketing-content \
      --asset=src/prompts/entries/social-media \
      --asset=src/prompts/entries/song-lyrics \
      --asset=src/prompts/entries/summary-and-overview \
      --asset=src/tools/o200k-base-ranks.tiktoken.gz \
      --asset=config \
      --asset=src/cli/commands/setup-and-utilities/models \
      --asset=src/cli/commands/setup-and-utilities/models/ocr-config \
      --asset=src/cli/commands/setup-and-utilities/models/stt-config \
      --asset=src/cli/commands/setup-and-utilities/models/tts-config \
      --asset=src/cli/commands/process-steps/step-8-comic/comic-prompts/prompts.json \
      --asset-naming='[dir]/[name].[ext]' \
      --metafile=/app/compiled-entrypoint-metafile.json \
      --metafile-md=/app/compiled-entrypoint-metafile.md \
      --outfile=/app/autoshow

FROM --platform=$BUILDPLATFORM ${BUN_BASE_IMAGE} AS fetch

ARG YT_DLP_URL=https://github.com/yt-dlp/yt-dlp/releases/download/2026.06.09/yt-dlp
ARG YT_DLP_SHA256=e5d57466682cfa9d61e9cf7c8a4f09b00f4a62af37d3bbdc4bcffdf63615feac

RUN set -eux; \
    YT_DLP_URL="${YT_DLP_URL}" bun --no-env-file -e 'const url = process.env.YT_DLP_URL; const response = await fetch(url); if (!response.ok || !response.body) throw new Error(`yt-dlp download failed: ${response.status}`); const writer = Bun.file("/usr/local/bin/yt-dlp").writer(); for await (const chunk of response.body) writer.write(chunk); await writer.end();'; \
    printf '%s %s\n' "${YT_DLP_SHA256}" /usr/local/bin/yt-dlp | sha256sum -c -; \
    chmod 0755 /usr/local/bin/yt-dlp

FROM ${BUN_BASE_IMAGE} AS runtime-base

ARG DEBIAN_FRONTEND=noninteractive
ARG AUTOSHOW_VERSION=0.1.0
ARG BUILD_DATE=unknown
ARG VCS_REF=unknown

LABEL org.opencontainers.image.title="autoshow-cli"
LABEL org.opencontainers.image.description="Bun-native AutoShow CLI with Debian slim local-lite tools"
LABEL org.opencontainers.image.version="${AUTOSHOW_VERSION}"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${VCS_REF}"
LABEL org.opencontainers.image.source="https://github.com/ajcwebdev/autoshow-cli"
LABEL org.opencontainers.image.url="https://github.com/ajcwebdev/autoshow-cli/pkgs/container/autoshow-cli"

ENV NODE_ENV=production
ENV HOME=/home/bun

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      calibre \
      ffmpeg \
      mupdf-tools \
      python3 \
      qpdf \
      tesseract-ocr \
      tesseract-ocr-eng; \
    printf '%s\n' \
      '#!/bin/sh' \
      'SYSTEM_TESSDATA="/usr/share/tesseract-ocr/5/tessdata"' \
      'if [ -n "${TESSDATA_PREFIX:-}" ] && [ ! -f "${TESSDATA_PREFIX%/}/eng.traineddata" ] && [ -f "$SYSTEM_TESSDATA/eng.traineddata" ]; then' \
      '  export TESSDATA_PREFIX="$SYSTEM_TESSDATA"' \
      'elif [ -z "${TESSDATA_PREFIX:-}" ] && [ -f "$SYSTEM_TESSDATA/eng.traineddata" ]; then' \
      '  export TESSDATA_PREFIX="$SYSTEM_TESSDATA"' \
      'fi' \
      'exec /usr/bin/tesseract "$@"' \
      > /usr/local/bin/tesseract; \
    chmod 0755 /usr/local/bin/tesseract; \
    rm -rf /var/lib/apt/lists/* /root/.cache/* /tmp/*

COPY --from=fetch /usr/local/bin/yt-dlp /usr/local/bin/yt-dlp

WORKDIR /app

FROM runtime-base AS runtime

COPY --from=deps --chown=bun:bun /app/node_modules ./node_modules
COPY --chown=bun:bun package.json bun.lock* bunfig.toml tsconfig.json ./
COPY --chown=bun:bun src ./src

RUN set -eux; \
    mkdir -p input output runtime/tools; \
    ln -s /usr/share/tesseract-ocr/5/tessdata runtime/tools/tessdata; \
    chown -R bun:bun /app /home/bun

USER bun

ENTRYPOINT ["bun", "--no-env-file", "/app/src/cli/create-cli.ts"]
CMD ["help"]

FROM runtime-base AS compiled-experiment

COPY --from=build-deps --chown=bun:bun /app/autoshow /app/autoshow
COPY --from=build-deps --chown=bun:bun /app/compiled-entrypoint-metafile.json /app/compiled-entrypoint-metafile.json
COPY --from=build-deps --chown=bun:bun /app/compiled-entrypoint-metafile.md /app/compiled-entrypoint-metafile.md
RUN set -eux; \
    mkdir -p input output runtime/tools; \
    ln -s /usr/share/tesseract-ocr/5/tessdata runtime/tools/tessdata; \
    chown -R bun:bun /app /home/bun

USER bun

ENTRYPOINT ["/app/autoshow"]
CMD ["help"]

FROM runtime AS production
