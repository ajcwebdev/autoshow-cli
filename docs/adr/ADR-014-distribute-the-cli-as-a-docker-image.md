# ADR-014: Distribute the CLI as a Debian Slim Docker Image

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-24
- **Date Updated:** 2026-08-15
- **Verification Status:** Passed

## Context

AutoShow is a Bun-native, run-to-completion CLI. It executes TypeScript directly through `bun src/cli/create-cli.ts`, has no compile or bundle stage, exposes no HTTP server or port, and uses the offline `bun autoshow setup --doctor` command rather than a web health endpoint. Native onboarding otherwise requires Bun plus a host setup flow that installs or builds local tools and optional model assets.

The Docker distribution must provide a useful local baseline without containing every AutoShow capability. Its local-lite contract includes `ffmpeg`, `ffprobe`, `yt-dlp`, Tesseract OCR with English data, MuPDF `mutool`, `qpdf`, and Calibre `ebook-convert`. Heavy local STT, LLM, and TTS engines, model weights, Defuddle, and hosted-provider credentials remain outside the image.

The CLI maintains no container-only setup or health path: system tools resolve through the standard Linux `PATH` fallback, and omitted tools surface as real setup, doctor, or workflow failures rather than being masked by container detection.

Evaluation of available Bun bases showed that Alpine (`oven/bun:1.3.14-alpine`) lacks Calibre in its package repositories, whereas Debian slim (`oven/bun:1.3.14-slim`) provides the complete local-lite package set through `apt`, including `calibre` and `tesseract-ocr-eng`.

Why now: container users were paying the full native onboarding cost for a tool set that installs cleanly from one package manager, and the Docker surface had grown from a base-image question into a build, runtime, mount, credential, and publication contract that needs a single authority.

## Options Considered

**Option 1 (selected)**

- **Option:** Debian slim local-lite image (`oven/bun:1.3.14-slim`) alongside native host setup
- **Pros:** Installs full local-lite contract (`ffmpeg`, Tesseract, MuPDF, qpdf, Calibre) via `apt`; preserves native host development
- **Cons:** Larger base size than Alpine; maintains dual distribution paths
- **Quantitative Notes:** 269 MB base disk usage / 67.6 MB compressed

**Option 2**

- **Option:** Alpine base without Calibre (`oven/bun:1.3.14-alpine`)
- **Pros:** Smallest base image size
- **Cons:** Package repositories lack Calibre, breaking ebook conversion workflows
- **Quantitative Notes:** 146 MB base disk usage / 43.7 MB compressed

**Option 3**

- **Option:** Full Bun Debian base (`oven/bun:1.3.14`)
- **Pros:** Supplies all required packages via `apt`
- **Cons:** Adds base size without capability gain
- **Quantitative Notes:** 335 MB base disk usage / 87.1 MB compressed

**Option 4**

- **Option:** Native setup only (no container distribution)
- **Pros:** Avoids image, CI, and registry maintenance
- **Cons:** Retains full onboarding cost for containerized environments
- **Quantitative Notes:** Rejected

**Option 5**

- **Option:** Docker as exclusive setup path
- **Pros:** Single reproducible environment across platforms
- **Cons:** Degrades native macOS workflow; complicates local GPU and engine integration
- **Quantitative Notes:** Rejected

**Option 6 (selected)**

- **Option:** Publish multi-architecture images to GHCR (`linux/amd64`, `linux/arm64`)
- **Pros:** Colocates package with repository; provides prebuilt images for release tags and manual dispatch
- **Cons:** Adds registry, CI workflow, tag, cache, and provenance maintenance
- **Quantitative Notes:** Semantic-version tags (`v*.*.*`), `latest`, and manual tag

**Option 7**

- **Option:** Local container builds only
- **Pros:** Zero release-operations surface
- **Cons:** Every user incurs local build time and cannot pin published releases
- **Quantitative Notes:** Rejected

**Option 8**

- **Option:** Publish to a separate external registry
- **Pros:** Serves users centered on third-party registries
- **Cons:** Adds external credential, account, and retention management
- **Quantitative Notes:** Rejected

## Decision

AutoShow distributes an additive, Debian slim, local-lite Docker image. The multi-stage `Dockerfile` defaults `ARG BUN_BASE_IMAGE` to `oven/bun:1.3.14-slim`, installs production Bun dependencies in a dependency stage, and copies only production package metadata, `node_modules`, TypeScript configuration, and `src/` into the runtime stage.

The runtime stage installs `ffmpeg`, Tesseract OCR with English data, MuPDF tools, `qpdf`, Calibre, Python, CA certificates, and `curl` via `apt`. It downloads the Linux `yt-dlp` asset configured by `YT_DLP_URL`, verifies `YT_DLP_SHA256`, and installs it at `/usr/local/bin/yt-dlp`, keeping the pin aligned with native Linux dependency metadata.

The image runs as the non-root `bun` user, uses `/app` as the working directory, and sets `ENTRYPOINT ["bun", "/app/src/cli/create-cli.ts"]`. It exposes no ports and defines no HTTP `HEALTHCHECK`; `setup --doctor` is the offline diagnostic surface. A default `help` command ensures bare container runs terminate usefully.

`.dockerignore` excludes repository history, installed dependencies, runtime state, inputs, outputs, credentials, logs, docs, and tests from the build context. Credentials are provided at runtime via `--env-file`, `-e` variables, or a read-only `.env` mount and are never baked into the image.

User data remains outside the image. Direct container invocations may mount the host directory at `/workspace` or bind input, output, and runtime paths beneath `/app`. Arguments following the image name are passed directly to AutoShow. Linux host users manage writable bind-mount permissions via `--user "$(id -u):$(id -g)"`.

The image links `/app/runtime/tools/tessdata` to `/usr/share/tesseract-ocr/5/tessdata` and includes a wrapper at `/usr/local/bin/tesseract` that falls back to system data if a bind-mounted `/app/runtime` obscures the symlink.

Multi-architecture images (`linux/amd64` and `linux/arm64`) are published as `ghcr.io/ajcwebdev/autoshow-cli` via `.github/workflows/docker-publish.yml` on release tags (`v*.*.*`) and manual workflow dispatch, with GitHub Actions layer caching and OCI provenance.

This applies to:

- The Docker build context, image contents, entrypoint, non-root user, filesystem layout, and diagnostic expectations.
- Direct image invocation, bind mounts, credential injection, runtime path resolution, and host ownership guidance.
- GHCR image tagging, multi-architecture publication, caching, and provenance.
- Standard Linux tool resolution without container-specific code branches or bypasses.

It does not apply to:

- Heavyweight local engines, model weights, Defuddle, provider credentials, server ports, or HTTP health checks.
- Native host setup lifecycle (governed by [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md)) or third-party container launcher scripts.

## Rationale

- Debian slim is the smallest base that provides the complete local-lite package set through one package manager; Alpine lacks Calibre support.
- Standard Linux `PATH` resolution discovers baked tools without container-specific runtime branches.
- A run-to-completion CLI requires a direct entrypoint and offline diagnostic checks rather than open ports or HTTP health probes.
- Direct image execution and native `bun autoshow` remain the sole supported command surfaces, avoiding wrapper scripts and argument translation layers.
- Non-root execution, minimal build context, checksum-pinned direct downloads, runtime credential injection, and OCI provenance ensure a secure, inspectable boundary.
- GHCR colocates image publication with repository source and release workflows across `linux/amd64` and `linux/arm64`.
- Additive container distribution preserves native host workflows and heavyweight local capabilities that do not fit containerization.

## Consequences

Positive outcomes:

- Users can execute the CLI and complete local-lite workflows without installing Bun or local tools on the host.
- Calibre-backed ebook conversion workflows remain fully functional.
- The image reuses standard Linux tool resolution without container-specific code paths.
- Direct image invocation keeps arguments, mounts, credentials, and working directories explicit in a single command.
- Multi-architecture GHCR publication eliminates per-user build overhead while preserving local build capability.
- Checksum-pinned dependencies, non-root execution, runtime credential injection, and provenance remain inspectable.

Negative outcomes:

- Debian slim base image is larger than an Alpine equivalent.
- System tool versions are bound to Debian package repositories rather than pinned source builds.
- Deliberately omitted heavyweight engines and models require external host mounting or native setup.
- Linux hosts may require explicit UID/GID configuration for writable bind mounts.
- Maintainers oversee multi-architecture CI workflows, base image updates, and direct-download checksum alignment.

## Trade-offs

**Trade-off 1**

- **Gain:** Complete local-lite tool coverage via Debian `apt`
- **Sacrifice:** Larger base image size than Alpine

**Trade-off 2**

- **Gain:** Calibre-backed ebook conversion support
- **Sacrifice:** Package versions governed by Debian repositories rather than pinned source builds

**Trade-off 3**

- **Gain:** Standard Linux tool resolution without runtime bypasses
- **Sacrifice:** Omitted or misconfigured tools surface as real runtime errors

**Trade-off 4**

- **Gain:** Non-root, credential-free image security
- **Sacrifice:** Bind mounts may require host UID/GID flags

**Trade-off 5**

- **Gain:** Direct image entrypoint without wrapper scripts
- **Sacrifice:** Callers must specify container flags and mount arguments explicitly

**Trade-off 6**

- **Gain:** Prebuilt `amd64` and `arm64` images on GHCR
- **Sacrifice:** CI workflow, cache, and registry maintenance

**Trade-off 7**

- **Gain:** Additive container distribution
- **Sacrifice:** Maintaining dual native host and container distribution paths

## Implementation Note

The Docker recipe, build exclusions, documentation, and entrypoint are implemented in `Dockerfile`, `.dockerignore`, `docs/docker.md`, and `README.md`. The image runs as non-root `bun`, installs local-lite system packages during build, verifies `yt-dlp` via checksum, and provides the fallback Tesseract wrapper for runtime mounts.

Publishing is implemented in `.github/workflows/docker-publish.yml`, building and pushing `linux/amd64` and `linux/arm64` images to GHCR on release tags and workflow dispatch with GitHub Actions caching and OCI provenance. Local builds remain supported.

## Test Plan

Run default verification and local contract validation suites:

```bash
bun run check
bun test test/test-cases/validation/cli/docker-image-contracts.test.ts
```

- `bun test test/test-cases/validation/cli/docker-image-contracts.test.ts` validates that the Docker `yt-dlp` URL and SHA-256 match native Linux dependency metadata, that installation order is verified, and that documentation reflects direct `docker run` execution without wrapper scripts.
- Static review confirms `Dockerfile` uses non-root `bun`, absolute CLI entrypoint, declared package set, Tesseract fallback, and no baked credentials; `.dockerignore` excludes secrets and runtime state.
- Static review confirms `.github/workflows/docker-publish.yml` targets `linux/amd64` and `linux/arm64`, triggers on release tags and workflow dispatch, enables caching and provenance, and uses least-privilege permissions (`contents: read`, `packages: write`).
- Codebase verification is confirmed with `bun run check` and `git diff --check` without invoking external paid services.

## References

- Host setup and toolchain lifecycle: [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md)
- Environment-variable policy: [ADR-005](ADR-005-reduce-environment-variable-surface-area.md)
- Extract and current local OCR scope: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- `Dockerfile`
- `.dockerignore`
- `.github/workflows/docker-publish.yml`
- `docs/docker.md`
- `test/test-cases/validation/cli/docker-image-contracts.test.ts`
- Runtime tool resolution: `src/utils/runtime-paths.ts`
- Native Linux `yt-dlp` dependency metadata: `src/cli/commands/setup-and-utilities/setup/dependency-metadata.ts`
