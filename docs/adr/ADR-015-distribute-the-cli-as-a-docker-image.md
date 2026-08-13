# ADR-015: Distribute the CLI as a Debian Slim Docker Image

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-24
- **Date Updated:** 2026-08-13
- **Verification Status:** Passed

## Context

AutoShow is a Bun-native, run-to-completion CLI. It executes TypeScript directly through `bun src/cli/create-cli.ts`, has no compile or bundle stage, exposes no HTTP server or port, and uses the offline `bun autoshow setup --doctor` command rather than a web health endpoint. Native onboarding otherwise requires Bun plus a host setup flow that installs or builds local tools and may fetch large optional model assets.

The Docker distribution must provide a useful local baseline without pretending to contain every AutoShow capability. Its local-lite contract is `ffmpeg` and `ffprobe`, `yt-dlp`, Tesseract OCR with English data, MuPDF `mutool`, `qpdf`, and Calibre `ebook-convert`. Heavy local STT, LLM, and TTS engines, model weights, Defuddle, and hosted-provider credentials remain outside the image.

ADR-005 removed the `DOCKER_CONTAINER` environment-variable bypass, so the CLI maintains no container-only setup or health path. Normal Linux resolution and checks apply inside the image: system tools installed under standard locations resolve through the existing Linux `PATH` fallback, and an omitted promised tool becomes a real setup, doctor, or workflow failure rather than something hidden by container detection.

Local arm64 evaluation of the available Bun bases found that `oven/bun:1.3.14-alpine` can install the media, OCR, MuPDF, qpdf, Python, certificate, and download dependencies, but its package repositories do not supply Calibre. Both `oven/bun:1.3.14-slim` and `oven/bun:1.3.14` are Debian 13 and can install the complete local-lite set through `apt`, including `calibre` and `tesseract-ocr-eng`. The base-only sizes recorded below were inputs to the decision, not final image-size promises.

Why now: container users were paying the full native onboarding cost for a tool set that installs cleanly from one package manager, and the Docker surface had grown from a base-image question into a build, runtime, mount, credential, and publication contract that needs a single authority.

## Options Considered

### Distribution Boundary

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Add a local-lite image alongside native host setup** | Removes Bun and common-tool installation from container users while preserving native development and heavyweight local engines | Maintains two distribution paths and requires explicit mount, credential, and ownership guidance | One image recipe plus the existing native setup path |
| Make Docker the only supported setup path | Centralizes system dependencies and improves scripted reproducibility | Degrades the local-first macOS workflow and makes heavyweight local engines and host integration harder | Rejected as the sole distribution path |
| Keep native setup only | Avoids image and registry maintenance | Retains the full onboarding cost for users who already standardize on containers | Rejected after the image trade study |

### Base Image

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Debian slim full local-lite (`oven/bun:1.3.14-slim`)** | Installs the complete local-lite contract through one `apt` path | Larger than Alpine | 269 MB disk usage / 67.6 MB content before AutoShow packages |
| Alpine without Calibre (`oven/bun:1.3.14-alpine`) | Smallest observed base | Cannot support Calibre-backed ebook conversion and would narrow the documented contract | 146 MB disk usage / 43.7 MB content before AutoShow packages |
| Full Bun Debian (`oven/bun:1.3.14`) | Has the same required package availability as slim | Adds base size with no identified capability gain | 335 MB disk usage / 87.1 MB content before AutoShow packages |

### Image Publication

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Publish multi-architecture images to GHCR from release tags and explicit manual dispatches** | Keeps source and package identity together on GitHub; gives users a prebuilt image; supports release and recovery publication | Adds registry, CI, tag, cache, and provenance maintenance | `linux/amd64` and `linux/arm64`; semantic-version and `latest` tags plus an optional manual tag |
| Support local builds only | Smallest release-operations surface | Every user pays the build cost and cannot pin a project-published image | Rejected once GHCR publishing shipped |
| Publish to a separate registry | Could serve users already centered on another registry | Adds another account, credential, retention, and identity boundary without a demonstrated need | Rejected; no second registry is configured |

## Decision

AutoShow distributes an additive, Debian slim, local-lite Docker image. The in-repository multi-stage `Dockerfile` defaults `ARG BUN_BASE_IMAGE` to `oven/bun:1.3.14-slim`, installs production Bun dependencies in a dependency stage, and copies only the production package metadata, `node_modules`, TypeScript configuration, and `src/` tree into the runtime stage.

The runtime stage installs `ffmpeg`, Tesseract and English data, MuPDF tools, qpdf, Calibre, Python, CA certificates, and curl through `apt`. It downloads the exact Linux `yt-dlp` asset configured by `YT_DLP_URL`, verifies `YT_DLP_SHA256`, and installs it at `/usr/local/bin/yt-dlp`. The image must keep that pin aligned with the native Linux dependency metadata.

The image runs as the official base image's non-root `bun` user, uses `/app` as its image work directory, and invokes the CLI through `ENTRYPOINT ["bun", "/app/src/cli/create-cli.ts"]`. It exposes no port and defines no HTTP `HEALTHCHECK`; `setup --doctor` remains the CLI-native offline diagnostic surface. A default `help` command makes a bare image run terminate usefully.

The `.dockerignore` excludes repository history, installed dependencies, runtime state, inputs, outputs, test output, credentials, logs, docs, tests, and development-only files from the build context. Credentials are supplied at run time with `--env-file`, individual `-e` values, or a read-only `.env` mount; they are never baked into the image.

User data remains outside the image, and users invoke either `bun autoshow` from a native checkout or the image entrypoint through `docker run`. A direct image invocation may mount the current host directory at `/workspace` and use it as the container work directory, or bind separate input, output, and optional runtime paths beneath `/app`. Arguments after the image name are interpreted as AutoShow arguments against the container filesystem. Linux users are responsible for writable bind-mount ownership and may run with `--user "$(id -u):$(id -g)"`.

Debian's Tesseract data lives under `/usr/share/tesseract-ocr/5/tessdata`, while AutoShow can project a runtime-local `TESSDATA_PREFIX`. The image creates `/app/runtime/tools/tessdata` as a symlink to the system data and installs a wrapper at `/usr/local/bin/tesseract` that falls back to the system directory when a bind-mounted `/app/runtime` hides that symlink.

The image is published as `ghcr.io/ajcwebdev/autoshow-cli` by `.github/workflows/docker-publish.yml`. Tag pushes matching `v*.*.*` publish semantic-version tags and `latest`; `workflow_dispatch` publishes `latest` by default or an explicitly supplied tag. Buildx and QEMU produce `linux/amd64` and `linux/arm64` manifests, GitHub Actions caching is enabled, and the build emits OCI provenance. The workflow does not define a separate image-signing or custom registry-retention program.

This applies to:

- The Docker build context, image contents, entrypoint, user, filesystem layout, and diagnostic expectations.
- Direct image invocation, bind mounts, credential injection, runtime-cache behavior, in-container path resolution, and host ownership guidance.
- GHCR image tags, multi-architecture publication, caching, and provenance.
- Removal of container-specific runtime bypasses: the image follows normal Linux setup, resolution, and health behavior.

It does not apply to:

- Heavyweight local engines, model weights, Defuddle, provider credentials, server ports, or web health checks, none of which are in the image.
- Native host setup, whose lifecycle remains governed by ADR-004, or a second host-side Docker launcher, which the project does not maintain.

## Rationale

- Debian slim is the smallest observed base that supplies the complete current local-lite package set through one package manager. Alpine's Calibre gap would make documented ebook behavior diverge from the image.
- The existing Linux `PATH` resolver discovers the baked tools without a production-only container branch, so container behavior stays ordinary Linux behavior backed by a complete declared tool set.
- A run-to-completion CLI needs a direct entrypoint and offline doctor command, not ports, a resident process, or an HTTP health probe.
- Keeping `bun autoshow` and the image entrypoint as the only command surfaces avoids a second layer of argument, mount, credential, and image-selection behavior.
- Non-root execution, a narrow build context, checksum-pinned direct downloads, runtime-only credentials, and OCI provenance make the distribution boundary explicit and inspectable.
- GHCR matches the repository identity and gives both common Linux architectures one publication path without establishing a separate registry account.
- Keeping the image additive preserves native macOS setup and heavyweight local workflows whose build time, image size, hardware access, and model lifecycle do not fit local-lite distribution.

## Consequences

Positive outcomes:

- Users can run the CLI and the complete local-lite tool set without installing Bun or those tools on the host.
- Calibre-backed convertible ebook workflows remain available rather than silently disappearing from a smaller Alpine image.
- The image reuses normal Linux resolution and requires no container-only production code.
- Direct image invocation keeps the Docker command, selected image, mounts, credentials, work directory, and AutoShow arguments visible in one command.
- Multi-architecture GHCR publication removes per-user build cost while retaining local builds as a supported fallback.
- The `yt-dlp` contract, non-root user, excluded build context, runtime credential injection, and provenance are locally inspectable.

Negative outcomes:

- Debian slim starts larger than Alpine, and final size also includes system packages, production dependencies, and source files.
- Debian supplies package versions rather than the SHA-pinned source-build lifecycle used for some native macOS tools.
- Heavy local engines, model weights, and Defuddle are unavailable unless users build or mount a separate extension, and `setup --doctor` can warn about those deliberately omitted engines, models, or provider keys.
- Bind-mounted output and runtime directories may require explicit UID/GID handling on Linux hosts, and Docker users must repeat or orchestrate their own `docker run` options for recurring commands.
- Maintainers own a two-architecture registry workflow, tag behavior, cache configuration, provenance output, base-image updates, and direct-download pin alignment.
- Publishing provides provenance but no independent signing policy or custom GHCR retention contract.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Complete local-lite coverage through one Debian package path | A larger base than Alpine |
| Calibre-backed ebook compatibility | Debian package versions instead of macOS-style pinned source builds |
| Normal Linux resolution with no container bypass | Every promised tool must actually be present and healthy |
| Non-root, credential-free image contents | Bind mounts can require host ownership configuration |
| Only native `bun autoshow` and the image entrypoint are project-supported command surfaces | Direct Docker commands are longer and callers must provide their mounts and runtime options |
| Prebuilt `amd64` and `arm64` images on GHCR | Ongoing registry and CI maintenance |
| OCI provenance and source-aligned `yt-dlp` integrity | No separate signature or custom retention program |
| Additive container distribution | Native host setup remains a second maintained path |

## Implementation Note

The image recipe, build-context exclusions, user documentation, and README pointer are implemented in `Dockerfile`, `.dockerignore`, `docs/docker.md`, and `README.md`. The runtime is non-root, the local-lite system packages are installed during the build, the `yt-dlp` download is checksum-pinned, and the Tesseract wrapper preserves English-data resolution when runtime state is mounted.

Publication is implemented in `.github/workflows/docker-publish.yml`, which pushes GHCR manifests for `linux/amd64` and `linux/arm64` on release tags or explicit manual dispatch, with GitHub Actions layer caching and OCI provenance. Local image builds remain supported alongside the published images.

## Test Plan

Run default verification (`bun run check`) and local, no-cost contract validation suites:

```bash
bun run check
bun test test/test-cases/validation/cli/docker-image-contracts.test.ts
```

- `bun test test/test-cases/validation/cli/docker-image-contracts.test.ts` verifies that the Docker `yt-dlp` URL and SHA-256 exactly match native Linux dependency metadata, that download, checksum, and executable installation occur in the safe order, and that `docs/docker.md` documents direct `bun autoshow` and `docker run` commands without reintroducing a project launcher.
- Static review verifies that `Dockerfile` uses the non-root `bun` user, an absolute CLI entrypoint, the declared package set, Tesseract fallback behavior, and no credential copy; `.dockerignore` excludes runtime and secret-bearing paths.
- Static review verifies that `.github/workflows/docker-publish.yml` publishes only from release tags or explicit manual dispatch, targets `linux/amd64` and `linux/arm64`, enables layer caching and provenance, and has only `contents: read` and `packages: write` permissions.
- Repository verification uses `bun run check`, `bun t --price`, and `git diff --check`; no paid or quota-limited provider execution is part of Docker verification.

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
