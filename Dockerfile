# syntax=docker/dockerfile:1.27.1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e

ARG BUN_BASE_IMAGE=oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61
ARG DENO_BASE_IMAGE=denoland/deno:bin-2.9.8@sha256:b507583d3c68ba69f3ed2ce5969ae5b8b70f43421c781279c7aea06435263543

FROM ${DENO_BASE_IMAGE} AS youtube-js

FROM ${BUN_BASE_IMAGE} AS deps

WORKDIR /app

COPY package.json bun.lock bunfig.toml ./

RUN bun --no-env-file install --frozen-lockfile --production --omit=peer --ignore-scripts

FROM ${BUN_BASE_IMAGE} AS alignment-deps
ARG TARGETARCH
WORKDIR /app/runtime/tools/stt-alignment
COPY config/stt-alignment ./
COPY --from=deps /app/node_modules /app/node_modules
COPY package.json bun.lock bunfig.toml tsconfig.json /app/
COPY src /app/src
RUN set -eu; \
    case "${TARGETARCH}" in amd64) arch=x64 ;; arm64) arch=arm64 ;; *) echo "Unsupported target architecture: ${TARGETARCH}" >&2; exit 1 ;; esac; \
    bun --no-env-file install --frozen-lockfile --ignore-scripts; \
    onnx_bin=node_modules/onnxruntime-node/bin/napi-v6; \
    test -f "${onnx_bin}/linux/${arch}/onnxruntime_binding.node"; \
    find "${onnx_bin}" -mindepth 2 -maxdepth 2 ! -path "${onnx_bin}/linux/${arch}" -exec rm -rf {} +; \
    test -f "${onnx_bin}/linux/${arch}/onnxruntime_binding.node"; \
    chmod -R a+rX,go-w .; \
    bun --no-env-file -e 'import { writeManagedPackageManifest } from "/app/src/cli/commands/setup-and-utilities/setup/setup-download/managed-js-runtime"; await Bun.write(".frozen-install", "1.29.0\n"); await writeManagedPackageManifest(process.cwd(), "onnxruntime-node@1.29.0")'

FROM ${BUN_BASE_IMAGE} AS native-tools

ARG BUN_BASE_IMAGE
ARG DENO_BASE_IMAGE
ARG DEBIAN_FRONTEND=noninteractive
# Includes the APT, ImageMagick, and zlib/minizip fixes required by the image vulnerability gate.
ARG DEBIAN_SNAPSHOT=20261110T000000Z

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
ADD --checksum=sha256:${YT_DLP_SHA256} --chmod=0755 ${YT_DLP_URL} /opt/autoshow-runtime/tools/yt-dlp/yt-dlp
COPY --from=youtube-js /deno /opt/autoshow-runtime/tools/deno/bin/deno

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock bunfig.toml tsconfig.json ./
COPY src ./src
RUN set -eu; bun --no-env-file build src/cli/create-cli.ts --target=bun --format=esm --outfile=src/cli/bundled-cli.js; \
    bun --no-env-file build src/tools/docker-runtime-entry.ts --target=bun --format=esm --outfile=src/tools/docker-runtime-entry-bundle.js; \
    bun --no-env-file build src/tools/docker-runtime-seed.ts --target=bun --format=esm --outfile=src/tools/docker-runtime-seed-bundle.js; \
    bun --no-env-file -e 'await import("./src/cli/bundled-cli.js"); const { dockerInvocationLaunchPlan } = await import("./src/tools/docker-runtime-entry-bundle.js"); const plan = await dockerInvocationLaunchPlan(["--json", "setup", "--doctor"]); if (plan.needsRuntime || !plan.bootstrap) throw new Error("Read-only Docker bootstrap attempted runtime activation")'
# Move a graph created in this writable build layer: overlayfs cannot rename a
# lower-layer directory across parents, even when both paths share a mount.
RUN set -eu; \
    cp -a /app/node_modules /opt/autoshow-build-node_modules; \
    rm -rf /app/node_modules; \
    mv /opt/autoshow-build-node_modules /app/node_modules; \
    BUN_IMAGE_SOURCE="${BUN_BASE_IMAGE}" DENO_IMAGE_SOURCE="${DENO_BASE_IMAGE}" bun --no-env-file src/tools/docker-build-runtime.ts

FROM ${BUN_BASE_IMAGE} AS runtime

ARG DEBIAN_FRONTEND=noninteractive
ARG DEBIAN_SNAPSHOT=20261110T000000Z

LABEL org.opencontainers.image.title="autoshow-cli" \
      org.opencontainers.image.description="Bun-native AutoShow CLI with a managed runtime toolchain" \
      org.opencontainers.image.source="https://github.com/ajcwebdev/autoshow-cli" \
      org.opencontainers.image.url="https://github.com/ajcwebdev/autoshow-cli/pkgs/container/autoshow-cli"

ENV NODE_ENV=production \
    HOME=/home/bun \
    AUTOSHOW_DISABLE_HTTP_KEEPALIVE=1 \
    PATH=/app/runtime/bin:/usr/local/bin:/usr/bin:/bin \
    BUN_INSTALL_CACHE_DIR=/app/runtime/cache/bun \
    BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 \
    TMPDIR=/app/runtime/tmp

# The final base retains only OS support; application package closures live in the managed payload.
RUN <<'OS_SETUP'
set -eux
mkdir -p /app/runtime/tmp
sed -i "s|http://deb.debian.org/debian-security|https://snapshot.debian.org/archive/debian-security/${DEBIAN_SNAPSHOT}|g; s|http://deb.debian.org/debian|https://snapshot.debian.org/archive/debian/${DEBIAN_SNAPSHOT}|g" /etc/apt/sources.list.d/debian.sources
printf 'Acquire::Check-Valid-Until "false";\n' > /etc/apt/apt.conf.d/99snapshot
apt-get update
apt-get upgrade -y --no-install-recommends
apt-get install -y --no-install-recommends ca-certificates
rm -rf /var/lib/apt/lists/* /root/.cache/* /tmp/*
OS_SETUP

COPY --from=native-tools --chown=0:0 /opt/autoshow-runtime /opt/autoshow-runtime

WORKDIR /app
COPY --chown=0:0 config/defuddle ./config/defuddle
COPY --chown=0:0 config/stt-alignment ./config/stt-alignment
COPY --chown=0:0 package.json bun.lock bunfig.toml tsconfig.json ./
COPY --chown=0:0 src ./src
COPY --from=native-tools --chown=0:0 /app/src/cli/bundled-cli.js ./src/cli/bundled-cli.js
COPY --from=native-tools --chown=0:0 /app/src/tools/docker-runtime-entry-bundle.js ./src/tools/docker-runtime-entry-bundle.js
COPY --from=native-tools --chown=0:0 /app/src/tools/docker-runtime-seed-bundle.js ./src/tools/docker-runtime-seed-bundle.js

RUN set -eux; \
    install -d -o bun -g bun -m 0755 input output runtime /home/bun; \
    bun --no-env-file -e 'import { hydrateDockerRuntime } from "./src/tools/docker-runtime-seed-bundle.js"; await hydrateDockerRuntime("/opt/autoshow-runtime", "/app/runtime")'; \
    /app/runtime/bin/deno --version; \
    /app/runtime/bin/yt-dlp --version; \
    chmod 0755 /app /app/config; \
    chmod -R a+rX,go-w /app/src /app/config/defuddle; \
    chmod 0644 package.json bun.lock bunfig.toml tsconfig.json; \
    install -d -o bun -g bun -m 0755 runtime/cache/bun runtime/tmp runtime/state; \
    chown -R bun:bun runtime; \
    ln -s ../runtime/autoshow.json config/autoshow.json; \
    ln -s runtime/tools/project-dependencies/node_modules node_modules

USER bun

ENTRYPOINT ["/usr/local/bin/bun", "--no-env-file", "/app/src/tools/docker-runtime-entry-bundle.js"]
CMD ["help"]
# Build identity is declared after the last RUN so per-commit values never invalidate cached layers.
ARG AUTOSHOW_VERSION=0.1.0
ARG BUILD_DATE=unknown
ARG VCS_REF=unknown
LABEL org.opencontainers.image.version="${AUTOSHOW_VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}"

FROM runtime AS alignment
COPY --from=alignment-deps --chown=0:0 /app/runtime/tools/stt-alignment /opt/autoshow-runtime/tools/stt-alignment
USER root
RUN set -eu; \
    bun --no-env-file src/tools/docker-runtime-seed-bundle.js manifest /opt/autoshow-runtime; \
    rm -rf /app/runtime; \
    install -d -o bun -g bun -m 0755 /app/runtime; \
    bun --no-env-file -e 'import { hydrateDockerRuntime } from "./src/tools/docker-runtime-seed-bundle.js"; await hydrateDockerRuntime("/opt/autoshow-runtime", "/app/runtime")'; \
    install -d -o bun -g bun -m 0755 /app/runtime/cache/bun /app/runtime/tmp /app/runtime/state; \
    chown -R bun:bun /app/runtime
USER bun

FROM runtime AS production
