# ADR-004: Manage the Setup Runtime and Toolchain Lifecycle

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-08-13
- **Verification Status:** Passed
- **Supersession:** Consolidates the setup reliability, reporting, and performance record formerly titled "Make Setup Downloads Resumable and Setup Reporting Truthful"; the standalone macOS toolchain distribution review; and the ACSM plugin, managed Python, wrapper, resolver, authorization-helper, doctor, and setup/help mechanics formerly recorded in ADR-001. Docker distribution moved to [ADR-015](ADR-015-distribute-the-cli-as-a-docker-image.md) on 2026-08-13. ADR-001 retains book-like ingestion, fulfillment, authorization, conversion, and extraction policy.

## Context

AutoShow promises one "local-lite" tool set — FFmpeg and `ffprobe`, `yt-dlp`, MuPDF `mutool`, `qpdf`, Calibre `ebook-convert`, and Tesseract with English trained data — and has to provision it on macOS and Linux hosts. Both host environments are governed by the resolver precedence in `resolveRuntimeToolInfo` (`src/utils/runtime-paths.ts`): an explicit `--bin-dir` or per-tool override first, then an AutoShow-managed artifact under `runtime/`, then `PATH` for tools AutoShow does not own. The provisioning decision for each host is which of those tiers supplies the tools. Docker distribution is governed separately by ADR-015.

Host provisioning. macOS setup used Homebrew for several tools while most AutoShow-managed local dependencies already lived under `runtime/`. That mixed model made setup behavior less reproducible: managed binaries, Python environments, and models are cacheable project artifacts, but Homebrew installs mutate global machine state and can vary by host, tap state, bottle availability, and the user's existing package manager configuration. The Homebrew-managed setup paths covered FFmpeg and `ffprobe`, `yt-dlp`, MuPDF `mutool`, Calibre `ebook-convert`, Tesseract and English language data, and OCRmyPDF; [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md) later made Tesseract the only local OCR engine, retiring the managed OCRmyPDF and Ghostscript paths. Host build prerequisites such as Apple/Xcode tooling, command line developer tools, `cmake`, and compiler/runtime components remain explicit external prerequisites, not AutoShow-installed dependencies. Linux hosts continue to use `apt`.

Setup reliability evidence. An audited full setup took 426.4 seconds and reported success despite two 60-second Whisper download timeouts and incomplete readiness checks. The flat `AbortSignal.timeout(60_000)` stayed armed through body streaming, imposing a roughly 200 Mbps floor on the 1.5 GB `ggml-large-v3-turbo.bin`; retries deleted the destination and restarted from byte zero; whole bodies were buffered in memory; the largest models lacked SHA-256 pins; and eight concurrent setup tasks divided available bandwidth. Reporting could still end with unconditional success and exit 0 after a warning summary. Doctor probed the ACSM wrapper's early-returning `--version` path rather than activation readiness, omitted qpdf, and trusted a 236-byte llama marker instead of the cached GGUF. The run also left roughly 3.3 GB of removable build trees and gave users no truthful disk or bandwidth accounting.

Setup performance evidence. The accepted arm64 macOS topology has a 175.181-second ungated cold median, an 11.2-second post-install cold-cache rerun, and a 1.639-second steady-state warm median. MuPDF and qpdf compile/link medians total 87.673 seconds, or 50.0% of the cold run. A capacity-one CPU-heavy gate produced a 169.8-second median, only 3.1% faster, and missed the predeclared 10% acceptance threshold.

ACSM provisioning evidence. ADR-001 selects local, user-authorized Calibre ACSM Input plugin fulfillment behind a `calibre-acsm-fulfill <input.acsm> <output-dir>` interface and prohibits raw ACSM extraction, online conversion, secret persistence, and automated DRM removal. Setup must supply that interface without taking ownership of the user's authorization rights or sensitive activation data.

MuPDF/qpdf delivery evidence. The exact upstream MuPDF 1.27.2 release exposes source archives only, and the exact qpdf 12.3.2 release exposes source, Linux, and Windows assets but no macOS binaries, so an upstream-prebuilt option does not exist for either pinned tool. A local arm64 audit also found that the original qpdf source build was not portable: its `libqpdf` had absolute dynamic references to Homebrew `libjpeg` and OpenSSL. A no-cost proof build corrected that by pinning libjpeg-turbo 3.2.0, statically linking qpdf and libjpeg, selecting qpdf's native crypto provider, and setting an explicit deployment target; the resulting arm64 `qpdf` linked only `/usr/lib/libz.1.dylib`, `/usr/lib/libc++.1.dylib`, and `/usr/lib/libSystem.B.dylib` and passed version, PDF validation, AES-256 encryption, and linearization checks. The existing arm64 `mutool` likewise links only `/usr/lib/libSystem.B.dylib`.

Why now: host provisioning, acquisition integrity, setup health/reporting, performance topology, and ACSM runtime supply are one lifecycle. Keeping them in separate records obscured the owner of downloads, provenance, staging, promotion, cleanup, doctor truth, and setup-only plugin mechanics. This consolidation gives host setup one authority while leaving source-format and fulfillment policy in ADR-001 and Docker distribution in ADR-015.

## Options Considered

### Host Dependency Source

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| Keep Homebrew on macOS | Lowest implementation cost; continues using familiar package names; preserves current installer branches | Keeps global package-manager mutation; remains dependent on user Homebrew state; preserves platform drift from existing `runtime/` patterns | No migration work; keeps six active Homebrew-managed install paths |
| **Runtime-managed macOS dependencies** | Aligns macOS with existing managed runtime patterns; supports version pinning, checksums, provenance metadata, and cacheable installs; avoids global package-manager mutation | Requires direct download, build, or runtime install flows for each affected tool; needs architecture and license review | Chosen. Removes six active Homebrew-managed install paths |
| Manual user-installed dependencies | Simplest code; avoids maintaining binary download logic | Worse onboarding; weakens `setup` and `setup --doctor`; makes local runs less self-contained and harder to reproduce | Would turn setup into guidance for these tools instead of installation |

### macOS MuPDF and qpdf Delivery

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Keep hermetic source builds as the only path** | No binary-publishing, signing, hosting, credential, or release program; the installed result remains project-managed and reproducible | Retains the dominant measured cold cost | MuPDF + qpdf compile/link medians: 87.673s, 50.0% of the 175.181s cold median; chosen after repairing qpdf's accidental Homebrew linkage |
| Use upstream macOS prebuilts | Upstream would own production, signing, and release lifecycle | Rejected because neither pinned upstream release publishes a macOS CLI asset | MuPDF 1.27.2: 2 source assets only; qpdf 12.3.2: 0 macOS assets |
| Use Homebrew bottles or another third-party binary feed | Existing multi-architecture packaging infrastructure | Reintroduces a mutable package-manager dependency, weakens exact project pinning, and reverses the accepted no-Homebrew boundary | At least 2 external package recipes plus transitive bottle availability |
| Produce thin, pinned, signed and notarized AutoShow prebuilts with a source fallback | Would remove the measured compile path on eligible hosts | Requires an ongoing producer CI, Apple credential, signing, notarization, release, retention, and incident-response program | Investigated, then withdrawn before any artifact was signed, published, configured, or activated |

### Setup Transfer, Health, and Reporting

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Stall-based timeouts with per-flow total budgets, streaming to resumable `.part` files, and checksum pins** | Transfer size stops deciding success; retries resume; memory stays bounded; large models receive integrity checks | Adds sidecar and resume-validity logic; hashing requires a completed-file read | Removes the roughly 200 Mbps floor; retries transfer only remaining bytes |
| Raise the flat timeout | Minimal change | Retains an arbitrary bandwidth floor, byte-zero restarts, and whole-body buffering | Roughly 20 minutes would be needed for 1.5 GB at 10 Mbps and would also delay genuine stalls |
| Shell out to `curl -C -` | Provides resume and progress | Reintroduces an external tool dependency and splits acquisition behavior | Rejected |
| Keep optimistic reporting and document caveats | No implementation risk | Cannot correct a false exit code or a doctor probe that bypasses actual prerequisites | Rejected |

### ACSM Fulfillment Provisioning

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Setup-managed pinned Calibre ACSM Input plugin and standalone-script runtime** | Supplies ADR-001's selected interface through the existing Calibre dependency; pins provenance; supports Adobe ID, anonymous authorization, ADE activation import, activation backups, `fulfill.py`, and a user-facing authorization helper | Maintains a sensitive local activation environment and GPLv3 external-download boundary; fulfillment may contact Adobe or distributor servers | Selected; no plugin source is vendored or modified in AutoShow |
| Require users to install and locate the plugin scripts manually | Removes setup code | Weakens one-command setup and doctor truth; creates inconsistent resolver behavior | Rejected as the default; explicit overrides remain supported |
| Provision `libgourou` as a second managed ACSM stack | More CLI-native and headless | Duplicates the Calibre-centered toolchain and makes setup manage ADEPT activation directly | Rejected unless the ingestion decision changes |

## Decision

AutoShow provisions the local-lite toolchain through managed `runtime/` artifacts on a macOS host and `apt` on a Linux host. Nothing resolves through a global package manager AutoShow does not control, and nothing resolves implicitly through `PATH` on macOS.

Host provisioning. macOS setup must not invoke Homebrew for AutoShow-installed local dependencies. Affected tools are installed, resolved, and reported as project-local managed runtime dependencies under `runtime/`, following the existing patterns used for managed `uv`/`uvx`, whisper.cpp, llama.cpp, Defuddle, Python environments, and local model assets. Resolver precedence is:

1. Explicit user override where the tool supports one, such as the global `--bin-dir` flag or a config setting.
2. AutoShow-managed runtime binary, environment, or shim under `runtime/`.
3. `PATH` only for external prerequisites that AutoShow does not own, such as Xcode tooling, `cmake`, compilers, and optional host utilities.

This requires no CLI command-shape change. Existing setup entry points, including `bun autoshow setup`, `bun autoshow setup --step yt-dlp`, `bun autoshow setup --step calibre`, and `bun autoshow setup --doctor`, keep their current public shape while their macOS dependency source changes underneath.

Setup acquisition, reporting, and health. Every `downloadFile` transfer aborts on inactivity rather than total elapsed transfer time, streams to a resumable `<destination>.part` guarded by URL-matched metadata, and verifies checksum or minimum-size evidence before atomic completion. Shared transfer admission is bounded at the byte-moving leaves rather than around whole setup tasks. Setup reports per-step wall-clock timing, aggregate progress, disk state, provider-key counts, and ACSM authorization separately; the final message and process exit follow the summary health verdict. Doctor remains offline and checks the real artifacts and prerequisites that execution uses. Successful installers reclaim disposable build trees and conversion inputs while retaining intentional caches.

ACSM setup mechanics. `bun autoshow setup --step calibre` installs the document tools and ACSM fulfillment support; `bun autoshow setup --step acsm` installs only a pinned Calibre ACSM Input plugin ZIP under `runtime/tools/acsm-calibre-plugin`, its managed Python environment, `calibre-acsm-fulfill`, and `calibre-acsm-authorize`. Resolution is explicit `--bin-dir` first, the setup-managed `runtime/bin` wrapper second, then `PATH`. The generated fulfillment wrapper must satisfy ADR-001's exact one-EPUB-or-PDF output contract. `setup --doctor` separately reports wrapper health and authorization-file readiness, and setup/help text keeps Calibre conversion, fulfillment scripts, and user-controlled authorization distinct. Activation files, Adobe IDs, account data, keys, and backup ZIPs remain local sensitive state and never enter manifests, run artifacts, performance artifacts, or logs. AutoShow downloads the pinned upstream GPLv3 plugin instead of vendoring or modifying its code; any future vendoring, modification, or redistribution requires an explicit license review.

macOS MuPDF/qpdf delivery. AutoShow builds both tools from exact project-pinned source on the host and does not publish, select, or download AutoShow-built macOS executable archives. The qpdf recipe statically links the pinned libjpeg-turbo input, uses qpdf's native crypto provider, and rejects non-system dynamic-library paths; MuPDF retains its release/no-X11/no-GLUT/no-objcopy recipe with host libcrypto discovery disabled. Neither result may contain a non-system absolute dynamic-library path, and the source install records a deployment target compatible with the host that compiles it. Both tools install through isolated staging, record source provenance and payload hashes, pass health checks, and atomically replace the managed runtime directory while preserving the prior healthy install on failure. The existing `runtime/bin` resolver shims remain the public managed paths, and explicit `--bin-dir` tools retain precedence without being required to carry AutoShow provenance.

This applies to:

- AutoShow-installed, runtime-managed dependencies on macOS.
- All setup downloads, transfer admission, integrity checks, retry/resume behavior, health guards, performance artifacts, progress, summaries, cleanup, and doctor reporting.
- Setup-managed ACSM plugin acquisition, managed Python and generated wrappers, resolver precedence, authorization helper/readiness reporting, and setup/help mechanics; ADR-001 remains authoritative for lawful user authorization, the fulfillment command contract, source classification, conversion metadata, and extraction behavior.
- Hermetic, pinned MuPDF and qpdf source builds on supported macOS hosts, with no project-published executable archive path.
- No user-managed tools, host build prerequisites, Linux host package management, or other platform setup behavior; no project-hosted prebuilt scope is active.
- No implicit hosted-provider key validation during setup; validating credentials would call provider APIs and remains an explicit opt-in workflow.

## Implementation Note

| Action | Owner | Current State |
|---|---|---|
| Runtime-managed macOS dependencies | Setup maintainers | Implemented in `src/utils/runtime-paths.ts` |
| Resumable downloads, stall timeouts, and concurrency gate | Setup maintainers | Implemented in `src/cli/commands/setup-and-utilities/setup/setup-download/` |
| Honest setup summary reporting, progress heartbeats, and offline doctor checks | CLI maintainers | Implemented in `src/cli/commands/setup-and-utilities/setup/` |
| Managed ACSM plugin provisioning, Python env, and fulfillment wrappers | Extraction maintainers | Implemented in `src/cli/commands/setup-and-utilities/setup/setup-download/dl-document/acsm.ts` |
| Hermetic macOS MuPDF and qpdf source builds with static linking and manifest verification | Setup maintainers | Implemented in `src/cli/commands/setup-and-utilities/setup/setup-download/` |
| Prebuilt distribution track withdrawal and enforcement of source-only fallback | Setup maintainers | Implemented in `src/cli/commands/setup-and-utilities/setup/setup-download/prebuilt-artifact.ts` |

## Rationale

Host provisioning:

- The project already treats many local capabilities as managed runtime assets: `runtime/bin/uv`, `runtime/bin/uvx`, `runtime/bin/whisper-cli`, `runtime/bin/llama-server`, `runtime/defuddle/`, Python environments under `runtime/bin/`, and model assets under `runtime/models/`. Keeping macOS media, document, and OCR tools on Homebrew was the outlier.
- Runtime-managed macOS dependencies improve reproducibility because setup can pin versions, validate checksums, record provenance, and reuse cached artifacts. They also avoid mutating global system package state, which matters for developer machines and CI agents that may already have unrelated Homebrew installations.
- Using the same dependency-management model across local tools reduces platform drift. A setup or doctor report can explain whether AutoShow is using a user override, a managed runtime artifact, or an external prerequisite instead of implicitly relying on whatever Homebrew installed globally.
- The target pattern already existed in the codebase: on Linux, setup downloads the official `yt-dlp` release binary directly to `ytDlpManagedBinaryPath` instead of using a system package manager, so the macOS migration for `yt-dlp` was reuse rather than new work.

MuPDF/qpdf source-only conclusion:

- The removable compile/link work is half of the selected cold median, but exact upstream macOS CLI artifacts do not exist for the pinned versions, so avoiding that time would require AutoShow to own binary production and release operations.
- The owner does not want a standing Apple Developer credential, signing, notarization, or protected release workflow for these helper tools. That operational boundary outweighs the cold-install optimization.
- A static, native-crypto qpdf recipe removes accidental Homebrew and OpenSSL runtime dependencies and passed a local functional proof.
- Unsigned AutoShow-built executables are not an acceptable substitute. Keeping source builds avoids weakening the trust contract while preserving exact pins, provenance, atomic promotion, and offline health verification.

Setup acquisition, reporting, and ACSM provisioning:

- A stall timeout is correct for both small and multi-gigabyte assets; a flat total-transfer deadline always embeds a bandwidth assumption. Resumable disk streaming makes retries useful and bounds memory, while hashing the completed file composes cleanly with resumed transfers.
- Admission belongs at the shared byte-moving resource, not at whole task boundaries. The network and CPU experiments are retained because they show why the accepted three-transfer budget and ungated compile topology are different decisions.
- The exit status must follow the same verdict as the human summary, and doctor must inspect the artifact or prerequisite that execution actually uses rather than an easy version or marker proxy.
- The Calibre plugin is already selected by the ingestion policy and emits exactly the EPUB/PDF forms the pipeline accepts. Provisioning its pinned external scripts and managed interpreter beside Calibre keeps setup coherent without making extraction own installer paths or sensitive activation state.

## Consequences

Positive outcomes:

- macOS setup no longer mutates global Homebrew state for AutoShow-owned tools.
- Local dependency versions can be pinned, verified, and cached with project artifacts.
- `setup --doctor` reports managed runtime sources consistently, and managed manifests make an installed tool's target, version, and integrity inspectable offline.
- macOS dependency management aligns with existing managed uv, whisper.cpp, llama.cpp, Defuddle, Python environment, and model-asset patterns.
- CI and developer setup become less sensitive to machine-local package manager state.
- The qpdf build stops depending on absolute Homebrew library paths.
- Large downloads survive slow links and interruptions without whole-body buffering or byte-zero retries, and pinned model integrity fails closed.
- Setup summaries, process exits, and offline doctor checks agree on readiness; qpdf, current local model assets, and ACSM authorization are checked at their real use boundaries, while retired CoreML artifacts are identified for reclamation rather than provisioned.
- Warm setup reuses healthy llama assets without stopping a llama server the user may already be running.
- Disposable build inputs are reclaimed, intentional caches remain, and performance artifacts make cold, post-install, and steady-state behavior auditable.
- The selected ACSM plugin runtime is one setup command away while lawful authorization and sensitive activation state remain explicitly user-controlled.

Negative outcomes:

- Setup maintainers must own more dependency-specific install and update logic.
- MuPDF and qpdf retain their measured source-build cost on a cold host.
- Calibre was installed as a Homebrew cask, meaning a GUI app bundle rather than a CLI formula; replacing it required sourcing `ebook-convert` from the official Calibre app distribution, which is materially harder than swapping in a static binary.
- Existing users with working Homebrew installs may see a one-time runtime download or build cost.
- The dormant prebuilt consumer and distribution policy remain as maintained code and contract coverage even though no production candidate, URL, checksum pin, or release lifecycle exists.
- Resumable downloads maintain `.part` and `.part.json` state; completed-file checksum verification adds one full read, roughly 1–2 seconds for a 1.5 GB model on the measured NVMe host.
- Setup now exits non-zero for partial installs that older automation may have accepted, and upstream same-name model republishing becomes a visible checksum failure.
- The setup authority maintains the pinned GPLv3 ACSM plugin, managed Python environment, wrappers, resolver, and readiness checks; fulfillment can still depend on Adobe/distributor availability and user authorization.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Reproducible macOS setup with pinned versions, checksum validation, and provenance metadata | The project owns install and update logic for six tools previously maintained by Homebrew |
| No mutation of global Homebrew state for AutoShow-owned tools | MuPDF and qpdf compile locally on a cold host |
| Uniform resolver and doctor reporting across managed local dependencies | Calibre and Tesseract require more involved packaging than static binaries |
| Cacheable project-local artifacts across developer machines and CI | Existing users may incur a one-time managed-runtime download or build |
| Avoid an Apple credential and binary release program | Retain 87.673s of measured MuPDF/qpdf compile/link work on eligible cold installs |
| Hermetic static qpdf runtime with native crypto | Add and maintain a pinned libjpeg-turbo source input for qpdf builds |
| Offline installed-file provenance and integrity checks | Pay a small doctor/setup hashing cost and maintain a versioned manifest schema |
| Do not distribute executables without the full Apple trust chain | Give up project-hosted macOS prebuilts unless a future ADR accepts their operational cost |
| Transfer-size-independent, resumable, checksum-verified downloads | Maintain partial-file metadata, stall/total profiles, and a completed-file hash pass |
| Truthful summary, exit code, doctor, progress, and disk reporting | Existing partial installs become explicit failures and setup owns more health probes |
| Bounded transfer concurrency with measured ungated compile topology | Preserve two resource-specific scheduling rules and their evidence |
| One setup-managed ACSM runtime behind ADR-001's stable interface | Maintain external plugin provenance and keep sensitive authorization state out of project artifacts |

## Keep (with rationale)

- Retired Whisper CoreML environments and model artifacts are reclaimable and are no longer provisioned or recorded; the earlier 654 MB cache-retention decision applied only while conversion remained active.
- `config/deps.json` remains an optional supported override merged over defaults rather than dead configuration.
- HuggingFace downloads keep their own 120-second per-file budget and classifier but participate in shared transfer admission.

## Test Plan

- Setup acquisition contracts cover resumable Range requests, foreign-URL partial rejection, clean restart on `200`, discard on `416`, checksum and short-file failure, preservation on stalls, per-flow budgets, archive handling, and slot release before checksum verification.
- Setup orchestration contracts cover the capacity-three transfer gate, failed-transfer slot release, one-line activity-aware heartbeat, minute formatting, the serial document/ACSM chain, the 10 MiB reclaimed-tree threshold, Kitten symlink-aware cache checks, real llama GGUF readiness, qpdf and ACSM doctor checks, legacy CoreML reclamation, final health exit behavior, and force-reset coverage for qpdf.
- Managed source contracts cover closed-schema acceptance and rejection, exact MuPDF/qpdf manifests, platform/architecture/deployment-target/source-pin/recipe/payload validation, provenance-free and corrupt trees, interrupted staging, atomic replacement, rollback that preserves a healthy prior install, truthful doctor labels, and `--bin-dir` precedence.
- Dormant prebuilt contracts cover eligibility, absent candidates, exhausted availability, independent per-tool source fallback with visible warnings, fail-closed archive/manifest/payload/version/architecture/signature/Team-ID/notary mismatches, archive traversal rejection, exact package inventories, approved notice and SPDX reconstruction, review-reference binding, non-promotable unsigned state, the absence of both removed workflows, and the production source-only metadata boundary.
- ACSM setup contracts cover the `acsm` step, inclusion from the Calibre chain, pinned plugin/runtime/wrapper generation, resolver precedence, idempotent readiness, separate authorization reporting, and omission/redaction of activation paths and account/key material. Fulfillment and conversion behavior remain covered under ADR-001.
- The setup performance artifact contract covers its closed schema, monotonic structured phases, phase reconciliation, actual compile overlap, environment facts, local-only persistence, and exclusion of home paths, URLs, and credentials.
- Production-path verification completed on 2026-08-13 on arm64 macOS: normal setup rebuilt and atomically promoted MuPDF 1.27.2 and qpdf 12.3.2 with valid version 1 manifests, exact version launches, valid payload hashes, and system-only dynamic closure; qpdf passed PDF validation, AES-256 encrypt/check/decrypt, and linearization against the pinned fixture; offline doctor reported `managed source 1.27.2 darwin/arm64` and `managed source 12.3.2 darwin/arm64`; no staging or backup directory remained; and a rerun reused both installs in 0.16s without compiling.
- Source-only closure verification completed on 2026-08-13: both toolchain workflow files, the signed producer implementation, its package commands, and its signed producer contracts are removed; repository search finds no Apple credential names in runtime or test automation; production dependency metadata contains no prebuilt URL or checksum; the protected environment is deleted; and the repository has zero releases. Zero `brew` invocations remain in `src`.

## References

- Related ADR: [ADR-005](ADR-005-reduce-environment-variable-surface-area.md)
- Docker image distribution: [ADR-015](ADR-015-distribute-the-cli-as-a-docker-image.md)
- Error, retry, and diagnostic vocabulary: [ADR-006](ADR-006-unify-error-handling-vocabulary.md)
- Ingestion and ACSM fulfillment-policy boundary: [ADR-001](ADR-001-source-ingestion-and-normalization.md)
- Local OCR engine selection that retired OCRmyPDF: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- Runtime tool resolution: `src/utils/runtime-paths.ts`
- Setup download and transfer admission: `src/cli/commands/setup-and-utilities/setup/setup-download/download.ts`, `src/cli/commands/setup-and-utilities/setup/setup-download/download-admission.ts`
- Setup progress, performance, summary, and doctor: `src/cli/commands/setup-and-utilities/setup/setup-heartbeat.ts`, `src/cli/commands/setup-and-utilities/setup/setup-performance.ts`, `src/cli/commands/setup-and-utilities/setup/run-complete-setup.ts`, `src/cli/commands/setup-and-utilities/setup/run-doctor.ts`
- ACSM plugin provisioning and wrappers: `src/cli/commands/setup-and-utilities/setup/setup-download/dl-document/acsm.ts`
- Shared setup/generation resource gate: `src/utils/resource-gate.ts`
- Whisper model integrity and llama cache readiness: `src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisper/whisper-model-integrity.ts`, `src/cli/commands/process-steps/step-3-write/write-local/llama/llama-model-cache.ts`
- macOS FFmpeg and yt-dlp setup: `src/cli/commands/setup-and-utilities/setup/setup-download/dl-audio/audio.ts`
- macOS MuPDF setup: `src/cli/commands/setup-and-utilities/setup/setup-download/dl-document/document.ts`
- macOS Calibre setup: `src/cli/commands/setup-and-utilities/setup/setup-download/dl-document/calibre.ts`
- macOS Tesseract setup: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-local/tesseract-setup.ts`
- Dependency metadata and checksum pinning: `src/cli/commands/setup-and-utilities/setup/dependency-metadata.ts`
- Shared hermetic qpdf source recipe and linkage check: `src/cli/commands/setup-and-utilities/setup/setup-download/qpdf-source-build.ts`
- Shared MuPDF source recipe: `src/cli/commands/setup-and-utilities/setup/setup-download/mupdf-source-build.ts`
- Managed source/prebuilt manifest validation and atomic promotion: `src/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact.ts`
- Dormant prebuilt consumer and its fixture contracts: `src/cli/commands/setup-and-utilities/setup/setup-download/prebuilt-artifact.ts`, `test/test-cases/validation/setup/prebuilt-artifact-contracts.test.ts`
- Unsigned research artifact schemas and packaging: `src/cli/commands/setup-and-utilities/setup/setup-download/unsigned-prebuilt-artifact.ts`, `src/cli/commands/setup-and-utilities/setup/setup-download/managed-toolchain-package.ts`, `test/test-cases/validation/setup/prebuilt-producer-contracts.test.ts`
- Closed distribution policy and exact notice/source/SBOM/reviewer inventories: `src/cli/commands/setup-and-utilities/setup/setup-download/managed-toolchain-distribution-policy.ts`
- Producer PDF fixture: `test/fixtures/setup/managed-toolchain-smoke.pdf`
- MuPDF 1.27.2 upstream release: [ArtifexSoftware/mupdf-downloads 1.27.2](https://github.com/ArtifexSoftware/mupdf-downloads/releases/tag/1.27.2)
- qpdf 12.3.2 upstream release: [qpdf 12.3.2](https://github.com/qpdf/qpdf/releases/tag/v12.3.2)
- libjpeg-turbo 3.2.0 source release: [libjpeg-turbo 3.2.0](https://github.com/libjpeg-turbo/libjpeg-turbo/releases/tag/3.2.0)
- Verification rule: `bun run check`
