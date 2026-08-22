# ADR-014: Distribute the CLI as a Debian Slim Docker Image

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-24
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed

## Context

AutoShow is a Bun-native, run-to-completion CLI. It has no compile or bundle stage, exposes no HTTP server or port, and uses the offline `bun autoshow setup --doctor` command rather than a web health endpoint. Native onboarding otherwise requires Bun plus a host setup flow that installs or builds local tools and optional model assets.

The Docker distribution must provide a useful local baseline without containing every AutoShow capability. Its local-lite contract includes `ffmpeg`, `ffprobe`, `yt-dlp`, Tesseract OCR with English data, MuPDF `mutool`, `qpdf`, and Calibre `ebook-convert`. Heavy local STT, LLM, and TTS engines, model weights, Defuddle, and hosted-provider credentials remain outside the image.

The CLI has no container-only setup or health path. System tools resolve through the standard Linux `PATH` fallback, and omitted tools surface as real setup, doctor, or workflow failures rather than being masked by container detection.

Alpine Bun images cannot install Calibre from their package repositories. Debian slim can install the full local-lite set through `apt`.

Why now: container users were paying the full native onboarding cost for a tool set that installs cleanly from one package manager.

## Options Considered

### Base Image and Host Relationship

**Option 1 (selected)**

- **Option:** Debian slim local-lite image (`oven/bun:1.3.14-slim`) alongside native host setup
- **Pros:** Installs the full local-lite contract via `apt`; preserves native host development
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
- **Quantitative Notes:** n/a

**Option 5**

- **Option:** Docker as exclusive setup path
- **Pros:** Single reproducible environment across platforms
- **Cons:** Degrades native macOS workflow; complicates local GPU and engine integration
- **Quantitative Notes:** n/a

### Publication

**Option 1 (selected)**

- **Option:** Publish multi-architecture images to GHCR (`linux/amd64`, `linux/arm64`)
- **Pros:** Colocates the package with the repository; provides prebuilt images for every push to `main`
- **Cons:** Adds registry and CI maintenance
- **Quantitative Notes:** `latest` and full-commit-SHA tags

**Option 2**

- **Option:** Local container builds only
- **Pros:** Zero release-operations surface
- **Cons:** Every user incurs local build time and cannot pin published releases
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Publish to a separate external registry
- **Pros:** Serves users centered on third-party registries
- **Cons:** Adds external credential, account, and retention management
- **Quantitative Notes:** n/a

## Decision

AutoShow distributes an additive Debian slim local-lite Docker image alongside native host setup. The image is based on `oven/bun:1.3.14-slim`, runs as the non-root `bun` user from `/app`, and uses the CLI as its entrypoint, so arguments after the image name are AutoShow arguments. Bare container runs print help and exit. It exposes no ports and defines no HTTP health check; `setup --doctor` remains the offline diagnostic.

The image includes the local-lite tools listed in Context. `yt-dlp` is checksum-pinned to the same Linux artifact native setup uses. Credentials arrive at runtime through `--env-file`, `-e`, or a read-only `.env` mount and are never baked into the image. User data stays on the host via bind mounts: the working directory at `/workspace`, or input, output, and runtime paths under `/app`. Linux hosts that need host-owned output use `--user "$(id -u):$(id -g)"`. Binding over `/app/runtime` must not break Tesseract English data.

Multi-architecture images (`linux/amd64` and `linux/arm64`) publish to `ghcr.io/ajcwebdev/autoshow-cli` on every push to `main`, tagged `latest` and by full commit SHA, with OCI provenance.

This applies to:

- Image contents, entrypoint, non-root user, and doctor diagnostics.
- Direct `docker run` invocation, bind mounts, credential injection, and Linux host ownership.
- GHCR multi-architecture publication.
- Standard Linux tool resolution without container-specific code branches.

It does not apply to:

- Heavyweight local engines, model weights, Defuddle, provider credentials, server ports, or HTTP health checks.
- Native host setup lifecycle (governed by [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md)) or third-party container launcher scripts.

## Rationale

- Debian slim is the smallest base that provides the complete local-lite package set, including Calibre, through one package manager.
- Standard Linux `PATH` resolution discovers image tools without container-specific runtime branches.
- A run-to-completion CLI needs a direct entrypoint and offline doctor checks, not open ports or HTTP probes.
- Direct image execution and native `bun autoshow` are the only supported command surfaces.
- Checksum-pinned `yt-dlp`, non-root execution, and runtime credential injection keep the image inspectable and free of secrets.
- GHCR colocates prebuilt `amd64` and `arm64` images with the repository.
- Additive distribution preserves native host workflows and heavyweight local capabilities that do not belong in the image.

## Consequences

Positive outcomes:

- Users can run local-lite workflows without installing Bun or local tools on the host.
- Direct `docker run` keeps arguments, mounts, and credentials explicit.
- Prebuilt `amd64` and `arm64` images remove per-user build cost.

Negative outcomes:

- Debian slim is larger than an Alpine equivalent, and tool versions follow Debian repositories.
- Heavyweight engines and models still need a host mount or native setup.
- Linux hosts may need `--user` for writable bind mounts.
- Maintainers own image publication, base-image updates, and the `yt-dlp` pin.

## Trade-offs

**Trade-off 1**

- **Gain:** Complete local-lite coverage, including Calibre, via Debian `apt`
- **Sacrifice:** Larger than Alpine; package versions follow Debian repositories

**Trade-off 2**

- **Gain:** Standard Linux tool resolution with no container bypasses
- **Sacrifice:** Omitted or misconfigured tools fail at runtime

**Trade-off 3**

- **Gain:** Non-root, credential-free image
- **Sacrifice:** Writable bind mounts may need host UID/GID flags

**Trade-off 4**

- **Gain:** Direct image entrypoint with no wrapper scripts
- **Sacrifice:** Callers specify container flags and mounts explicitly

**Trade-off 5**

- **Gain:** Prebuilt `amd64` and `arm64` images on GHCR
- **Sacrifice:** CI and registry maintenance

**Trade-off 6**

- **Gain:** Additive container distribution
- **Sacrifice:** Dual native host and container paths

## Implementation Note

The image recipe, build exclusions, user documentation, and entrypoint live in `Dockerfile`, `.dockerignore`, `docs/docker.md`, and `README.md`. Publishing lives in `.github/workflows/docker-publish.yml`. Local `docker build` remains supported.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/cli/docker-image-contracts.test.ts
```

1. Typecheck and unique source check pass.
2. Docker `yt-dlp` URL and SHA-256 match native Linux dependency metadata, and documentation shows direct `docker run` with no wrapper scripts.

## References

- Related ADR: [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md)
- Related ADR: [ADR-005](ADR-005-reduce-environment-variable-surface-area.md)
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- `Dockerfile`
- `.dockerignore`
- `.github/workflows/docker-publish.yml`
- `docs/docker.md`
- `test/test-cases/validation/cli/docker-image-contracts.test.ts`
- `src/cli/commands/setup-and-utilities/setup/dependency-metadata.ts`
