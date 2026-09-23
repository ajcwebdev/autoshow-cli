# ADR-014: Distribute the CLI as a Debian Slim Docker Image

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-24
- **Date Updated:** 2026-09-23
- **Verification Status:** Passed

Native AMD64 and ARM64 production validation passed on the published image. Both native compiled-entrypoint experiments were reviewed and rejected because their images grew; production retains the source entrypoint.

## Context

AutoShow is a Bun-native, run-to-completion CLI, not a server. Native onboarding requires Bun plus a host setup flow that installs or builds local tools and optional model assets, and container users were paying that full cost for a tool set that installs cleanly from one package manager. Alpine Bun images cannot install Calibre from their package repositories; Debian slim installs every apt-packaged local-lite tool.

Why now: container users needed a useful local baseline without the native onboarding cost or every AutoShow capability.

## Options Considered

### Base image and host relationship

**Option 1 (selected)**

- **Option:** Debian slim local-lite image alongside native host setup
- **Pros:** Installs the full local-lite contract, including Calibre, via `apt`; preserves native host development
- **Cons:** Larger than Alpine; two distribution paths to maintain
- **Quantitative Notes:** 269 MB base / 67.6 MB compressed on Bun 1.4.0; the published image pins the Bun 1.4.2 digest

**Option 2**

- **Option:** Alpine base without Calibre
- **Pros:** Smallest base image
- **Cons:** Rejected; no Calibre, so ebook conversion breaks
- **Quantitative Notes:** 146 MB base / 43.7 MB compressed

**Option 3**

- **Option:** Full Bun Debian base
- **Pros:** Supplies every required package
- **Cons:** Adds size without capability gain
- **Quantitative Notes:** 335 MB base / 87.1 MB compressed

**Option 4**

- **Option:** Native setup only, no container distribution
- **Pros:** No image, CI, or registry maintenance
- **Cons:** Containerized environments keep the full onboarding cost
- **Quantitative Notes:** n/a

**Option 5**

- **Option:** Docker as the exclusive setup path
- **Pros:** One reproducible environment
- **Cons:** Degrades the native macOS workflow and local GPU and engine integration
- **Quantitative Notes:** n/a

### Publication

**Option 1 (selected)**

- **Option:** Publish multi-architecture images to GHCR
- **Pros:** Colocates the package with the repository and provides prebuilt images
- **Cons:** Registry and CI maintenance
- **Quantitative Notes:** `linux/amd64` and `linux/arm64`, tagged `latest` and full commit SHA

**Option 2**

- **Option:** Local container builds only
- **Pros:** No release-operations surface
- **Cons:** Every user pays build time and cannot pin a published release
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Publish to a separate external registry
- **Pros:** Serves users centered on third-party registries
- **Cons:** External credential, account, and retention management
- **Quantitative Notes:** n/a

## Decision

AutoShow distributes an additive Debian slim local-lite Docker image alongside native host setup. The image is based on the exact multi-architecture image `oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61`, runs as the non-root `bun` user from `/app`, and uses the CLI as its entrypoint, so arguments after the image name are AutoShow arguments. A bare container run prints help and exits. The image exposes no ports and defines no HTTP health check; `setup --doctor` remains the offline diagnostic. The supported command surfaces are native `bun autoshow` and direct `docker run`.

The image includes `ffmpeg`, `ffprobe`, `yt-dlp` at the native Linux pin with Deno for YouTube JavaScript challenges, Tesseract OCR with English data, MuPDF `mutool`, `qpdf`, Calibre `ebook-convert`, and ImageMagick with Pango and DejaVu fonts. Heavy local STT, LLM, and TTS engines, model weights, Defuddle, and hosted-provider credentials stay outside the image.

Hosted-provider credentials arrive at runtime through Docker's `--env-file` or `-e` options and are never baked into the image. The entrypoint disables Bun's automatic `.env` loading, so mounting a file at `/app/.env` is not a supported credential path. User data stays on the host via bind mounts: the working directory at `/workspace`, or input, output, and runtime paths under `/app`. Linux hosts that need host-owned output use `--user "$(id -u):$(id -g)"`. A bind mount over `/app/runtime` hides the image tessdata symlink; the image `tesseract` command falls back to Debian English data when `TESSDATA_PREFIX` is unset or that prefix has no `eng.traineddata`.

Image tools are discovered on the normal Linux `PATH`. The CLI does not special-case containers, so omitted tools fail in setup, doctor, or the workflow the same way they would on a native Linux host.

Multi-architecture images (`linux/amd64` and `linux/arm64`) publish to `ghcr.io/ajcwebdev/autoshow-cli`, tagged `latest` and by full commit SHA, on pushes to `main` that change image inputs (`Dockerfile`, dependencies, `config/`, `src/`, the acceptance harness, or workflows). Docs-only pushes keep the previous `latest`. The production image runs the TypeScript source entrypoint; the `compiled-experiment` target remains unpublished, and adopting it requires a material improvement without asset, path, diagnostic, image-size, or multi-architecture regressions.

This applies to:

- Image contents, entrypoint, non-root user, and doctor diagnostics.
- Direct `docker run` invocation, bind mounts, credential injection, and Linux host ownership.
- GHCR multi-architecture publication.

It does not apply to:

- Heavyweight local engines, model weights, Defuddle, provider credentials, server ports, or HTTP health checks.
- Native host setup lifecycle and the environment-variable surface ([ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md)).
- The HTTP payload ceiling and its `AUTOSHOW_HTTP_PAYLOAD_MAX_BYTES` override ([ADR-019](ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md)); the container memory a large provider response needs is documented in [docs/docker.md](../docker.md#large-provider-responses).

## Rationale

- Debian slim is the smallest base that provides every apt-packaged local-lite tool, including Calibre, through one package manager.
- A run-to-completion CLI needs a direct entrypoint and offline doctor checks, not open ports or HTTP probes.
- Runtime credential injection and a non-root user keep secrets out of the image and avoid running as root.
- Prebuilt GHCR images spare users a local rebuild, and additive distribution preserves native workflows and the heavyweight capabilities that do not belong in the image.

## Consequences

Positive outcomes:

- Users can run local-lite workflows without installing Bun or local tools on the host, with arguments, mounts, and credentials explicit on the `docker run` line.
- Prebuilt `amd64` and `arm64` images remove per-user build cost.

Negative outcomes:

- The image is larger than an Alpine equivalent, and apt tool versions follow the pinned Debian snapshot.
- Heavyweight engines and models still need a host mount or native setup, and Linux hosts may need `--user` for writable bind mounts.
- Maintainers own image publication, base-image updates, and the `yt-dlp` pin.

## Trade-offs

**Trade-off 1**

- **Gain:** Complete apt-packaged local-lite coverage, including Calibre
- **Sacrifice:** Larger than Alpine, with package versions pinned to the Debian snapshot

**Trade-off 2**

- **Gain:** Missing tools fail the same way they would on a native Linux host
- **Sacrifice:** No container-specific setup or health path hides omitted capabilities

**Trade-off 3**

- **Gain:** Non-root, credential-free image with a direct entrypoint
- **Sacrifice:** Callers specify mounts, credentials, and host UID/GID flags explicitly

**Trade-off 4**

- **Gain:** Prebuilt multi-architecture images on GHCR
- **Sacrifice:** CI and registry maintenance beside the native host path

## Implementation Note

The image recipe, entrypoint, and publishing workflow ship with the repository, and user-facing usage is documented in the [Docker guide](../docker.md).

### Bun 1.4 Migration Evidence

On 2026-08-31, local no-cost measurements compared the production image on Bun 1.3.14 with Bun 1.4.0 on one Docker Desktop host with a local Tesseract OCR fixture. The migration benchmark utility was retired on September 23; these measurements and the existing benchmark artifacts remain historical evidence. Current Docker acceptance continues through `bun t:docker`. The dotenv result is archived in [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md#bun-14-dotenv-compatibility), and Linux TIFF and ImageMagick routing constraints in [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md#bun-14-image-routing). On native ARM64, containerized help, setup, and `setup --doctor` passed with the expected warnings for tools and models left out of the image:

- **Image size:** 601.51 MiB to 599.52 MiB (−0.33%)
- **Cold `--help` median:** 290.71 ms to 256.21 ms (−11.87%)
- **CLI prebuild median:** 77.61 ms to 58.48 ms (−24.65%)
- **Fixture peak RSS median:** 107.90 MiB to 64.15 MiB (−40.55%)

The AMD64 image run under QEMU on that host produced no output and was discarded; emulated rows are not native release evidence, and native AMD64 and ARM64 CI artifacts were unreviewed on the evaluation date. A local Linux ARM64 `compiled-experiment` image improved help startup from 263 ms to 182 ms but grew the image from 599.5 MiB to 637.1 MiB by embedding a second Bun runtime, so it misses the adoption gate. Keep the source entrypoint unless a later measurement improves startup without asset, path, diagnostic, image-size, or multi-architecture regressions.

### Native release review (2026-09-22)

The [successful native CI run](https://github.com/ajcwebdev/autoshow-cli/actions/runs/35698609648) at commit `b1574d71fef1768dcdb2d50151704c8637571657` closed the production evidence gap. Separate native `ubuntu-24.04` (AMD64) and `ubuntu-24.04-arm` (ARM64) runners built and smoke-tested their digest-pinned images: AMD64 `sha256:fc48a2837b16bbe929fb5e7bcef98982d40dea5e06e60803d7cd2789693775bc` and ARM64 `sha256:90f2e9978895d1232503b5c980efa8f1e70f9e282e9a818bda83cbed2aebc41a`. Both passed offline acceptance, production dependency installation, help, config, doctor, and a local Tesseract OCR fixture. The published multi-architecture `latest` manifest (`sha256:f0e2c5a0f008493b0ad12db1e1258b1daa3407a0c39608177d08f33492ff61fb`) then passed all twelve native acceptance shards: core, public network, and four Whisperfile model selections on each architecture. The core artifacts record 28 of 28 cases passed per architecture, public-network jobs passed 2 of 2 each, and the core artifacts confirm the non-root `bun` user and `bun --no-env-file /app/src/cli/create-cli.ts` production entrypoint. Doctor completed with 46 of 50 checks passed and four warnings on each architecture, including an `ffprobe --version` warning and absent optional local assets; those warnings did not fail the documented smoke gate.

Both native compiled targets passed their limited help, config, doctor, and `write --price` path probes. The AMD64 compiled image grew from 1,795,600,085 to 1,865,543,390 bytes (+69,943,305 bytes; +3.9%) while median cold help improved from 483 to 230 ms. ARM64 grew from 1,778,569,277 to 1,848,501,301 bytes (+69,932,024 bytes; +3.93%) while median cold help improved from 401 to 232 ms. The image-size gate fails on both architectures, and the compiled target has not run the full published-image acceptance matrix. Keep it unpublished and retain the source production entrypoint.

Additional native measurements provide the baseline for a future entrypoint review. Cold-help and CLI-prebuild medians use five samples; RSS medians use three. Source RSS measures the local Tesseract fixture while compiled RSS measures help, so they do not establish a memory improvement for the same workload.

| Native runner | Source build ms | Source CLI prebuild median ms | Source OCR peak RSS median bytes | Compiled build ms | Compiled help peak RSS median bytes |
| ------------- | --------------- | ----------------------------- | -------------------------------- | ----------------- | ----------------------------------- |
| AMD64         | 61,896          | 162.131                       | 72,429,568                       | 26,776            | 21,012,480                          |
| ARM64         | 35,166          | 130.782                       | 79,003,648                       | 24,332            | 22,573,056                          |

The fixture was `test/fixtures/setup/managed-toolchain-smoke.pdf`, SHA-256 `58bec9a7757f44d7baf9cfac5fb9f24863a6fe7efdef2e82c3fd9e6a10ba4050`. Reviewed originals came from the four `docker-smoke-*` and `docker-compiled-experiment-*` CI artifacts: platform measurements, native offline-acceptance records, compiled measurements, image history and help/config/doctor/path logs. The workflow run supplies the conclusions for all twelve published-image acceptance jobs; the local evidence bundle covered the smoke and compiled artifacts only. Its SHA-256 was `38b46b159ef38b10d7e220c593e7dea89b9def4a37ce47a44c059d4339602af9`, with per-entry hashes in `SHA256SUMS`.

The September 22 review passed `bun run check` (structure, naming and types), `bun t --price` (97/97 price-only preflights), `bun test test/test-cases/validation/cli/docker-image-contracts.test.ts` (10/10 tests), `git diff --check`, archive integrity and archive SHA-256 verification. The separate report and evidence bundle were retired on September 23 after retaining the provenance, acceptance counts, measurements, decision and limits here. Raw logs are no longer packaged with this ADR; access to the original CI artifacts depends on GitHub retention.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/cli/docker-image-contracts.test.ts
```

1. The image `yt-dlp` URL and SHA-256 match native Linux metadata, and documentation shows direct `docker run`.

## Follow-up Actions

- [x] Review native Bun 1.4 production-image evidence for AMD64 and ARM64 — Passed on native Ubuntu runners in the 2026-09-22 CI run.
- [x] Review both native compiled-entrypoint experiment artifacts — Rejected for production because both compiled images grew by about 70 MB; retain the source entrypoint.

## References

- Related ADR: [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md)
- Related ADR: [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md)
- Related ADR: [ADR-019](ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md)
- [Docker guide](../docker.md)
- [Docker usage and acceptance guide](../docker.md)
