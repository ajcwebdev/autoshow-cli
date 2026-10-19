# syntax=docker/dockerfile:1.6@sha256:ac85f380a63b13dfcefa89046420e1781752bab202122f8f50032edf31be0021

ARG BUN_BASE_IMAGE=oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61
ARG DENO_BASE_IMAGE=denoland/deno:bin-2.9.6@sha256:4cf0029b9aeeeed5efcbb71828737f0d7c8c8a20072df960e51a5679ef0d21ba

FROM ${DENO_BASE_IMAGE} AS youtube-js

FROM ${BUN_BASE_IMAGE} AS deps

WORKDIR /app

COPY package.json bun.lock bunfig.toml ./

RUN bun --no-env-file install --frozen-lockfile --production

FROM ${BUN_BASE_IMAGE} AS runtime

ARG DEBIAN_FRONTEND=noninteractive
# Includes the PCRE2, OpenSSL, libheif, librsvg, and Expat security fixes required by the image audits.
ARG DEBIAN_SNAPSHOT=20261016T082316Z

LABEL org.opencontainers.image.title="autoshow-cli"
LABEL org.opencontainers.image.description="Bun-native AutoShow CLI with Debian slim local-lite tools"
LABEL org.opencontainers.image.source="https://github.com/ajcwebdev/autoshow-cli"
LABEL org.opencontainers.image.url="https://github.com/ajcwebdev/autoshow-cli/pkgs/container/autoshow-cli"

ENV NODE_ENV=production
ENV HOME=/home/bun
ENV AUTOSHOW_DISABLE_HTTP_KEEPALIVE=1

RUN set -eux; \
    sed -i "s|http://deb.debian.org/debian-security|https://snapshot.debian.org/archive/debian-security/${DEBIAN_SNAPSHOT}|g; s|http://deb.debian.org/debian|https://snapshot.debian.org/archive/debian/${DEBIAN_SNAPSHOT}|g" /etc/apt/sources.list.d/debian.sources; \
    printf 'Acquire::Check-Valid-Until "false";\n' > /etc/apt/apt.conf.d/99snapshot; \
    apt-get update; \
    apt-get upgrade -y --no-install-recommends; \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      calibre \
      ffmpeg \
      imagemagick \
      pango1.0-tools \
      fontconfig \
      fonts-dejavu-core \
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

# Keep the download after APT so yt-dlp pin changes reuse the package layer.
ARG YT_DLP_URL=https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/yt-dlp
ARG YT_DLP_SHA256=1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6
ADD --checksum=sha256:${YT_DLP_SHA256} --chmod=0755 ${YT_DLP_URL} /usr/local/bin/yt-dlp
COPY --from=youtube-js /deno /usr/local/bin/deno

WORKDIR /app
COPY --chown=0:0 config/defuddle ./config/defuddle
COPY --from=deps --chown=0:0 /app/node_modules ./node_modules
COPY --chown=0:0 package.json bun.lock bunfig.toml tsconfig.json ./
COPY --chown=0:0 src ./src

RUN set -eux; \
    deno --version; \
    yt-dlp --version; \
    chmod 0755 /app /app/config; \
    chmod -R a+rX,go-w /app/src /app/node_modules /app/config/defuddle; \
    chmod 0644 package.json bun.lock bunfig.toml tsconfig.json; \
    install -d -o bun -g bun -m 0755 input output runtime runtime/tools /home/bun /home/bun/.cache; \
    ln -s /usr/share/tesseract-ocr/5/tessdata runtime/tools/tessdata; \
    ln -s ../runtime/autoshow.json config/autoshow.json

USER bun

ENTRYPOINT ["bun", "--no-env-file", "/app/src/cli/create-cli.ts"]
CMD ["help"]
# Build identity is declared after the last RUN so per-commit values never invalidate cached layers.
ARG AUTOSHOW_VERSION=0.1.0
ARG BUILD_DATE=unknown
ARG VCS_REF=unknown
LABEL org.opencontainers.image.version="${AUTOSHOW_VERSION}"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${VCS_REF}"

FROM runtime AS alignment
# Installation needs a writable dependency directory; only the build runs as root.
USER root
COPY --chown=0:0 config/stt-alignment ./config/stt-alignment
RUN bun --no-env-file install --cwd config/stt-alignment --frozen-lockfile --ignore-scripts
RUN chmod -R a+rX,go-w config/stt-alignment
USER bun

FROM runtime AS production
