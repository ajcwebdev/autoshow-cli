# ADR-004: Manage the Setup Runtime and Toolchain Lifecycle

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-08-17
- **Verification Status:** Passed
- **Supersession:** Docker distribution is governed separately by [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md). This record remains accepted authority for host setup reliability and toolchain lifecycle.

## Context

AutoShow requires a "local-lite" tool set — FFmpeg and `ffprobe`, `yt-dlp`, MuPDF `mutool`, `qpdf`, Calibre `ebook-convert`, and Tesseract with English trained data — across macOS and Linux hosts. Both environments follow the resolver precedence in `resolveRuntimeToolInfo` (`src/utils/runtime-paths.ts`): an explicit `--bin-dir` or per-tool override first, then an AutoShow-managed artifact under `runtime/`, then `PATH` for unmanaged external host utilities.

Several issues motivated unifying this lifecycle:

1. **Host provisioning drift.** macOS setup previously used Homebrew for several tools while other dependencies lived under `runtime/`. Homebrew installs mutated global system state, varied by machine configuration, and drifted from the managed runtime pattern used for tools like `uv`, `whisper-cli`, whisperfile, and local models. Linux hosts continue to use `apt`.
2. **Download reliability and integrity.** Setup downloads relied on rigid total-transfer timeouts that aborted large assets (such as multi-gigabyte models) on normal bandwidth. Retries restarted from byte zero while buffering entire bodies in memory, downloads lacked checksum verification, and unthrottled concurrent downloads saturated available bandwidth.
3. **Truthful reporting and diagnostics.** Setup reporting could exit with code 0 despite failed steps, while `setup --doctor` inspected superficial version flags rather than verifying actual binary execution readiness.
4. **Hermetic toolchain delivery.** Upstream MuPDF and qpdf releases do not publish prebuilt macOS CLI binaries. Default source builds risked linking against host Homebrew or OpenSSL libraries instead of hermetic, portable system linkage.
Why now: host provisioning, download integrity, and offline diagnostic health require one authoritative lifecycle.

## Options Considered

### Host Dependency Source

**Option 1 (selected)**

- **Option:** Runtime-managed macOS dependencies
- **Pros:** Pinned versions, checksum verification, provenance metadata, cacheable installs; avoids global package-manager mutation
- **Cons:** Requires direct download, build, and management logic per tool
- **Quantitative Notes:** Replaces 6 Homebrew-managed install paths

**Option 2**

- **Option:** Keep Homebrew on macOS
- **Pros:** Lower initial implementation cost; uses familiar package names
- **Cons:** Mutates global machine state; introduces environment drift; less reproducible
- **Quantitative Notes:** Preserves 6 Homebrew-managed paths

**Option 3**

- **Option:** Manual user-installed dependencies
- **Pros:** Minimal setup code
- **Cons:** Degrades onboarding experience; weakens `setup --doctor` validation
- **Quantitative Notes:** Turns setup into manual documentation

### macOS MuPDF and qpdf Delivery

**Option 1 (selected)**

- **Option:** Hermetic host source builds
- **Pros:** Reproducible, project-managed, statically linked binaries; no signing or release hosting infrastructure needed
- **Cons:** Incurs compilation time on cold setup
- **Quantitative Notes:** Pinned source recipes for MuPDF and qpdf

**Option 2**

- **Option:** Upstream macOS prebuilts
- **Pros:** Upstream maintains binaries and signing
- **Cons:** Neither pinned upstream release provides macOS CLI binaries
- **Quantitative Notes:** Unavailable

**Option 3**

- **Option:** Homebrew bottles
- **Pros:** Existing pre-packaged binaries
- **Cons:** Reintroduces package manager dependency and breaks hermetic runtime boundary
- **Quantitative Notes:** Reintroduces Homebrew dependencies

**Option 4**

- **Option:** Project-hosted signed prebuilts
- **Pros:** Eliminates local compilation time
- **Cons:** Requires Apple Developer credentials, signing, notarization, and binary release infrastructure
- **Quantitative Notes:** High operational overhead

### Setup Transfer, Health, and Reporting

**Option 1 (selected)**

- **Option:** Stall-based timeouts, resumable `.part` streaming, and checksum verification
- **Pros:** Transfer success independent of file size; retries resume remaining bytes; bounded memory; fails closed on corrupt downloads
- **Cons:** Requires partial-file metadata management and post-download hash verification
- **Quantitative Notes:** Covers all multi-gigabyte models and runtime archives

**Option 2**

- **Option:** Flat total-transfer timeouts
- **Pros:** Minimal code change
- **Cons:** Imposes arbitrary bandwidth floors; restarts from byte zero; buffers in memory
- **Quantitative Notes:** Fails large models on slow links

**Option 3**

- **Option:** Shell out to `curl -C -`
- **Pros:** Provides native resume capability
- **Cons:** Adds external system tool dependency; fragments download logic
- **Quantitative Notes:** Inconsistent across platforms

**Option 4**

- **Option:** Optimistic exit and summary reporting
- **Pros:** No error-handling complexity
- **Cons:** Masks failed setup steps; leaves doctor checks incomplete
- **Quantitative Notes:** Inaccurate diagnostic status

## Decision

AutoShow provisions the local-lite toolchain through managed `runtime/` artifacts on macOS and `apt` on Linux. Nothing resolves through unmanaged global package managers or implicit `PATH` lookups on macOS.

1. **Host provisioning and resolver precedence:** macOS setup does not invoke Homebrew for AutoShow-managed dependencies. Tools are installed and isolated under `runtime/`. Resolver precedence is:
   1. Explicit user override (such as `--bin-dir` or configuration settings).
   2. AutoShow-managed runtime binary, environment, or shim under `runtime/`.
   3. `PATH` only for unmanaged external host prerequisites (Xcode tools, `cmake`, compilers).
2. **Download integrity, transfer concurrency, and health:** All downloads use stall-based inactivity timeouts, stream to resumable `<destination>.part` files guarded by metadata, and verify checksums prior to atomic promotion. Concurrent network transfers are bounded by a shared capacity gate. Setup reports step timing, disk usage, and component health truthfully, exiting non-zero on partial failures. Offline doctor checks validate actual executable execution rather than surface markers.
3. **Hermetic macOS MuPDF and qpdf builds:** Both tools are built from pinned upstream source on macOS. The qpdf build statically links a pinned libjpeg-turbo dependency, selects native crypto, and eliminates external dynamic library linkages. Builds install via isolated staging and atomic directory replacement.

This applies to:

- AutoShow-installed, runtime-managed dependencies on macOS.
- Setup download streaming, retry/resume mechanics, transfer admission, checksum validation, disk cleanup, and doctor diagnostics.
- Pinned source compilation of MuPDF and qpdf on supported macOS hosts.

This does not apply to:

- External host build prerequisites (Xcode command line tools, `cmake`, compilers).
- Linux host package management (`apt`).
- Docker container distribution (governed by [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)).
- Hosted provider credential validation (which requires explicit opt-in execution).

## Rationale

- **Host provisioning:** Treating local dependencies as managed runtime assets under `runtime/` aligns macOS with existing patterns used for `uv`, `whisper-cli`, whisperfile, Defuddle, and model assets. It guarantees reproducible versions and avoids mutating host system state.
- **Source builds:** Compiling MuPDF and qpdf from pinned source preserves exact versions and hermetic static linkage without requiring Apple Developer signing credentials, notarization pipelines, or binary distribution infrastructure.
- **Acquisition and reporting:** Stall-based timeouts and chunked resumable streaming decouple download reliability from bandwidth constraints or file sizes. Bounding transfer concurrency prevents network contention, and truthful exit codes ensure automated workflows fail closed on incomplete installations.

## Consequences

Positive outcomes:

- macOS setup no longer mutates global Homebrew state for AutoShow-owned tools.
- Dependency versions, checksums, and manifests are pinned and verifiable offline.
- `setup --doctor` inspects functional execution readiness rather than surface-level markers.
- Large model and tool downloads reliably resume across network interruptions without memory exhaustion.
- Build artifacts are isolated and transient staging directories are automatically reclaimed.

Negative outcomes:

- AutoShow maintainers must manage tool-specific download, packaging, and compilation recipes.
- Cold setup on macOS incurs a local compilation step for MuPDF and qpdf.
- Sourcing `ebook-convert` requires extracting the official Calibre application bundle.
- Resumable downloads require managing partial-file metadata and post-download hash verification passes.

## Trade-offs

**Trade-off 1**

- **Gain:** Reproducible macOS setup with pinned versions, checksums, and provenance
- **Sacrifice:** Project maintains installation recipes for tools previously delegated to Homebrew

**Trade-off 2**

- **Gain:** Hermetic runtime without mutating global package-manager state
- **Sacrifice:** Cold setup incurs local compilation time for MuPDF and qpdf

**Trade-off 3**

- **Gain:** Transfer-size-independent, resumable, and integrity-verified downloads
- **Sacrifice:** Setup manages `.part` metadata and post-download hash passes

**Trade-off 4**

- **Gain:** Truthful diagnostic reporting and fail-closed exit codes
- **Sacrifice:** Partial installs fail explicitly rather than succeeding with warnings

## Implementation Note

- Runtime-managed macOS dependencies — Implemented in `src/utils/runtime-paths.ts`
- Resumable downloads, stall timeouts, and concurrency gate — Implemented in `src/cli/commands/setup-and-utilities/setup/setup-download/`
- Honest setup summary reporting, progress heartbeats, and offline doctor checks — Implemented in `src/cli/commands/setup-and-utilities/setup/`
- Hermetic macOS MuPDF and qpdf source builds with static linking and manifest verification — Implemented in `src/cli/commands/setup-and-utilities/setup/setup-download/`

## Keep (with rationale)

- `config/deps.json` remains a supported user override mechanism merged over default dependency metadata.
- HuggingFace downloads retain a dedicated per-file timeout budget while participating in shared transfer concurrency gating.
- Reclaimed legacy build trees and conversion caches are cleaned up automatically while preserving intentional persistent caches.

## Test Plan

Verification is automated through default check routines and focused contract validation suites:

```bash
bun run check
bun test test/test-cases/validation/setup/
```

- **Setup acquisition contracts:** Verify HTTP Range requests, invalid partial-file rejection, clean restarts on full responses (`200`), stall preservation, per-flow budgets, and checksum failure handling.
- **Setup orchestration contracts:** Verify transfer concurrency limits, heartbeat progress reporting, serial execution chains, artifact cleanup thresholds, offline doctor checks, and exit code accuracy on partial failures.
- **Managed source contracts:** Verify MuPDF and qpdf manifest validation, architecture/platform checks, static linking constraints (no non-system dynamic libraries), atomic directory promotion, and rollback on failure.

## References

- Related ADR: [ADR-005](ADR-005-reduce-environment-variable-surface-area.md)
- Docker image distribution: [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)
- Error and retry vocabulary: [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md)
- Ingestion and ebook normalization policy: [ADR-001](ADR-001-source-ingestion-and-normalization.md)
- Local OCR engine selection: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- Runtime tool resolution: `src/utils/runtime-paths.ts`
- Setup download and admission: `src/cli/commands/setup-and-utilities/setup/setup-download/download.ts`, `src/cli/commands/setup-and-utilities/setup/setup-download/download-admission.ts`
- Setup orchestration and doctor: `src/cli/commands/setup-and-utilities/setup/run-complete-setup.ts`, `src/cli/commands/setup-and-utilities/setup/run-doctor.ts`
- MuPDF and qpdf source recipes: `src/cli/commands/setup-and-utilities/setup/setup-download/mupdf-source-build.ts`, `src/cli/commands/setup-and-utilities/setup/setup-download/qpdf-source-build.ts`
- Managed artifact promotion: `src/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact.ts`
- Dependency metadata: `src/cli/commands/setup-and-utilities/setup/dependency-metadata.ts`
- Upstream releases: [MuPDF 1.27.2](https://github.com/ArtifexSoftware/mupdf-downloads/releases/tag/1.27.2), [qpdf 12.3.2](https://github.com/qpdf/qpdf/releases/tag/v12.3.2), [libjpeg-turbo 3.2.0](https://github.com/libjpeg-turbo/libjpeg-turbo/releases/tag/3.2.0)
