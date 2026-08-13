# ADR-004: Provision the Local-Lite Toolchain Through Managed Runtimes and a Container Image

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-08-13
- **Verification Status:** Pending
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

Prebuilt distribution evidence. [ADR-015](ADR-015-make-setup-downloads-resumable-and-setup-reporting-truthful.md) measured a 175.181s ungated cold median on arm64 macOS. MuPDF and qpdf compile/link medians total 87.673s, or 50.0% of that run, while serializing CPU-heavy build leaves improved the median by only 3.1% and missed the predeclared 10% threshold. The exact upstream MuPDF 1.27.2 release exposes source archives only, and the exact qpdf 12.3.2 release exposes source, Linux, and Windows assets but no macOS binaries, so an upstream-prebuilt option does not exist for either pinned tool. The public AutoShow repository had no Actions workflows and no releases when this decision was evaluated.

A local arm64 audit also found that the current qpdf source build is not a distributable fallback as built on the measured host: its `libqpdf` has absolute dynamic references to Homebrew `libjpeg` and OpenSSL. A no-cost proof build corrected that by pinning libjpeg-turbo 3.2.0 (`sha256:6f30092cef9fb839779646608f4ee14ae3cbac989c47fa05e841b0841f09878e`), statically linking qpdf and libjpeg, selecting qpdf's native crypto provider, and setting a macOS 15.0 deployment target. The resulting 3.8 MB arm64 `qpdf` linked only `/usr/lib/libz.1.dylib`, `/usr/lib/libc++.1.dylib`, and `/usr/lib/libSystem.B.dylib`; version, PDF validation, AES-256 encryption, and linearization checks passed. The existing 40 MB arm64 `mutool` likewise links only `/usr/lib/libSystem.B.dylib`. Unsigned proof ZIPs were 1.2 MB for qpdf and 29 MB for MuPDF, small enough that release storage is not a limiting force. This proves the portable qpdf recipe on one architecture; it does not substitute for the accepted two-architecture CI, signing, notarization, or clean-host verification gates below.

Why now: the original mixed Homebrew/runtime model and missing container distribution were already resolved, but ADR-015 has now completed the measurement gate for the remaining dominant macOS setup cost. The project therefore needs to choose and constrain build versus distribution before any release URL enters setup metadata.

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

### macOS MuPDF and qpdf Delivery

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| Keep source builds as the only path | No binary-publishing, signing, hosting, or redistribution program | Retains the dominant measured cold cost and the current qpdf build's accidental Homebrew linkage unless separately repaired | MuPDF + qpdf compile/link medians: 87.673s, 50.0% of the 175.181s cold median |
| Use upstream macOS prebuilts | Upstream would own production, signing, and release lifecycle | Rejected because neither pinned upstream release publishes a macOS CLI asset | MuPDF 1.27.2: 2 source assets only; qpdf 12.3.2: 0 macOS assets |
| Use Homebrew bottles or another third-party binary feed | Existing multi-architecture packaging infrastructure | Reintroduces a mutable package-manager dependency, weakens exact project pinning, and reverses the accepted no-Homebrew boundary | At least 2 external package recipes plus transitive bottle availability |
| **Produce thin, pinned, signed and notarized AutoShow prebuilts with a source fallback** | Removes the measured compile path on eligible hosts; preserves exact version and checksum ownership; supports offline doctor provenance; keeps unsupported or unavailable cases functional | Adds producer CI, release, signing, notarization, license, retention, and incident-response obligations | 2 tools × 2 architectures = 4 executable archives; promotion requires at least 10% full cold-median improvement |

## Decision

AutoShow provisions the local-lite toolchain from project-owned sources in every environment: managed `runtime/` artifacts on a macOS host, `apt` on a Linux host, and baked-in `apt` packages in the distribution image. Nothing resolves through a global package manager AutoShow does not control, and nothing resolves implicitly through `PATH` on macOS.

Host provisioning. macOS setup must not invoke Homebrew for AutoShow-installed local dependencies. Affected tools are installed, resolved, and reported as project-local managed runtime dependencies under `runtime/`, following the existing patterns used for managed `uv`/`uvx`, whisper.cpp, llama.cpp, Defuddle, Python environments, and local model assets. Resolver precedence is:

1. Explicit user override where the tool supports one, such as an environment variable or config setting.
2. AutoShow-managed runtime binary, environment, or shim under `runtime/`.
3. `PATH` only for external prerequisites that AutoShow does not own, such as Xcode tooling, `cmake`, compilers, and optional host utilities.

This requires no CLI command-shape change. Existing setup entry points, including `bun autoshow setup`, `bun autoshow setup --step yt-dlp`, `bun autoshow setup --step calibre`, and `bun autoshow setup --doctor`, keep their current public shape while their macOS dependency source changes underneath.

macOS MuPDF/qpdf delivery. AutoShow will produce separate thin `arm64` and `x64` MuPDF and qpdf archives and prefer an exact verified prebuilt on macOS 15 or later. Each tool remains independently eligible and independently falls back to a project-owned build from its existing pinned source when the host is older, the architecture is unsupported, metadata has no matching asset, or an otherwise valid release asset is unavailable after normal download retries. A checksum, embedded-manifest, version, architecture, code-signature, or file-integrity mismatch is a hard failure: setup deletes staging and reports the violated invariant instead of hiding a possible publishing or tampering incident behind a source build.

The source fallback and producer CI use the same tool feature and linkage recipe. MuPDF retains its current release build flags. qpdf becomes a static CLI build with qpdf's native crypto provider and a pinned static libjpeg-turbo input; neither result may contain a non-system absolute dynamic-library path. Producer artifacts fix the deployment target at macOS 15.0, while a source fallback records and uses a target compatible with the host that is compiling it. Archives are extracted to staging, verified, health-checked, and atomically promoted under `runtime/tools`; the existing `runtime/bin` resolver shims remain the public managed paths. Explicit `--bin-dir` tools retain precedence and are not required to carry AutoShow provenance.

Container provisioning. The distribution image adopts the Debian slim full local-lite option using `ARG BUN_BASE_IMAGE=oven/bun:1.3.14-slim`. The implementation adds an in-repo multi-stage `Dockerfile`; a `.dockerignore` that excludes host runtime artifacts, inputs, outputs, credentials, tests, and docs from the build context; `docs/docker.md` with build/run, bind mount, env-file, runtime cache, and ownership guidance; and a README pointer to the Docker documentation. The image installs the full local-lite package set at build time with `apt` — `ffmpeg`, `tesseract-ocr`, `tesseract-ocr-eng`, `mupdf-tools`, `qpdf`, `calibre`, `python3`, `ca-certificates`, and `curl` — and downloads the `yt-dlp` zipapp from GitHub releases into `/usr/local/bin`. It runs as the non-root `bun` user supplied by the official Bun base image and uses a plain `ENTRYPOINT ["bun", "src/cli/create-cli.ts"]`.

This applies to:

- AutoShow-installed, runtime-managed dependencies on macOS.
- Pinned MuPDF and qpdf prebuilts for macOS 15+ on `arm64` and `x64`, plus the source-build fallback for every ineligible or unavailable case.
- The Debian slim, full local-lite CLI image and its bundled system tools.
- No user-managed tools, host build prerequisites, Linux host package management, or other platform setup behavior; FFmpeg is not included in the first prebuilt scope.
- No registry publishing, Docker CI, heavyweight local engines, model weights, Defuddle, or provider credentials in the image.

## Implementation Note

Host. Implemented on 2026-06-12. macOS setup resolves AutoShow-owned local tools through explicit override environment variables first, then managed artifacts under `runtime/`, without implicit `PATH` fallback. The managed macOS set covers FFmpeg/ffprobe, `yt-dlp`, MuPDF `mutool`, Calibre `ebook-convert`, Tesseract with `eng.traineddata`, and OCRmyPDF with managed Ghostscript/qpdf support. Every managed macOS download path is pinned with a SHA-256 checksum in the dependency metadata defaults or `config/deps.json` overrides.

Container. Debian installs Tesseract language data under `/usr/share/tesseract-ocr/5/tessdata`, while AutoShow's local OCR code passes a project-local `TESSDATA_PREFIX` under `runtime/tools/tessdata`. The Docker image therefore creates `/app/runtime/tools/tessdata` as a symlink to the Debian data directory and adds a small `/usr/local/bin/tesseract` wrapper that falls back to the Debian data directory when a bind-mounted `runtime/` hides the symlink.

Prebuilt decision. Accepted on 2026-08-13; Phases 1 through 3 are complete, the Phase 4 implementation is locally verified but awaits its required ordinary pull-request matrix evidence, and Phases 5–9 remain pending. The repository now has a dormant fixture-injected prebuilt consumer and an unprivileged unsigned producer workflow, but it still has no retained passing two-architecture run, immutable tool release, configured candidate, prebuilt URL, or prebuilt checksum pin. Source builds remain the only active macOS path until every promotion gate in this record passes. This sequencing is deliberate: implementing the producer and consumer contracts does not certify or activate an artifact that has not yet passed the recorded remote gates.

Phase 1. Completed on 2026-08-13. Dependency metadata now pins libjpeg-turbo 3.2.0 to its exact release URL and SHA-256 alongside qpdf 12.3.2. The shared source recipe builds only static libjpeg, configures qpdf with shared libraries and implicit crypto disabled, requires and selects qpdf's native crypto provider, supplies only the pinned libjpeg include/library/package paths, builds the static qpdf CLI target, and rejects every dynamic-library reference outside Apple system paths or packaged loader/rpath paths before accepting the install. A recipe stamp makes normal setup replace the prior launchable-but-unhermetic qpdf tree once and reuse the portable result thereafter; the download flows, checksum validation, retry budgets, cached-source behavior, phase reporting, and source-only production selection remain in place.

The Phase 1 production-path verification ran on arm64 macOS 26.5.2 with AppleClang 21.0.0 and CMake 4.3.2. `bun autoshow setup --step calibre` downloaded and verified the exact qpdf/libjpeg-turbo pins, produced qpdf 12.3.2 as a thin arm64 Mach-O with a host-compatible macOS 26.0 deployment target, and installed a runtime tree containing only the build stamp and static `bin/qpdf`. `otool -L` reported only `/usr/lib/libz.1.dylib`, `/usr/lib/libc++.1.dylib`, and `/usr/lib/libSystem.B.dylib`. The installed managed path passed PDF validation, AES-256 encrypt/check/decrypt, linearization, and linearization validation against the pinned qpdf 12.3.2 fixture; a second normal setup reused it without a compile phase. No prebuilt metadata, URL, consumer, workflow, release, manifest schema, or doctor behavior was added.

Phase 2. Completed on 2026-08-13. MuPDF and qpdf source installs now share a closed `.autoshow-managed-artifact.json` schema at version 1. Each manifest records `distribution: source`, the exact tool version, Darwin platform, architecture, source-build deployment target, dependency versions/URLs/SHA-256 values, shared recipe flags, and the relative installed executable with its SHA-256. Health validation rejects missing or unknown schema fields, a wrong tool/version/platform/architecture, a deployment target newer than the host, source-pin or recipe drift, an unexpected payload inventory, and payload corruption. The setup guards require both valid provenance and an exact version launch before reusing a managed source tree; explicit `--bin-dir` overrides retain precedence and do not inherit an AutoShow provenance claim. Offline doctor applies the same manifest and payload validation before launch and reports `managed source <version> <platform>/<arch>` for healthy source installs.

Both source installers now build without mutating the working tool directory, assemble the runtime payload and manifest in a unique sibling staging directory, validate the staged binary, rename the prior directory to a unique backup, atomically rename staging into the stable tool path, activate the stable managed shim, validate again, and remove the backup only after success. A staging, activation, or post-promotion validation failure removes the candidate and restores the prior directory; shim replacement also uses a temporary sibling plus atomic rename. Interrupted staging trees are outside resolver and doctor paths. qpdf retains the Phase 1 static-libjpeg/native-crypto/linkage recipe, and MuPDF uses its release/no-X11/no-GLUT/no-objcopy recipe with host libcrypto discovery disabled while both record and use the host-compatible deployment target.

The Phase 2 production-path verification ran on the same arm64 macOS 26.5.2 host. Normal setup identified both pre-schema installations as unhealthy, rebuilt MuPDF 1.27.2 and qpdf 12.3.2, validated them from staging, and promoted manifests recording arm64 Darwin with a macOS 26.0 deployment target. The installed MuPDF payload hash is valid and `otool -L` reports only `/usr/lib/libSystem.B.dylib`; qpdf's payload hash is valid and its dynamic closure remains `/usr/lib/libz.1.dylib`, `/usr/lib/libc++.1.dylib`, and `/usr/lib/libSystem.B.dylib`. Both managed paths pass exact version launch checks, offline doctor reports `managed source 1.27.2 darwin/arm64` and `managed source 12.3.2 darwin/arm64`, no staging or backup directory remains, and a second `bun autoshow setup --step calibre` completed in 0.16s without compiling either tool. No prebuilt type, candidate injection, archive consumer, production URL, workflow, or release behavior was added.

Phase 3. Completed on 2026-08-13. The managed-artifact type and closed version 1 schema now cover both `distribution: source` and `distribution: prebuilt`, with separate closed embedded-payload and release-manifest parsers. A typed prebuilt candidate binds the exact tool/version/revision/platform/architecture/minimum macOS identity, canonical archive name, immutable URL, archive and release-manifest SHA-256 values, signing identity, and Team ID. Candidates can enter only through typed function parameters used by tests; production dependency metadata, setup flags, environment variables, and default URL resolution contain no candidate surface.

The dormant consumer makes an independent per-tool eligibility decision for Darwin macOS 15 or later on `arm64` or `x64`, preserves a healthy explicit override, and classifies failures as either availability or trust. Unsupported hosts, an absent candidate, clean-host minimum-OS incompatibility, and download unavailability after the three-attempt setup retry policy produce a visible source-fallback warning. Archive checksum, release or payload schema/identity, source pin, recipe, package inventory, payload hash, actual thin Mach-O architecture, signing identity, Team ID, accepted-notarization metadata, exact version launch, and post-promotion integrity failures are trust failures and stop without source fallback.

Candidate ZIPs download to a unique sibling work tree, are listed before extraction to reject absolute, traversal, duplicate, alternate-root, link, and special-file entries, and must contain one exact top-level tool directory. The consumer validates the embedded manifest and complete file inventory, hashes every package file, checks the executable with `lipo` and strict `codesign`, performs an exact version health check, writes merged `distribution: prebuilt` provenance, and uses the Phase 2 atomic promotion/rollback primitive. It never extracts over the working install; staging, activation, or stable-path validation failure restores the prior directory. Offline doctor uses the distribution-neutral validator, refuses a prebuilt without explicitly supplied pinned candidate metadata, applies the same file/architecture/signature/Team-ID/notarization checks without network access, and truthfully reports `managed prebuilt <version>-<revision> <platform>/<arch>` while retaining the source and override labels.

Phase 3 verification used typed local fixtures only. The focused setup matrix passed 112 tests with 0 failures and covered eligible MuPDF/qpdf behavior, closed schemas, the intentionally absent production candidate, unsupported OS/architecture, absent metadata, exhausted availability, independent per-tool fallback, every specified checksum/manifest/payload/version/architecture/signature/Team-ID/notary trust failure, traversal, prior-install preservation, activation and staged-health rollback, source/prebuilt doctor labels, corrupt provenance, wrong launched version, and override precedence. The real arm64 production path remained source-only: offline doctor still reported `managed source 1.27.2 darwin/arm64` and `managed source 12.3.2 darwin/arm64`, and `bun autoshow setup --step calibre` completed in 0.25s without a prebuilt lookup or source compile.

Phase 4 implementation. Implemented and locally verified on 2026-08-13; formal phase completion remains pending the required ordinary pull-request run on both architectures. The new `macOS Toolchain Unsigned Verification` workflow has a fixed `macos-15` arm64 and `macos-15-intel` x64 matrix, top-level `contents: read` permission, credential persistence disabled, full-commit-SHA pins for every action, no `pull_request_target`, secret, signing, notarization, attestation, publication, or release step, and separate build and clean-install jobs. Its producer downloads and hashes the exact existing MuPDF, qpdf, and libjpeg-turbo source pins, uses the shared build flags with `MACOSX_DEPLOYMENT_TARGET=15.0`, records the producer commit/run/runner/toolchain, runs available upstream checks and the repository PDF fixture, rejects a wrong thin architecture, deployment target, dynamic linkage, Developer ID identity, build path, or credential shape, and emits per-tool ZIPs, closed payload and verification manifests, SPDX 2.3 JSON, and `SHA256SUMS`.

Unsigned verification artifacts have a separate `artifactKind: unsigned-verification` schema with `promotable: false`, `developerIdSigned: false`, `notarized: false`, and `reviewStatus: pending-phase-5`. Their names begin `autoshow-unsigned-verification-`, they do not contain the production `.autoshow-payload-manifest.json`, and the clean verifier confirms the production managed-artifact validator rejects them. The clean job downloads the exact workflow artifact, verifies `SHA256SUMS`, applies the same archive entry and atomic promotion primitives as the dormant consumer, checks the complete file inventory and SPDX/source binding, reruns architecture/target/linkage/unsigned/leak and functional checks from the promoted path, and independently exercises absent-candidate source fallback on the same native architecture. Production metadata and setup still contain no prebuilt or unsigned candidate, URL, checksum, flag, or environment override.

Local Phase 4 evidence covers the available arm64 architecture only and therefore is not the phase completion evidence. The focused setup matrix now passes 122 tests with 0 failures. A real arm64 qpdf producer run passed all seven upstream CTest groups, exact 12.3.2/libjpeg-turbo 3.2.0 pins, native crypto, thin architecture, macOS 15.0 target, system-only closure, unsigned-state and build-path/credential scans, PDF validation, AES-256 encrypt/check/decrypt, linearization, SPDX/package generation, and clean staged installation; its temporary unsigned ZIP SHA-256 was `5ff43997704ca4541ae163c89ebe470c9767b4086d617ce80eafa4d7b55e30f6`. A real arm64 MuPDF run passed the available upstream extract buffer/misc/source checks, exact 1.27.2 pin and recipe, thin architecture, macOS 15.0 target, system-only closure, unsigned-state and leak scans, PDF inspect/render, SPDX/package generation, and clean staged installation; its temporary unsigned ZIP SHA-256 was `ef1d84b9149c6eeaf39784f31d3a2795d97341088c1d565c11f39cd3f8d4023a`. These local temporary digests prove the scripts but are not durable workflow artifacts and cannot replace the missing x64 job, pull-request run URL, or retained workflow-artifact digests.

> Correction (2026-08-07): two things this ADR describes as shipped no longer exist, both retired by later decisions rather than by this one being reversed.
>
> - **OCRmyPDF is gone.** [ADR-009](ADR-009-unify-ocr-extraction-architecture-and-reliability-guardrails.md) chose Tesseract as the only local OCR engine, on the recorded finding that Tesseract was the fastest and highest-mean local engine while avoiding OCRmyPDF's dependency and maintenance cost. Every mention of OCRmyPDF above — in the local-lite tool set, the Homebrew paths this ADR removed, the managed macOS set, the packaging risks, and the `ocr-local/ocrmypdf/ocrmypdf.ts` reference below — is history. Managed Ghostscript went with it; `qpdf` is still managed.
> - **`AUTOSHOW_BIN_DIR` is no longer a resolver input.** The precedence in `resolveRuntimeToolInfo` is unchanged in shape — explicit override, then managed artifact under `runtime/`, then `PATH` for tools AutoShow does not own — but its first tier is now fed by the global `--bin-dir` flag only. [ADR-005](ADR-005-reduce-environment-variable-surface-area.md) introduced `AUTOSHOW_BIN_DIR` in its pass 3 as the consolidation of six per-tool `AUTOSHOW_*_BIN` vars; production stopped reading it when the flag replaced it. The name survives in `test/test-utils/test-helpers.ts` as a harness convention only, and is translated into `--bin-dir` before the child process sees it. Read "`--bin-dir`/`AUTOSHOW_BIN_DIR`" above as "`--bin-dir`".

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

MuPDF/qpdf prebuilt distribution:

- The removable compile/link work is half of the selected cold median, while a lower-complexity scheduling change recovered only 3.1%. Distribution is therefore the remaining option with evidence of material critical-path leverage.
- Exact upstream macOS CLI artifacts do not exist for the pinned versions, so accepting prebuilts necessarily means owning production rather than repointing setup at an unowned binary feed.
- Separate thin archives keep the tools independently updatable and avoid making every user download both architectures. Source fallback preserves the existing capability boundary for older macOS versions, unsupported architectures, and ordinary release availability failures.
- A static, native-crypto qpdf recipe removes accidental Homebrew and OpenSSL runtime dependencies and passed a local functional proof. Reusing that recipe for producer CI and local fallback prevents the two paths from drifting into different products.
- Signed and notarized immutable assets, repository-pinned SHA-256 values, embedded file hashes, and producer attestations cover different threats. None is treated as a substitute for the others.

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
- Eligible macOS users can avoid the two compile/link phases that account for 50.0% of the measured cold median.
- Managed manifests make the installed tool's source/prebuilt origin, target, version, and integrity inspectable offline.
- The qpdf fallback stops depending on absolute Homebrew library paths.

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
- AutoShow becomes the publisher of four macOS executable archives and must maintain signing credentials, notarization automation, immutable releases, provenance, SBOMs, license material, rollback instructions, and security response.
- MuPDF's AGPL terms require an explicit redistribution review and corresponding-source plan before its first binary is published; absent approval, the MuPDF release and metadata pin remain blocked.
- macOS 14 and older hosts keep the slower source path, and ordinary asset unavailability can still impose the source-build time.

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
| Avoid 87.673s of measured MuPDF/qpdf compile/link work on eligible cold installs | Own four architecture-specific archives and their release lifecycle |
| Hermetic static qpdf runtime with native crypto | Add and maintain a pinned libjpeg-turbo source input for qpdf builds |
| Offline installed-file provenance and integrity checks | Pay a small doctor/setup hashing cost and maintain a versioned manifest schema |
| Developer ID, notarization, checksums, and attestations provide layered trust | Provision protected Apple credentials and block releases when any trust layer is unavailable |

## Keep (with rationale)

- The host `bun autoshow setup` path remains the supported route for macOS and for heavy local engines such as whisper.cpp, llama.cpp, Reverb, and Kitten TTS. The Docker image is additive, not a replacement for host setup — this is the seam that keeps both halves of this record coherent.
- Heavy local engines and model weights remain out of scope for the first end-user image. They would materially change build time, image size, and update policy.
- A run-to-completion CLI image still should not expose ports, define an HTTP `HEALTHCHECK`, or add web-app build arguments. Those sibling-image conventions do not apply to this CLI.

## Accepted macOS Prebuilt Distribution Contract

- **Decision State:** Accepted for implementation; no release download is active yet
- **Eligible Targets:** macOS 15.0 or later on `arm64` and `x64`
- **Default After Promotion:** Exact verified prebuilt per tool, with independent source fallback
- **First Scope:** MuPDF `mutool` 1.27.2 and qpdf 12.3.2 only
- **Trigger Evidence:** 87.673s of compile/link work, 50.0% of the 175.181s selected cold median

### Producer CI and artifact closure

Producer CI lives in the AutoShow repository and has an unprivileged verification path plus a protected publication path. Pull requests and ordinary pushes build unsigned artifacts with no signing or release secrets. Publication is a manual dispatch from the default branch through a reviewer-protected `macos-toolchain-release` environment; it checks out one exact commit, refuses source-version or release-revision inputs that do not match that commit's manifest, and grants only the minimum `contents`, `id-token`, and `attestations` permissions needed by the publishing job. Every referenced action is pinned to a reviewed full commit SHA.

The build matrix uses the fixed standard GitHub-hosted labels `macos-15` for `arm64` and `macos-15-intel` for `x64`, never a moving `-latest` label. Both set `MACOSX_DEPLOYMENT_TARGET=15.0`, record the runner image version, Xcode, SDK, AppleClang, CMake, make, and build flags, and produce thin Mach-O executables. A runner-label change, build-flag change, signing-identity change, packaging change, or source change requires a new release revision; an existing artifact is never overwritten.

MuPDF is built from the exact source URL and SHA-256 already pinned for version 1.27.2 with `build=release`, `HAVE_X11=no`, `HAVE_GLUT=no`, `HAVE_OBJCOPY=no`, and `HAVE_LIBCRYPTO=no` so the result cannot inherit an unpinned Homebrew OpenSSL from `pkg-config`. qpdf is built from the exact qpdf 12.3.2 source pin plus libjpeg-turbo 3.2.0 source pin, with explicit paths to the pinned static libjpeg and `BUILD_SHARED_LIBS=OFF`, `BUILD_STATIC_LIBS=ON`, `USE_IMPLICIT_CRYPTO=OFF`, `REQUIRE_CRYPTO_NATIVE=ON`, and `DEFAULT_CRYPTO=native`. The same functions and feature/linkage flags back the local source fallback; only the recorded deployment target and host toolchain may differ so older eligible source-build hosts do not produce an unusable macOS 15 binary. Producer CI and fallback builds reject `/opt/homebrew`, `/usr/local`, another workspace, or any other non-system absolute dependency reported by `otool -L`; final artifacts may reference Apple system libraries or packaged `@loader_path`/`@rpath` libraries only. The accepted first qpdf package is static and therefore contains no packaged dynamic library.

Each matrix job runs upstream tests appropriate to the built target and clean-fixture command checks before signing. At minimum, MuPDF must report the exact version and successfully inspect and render a repository-owned PDF fixture; qpdf must report the exact version and pass PDF validation, AES-256 encrypt/decrypt validation, and linearization checks. CI also asserts the thin architecture, deployment target, allowed dynamic-library closure, expected package file list, and absence of build paths, credentials, and quarantine-bypass commands. A second clean-host job downloads the exact candidate ZIP, exercises the same installer staging path, runs both tools from the promoted runtime paths, and tests the source fallback on each architecture.

### Package shape, provenance, and integrity

MuPDF and qpdf are released separately so either tool can update or fall back without coupling the other. The first immutable tags and executable asset names are:

| Tool | Release Tag | Executable Assets |
|---|---|---|
| MuPDF 1.27.2 | `toolchain-mupdf-1.27.2-r1` | `autoshow-mupdf-1.27.2-r1-darwin-arm64.zip`, `autoshow-mupdf-1.27.2-r1-darwin-x64.zip` |
| qpdf 12.3.2 | `toolchain-qpdf-12.3.2-r1` | `autoshow-qpdf-12.3.2-r1-darwin-arm64.zip`, `autoshow-qpdf-12.3.2-r1-darwin-x64.zip` |

`r1` is the packaging/build revision and increments whenever an input other than the upstream tool version changes. Each release also carries `SHA256SUMS`, a release manifest, an SPDX SBOM, provenance attestations, required notices, and the exact verified upstream source archives. The MuPDF release includes the exact corresponding source archive; the qpdf release includes the exact qpdf and libjpeg-turbo source archives. GitHub's tag source archive supplies the exact AutoShow producer scripts at the release commit.

Each executable ZIP has one top-level tool directory containing only the runtime files AutoShow consumes, required licenses/notices, and `.autoshow-payload-manifest.json`. Development headers, static libraries, build trees, and unrelated qpdf utilities are excluded. The embedded payload manifest and post-notarization release manifest are both schema-versioned and collectively record all of the following without creating a self-referential archive hash:

| Field Group | Required Values |
|---|---|
| Identity | Tool, upstream version, packaging revision, platform, architecture, minimum macOS version, manifest schema version |
| Source | Every source URL, source SHA-256, upstream source reference, build flags |
| Producer | AutoShow repository and commit, workflow name/run URL, runner label/image, compiler/SDK/build-tool versions |
| Payload | Relative runtime file list and SHA-256 per executable or packaged library; no absolute host paths |
| Trust | Payload manifest: signing identity and Team ID. Release manifest: notarization submission ID/status, final archive name and SHA-256, SBOM name, provenance subject digest |
| License | Primary license, included notice paths, corresponding-source asset names, completed review reference |

The final ZIP SHA-256, release-manifest identity, accepted notarization record, and exact immutable release URL are pinned in `dependency-metadata.ts`; setup never resolves `latest`, a branch, or an unversioned asset. The existing resumable download layer validates the archive hash before extraction. Setup then parses the embedded payload manifest with a closed schema, compares it to dependency metadata and the host, hashes every runtime payload file, validates signatures, runs tool health checks, and only then atomically replaces the tool directory, writes `.autoshow-managed-artifact.json` by merging the verified payload facts with the pinned release facts, and regenerates the managed shim. The distributed ZIP is never mutated after notarization and is never extracted over a working install. Any failure removes staging and leaves the previous healthy install intact.

GitHub build provenance is generated for each final ZIP and SBOM with GitHub's first-party artifact-attestation action. Promotion verifies those attestations against `ajcwebdev/autoshow-cli` before release publication. Runtime setup and doctor do not depend on `gh`, Sigstore, or network access: their trust root is the reviewed repository metadata pin plus the embedded manifest, payload hashes, and Apple signature. Signed ZIP bytes are not promised to be bit-for-bit reproducible because secure timestamps and notarization are variable; the recorded source pins, toolchain, flags, unsigned payload hashes, and producer commit make the build independently replayable.

### Hosting, retention, update, and rollback

Artifacts are hosted only as GitHub Release assets in `ajcwebdev/autoshow-cli`. Release immutability must be enabled before the first tool release. CI creates a draft release, uploads the complete asset set, verifies names, hashes, attestations, source/license material, and both architecture jobs, and then publishes it; published tool releases are never drafts. Release assets are the durable distribution surface, not expiring workflow artifacts.

An immutable tool release is retained indefinitely while any supported AutoShow revision pins it and is not routinely deleted afterward. If legal or security response requires removal, maintainers first ship dependency metadata that disables the affected prebuilt and restores the independently pinned source fallback, then delete the whole release if required; its tag name is never reused. Routine updates create a new upstream-version/revision tag and a reviewed metadata change only after both architectures pass. Rollback repins an older still-acceptable immutable release in a new AutoShow change or disables the prebuilt; assets are never replaced in place.

### License, signing, notarization, and quarantine gates

MuPDF is AGPL-3.0-or-later or commercially licensed. Before the first MuPDF binary is published, a recorded redistribution review must approve the subprocess/distribution boundary, the exact corresponding-source assets, notices for bundled third-party code, the AutoShow release-tag source availability, and any required written offer or user-facing notice. If that review concludes the MIT-distributed AutoShow boundary is insufficient, AutoShow must obtain an appropriate commercial license or keep MuPDF source-only and return to this ADR; CI may not publish the MuPDF release on an assumption of compliance.

qpdf is Apache-2.0 licensed. Its archive includes qpdf's `LICENSE.txt` and `NOTICE.md`; because the accepted static build embeds libjpeg-turbo, it also includes libjpeg-turbo's license and source reference. The SPDX SBOM and third-party notice inventory are reviewed for each source-version or dependency change. Neither tool is promoted when the license inventory differs from the reviewed manifest.

Every final Mach-O executable and any future packaged Mach-O library is signed after all mutation with an Apple Developer ID Application identity, hardened runtime, and secure timestamp. The expected Team ID is recorded in release and dependency metadata. CI verifies signatures strictly, packages the signed files into the exact ZIP that will be distributed, submits that ZIP with `notarytool --wait` without `--force`, requires an Accepted result, records the submission ID and log, and attests the final ZIP. A clean job applies quarantine to the downloaded archive, extracts through the production path, and confirms Gatekeeper acceptance and successful launch. Setup never clears `com.apple.quarantine`, disables Gatekeeper, or substitutes ad hoc signing. Signing and notarization credentials are available only to the protected publication environment and never to pull-request jobs.

### Eligibility, fallback, and doctor behavior

Prebuilt selection is per tool and requires `darwin`, `arm64` or `x64`, macOS 15.0 or later, an exact metadata entry, and no explicit `--bin-dir` tool already satisfying health checks. Older macOS, another architecture, an intentionally absent metadata entry, HTTP unavailability after the existing retry policy, or a clean-host incompatibility classified before trust verification produces a visible warning and runs the independently checksummed source recipe for that tool. Checksum, manifest, payload hash, architecture, version, signing identity, notarization metadata, or post-extraction integrity failures are security/publisher failures and stop setup without source fallback. No production environment variable or hidden URL override is added to select an unreviewed artifact.

Both prebuilt and source installations write the same schema-versioned managed-artifact manifest under the tool directory. A source manifest records `distribution: source`, source pins, build flags, host target, and installed payload hashes; a prebuilt manifest records `distribution: prebuilt` plus release and trust fields. Setup's initial health guard requires a valid manifest in addition to launchability, so an old, partial, or provenance-free managed tree is repaired rather than silently reused.

`setup --doctor` remains offline. For managed MuPDF and qpdf it validates manifest schema, expected version, distribution type, current architecture and platform, minimum-OS compatibility, installed payload hashes, and launch/version behavior. For a prebuilt it additionally runs strict Apple code-signature verification and checks the expected Team ID and recorded accepted notarization metadata. Doctor reports `managed prebuilt <version>-<revision> <platform>/<arch>` or `managed source <version> <platform>/<arch>` so the source is truthful. Missing or inconsistent provenance is warning-level unhealthy state with `bun autoshow setup --step calibre` as the repair. User overrides remain launch/version checked and are labeled `override`; AutoShow does not claim provenance for them.

### Promotion and final acceptance

Prebuilt URLs may enter default dependency metadata only when all of these gates pass for both tools and both architectures:

1. Producer and fallback recipes use the exact source pins and pass unit, upstream, fixture, architecture, deployment-target, dynamic-link closure, package-content, and clean-install checks.
2. Embedded manifests, SHA-256 pins, SPDX SBOMs, build attestations, immutable-release settings, retention ownership, and rollback instructions are complete and independently reviewed.
3. MuPDF and qpdf/libjpeg-turbo redistribution reviews approve the exact release contents.
4. Developer ID signing, notarization, quarantine/Gatekeeper, and protected-secret tests pass on both architectures.
5. Installer tests cover prebuilt success, per-tool availability fallback, unsupported OS/architecture fallback, atomic rollback, and hard failure for every trust mismatch; doctor covers both distribution types and overrides without network access.
6. On the same arm64 host and reset procedure used by ADR-015, three prebuilt cold runs improve the 175.181s median by at least the same predeclared 10% threshold, every run is healthy, no MuPDF/qpdf compile phase occurs, and the three-run steady-state warm median regresses by no more than 10% from 1.639s. The x64 path must pass clean cold/warm functional runs even though ADR-015 did not record an x64 timing baseline.

Until all six gates pass, source builds remain the active default and this ADR remains `Accepted · Pending`. FFmpeg remains a possible later candidate—the recorder measured a 64.214s compile median and 51.503s configure median—but it requires its own evidence and the same distribution review rather than entering this first scope by association.

## Implementation Plan

The prebuilt work is divided into nine ordered phases. Each phase is one independently reviewable change with its own verification and safe-stop/recovery boundary. A phase may start only after the preceding phase's completion criterion is recorded in the Implementation Note and its Follow-up Actions row is marked complete. Every phase through Phase 8 must leave source builds as the production default, and no phase may depend on unfinished work from a later phase to keep setup or doctor correct. If a phase fails its completion criterion, stop at that boundary, leave the last completed state in place, and revise this ADR before changing the sequence or weakening a gate. Every phase runs `bun run check`, `bun t --price`, and `git diff --check` in addition to its phase-specific local/no-cost verification; no phase authorizes provider, hosted-generation, or other paid/quota-risk commands.

### Phase 1: Make the qpdf source fallback hermetic

- **Status:** Complete on 2026-08-13.
- **Prerequisites:** The accepted qpdf 12.3.2 and libjpeg-turbo 3.2.0 source URLs and SHA-256 pins in this ADR.
- **Deliverable:** Add the libjpeg-turbo pin to dependency metadata, replace the current qpdf source build with one shared static-libjpeg/native-crypto recipe, and reject non-system absolute dynamic-library references. Do not add a prebuilt type, URL, workflow, or release behavior.
- **Verification:** Run metadata/build-argument unit tests; build qpdf from the exact pins on the available macOS architecture; assert version, thin architecture, deployment target, system-only linkage, PDF validation, AES-256 encrypt/decrypt, and linearization; then run `bun run check`, `bun t --price`, and `git diff --check`.
- **Complete when:** A normal source install produces a healthy portable qpdf on the tested architecture, existing source retry/reporting behavior is preserved, and source builds remain the only production path. Reverting this phase restores the prior qpdf recipe without affecting any later schema or release surface.

### Phase 2: Add source-install provenance and atomic promotion

- **Status:** Complete on 2026-08-13.
- **Prerequisites:** Phase 1 complete.
- **Deliverable:** Define the closed, schema-versioned managed-artifact manifest; make MuPDF and qpdf source installs write `distribution: source` provenance; install through per-tool staging and atomic promotion; preserve the previous healthy directory on failure; and make the setup health guard plus offline doctor validate source manifests, hashes, platform, architecture, version, and launch behavior.
- **Verification:** Add local/no-cost tests for schema acceptance/rejection, source manifests, interrupted staging, atomic replacement, preservation of a healthy prior install, repair of provenance-free or corrupt managed trees, truthful doctor labels, and `--bin-dir` precedence; then run the shared verification baseline.
- **Complete when:** Both source-installed tools are healthy only with valid provenance, every failed install leaves the previous healthy install usable, and no prebuilt metadata or network path exists. This phase can be reverted without changing the Phase 1 build recipe.

### Phase 3: Add a dormant prebuilt consumer

- **Status:** Complete on 2026-08-13.
- **Prerequisites:** Phase 2 complete.
- **Deliverable:** Add the typed prebuilt metadata and embedded/release manifest parsers, per-tool eligibility decision, staged archive consumer, strict payload/signature/Team-ID/notarization checks, availability-versus-trust failure classifier, source fallback dispatch, and offline prebuilt doctor checks. Exercise candidates only through typed test dependency injection; add no production flag, environment variable, configured asset, or default release URL.
- **Verification:** Use repository fixtures to cover eligible success, unsupported OS/architecture, absent candidate, exhausted availability retries, per-tool fallback, checksum/manifest/payload/version/architecture/signature/notary mismatches, archive traversal, atomic rollback, prior-install preservation, doctor behavior for both distributions, and override precedence. Availability cases must fall back visibly; every trust case must fail closed without falling back.
- **Complete when:** The dormant consumer contract passes all fixture tests while production setup still has no candidate to select and therefore remains source-only. Removing this phase leaves the source manifest and source installer from Phase 2 intact.

### Phase 4: Produce unsigned verification artifacts on both architectures

- **Status:** Implementation complete and locally verified on arm64 on 2026-08-13; phase completion pending one passing ordinary pull-request run on both matrix architectures with retained run URL and artifact digests.
- **Prerequisites:** Phase 3 complete.
- **Deliverable:** Add reusable producer/package scripts and an unprivileged GitHub Actions matrix on fixed `macos-15` arm64 and `macos-15-intel` x64 runners. Build exact MuPDF/qpdf/libjpeg-turbo pins, run upstream and fixture checks, generate payload manifests and SPDX SBOMs, reject forbidden linkage/content, and clean-install each candidate through the Phase 3 consumer. Pin actions by full commit SHA and expose no signing, notarization, publication, or release secret. Unsigned outputs must be labeled non-promotable and must not use final release names in production metadata.
- **Verification:** Require both matrix legs to prove versions, architectures, deployment targets, linkage closure, expected package contents, absence of build paths or credentials, MuPDF inspect/render, qpdf validate/encrypt/decrypt/linearize, clean candidate installation, and independent source fallback. Run the shared verification baseline locally.
- **Complete when:** One ordinary pull-request run passes on both architectures and retains its run URL and artifact digests as evidence, while no release or production URL exists. The workflow can be removed without affecting host source setup or the dormant consumer.

### Phase 5: Close redistribution and notice review

- **Prerequisites:** Phase 4 complete so reviewers inspect the exact source, linkage, SBOM, notice, and package inventories that would ship.
- **Deliverable:** Record approval references for qpdf, static libjpeg-turbo, and MuPDF redistribution; finalize the exact licenses, notices, corresponding-source assets, AutoShow source reference, and any written-offer/user-notice requirement; and make the package/release manifest reject an inventory that differs from the approved one.
- **Verification:** Compare each unsigned package inventory and SBOM to its approval, test that missing or changed review identifiers block promotion, and have the designated compliance/repository reviewers sign off on the recorded result.
- **Complete when:** qpdf/libjpeg-turbo and MuPDF are explicitly approved for the exact planned distribution. If MuPDF is not approved, stop: either obtain a commercial license or revise this ADR to keep MuPDF source-only before any signing or publication work. This phase changes review evidence and package policy only, not setup behavior.

### Phase 6: Add protected signing, notarization, and draft-publication controls

- **Prerequisites:** Phase 5 complete.
- **Deliverable:** Enable repository release immutability; create the reviewer-protected `macos-toolchain-release` environment; provision the Developer ID Application/notarization secrets; and add a manual default-branch publication workflow with minimal permissions. It must sign with hardened runtime and secure timestamp, package once, notarize the exact final ZIP, require Accepted status, generate final release manifests and attestations, apply quarantine on a clean host, verify Gatekeeper, and assemble a complete draft release without publishing it.
- **Verification:** Run one protected rehearsal for both tools and architectures; verify full-SHA action pins, permission boundaries, secret absence from unprivileged jobs and artifacts, expected Team ID, strict code signatures, accepted notarization records, final ZIP/SBOM attestations, quarantine-preserving installation, Gatekeeper launch, complete draft assets, and refusal of mismatched commit/version/revision inputs.
- **Complete when:** A protected run produces a complete verified draft for both tool releases and no public release or production URL has been created. Disabling the protected workflow leaves all source and dormant-consumer behavior unchanged.

### Phase 7: Publish the immutable tool releases without activating them

- **Prerequisites:** Phase 6 complete and its draft asset sets exactly match the names and contents accepted by this ADR.
- **Deliverable:** Publish `toolchain-mupdf-1.27.2-r1` and `toolchain-qpdf-12.3.2-r1` with both architecture ZIPs, final release manifests, `SHA256SUMS`, SPDX SBOMs, attestations, notices, and corresponding source. Record the immutable URLs and digests in release evidence, but do not add them to production dependency metadata.
- **Verification:** Independently download every published asset, recheck names and SHA-256 values, verify manifest/SBOM/attestation subjects, confirm tag and release immutability, confirm all source/license material is public, and rehearse the documented disable/rollback procedure without changing production metadata.
- **Complete when:** Both immutable releases are publicly verifiable and retained under the accepted ownership policy, while every supported AutoShow checkout still selects source builds by default. If any byte must change, publish a new `rN`; never replace or reuse an existing tag.

### Phase 8: Validate the exact release candidates and performance gates

- **Prerequisites:** Phase 7 complete.
- **Deliverable:** Build an acceptance packet against the exact published URLs and digests. A repository acceptance harness must pass a typed candidate metadata object directly to the setup orchestration; it must not add a production CLI flag, environment variable, hidden URL override, or default metadata entry. Use that harness for both-architecture integration coverage and the ADR-015 same-host performance matrix.
- **Verification:** On arm64 and x64, cover exact prebuilt success, per-tool availability fallback, unsupported OS/architecture fallback, source fallback, atomic rollback, every trust hard failure, offline doctor for source/prebuilt/override, quarantine/Gatekeeper, and clean cold/warm functional runs. On the ADR-015 arm64 host, require three healthy cold runs with no MuPDF/qpdf compile phase and a median no greater than 157.663s, at least 10% below the 175.181s baseline, plus three steady-state warm runs with a median no greater than 1.803s, no more than 10% above the 1.639s baseline.
- **Complete when:** All six promotion gates have traceable passing evidence for the exact immutable assets. If coverage or performance fails, stop before Phase 9, leave production source-only, and either issue a new release revision and repeat the affected phases or revise the decision. This phase records evidence only and does not activate a download.

### Phase 9: Activate exact pins and close verification

- **Prerequisites:** Phase 8 complete with every promotion gate passing.
- **Deliverable:** Add the four exact immutable URLs, archive SHA-256 values, release-manifest identities, accepted notarization facts, and expected Team ID to production dependency metadata; enable per-tool prebuilt selection for eligible hosts; update user-facing setup/doctor documentation; record all phase evidence in the Implementation Note and Test Plan; and change this ADR plus the ADR index from `Accepted · Pending` to `Accepted · Passed`.
- **Verification:** Run `bun run check`, `bun t --price`, `git diff --check`, the targeted local/no-cost setup contracts, exact-metadata success, availability fallback, trust-failure, atomic-preservation, source/prebuilt/override doctor cases, and a clean eligible-host setup using the production metadata. Confirm older/unsupported hosts still build from source and no unreviewed override surface exists.
- **Complete when:** Eligible macOS 15+ arm64/x64 hosts prefer only the four accepted assets, every other supported case retains a truthful source fallback, all trust failures stop closed, the prior healthy install is preserved on failure, and the ADR/index status accurately reports `Accepted · Passed`. Reverting this activation commit returns production to source-only without deleting the immutable releases.

### Independent deferred phase: Decide container registry publication

This phase is not part of the prebuilt sequence and does not block Phases 1–9. When maintainers have registry demand and final image-size/usage evidence, make one separate decision that either keeps local image builds as the supported boundary or accepts a named registry, retention policy, multi-architecture producer, provenance/signing contract, and CI verification. Do not add registry publishing as incidental work in a macOS prebuilt phase.

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Phase 1 — Make the qpdf source fallback hermetic without adding any prebuilt surface | Setup/runtime maintainers | Complete — exact pins, static libjpeg/native-crypto recipe, linkage rejection, source install, functional checks, and shared verification passed on arm64 macOS on 2026-08-13 |
| Phase 2 — Add source-install provenance, atomic promotion, health-guard repair, and offline source doctor checks | Setup/runtime maintainers | Complete — closed version 1 source manifests, exact provenance and payload validation, staged atomic promotion with rollback, provenance-aware setup guards, truthful offline doctor labels, focused failure coverage, and real arm64 source installs passed on 2026-08-13 |
| Phase 3 — Add the dormant typed prebuilt consumer, eligibility/fallback classifier, trust checks, and offline prebuilt doctor coverage with fixture-only candidate injection | Setup/runtime maintainers | Complete — typed closed manifests and candidate metadata, per-tool eligibility, visible availability fallback, fail-closed trust classification, safe staged ZIP consumption, actual architecture and signature checks, atomic rollback, and offline source/prebuilt/override doctor coverage passed 112 focused tests on 2026-08-13; production remains source-only with no configured candidate or URL |
| Phase 4 — Add unprivileged unsigned arm64/x64 producer verification with exact builds, packaging, SBOMs, and clean-install coverage | Release engineering | In verification — implementation, 122 focused contracts, real arm64 MuPDF/qpdf producer runs, package digests, and clean installs pass; the required ordinary pull-request run has not occurred, no GitHub Actions run URL or retained arm64/x64 artifact digests exist, and this phase must remain incomplete until both matrix legs pass remotely |
| Phase 5 — Record exact MuPDF and qpdf/libjpeg-turbo redistribution, source, SBOM, and notice approvals | Repository owner and compliance reviewers | Pending — blocked until the Phase 4 ordinary pull-request matrix run passes and its run URL and artifact digests are recorded |
| Phase 6 — Enable immutability and add protected Developer ID signing, notarization, attestation, quarantine, and draft-publication controls | Repository owner and release engineering | Pending — begins only after Phase 5 is recorded complete |
| Phase 7 — Publish both immutable tool releases and verify every asset without adding a production metadata pin | Release engineering | Pending — begins only after Phase 6 is recorded complete |
| Phase 8 — Validate the exact published candidates across both architectures and run the accepted cold/warm performance matrix without production activation | Setup/runtime and performance maintainers | Pending — begins only after Phase 7 is recorded complete |
| Phase 9 — Pin and activate the four accepted assets, update documentation/evidence, and promote the ADR only after every gate passes | Setup/runtime maintainers | Pending — begins only after Phase 8 is recorded complete |
| Independent deferred phase — Decide whether the container image needs registry publication and, if accepted, define its own producer and distribution contract | Maintainers | Deferred — independent of and non-blocking for Phases 1–9 |

## Test Plan

- Decision evidence completed on 2026-08-13: inspected the exact MuPDF 1.27.2 and qpdf 12.3.2 upstream release assets; verified their pinned source archives; audited local Mach-O architecture, deployment target, signatures, sizes, and dynamic libraries; and confirmed the repository is public with zero releases and zero Actions workflows.
- qpdf portability proof completed on 2026-08-13 in a temporary directory: verified libjpeg-turbo 3.2.0 by SHA-256, built arm64 qpdf 12.3.2 static with native crypto and macOS 15.0 minimum, confirmed system-only dynamic dependencies, and passed version, PDF validation, AES-256 encryption, and linearization commands. No repository runtime artifact was replaced.
- Phase 1 implementation verification completed on 2026-08-13: the metadata and source-recipe contract tests passed; a normal source-only setup replaced the old dynamic qpdf install; the resulting thin arm64 qpdf 12.3.2 recorded a host-compatible macOS 26.0 deployment target and only the three allowed `/usr/lib` dependencies; PDF validation, AES-256 encrypt/check/decrypt, linearization, and linearization validation passed; and a normal rerun reused the result without rebuilding.
- Phase 2 focused verification completed on 2026-08-13: 97 local/no-cost setup tests passed with 0 failures and covered closed-schema acceptance/rejection, exact MuPDF/qpdf source manifests, platform/architecture/deployment-target/source-pin/recipe/payload validation, provenance-free and corrupt trees, interrupted staging, atomic replacement, pre-promotion failure preservation, activation and stable-path validation rollback, setup health-guard wiring, truthful source doctor labels, corrupt-provenance and wrong-version repair guidance, and `--bin-dir` precedence.
- Phase 2 production-path verification completed on 2026-08-13: normal arm64 setup rebuilt and atomically promoted both source tools with valid version 1 manifests and macOS 26.0 deployment targets; exact version launch, payload hashes, and system-only dynamic closure passed; offline doctor reported both truthful `managed source` identities; no staging or backup directory remained; and a 0.16s setup rerun reused both installs without compilation.
- Phase 3 focused verification completed on 2026-08-13: 112 local/no-cost setup tests passed with 0 failures and covered eligible prebuilt installation, closed embedded/release/installed schemas, source-pin and recipe binding, unsupported OS/architecture, absent candidates, exhausted availability, independent per-tool source fallback with visible warnings, fail-closed archive/manifest/payload/version/architecture/signature/Team-ID/notary mismatches, archive traversal and unsafe entry rejection, exact package inventory, atomic rollback, healthy prior-install preservation, truthful source/prebuilt doctor labels, wrong-version detection, and override precedence. Candidate metadata entered only through typed test injection.
- Phase 3 production-boundary verification completed on 2026-08-13: dependency metadata and the macOS source installers still contain no prebuilt candidate, URL, checksum, flag, or environment override; real arm64 offline doctor continued to validate and label both source installs; and a 0.25s `bun autoshow setup --step calibre` rerun reused both tools without prebuilt lookup or compilation.
- Phase 4 focused verification completed locally on 2026-08-13: 122 local/no-cost setup tests passed with 0 failures and covered closed non-promotable unsigned schemas, conspicuous non-release names, exact source/build binding, preliminary license inventory, SPDX 2.3 generation, safe archive extraction, exact package contents, staged and stable-path validation, atomic prior-install preservation, rejection by the production manifest validator, visible absent-candidate source fallback, deployment-target parsing, build-path and credential scans, fixed runner labels, full-SHA action pins, read-only permissions, absence of signing/publication secrets, and the production source-only metadata boundary.
- Phase 4 real arm64 producer verification completed locally on 2026-08-13: qpdf built from exact qpdf 12.3.2 and libjpeg-turbo 3.2.0 pins, passed all seven upstream CTest groups and the repository validation/AES-256/decryption/linearization fixture matrix, and produced a 1.2 MB non-promotable ZIP with SHA-256 `5ff43997704ca4541ae163c89ebe470c9767b4086d617ce80eafa4d7b55e30f6`; MuPDF built from its exact 1.27.2 pin, passed the available upstream buffer/misc/source checks plus repository inspect/render fixtures, and produced a 29 MB non-promotable ZIP with SHA-256 `ef1d84b9149c6eeaf39784f31d3a2795d97341088c1d565c11f39cd3f8d4023a`. Both binaries were thin arm64 Mach-O files targeting macOS 15.0 with system-only linkage and no Developer ID identity, both packages carried closed manifests and SPDX, and both clean-installed successfully through staged atomic verification. The artifacts were temporary local evidence and were not published or placed in production metadata.
- Phase 4 formal completion remains pending: the current remote repository reports no Actions runs for this workflow, and the uncommitted workflow cannot produce the ADR-required ordinary pull-request run without a user-controlled commit/push. Both fixed matrix legs must pass and the run URL plus workflow-artifact digests must be recorded here before Phase 4 is marked Complete or Phase 5 begins.
- Documentation verification for this decision passed: `bun run check`; `bun t --price` with 165 commands checked and 0 failures; and `git diff --check`.
- Remaining implementation verification starts by running the implemented Phase 4 unsigned producer workflow on an ordinary pull request and retaining both architecture results, then must close exact redistribution review, signing/notarization/quarantine, immutable publication, exact-candidate clean-install and fallback coverage, and the accepted performance matrix before changing Verification Status to `Passed`.
- Do not run provider, service, hosted-generation, or any paid/quota-risk command for this work.

## Assumptions

- The original host and container decisions are accepted and implemented; macOS setup no longer invokes Homebrew for AutoShow-owned tools (verified: zero `brew` invocations remain in `src`).
- The prebuilt distribution decision is accepted and its first three implementation phases are complete. Phase 4 code and temporary arm64 verification artifacts exist locally, but its required two-architecture pull-request evidence does not; no artifact has been retained by CI, reviewed for redistribution, signed, published, or activated, so the aggregate Verification Status is `Pending` and no release URL may be inferred from this record.
- Apple Developer Program access and a Developer ID Application identity can be provisioned before publication. If they cannot, the accepted release gate blocks prebuilts and source builds remain active.

## References

- Related ADR: [ADR-005](ADR-005-reduce-environment-variable-surface-area.md)
- Performance escalation and measured source-build evidence: [ADR-015](ADR-015-make-setup-downloads-resumable-and-setup-reporting-truthful.md)
- Runtime tool resolution: `src/utils/runtime-paths.ts`
- Current macOS FFmpeg and yt-dlp setup: `src/cli/commands/setup-and-utilities/setup/setup-download/dl-audio/audio.ts`
- Current macOS MuPDF setup: `src/cli/commands/setup-and-utilities/setup/setup-download/dl-document/document.ts`
- Current macOS Calibre setup: `src/cli/commands/setup-and-utilities/setup/setup-download/dl-document/calibre.ts`
- Current macOS Tesseract setup: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-local/tesseract-setup.ts`
- Doctor check: `src/cli/commands/setup-and-utilities/setup/run-doctor.ts`
- Dependency metadata and checksum pinning: `src/cli/commands/setup-and-utilities/setup/dependency-metadata.ts`
- Shared hermetic qpdf source recipe and linkage check: `src/cli/commands/setup-and-utilities/setup/setup-download/qpdf-source-build.ts`
- Shared MuPDF source recipe: `src/cli/commands/setup-and-utilities/setup/setup-download/mupdf-source-build.ts`
- Managed source/prebuilt manifest validation and atomic promotion: `src/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact.ts`
- Dormant prebuilt eligibility, archive consumer, trust classifier, and fallback dispatch: `src/cli/commands/setup-and-utilities/setup/setup-download/prebuilt-artifact.ts`
- Dormant prebuilt fixture contracts: `test/test-cases/validation/setup/prebuilt-artifact-contracts.test.ts`
- Unsigned verification artifact schemas, packaging, SPDX generation, validation, and staged clean-install path: `src/cli/commands/setup-and-utilities/setup/setup-download/unsigned-prebuilt-artifact.ts`
- Reusable exact-pin producer and source-fallback commands: `src/tools/macos-toolchain-producer.ts`
- Unprivileged fixed-runner verification matrix: `.github/workflows/macos-toolchain-unsigned.yml`
- Phase 4 producer contracts: `test/test-cases/validation/setup/prebuilt-producer-contracts.test.ts`
- Repository-owned producer PDF fixture: `test/fixtures/setup/managed-toolchain-smoke.pdf`
- Docker user documentation: `docs/docker.md`
- MuPDF 1.27.2 upstream release: [ArtifexSoftware/mupdf-downloads 1.27.2](https://github.com/ArtifexSoftware/mupdf-downloads/releases/tag/1.27.2)
- MuPDF license: [ArtifexSoftware/mupdf](https://github.com/ArtifexSoftware/mupdf)
- qpdf 12.3.2 upstream release: [qpdf 12.3.2](https://github.com/qpdf/qpdf/releases/tag/v12.3.2)
- qpdf license and build documentation: [qpdf repository](https://github.com/qpdf/qpdf)
- libjpeg-turbo 3.2.0 source release: [libjpeg-turbo 3.2.0](https://github.com/libjpeg-turbo/libjpeg-turbo/releases/tag/3.2.0)
- Producer runners: [GitHub-hosted runners reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- Build provenance: [GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)
- Hosting and retention control: [GitHub immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)
- Workflow hardening: [GitHub secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
- Signing and notarization: [Apple notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
- Verification rule: `bun run check`
- `bunfig.toml`
