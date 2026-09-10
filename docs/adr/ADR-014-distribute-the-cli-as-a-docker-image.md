# ADR-014: Distribute the CLI as a Debian Slim Docker Image

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-24
- **Date Updated:** 2026-09-10
- **Verification Status:** Pending

The original image contract passed. Verification remains pending for the native production and compiled-experiment CI artifacts left open by the 2026-08-31 migration evaluation; archiving the local results does not close those reviews.

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

Multi-architecture images (`linux/amd64` and `linux/arm64`) publish to `ghcr.io/ajcwebdev/autoshow-cli` on every push to `main` after both native validation jobs succeed, tagged `latest` and by full commit SHA. The production image runs the TypeScript source entrypoint. The `compiled-experiment` target remains an unpublished measurement target; adoption requires material improvement without asset, path, diagnostic, image-size, or multi-architecture regressions.

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

## Bun 1.4 Migration Evidence

Evaluation date: 2026-08-31. These archived measurements compare Bun 1.3.14 with Bun 1.4.0 and record the source-entrypoint decision. All evaluation commands were local or container-local, with no hosted provider credentials or paid or quota-limited provider calls. The same Docker Desktop host, fixture, repeat counts, execution modes, and measurement definitions were used for the production-image comparison. Native CI results remain distinct from the local evidence below.

### Baseline Provenance

The Bun 1.3 baseline used the exact production base image `oven/bun:1.3.14-slim@sha256:d56a2534ffd262e92c12fd3249d3924d296d97086da773f821d7d0477435ea04` without changing any Bun version surface.

- Git revision: `399df322adfcb37da7337bb693353c6835cb1f1a`; the measured candidate worktree contained the Phase 1 and Phase 2 changes, while the Docker Bun pin and dependency lock remained unchanged.
- Dockerfile SHA-256: `02ef2ea810a375a2ebf34d7ef693c510da00ba5f8f437b9f7e1de70fe28e91e8`.
- `package.json` SHA-256: `d69e25e63a3cea61100a13904e0178a991a34b0c506a171ef5b87a49e0536c9e`.
- `bun.lock` SHA-256: `7e36e75b714e1ae5c1b38181054d2dc1e9e56f14b27667b4cf98fc8d17be94c7`.
- `tsconfig.json` SHA-256: `72ad395500f1370335090ec54da0c9d9181862f103a080ef558921637949f663`.
- Deterministic `src/` tree SHA-256: `48e05cc88bfca2a947a2aa9270aedafe66666f894cf9ac0f2916eac6f2e70697`.
- Fixture: `input/examples/document/30-document.pdf`, 571,633 bytes, SHA-256 `e395620917bd93dc0ca37e23c50f695aac6344542ecad49a6e315778f54b053d`.
- Docker client and server: 29.7.2; Darwin ARM64 client and Linux ARM64 Docker Desktop server.
- Linux transparent huge pages during both container measurements: `[always] madvise never`.

The fixture workload is local Tesseract OCR with `--ocr-concurrency 1`. It receives no provider credentials and makes no hosted provider request.

### Bun 1.3.14 Baseline and Measurement Definitions

**`linux/amd64`**

- **Execution mode:** Docker Desktop emulation
- **Bun:** 1.3.14
- **Image ID:** `sha256:5d2fcc9b66cbe1424b9da59865916a4c0cecc62cba2eef42673b2c08f105d354`
- **Image size:** 615.73 MiB
- **Cold `--help` median:** 2,237.96 ms
- **CLI prebuild median:** 723.56 ms
- **Fixture peak RSS median:** 410.87 MiB

**`linux/arm64`**

- **Execution mode:** Native ARM64 Linux VM
- **Bun:** 1.3.14
- **Image ID:** `sha256:f2d4d1c557af48e6513028b6b6f8d6e7d1aff08de61d38d6ee14f3f037a1ff73`
- **Image size:** 601.51 MiB
- **Cold `--help` median:** 290.71 ms
- **CLI prebuild median:** 77.61 ms
- **Fixture peak RSS median:** 107.90 MiB

Cold help uses five fresh `docker run` processes and host wall time. The AMD64 samples were 2,233.87, 2,272.41, 2,201.87, 2,262.63, and 2,237.96 ms. The ARM64 samples were 295.40, 290.71, 279.60, 286.58, and 303.03 ms.

CLI prebuild uses five fresh containers and measures `bun build /app/src/cli/create-cli.ts --target=bun --outfile /tmp/autoshow-cli-baseline.js` with in-container `performance.now()`. The AMD64 samples were 670.91, 641.05, 723.56, 784.22, and 812.42 ms. The ARM64 samples were 77.61, 81.76, 76.53, 74.34, and 83.68 ms.

Peak RSS uses cgroup v2 `memory.peak` after the local fixture completes in each of three fresh containers. The AMD64 samples were 460,587,008, 430,825,472, and 410,738,688 bytes. The ARM64 samples were 135,864,320, 113,139,712, and 109,428,736 bytes.

AMD64 timing and memory values include emulation overhead and must be compared only with a Bun 1.4 run using the same Docker Desktop execution mode. Native AMD64 release evidence remains a separate release-runner requirement.

### Bun 1.4.0 Native ARM64 Validation

The native ARM64 image built successfully, accepted `bun --no-env-file install --frozen-lockfile --production`, reported Bun 1.4.0, and passed containerized `--help`, `config --show`, and `setup --doctor` smoke commands. Expected doctor warnings cover tools and model assets intentionally excluded from the image; the Bun runtime and included local tools were detected.

**Image size**

- **Bun 1.3.14:** 601.51 MiB
- **Bun 1.4.0:** 599.52 MiB
- **Change:** -0.33%

**Cold `--help` median**

- **Bun 1.3.14:** 290.71 ms
- **Bun 1.4.0:** 256.21 ms
- **Change:** -11.87%

**CLI prebuild median**

- **Bun 1.3.14:** 77.61 ms
- **Bun 1.4.0:** 58.48 ms
- **Change:** -24.65%

**Fixture peak RSS median**

- **Bun 1.3.14:** 107.90 MiB
- **Bun 1.4.0:** 64.15 MiB
- **Change:** -40.55%

The Bun 1.4 image ID was `sha256:8af606cf46c72726726ba4ca6c54872478724bebff0d806e66f4572325c5f667`. Cold-help samples were 274.23, 249.38, 248.40, 269.57, and 256.21 ms. CLI prebuild samples were 58.48, 59.09, 62.24, 57.90, and 56.63 ms. Peak-RSS samples were 68,014,080, 67,264,512, and 66,351,104 bytes.

The native image build took 94,531.15 ms. The corresponding uncached Bun 1.3 native build artifact recorded 92,684.48 ms, a 1.99% increase; this small one-sample build-time difference is not treated as a runtime regression and native CI records a fresh build duration for each architecture.

Raw commands, samples, source hashes, Docker identity, image identity, and logs are retained under the ignored `runtime/profiling/bun-docker-baseline/2026-08-31T22-35-43-273Z/` directory. The preceding final-image build record is under `runtime/profiling/bun-docker-baseline/2026-08-31T22-35-20-971Z/`. Container smoke logs are retained under the ignored `runtime/profiling/bun-docker-smoke/arm64/` directory.

### AMD64 Validation and Release Gates

The AMD64 image built on the same ARM64 Docker Desktop host, but Bun 1.4.0 did not produce `--help` output under QEMU and remained at zero CPU with approximately 38 MiB RSS for more than two minutes. The run was stopped and its build metadata and log were preserved under `runtime/profiling/bun-docker-baseline/2026-08-31T22-20-27-664Z/`. Before that run, executing the architecture-neutral yt-dlp fetch with target-architecture Bun also triggered a Bun memory-exhaustion abort under QEMU; the fetch stage now runs on Docker's native build platform, while the final runtime image remains target-specific.

The Bun 1.3 AMD64 numbers were also emulated and therefore cannot substitute for native release evidence. The publish workflow now performs the frozen production install, help/config/doctor smokes, five cold-help samples, five prebuild samples, three peak-RSS samples with the tracked local setup fixture, and image-size recording on a native Ubuntu AMD64 runner. The ARM64 build job performs the identical checks on a native Ubuntu ARM64 runner. The multi-architecture manifest cannot publish unless both jobs succeed, and each job uploads its logs and measurement JSON for review. The native CI peak-RSS fixture is identical across architectures but is intentionally reported separately from the larger local baseline fixture.

At the evaluation date, native AMD64 evidence remained a release-gate artifact to be produced on the next push; the failed emulated run supplies no native result.

The exact baseline and redacted dotenv reproduction commands are maintained in the [runtime validation guide](../docker.md#runtime-validation). The dotenv compatibility result is archived in [ADR-005](ADR-005-reduce-environment-variable-surface-area.md#bun-14-dotenv-compatibility).

### Compiled Entrypoint Evaluation

The local decision was to reject the compiled entrypoint for production and retain a measured target. Review of both native AMD64 and ARM64 CI artifacts remained open on the evaluation date.

The `compiled-experiment` Docker target builds an ESM bytecode executable with dotenv, bunfig, tsconfig, and package-json autoload disabled, emits JSON and Markdown metafiles, embeds immutable prompt, tokenizer, model, STT configuration, and comic-prompt assets, and keeps writable `input`, `output`, `runtime`, caches, and protected artifacts outside the executable. Standalone execution resolves writable project paths from the executable directory and immutable assets from Bun's embedded virtual filesystem. Model and prompt registries enumerate the embedded file list because virtual asset directories are not ordinary filesystem directories.

The production target remains the source-run image. The final macOS ARM64 experiment bundled 1,020 modules in approximately 0.5 seconds and produced a 92,889,074-byte executable. Because the supported image already contains the Bun runtime, the executable duplicates a large runtime payload.

A local Linux ARM64 Docker measurement completed the compiled target in 87.8 seconds including a cold runtime-tool layer, with the final executable compilation step taking 1.1 seconds. After eliminating physical mirrors of the embedded assets, the source image was 628,645,259 bytes and the compiled image was 668,043,441 bytes, an increase of 39,398,182 bytes. Five fresh-container help samples improved from 342/247/267/263/241 ms for source to 161/178/192/185/182 ms for compiled, and one cgroup peak-memory sample improved from 52,416,512 bytes to 25,800,704 bytes. Help, `config --show`, `setup --doctor`, and a local `write --price` path that exercises prompt discovery and the embedded tokenizer all passed in the compiled container. The faster startup and lower help memory do not satisfy the adoption gate because image size regressed and immutable assets require a second packaging path, so the evidence-backed decision is reject.

Both native Linux Docker jobs are configured to build the experimental target without publishing it, run help, configuration, setup-doctor, and a no-cost `write --price` standalone path contract, and record build duration, cold-help samples, help peak RSS, compiled image size, and source image size in `compiled-entrypoint-experiment.json`. The `write --price` contract reads a mounted repository fixture and must resolve the embedded prompt registry and tokenizer ranks without creating output or contacting a provider. Native job logs remain required evidence rather than inferred results. The recorded decision is reject unless future measurements show a material improvement without asset, path, diagnostic, image-size, or multi-architecture regressions.

### Bundle Inventory Supporting the Packaging Decision

The initial macOS ARM64 Bun 1.4.0 capture is recorded under ignored `runtime/profiling/bun-runtime/2026-08-31T22-45-35-532Z-all/`. The test CLI bundle completed in 55.07 ms and produced 4,908,694 bytes before any compiled-entrypoint optimization.

The bundle inventory found 38 prompt JSON files totaling 84,549 bytes, the 1,689,761-byte compressed tokenizer rank asset, seven dynamic-import edges, and the current `import.meta.dir` source-layout references. The largest source input was Valibot at 206,613 bytes; the largest AutoShow source input was comic revision evaluation at 54,721 bytes. These are inventory measurements, not automatic candidates for removal.

The [profiling guide](../commands/testing.md#profiling) maintains bundle capture and before/after comparison instructions. Generated CPU and heap profiles, bundle metafiles, logs, and probe bundles remain ignored diagnostic artifacts; this ADR retains the measurements and rationale needed to reassess the packaging decision.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/cli/docker-image-contracts.test.ts
```

1. Typecheck and unique source check pass.
2. Image `yt-dlp` URL and SHA-256 match native Linux metadata, and documentation shows direct `docker run`.

## Follow-up Actions

- [ ] Review native Bun 1.4 production-image evidence for AMD64 and ARM64 — Pending
  The archived local ARM64 run passed, while native AMD64 release evidence was still required. Review the native jobs' frozen-install, help/config/doctor, image-size, five cold-help, five prebuild, and three local-fixture peak-RSS artifacts before closing migration verification.
- [ ] Review both native compiled-entrypoint experiment artifacts — Pending
  Review each architecture's `compiled-entrypoint-experiment.json`, standalone no-cost `write --price` contract, and logs. Keep the production source entrypoint unless measured gains satisfy the asset, path, diagnostic, image-size, and multi-architecture acceptance gates.

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
- `scripts/docker-bun-baseline.ts`
- `scripts/bun-profile.ts`
- [Runtime validation guide](../docker.md#runtime-validation)
- [Profiling guide](../commands/testing.md#profiling)
