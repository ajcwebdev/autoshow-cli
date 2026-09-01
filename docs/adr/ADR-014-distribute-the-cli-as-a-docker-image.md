# ADR-014: Distribute the CLI as a Debian Slim Docker Image

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-24
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed

## Context

AutoShow is a Bun-native, run-to-completion CLI, not a server. Native onboarding requires Bun plus a host setup flow that installs or builds local tools and optional model assets.

The Docker image should give container users a useful local baseline without shipping every AutoShow capability. That local-lite set is `ffmpeg`, `ffprobe`, `yt-dlp`, Tesseract OCR with English data, MuPDF `mutool`, `qpdf`, and Calibre `ebook-convert`. Heavy local STT, LLM, and TTS engines, model weights, Defuddle, and hosted-provider credentials stay outside the image.

Alpine Bun images cannot install Calibre from their package repositories. Debian slim can install the full local-lite set through `apt`.

Why now: container users were paying the full native onboarding cost for a tool set that installs cleanly from one package manager.

## Options Considered

### Base Image and Host Relationship

**Option 1 (selected)**

- **Option:** Debian slim local-lite image (`oven/bun:1.4.0-slim`) alongside native host setup
- **Pros:** Installs the full local-lite contract via `apt`; preserves native host development
- **Cons:** Larger base size than Alpine; maintains dual distribution paths
- **Quantitative Notes:** 269 MB base disk usage / 67.6 MB compressed

**Option 2**

- **Option:** Alpine base without Calibre (`oven/bun:1.4.0-alpine`)
- **Pros:** Smallest base image size
- **Cons:** Package repositories lack Calibre, breaking ebook conversion workflows
- **Quantitative Notes:** 146 MB base disk usage / 43.7 MB compressed

**Option 3**

- **Option:** Full Bun Debian base (`oven/bun:1.4.0`)
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

AutoShow distributes an additive Debian slim local-lite Docker image alongside native host setup. The image is based on the exact multi-architecture image `oven/bun:1.4.0-slim@sha256:e0ee68d16ccb9927bf02aa7dd8fd4bf3369ee6d46da04faa72b05ce8bfd135f6`, runs as the non-root `bun` user from `/app`, and uses the CLI as its entrypoint, so arguments after the image name are AutoShow arguments. A bare container run prints help and exits. The image exposes no ports and defines no HTTP health check; `setup --doctor` remains the offline diagnostic. The supported command surfaces are native `bun autoshow` and direct `docker run`.

The image includes the local-lite tools listed in Context. `yt-dlp` matches the native Linux pin. Credentials arrive at runtime through Docker's `--env-file` or `-e` options and are never baked into or mounted as files inside the image. The entrypoint disables Bun's automatic `.env` loading, so mounting a file at `/app/.env` is not a supported credential path. User data stays on the host via bind mounts: the working directory at `/workspace`, or input, output, and runtime paths under `/app`. Linux hosts that need host-owned output use `--user "$(id -u):$(id -g)"`. A bind mount over `/app/runtime` must still leave Tesseract English data available.

Image tools are discovered on the normal Linux `PATH`. The CLI does not special-case containers, so omitted tools fail in setup, doctor, or the workflow the same way they would on a native Linux host.

Multi-architecture images (`linux/amd64` and `linux/arm64`) publish to `ghcr.io/ajcwebdev/autoshow-cli` on every push to `main`, tagged `latest` and by full commit SHA.

This applies to:

- Image contents, entrypoint, non-root user, and doctor diagnostics.
- Direct `docker run` invocation, bind mounts, credential injection, and Linux host ownership.
- GHCR multi-architecture publication.

It does not apply to:

- Heavyweight local engines, model weights, Defuddle, provider credentials, server ports, or HTTP health checks.
- Native host setup lifecycle (governed by [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md)).

## Rationale

- Debian slim is the smallest base that provides the complete local-lite package set, including Calibre, through one package manager.
- A run-to-completion CLI needs a direct entrypoint and offline doctor checks, not open ports or HTTP probes.
- Runtime credential injection and a non-root user keep secrets out of the image and avoid running as root.
- GHCR colocates prebuilt `amd64` and `arm64` images with the repository so users do not have to rebuild locally.
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

- **Gain:** Missing tools fail the same way they would on a native Linux host
- **Sacrifice:** The image does not hide omitted capabilities behind a container-specific setup or health path

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

The image recipe, build exclusions, user documentation, and entrypoint live in `Dockerfile`, `.dockerignore`, `docs/docker.md`, and `README.md`. Publishing lives in `.github/workflows/docker-publish.yml`.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/cli/docker-image-contracts.test.ts
```

1. Typecheck and unique source check pass.
2. Image `yt-dlp` URL and SHA-256 match native Linux metadata, and documentation shows direct `docker run`.

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
```
