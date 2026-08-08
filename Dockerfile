ARG BUN_BASE_IMAGE=oven/bun:1.3.14-slim

FROM ${BUN_BASE_IMAGE} AS deps

WORKDIR /app

COPY package.json bun.lock* bunfig.toml ./

RUN bun install --frozen-lockfile --production

FROM ${BUN_BASE_IMAGE} AS runtime

ARG DEBIAN_FRONTEND=noninteractive

LABEL org.opencontainers.image.title="autoshow-cli"
LABEL org.opencontainers.image.description="Bun-native AutoShow CLI with Debian slim local-lite tools"
LABEL org.opencontainers.image.version="0.1.0"

ENV NODE_ENV=production
ENV HOME=/home/bun
ENV AUTOSHOW_SYSTEM_TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      calibre \
      curl \
      ffmpeg \
      mupdf-tools \
      python3 \
      qpdf \
      tesseract-ocr \
      tesseract-ocr-eng; \
    curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp; \
    chmod 0755 /usr/local/bin/yt-dlp; \
    printf '%s\n' \
      '#!/bin/sh' \
      'SYSTEM_TESSDATA="${AUTOSHOW_SYSTEM_TESSDATA_PREFIX:-/usr/share/tesseract-ocr/5/tessdata}"' \
      'if [ -n "${TESSDATA_PREFIX:-}" ] && [ ! -f "${TESSDATA_PREFIX%/}/eng.traineddata" ] && [ -f "$SYSTEM_TESSDATA/eng.traineddata" ]; then' \
      '  export TESSDATA_PREFIX="$SYSTEM_TESSDATA"' \
      'elif [ -z "${TESSDATA_PREFIX:-}" ] && [ -f "$SYSTEM_TESSDATA/eng.traineddata" ]; then' \
      '  export TESSDATA_PREFIX="$SYSTEM_TESSDATA"' \
      'fi' \
      'exec /usr/bin/tesseract "$@"' \
      > /usr/local/bin/tesseract; \
    chmod 0755 /usr/local/bin/tesseract; \
    rm -rf /var/lib/apt/lists/* /root/.cache/* /tmp/*

WORKDIR /app

COPY --from=deps --chown=bun:bun /app/node_modules ./node_modules
COPY --chown=bun:bun package.json bun.lock* bunfig.toml tsconfig.json ./
COPY --chown=bun:bun src ./src

RUN set -eux; \
    mkdir -p input output runtime/tools project/links; \
    ln -s "${AUTOSHOW_SYSTEM_TESSDATA_PREFIX}" runtime/tools/tessdata; \
    chown -R bun:bun /app /home/bun

USER bun

ENTRYPOINT ["bun", "/app/src/cli/create-cli.ts"]
CMD ["help"]
