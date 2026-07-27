# ADR-004: Provision the Local-Lite Toolchain Through Managed Runtimes and a Container Image

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-07-24
- **Verification Status:** Passed
- **Supersession:** Consolidates the separate Docker distribution record, "Docker Image Trade Study for CLI Distribution", merged here on 2026-07-24.

## Context

AutoShow promises one "local-lite" tool set — FFmpeg and `ffprobe`, `yt-dlp`, MuPDF `mutool`, `qpdf`, Calibre `ebook-convert`, Tesseract with English trained data, and OCRmyPDF — and has to provision it in three environments: a macOS host, a Linux host, and a container. All three are governed by one contract, the resolver precedence in `resolveRuntimeToolInfo` (`src/utils/runtime-paths.ts`): an explicit `--bin-dir`/`AUTOSHOW_BIN_DIR` or per-tool override first, then an AutoShow-managed artifact under `runtime/`, then `PATH` for tools AutoShow does not own. The provisioning decision for each environment is which of those three tiers supplies the tools.

Host provisioning. The local dependency report showed macOS setup still using Homebrew for several tools while most AutoShow-managed local dependencies already lived under `runtime/`. That mixed model made setup behavior less reproducible: managed binaries, Python environments, and models are cacheable project artifacts, but Homebrew installs mutate global machine state and can vary by host, tap state, bottle availability, and the user's existing package manager configuration. The macOS Homebrew-managed setup paths covered FFmpeg and `ffprobe`, `yt-dlp`, MuPDF `mutool`, Calibre `ebook-convert`, Tesseract and English language data, and OCRmyPDF. Host build prerequisites such as Apple/Xcode tooling, command line developer tools, `cmake`, and compiler/runtime components remain explicit external prerequisites, not AutoShow-installed dependencies. Linux hosts continue to use `apt`.

Container provisioning. `autoshow-cli` is a Bun-native CLI whose largest onboarding cost is exactly that host setup: `bun autoshow setup` either source-builds tools on macOS or `sudo apt`-installs them on Linux, may download binaries, and optionally fetches multi-GB model weights. A new user must run this flow before the CLI is usable, and the result varies with host OS, installed compilers, package-manager state, and available system packages. The CLI runs TypeScript directly via Bun (`autoshow` is `bun src/cli/create-cli.ts`) with no compile/bundle step, no `.output`, no `bin` field, and no HTTP server; it runs to completion and exits, and its only "health" surface is the offline `bun autoshow setup --doctor` check (`src/cli/commands/setup-and-utilities/setup/run-doctor.ts`). There was no `Dockerfile`, `.dockerignore`, Docker documentation, or Docker CI in the repo. [ADR-005](ADR-005-reduce-environment-variable-surface-area.md) removed the `DOCKER_CONTAINER` skip-guard, so Linux now always runs install/health paths: an image must bake the tools it promises or explicitly document omitted tools as unsupported. Because the Linux resolver already falls back to `PATH` via `Bun.which`, tools installed into a standard location such as `/usr/bin` are found with no production code change.

Container base image observations. Local checks of the available arm64 Bun base images found:

- `oven/bun:1.3.14-alpine` is Alpine 3.22. It can install `ffmpeg`, `tesseract-ocr`, `tesseract-ocr-data-eng`, `mupdf-tools`, `qpdf`, `python3`, `ca-certificates`, and `curl` from `apk`, but it cannot install `calibre` from `apk`.
- The `yt-dlp` zipapp runs under Alpine `python3`.
- Alpine installs English Tesseract data at `/usr/share/tessdata/eng.traineddata`.
- `oven/bun:1.3.14-slim` and `oven/bun:1.3.14` are Debian GNU/Linux 13 (trixie). Both can install the full local-lite package set with `apt`, including `calibre` for `ebook-convert` and `tesseract-ocr-eng` for English Tesseract data.

Locally observed arm64 base image sizes, before any AutoShow packages are added:

| Base image | Distro | Docker disk usage | Content size |
|---|---|---:|---:|
| `oven/bun:1.3.14-alpine` | Alpine 3.22 | 146 MB | 43.7 MB |
| `oven/bun:1.3.14-slim` | Debian 13 slim | 269 MB | 67.6 MB |
| `oven/bun:1.3.14` | Debian 13 | 335 MB | 87.1 MB |

These are local base-image observations only. They are not final built image sizes, because the final image size depends on the selected package set, package manager cache cleanup, `node_modules`, and any copied project files.

Why now: the mixed Homebrew/runtime model blocked reproducible, project-managed macOS installs and consistent `setup --doctor` reporting, and users needed a reproducible CLI distribution that avoids host setup entirely while still supporting the complete local-lite tool set. Both are implemented, and both are answers to the same provisioning question, so they belong in one record.

## Options Considered

### Host Dependency Source

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| Keep Homebrew on macOS | Lowest implementation cost; continues using familiar package names; preserves current installer branches | Keeps global package-manager mutation; remains dependent on user Homebrew state; preserves platform drift from existing `runtime/` patterns | No migration work; keeps six active Homebrew-managed install paths |
| **Runtime-managed macOS dependencies** | Aligns macOS with existing managed runtime patterns; supports version pinning, checksums, provenance metadata, and cacheable installs; avoids global package-manager mutation | Requires direct download, build, or runtime install flows for each affected tool; needs architecture and license review | Chosen. Removes six active Homebrew-managed install paths: FFmpeg/ffprobe, `yt-dlp`, `mutool`, `ebook-convert`, Tesseract, and OCRmyPDF |
| Manual user-installed dependencies | Simplest code; avoids maintaining binary download logic | Worse onboarding; weakens `setup` and `setup --doctor`; makes local runs less self-contained and harder to reproduce | Would turn setup into guidance for these tools instead of installation |
| Container-only or package-manager-only setup | Reproducible in CI and scripted environments; can centralize dependency versions outside the CLI | Poor native macOS developer experience; shifts local setup burden to Docker or external package-manager policy; does not fit current local-first workflow | Useful for CI, but too narrow as the main native macOS setup story |

The rejected "container-only or package-manager-only setup" row is not a rejection of containers — it is a rejection of containers as the *only* provisioning story. The image selected below is additive to host setup, and the second table chooses its base.

### Container Base Image

For this decision, "full local-lite" in an image means `ffmpeg` and `ffprobe`, `yt-dlp`, Tesseract OCR with English trained data, MuPDF `mutool`, `qpdf`, Calibre `ebook-convert`, and the support packages needed to fetch and run those tools, such as `python3`, `ca-certificates`, and `curl`.

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Debian slim full local-lite (`oven/bun:1.3.14-slim`)** | Covers hosted workflows, local audio/video helpers, OCR, PDF/document tools, and Calibre through one `apt` path | Larger and less Alpine-aligned than the smallest option | 269 MB disk usage / 67.6 MB content size before project packages |
| Alpine without Calibre (`oven/bun:1.3.14-alpine`) | Smallest base; highest fidelity to the original Alpine goal; `apk` covers most local-lite tools | Cannot provide Calibre-backed ebook conversion and therefore narrows supported functionality | 146 MB disk usage / 43.7 MB content size before project packages |
| Full Bun Debian full local-lite (`oven/bun:1.3.14`) | Provides the same complete local-lite coverage through one `apt` path | Largest base with no identified functionality gain over Debian slim | 335 MB disk usage / 87.1 MB content size before project packages |

## Decision

AutoShow provisions the local-lite toolchain from project-owned sources in every environment: managed `runtime/` artifacts on a macOS host, `apt` on a Linux host, and baked-in `apt` packages in the distribution image. Nothing resolves through a global package manager AutoShow does not control, and nothing resolves implicitly through `PATH` on macOS.

Host provisioning. macOS setup must not invoke Homebrew for AutoShow-installed local dependencies. Affected tools are installed, resolved, and reported as project-local managed runtime dependencies under `runtime/`, following the existing patterns used for managed `uv`/`uvx`, whisper.cpp, llama.cpp, Defuddle, Python environments, and local model assets. Resolver precedence is:

1. Explicit user override where the tool supports one, such as an environment variable or config setting.
2. AutoShow-managed runtime binary, environment, or shim under `runtime/`.
3. `PATH` only for external prerequisites that AutoShow does not own, such as Xcode tooling, `cmake`, compilers, and optional host utilities.

This requires no CLI command-shape change. Existing setup entry points, including `bun autoshow setup`, `bun autoshow setup --step yt-dlp`, `bun autoshow setup --step calibre`, and `bun autoshow setup --doctor`, keep their current public shape while their macOS dependency source changes underneath.

Container provisioning. The distribution image adopts the Debian slim full local-lite option using `ARG BUN_BASE_IMAGE=oven/bun:1.3.14-slim`. The implementation adds an in-repo multi-stage `Dockerfile`; a `.dockerignore` that excludes host runtime artifacts, inputs, outputs, credentials, tests, and docs from the build context; `docs/docker.md` with build/run, bind mount, env-file, runtime cache, and ownership guidance; and a README pointer to the Docker documentation. The image installs the full local-lite package set at build time with `apt` — `ffmpeg`, `tesseract-ocr`, `tesseract-ocr-eng`, `mupdf-tools`, `qpdf`, `calibre`, `python3`, `ca-certificates`, and `curl` — and downloads the `yt-dlp` zipapp from GitHub releases into `/usr/local/bin`. It runs as the non-root `bun` user supplied by the official Bun base image and uses a plain `ENTRYPOINT ["bun", "src/cli/create-cli.ts"]`.

This applies to:

- AutoShow-installed, runtime-managed dependencies on macOS.
- The Debian slim, full local-lite CLI image and its bundled system tools.
- No user-managed tools, host build prerequisites, Linux host package management, or other platform setup behavior.
- No registry publishing, Docker CI, heavyweight local engines, model weights, Defuddle, or provider credentials in the image.

## Implementation Note

Host. Implemented on 2026-06-12. macOS setup resolves AutoShow-owned local tools through explicit override environment variables first, then managed artifacts under `runtime/`, without implicit `PATH` fallback. The managed macOS set covers FFmpeg/ffprobe, `yt-dlp`, MuPDF `mutool`, Calibre `ebook-convert`, Tesseract with `eng.traineddata`, and OCRmyPDF with managed Ghostscript/qpdf support. Every managed macOS download path is pinned with a SHA-256 checksum in the dependency metadata defaults or `config/deps.json` overrides.

Container. Debian installs Tesseract language data under `/usr/share/tesseract-ocr/5/tessdata`, while AutoShow's local OCR code passes a project-local `TESSDATA_PREFIX` under `runtime/tools/tessdata`. The Docker image therefore creates `/app/runtime/tools/tessdata` as a symlink to the Debian data directory and adds a small `/usr/local/bin/tesseract` wrapper that falls back to the Debian data directory when a bind-mounted `runtime/` hides the symlink.

## Rationale

Host provisioning:

- The project already treats many local capabilities as managed runtime assets: `runtime/bin/uv`, `runtime/bin/uvx`, `runtime/bin/whisper-cli`, `runtime/bin/llama-server`, `runtime/defuddle/`, Python environments under `runtime/bin/`, and model assets under `runtime/models/`. Keeping macOS media, document, and OCR tools on Homebrew was the outlier.
- Runtime-managed macOS dependencies improve reproducibility because setup can pin versions, validate checksums, record provenance, and reuse cached artifacts. They also avoid mutating global system package state, which matters for developer machines and CI agents that may already have unrelated Homebrew installations.
- Using the same dependency-management model across local tools reduces platform drift. A setup or doctor report can explain whether AutoShow is using a user override, a managed runtime artifact, or an external prerequisite instead of implicitly relying on whatever Homebrew installed globally.
- The target pattern already existed in the codebase: on Linux, setup downloads the official `yt-dlp` release binary directly to `ytDlpManagedBinaryPath` instead of using a system package manager (`src/cli/commands/setup-and-utilities/setup/setup-download/dl-audio/audio.ts`). The macOS migration for `yt-dlp` was therefore reuse of an existing flow rather than new work, which lowered the cost of the first migration step.

Container provisioning:

- Full local-lite and Alpine are in tension. Alpine 3.22 can cover OCR, media helpers, MuPDF, `qpdf`, and `yt-dlp`, but not Calibre `ebook-convert`. Treating Alpine as full local-lite would produce an image whose documented behavior diverges from its package reality.
- Debian slim is the smallest observed base that can install the complete local-lite package set through one package manager. It is larger than Alpine before AutoShow packages are added, but it avoids a Calibre gap.
- The full Bun Debian image offers the same `apt` package availability as slim with a larger starting point. It may be useful if maintainers prefer the less-minimal official Bun base, but the size tradeoff should be chosen deliberately.
- The existing Linux `PATH` fallback means all three options can use system package locations without production code changes, provided every promised runtime tool is installed during image build.
- Because ADR-005 removed Docker-specific setup skips, omitted tools are not a cosmetic issue. A container that leaves out Calibre must document that Calibre-dependent setup/doctor checks and ebook workflows are outside its supported scope.

## Consequences

Positive outcomes:

- macOS setup no longer mutates global Homebrew state for AutoShow-owned tools.
- Local dependency versions can be pinned, verified, and cached with project artifacts.
- `setup --doctor` reports managed runtime sources consistently.
- macOS dependency management aligns with existing managed uv, whisper.cpp, llama.cpp, Defuddle, Python environment, and model-asset patterns.
- CI and developer setup become less sensitive to machine-local package manager state.
- The first Docker image covers the complete local-lite package set, including Calibre-backed convertible ebook workflows.
- Users can build and run the CLI without installing Bun or local-lite tools on the host.
- The image reuses the existing Linux `PATH` fallback and needs no production code changes.
- The locally observed base sizes are framed as base-image inputs to the decision, not as promises about final build size.

Negative outcomes:

- Setup maintainers must own more dependency-specific install and update logic.
- Some tools may need separate arm64 and x64 artifact handling.
- License, checksum, provenance, notarization, and quarantine behavior need explicit review per dependency.
- OCRmyPDF and Tesseract may require more careful runtime packaging than single static binaries.
- Calibre was installed as a Homebrew cask, meaning a GUI app bundle rather than a CLI formula; replacing it required sourcing `ebook-convert` from the official Calibre app distribution, which is materially harder than swapping in a static binary.
- Existing users with working Homebrew installs may see a one-time runtime download or build cost.
- The image starts from a larger base than the original Alpine goal.
- The image uses Debian package versions rather than AutoShow's macOS SHA-pinned managed source builds.
- Heavyweight local engines, model weights, Defuddle, provider credentials, registry publishing, and Docker CI remain out of scope.
- Host bind-mounted `output/` and `runtime/` directories may need writable ownership or a `--user "$(id -u):$(id -g)"` run option on Linux hosts.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Reproducible macOS setup with pinned versions, checksum validation, and provenance metadata | The project owns install and update logic for six tools previously maintained by Homebrew |
| No mutation of global Homebrew state for AutoShow-owned tools | AutoShow must handle arm64/x64 artifacts, licenses, notarization, and quarantine behavior |
| Uniform resolver and doctor reporting across managed local dependencies | Calibre, OCRmyPDF, and Tesseract require more involved packaging |
| Cacheable project-local artifacts across developer machines and CI | Existing users may incur a one-time managed-runtime download or build |
| Debian slim provides complete local-lite packages through one `apt` path | The base is larger than Alpine and less faithful to the original small-image goal |
| Calibre-backed ebook workflows match the documented local-lite capability | The image inherits Debian package versions instead of macOS-style pinned source builds |
| Existing Linux `PATH` resolution works without production code changes | Host bind mounts may require explicit ownership handling |

## Keep (with rationale)

- The host `bun autoshow setup` path remains the supported route for macOS and for heavy local engines such as whisper.cpp, llama.cpp, Reverb, and Kitten TTS. The Docker image is additive, not a replacement for host setup — this is the seam that keeps both halves of this record coherent.
- Heavy local engines and model weights remain out of scope for the first end-user image. They would materially change build time, image size, and update policy.
- A run-to-completion CLI image still should not expose ports, define an HTTP `HEALTHCHECK`, or add web-app build arguments. Those sibling-image conventions do not apply to this CLI.

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Choose one image strategy: Debian slim full local-lite, Alpine without Calibre, or full Bun Debian full local-lite | Maintainers | Done: Debian slim full local-lite |
| After the strategy is chosen, add a scoped Docker implementation for that option only | Setup/runtime maintainers | Done |
| Define the exact supported `setup --doctor` expectations for the selected image, especially if Calibre is omitted | Setup/runtime maintainers | Done in `docs/docker.md` |
| Add Docker user docs covering build/run, bind mounts for `input/`, `output/`, optional `runtime/`, `--env-file .env`, and any `--user`/volume ownership notes | Docs | Done in `docs/docker.md` |
| Decide later whether to publish to a registry and add CI | Maintainers | Deferred |

## Test Plan

- Run `bun run check`.
- Run targeted no-cost setup tests such as `bun test test/test-cases/validation/setup/`.
- Do not run provider, service, end-to-end, benchmark, or paid/quota-risk commands.

## Assumptions

- The status is `Accepted` and implemented (see the Implementation Note); macOS setup no longer invokes Homebrew for AutoShow-owned tools (verified: zero `brew` references remain in `src`).
- The retired local dependency inventory report is historical context; the implementation paths below are the current source of truth.

## References

- Related ADR: [ADR-005](ADR-005-reduce-environment-variable-surface-area.md)
- Runtime tool resolution: `src/utils/runtime-paths.ts`
- Current macOS FFmpeg and yt-dlp setup: `src/cli/commands/setup-and-utilities/setup/setup-download/dl-audio/audio.ts`
- Current macOS MuPDF setup: `src/cli/commands/setup-and-utilities/setup/setup-download/dl-document/document.ts`
- Current macOS Calibre setup: `src/cli/commands/setup-and-utilities/setup/setup-download/dl-document/calibre.ts`
- Current macOS Tesseract setup: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-local/tesseract-setup.ts`
- Current macOS OCRmyPDF setup: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-local/ocrmypdf/ocrmypdf.ts`
- Doctor check: `src/cli/commands/setup-and-utilities/setup/run-doctor.ts`
- Dependency metadata and checksum pinning: `src/cli/commands/setup-and-utilities/setup/dependency-metadata.ts`
- Docker user documentation: `docs/docker.md`
- Dependency inventory report: `docs/report/deps-report.md`
- Verification rule: `bun run check`
- `bunfig.toml`
