# syntax=docker/dockerfile:1.27.1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e

ARG BUN_BASE_IMAGE=oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61
ARG DENO_BASE_IMAGE=denoland/deno:bin-2.9.8@sha256:b507583d3c68ba69f3ed2ce5969ae5b8b70f43421c781279c7aea06435263543

FROM ${DENO_BASE_IMAGE} AS youtube-js

FROM ${BUN_BASE_IMAGE} AS deps

WORKDIR /app

COPY package.json bun.lock bunfig.toml ./

RUN bun --no-env-file install --frozen-lockfile --production --omit=peer

FROM ${BUN_BASE_IMAGE} AS alignment-deps
ARG TARGETARCH
WORKDIR /app/config/stt-alignment
COPY config/stt-alignment ./
RUN set -eu; \
    case "${TARGETARCH}" in amd64) arch=x64 ;; arm64) arch=arm64 ;; *) echo "Unsupported target architecture: ${TARGETARCH}" >&2; exit 1 ;; esac; \
    bun --no-env-file install --frozen-lockfile --ignore-scripts; \
    onnx_bin=node_modules/onnxruntime-node/bin/napi-v6; \
    test -f "${onnx_bin}/linux/${arch}/onnxruntime_binding.node"; \
    find "${onnx_bin}" -mindepth 2 -maxdepth 2 ! -path "${onnx_bin}/linux/${arch}" -exec rm -rf {} +; \
    test -f "${onnx_bin}/linux/${arch}/onnxruntime_binding.node"; \
    chmod -R a+rX,go-w .

FROM ${BUN_BASE_IMAGE} AS runtime

ARG DEBIAN_FRONTEND=noninteractive
# Includes the PCRE2, OpenSSL, libheif, librsvg, Expat, and vendor CA trust-store security fixes.
ARG DEBIAN_SNAPSHOT=20261025T000000Z

LABEL org.opencontainers.image.title="autoshow-cli" \
      org.opencontainers.image.description="Bun-native AutoShow CLI with Debian slim local-lite tools" \
      org.opencontainers.image.source="https://github.com/ajcwebdev/autoshow-cli" \
      org.opencontainers.image.url="https://github.com/ajcwebdev/autoshow-cli/pkgs/container/autoshow-cli"

ENV NODE_ENV=production \
    HOME=/home/bun \
    AUTOSHOW_DISABLE_HTTP_KEEPALIVE=1

RUN <<'APT_SETUP'
set -eux
sed -i "s|http://deb.debian.org/debian-security|https://snapshot.debian.org/archive/debian-security/${DEBIAN_SNAPSHOT}|g; s|http://deb.debian.org/debian|https://snapshot.debian.org/archive/debian/${DEBIAN_SNAPSHOT}|g" /etc/apt/sources.list.d/debian.sources
printf 'Acquire::Check-Valid-Until "false";\n' > /etc/apt/apt.conf.d/99snapshot
apt-get update
apt-get upgrade -y --no-install-recommends
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
  tesseract-ocr-eng
rm -rf /var/lib/apt/lists/* /root/.cache/* /tmp/*
APT_SETUP

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
    install -d -o bun -g bun -m 0755 input output runtime /home/bun /home/bun/.cache; \
    ln -s ../runtime/autoshow.json config/autoshow.json

USER bun

ENTRYPOINT ["bun", "--no-env-file", "/app/src/cli/create-cli.ts"]
CMD ["help"]
# Build identity is declared after the last RUN so per-commit values never invalidate cached layers.
ARG AUTOSHOW_VERSION=0.1.0
ARG BUILD_DATE=unknown
ARG VCS_REF=unknown
LABEL org.opencontainers.image.version="${AUTOSHOW_VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}"

FROM runtime AS alignment
COPY --from=alignment-deps --chown=0:0 /app/config/stt-alignment ./config/stt-alignment

FROM runtime AS production
