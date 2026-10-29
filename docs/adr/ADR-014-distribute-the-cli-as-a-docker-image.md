# ADR-014: Distribute the CLI as a Debian Slim Docker Image

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-24
- **Date Updated:** 2026-10-28
- **Verification Status:** Passed

## Context

AutoShow is a Bun-native, run-to-completion CLI. Native onboarding requires Bun plus a host setup flow that installs or builds local tools and optional model assets. Container users needed a useful baseline without that full setup cost. Debian slim supplies the selected local tools, including Calibre, through one package manager.

Why now: container users needed a useful local baseline without the native onboarding cost or every AutoShow capability.

## Options Considered

### Base image and host relationship

**Option 1 (selected)**

- **Option:** Debian slim local-lite image alongside native host setup
- **Pros:** Installs the full local-lite contract, including Calibre, via `apt`; preserves native host development
- **Cons:** Larger than Alpine; two distribution paths to maintain
- **Quantitative Notes:** n/a

**Option 2**

- **Option:** Alpine base without Calibre
- **Pros:** Smallest base image
- **Cons:** Rejected; no Calibre, so ebook conversion breaks
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Full Bun Debian base
- **Pros:** Supplies every required package
- **Cons:** Adds size without capability gain
- **Quantitative Notes:** n/a

**Option 4**

- **Option:** Native setup only, no container distribution
- **Pros:** No image, CI, or registry maintenance
- **Cons:** Containerized environments keep the full onboarding cost
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

## Decision

AutoShow distributes an additive Debian slim local-lite Docker image alongside native host setup. The image pins its Bun base by digest, runs as the non-root `bun` user from `/app`, and uses the CLI source as its entrypoint, so arguments after the image name are AutoShow arguments. A bare container run prints help and exits; `setup --doctor` remains the offline diagnostic.

The image includes `ffmpeg`, `ffprobe`, `yt-dlp` at the native Linux pin with Deno for YouTube JavaScript challenges, Tesseract OCR with English data, MuPDF `mutool`, `qpdf`, Calibre `ebook-convert`, and ImageMagick with Pango and DejaVu fonts. Heavy local STT, LLM, and TTS engines, model weights, Defuddle, and hosted-provider credentials stay outside the image.

Hosted-provider credentials arrive at runtime through Docker's `--env-file` or `-e` options and are never baked into the image. The entrypoint disables Bun's automatic `.env` loading, so mounting a file at `/app/.env` is not a supported credential path. User data stays on the host through bind mounts. Persist `/app/runtime` and `/home/bun` to retain configuration, managed assets, identity state, and caches between disposable containers. Linux hosts that need host-owned output use `--user "$(id -u):$(id -g)"` with writable host-owned state and home mounts, as described in the [Docker guide](../docker.md#project-workspace-invocation).

Tesseract uses valid managed English data when present and its packaged default when managed data is absent, including with an empty runtime mount. Invalid managed data fails with a diagnostic from OCR, setup, and doctor. Other image tools use the normal Linux `PATH`; omitted capabilities receive the normal setup, doctor, or workflow diagnostics.

Multi-architecture images (`linux/amd64` and `linux/arm64`) publish to `ghcr.io/ajcwebdev/autoshow-cli` on pushes to `main` that change image inputs. Verification, native smoke tests, and vulnerability scans precede a full-commit-SHA candidate. Every native core, model, and public-network acceptance shard must pass against that candidate's immutable digest before the same index is promoted to `latest`. Failed or skipped acceptance and docs-only pushes leave the previous `latest` in place.

This applies to:

- Image contents, entrypoint, non-root user, and doctor diagnostics.
- Direct `docker run` invocation, bind mounts, credential injection, and Linux host ownership.
- GHCR multi-architecture publication.

It does not apply to:

- Bundling heavyweight local engines, model weights, Defuddle, or provider credentials, or providing server ports and HTTP health checks.
- Native host setup lifecycle and the environment-variable surface ([ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md)).
- The HTTP payload ceiling and its `AUTOSHOW_HTTP_PAYLOAD_MAX_BYTES` override ([ADR-019](ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md)); the container memory a large provider response needs is documented in [docs/docker.md](../docker.md#large-provider-responses).

## Rationale

- Debian slim provides every selected apt-packaged local-lite tool, including Calibre, without the additional size of the full Debian base.
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

The recipe in `Dockerfile` and release workflow in `.github/workflows/docker-publish.yml` implement this decision. The [Docker guide](../docker.md) owns invocation examples, current security pins, and native acceptance procedures.

Application source, installed dependencies, and frozen manifests remain root-owned and read-only to the runtime user. Configuration writes go to persistent runtime storage. The optional `alignment` target adds the CPU alignment backend; the default `production` target omits it. The image disables HTTP keepalive by default for long provider requests on affected Docker Desktop networks; `AUTOSHOW_DISABLE_HTTP_KEEPALIVE=0` restores pooling.

### Bun 1.4 Migration Evidence

The 2026-08-31 native ARM64 comparison of Bun 1.3.14 and 1.4.0 passed help, setup, doctor, and a local Tesseract fixture, with smaller image size and improved startup and fixture memory measurements. The AMD64 run under emulation was discarded and did not establish native release support.

The 2026-09-22 [native release review](https://github.com/ajcwebdev/autoshow-cli/actions/runs/35698609648) closed that gap: production smoke tests and all twelve published-image acceptance shards passed on native AMD64 and ARM64. These are dated results, not verification of later image revisions.

Both native compiled-entrypoint experiments improved help startup but increased image size by about 70 MB each and did not run the full published-image acceptance matrix. Production therefore retains the source entrypoint. The rejected experiment stages and recurring jobs were retired on 2026-10-19. Reconsider compilation only if it materially improves startup without asset, path, diagnostic, image-size, or multi-architecture regressions.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/cli/docker-image-contracts.test.ts
bun test test/test-cases/validation/cli/docker-runtime-recipe.test.ts
```

1. Repository checks validate structure, names, types, and maintained documentation examples.
2. Image contracts check tool pins, direct invocation, source entrypoint, and promotion gates, including rejected acceptance states.
3. Runtime recipe contracts check optional alignment isolation and configuration creation, update, and reset through an initially empty runtime mount.

These local checks do not build an image or establish native image acceptance; release gates in the [Docker guide](../docker.md#acceptance-checks) cover that verification.

## References

- Related ADR: [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md)
- Related ADR: [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md)
- Related ADR: [ADR-019](ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md)
- `Dockerfile`
- `.github/workflows/docker-publish.yml`
- [Docker guide](../docker.md)
