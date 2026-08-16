# ADR-004: Manage the Setup Runtime and Toolchain Lifecycle

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-08-15
- **Verification Status:** Passed
- **Supersession:** Consolidates setup reliability, reporting, and toolchain distribution records with ACSM plugin and managed Python mechanics formerly in ADR-001. Docker distribution is governed separately by [ADR-015](ADR-015-distribute-the-cli-as-a-docker-image.md).

## Context

AutoShow requires a "local-lite" tool set — FFmpeg and `ffprobe`, `yt-dlp`, MuPDF `mutool`, `qpdf`, Calibre `ebook-convert`, and Tesseract with English trained data — across macOS and Linux hosts. Both environments follow the resolver precedence in `resolveRuntimeToolInfo` (`src/utils/runtime-paths.ts`): an explicit `--bin-dir` or per-tool override first, then an AutoShow-managed artifact under `runtime/`, then `PATH` for unmanaged external host utilities.

Several issues motivated unifying this lifecycle:

1. **Host provisioning drift.** macOS setup previously used Homebrew for several tools while other dependencies lived under `runtime/`. Homebrew installs mutated global system state, varied by machine configuration, and drifted from the managed runtime pattern used for tools like `uv`, `whisper-cli`, whisperfile, and local models. Linux hosts continue to use `apt`.
2. **Download reliability and integrity.** Setup downloads relied on rigid total-transfer timeouts that aborted large assets (such as multi-gigabyte models) on normal bandwidth. Retries restarted from byte zero while buffering entire bodies in memory, downloads lacked checksum verification, and unthrottled concurrent downloads saturated available bandwidth.
3. **Truthful reporting and diagnostics.** Setup reporting could exit with code 0 despite failed steps, while `setup --doctor` inspected superficial version flags rather than verifying actual binary execution readiness.
4. **Hermetic toolchain delivery.** Upstream MuPDF and qpdf releases do not publish prebuilt macOS CLI binaries. Default source builds risked linking against host Homebrew or OpenSSL libraries instead of hermetic, portable system linkage.
5. **ACSM runtime provisioning.** [ADR-001](ADR-001-source-ingestion-and-normalization.md) established local user-authorized Calibre ACSM Input plugin fulfillment behind `calibre-acsm-fulfill`. Setup must provision the plugin ZIP, managed Python environment, and execution wrappers without capturing sensitive user activation data.

Why now: host provisioning, download integrity, offline diagnostic health, and ACSM runtime supply form a single lifecycle. Consolidating them gives setup one authoritative model while leaving ingestion policy in ADR-001 and Docker distribution in ADR-015.

## Options Considered

### Host Dependency Source

| Option                                 | Pros                                                                                                                    | Cons                                                                          | Quantitative Notes                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------- |
| **Runtime-managed macOS dependencies** | Pinned versions, checksum verification, provenance metadata, cacheable installs; avoids global package-manager mutation | Requires direct download, build, and management logic per tool                | Replaces 6 Homebrew-managed install paths |
| Keep Homebrew on macOS                 | Lower initial implementation cost; uses familiar package names                                                          | Mutates global machine state; introduces environment drift; less reproducible | Preserves 6 Homebrew-managed paths        |
| Manual user-installed dependencies     | Minimal setup code                                                                                                      | Degrades onboarding experience; weakens `setup --doctor` validation           | Turns setup into manual documentation     |

### macOS MuPDF and qpdf Delivery

| Option                          | Pros                                                                                                           | Cons                                                                                           | Quantitative Notes                       |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **Hermetic host source builds** | Reproducible, project-managed, statically linked binaries; no signing or release hosting infrastructure needed | Incurs compilation time on cold setup                                                          | Pinned source recipes for MuPDF and qpdf |
| Upstream macOS prebuilts        | Upstream maintains binaries and signing                                                                        | Neither pinned upstream release provides macOS CLI binaries                                    | Unavailable                              |
| Homebrew bottles                | Existing pre-packaged binaries                                                                                 | Reintroduces package manager dependency and breaks hermetic runtime boundary                   | Reintroduces Homebrew dependencies       |
| Project-hosted signed prebuilts | Eliminates local compilation time                                                                              | Requires Apple Developer credentials, signing, notarization, and binary release infrastructure | High operational overhead                |

### Setup Transfer, Health, and Reporting

| Option                                                                           | Pros                                                                                                                         | Cons                                                                           | Quantitative Notes                                    |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------- |
| **Stall-based timeouts, resumable `.part` streaming, and checksum verification** | Transfer success independent of file size; retries resume remaining bytes; bounded memory; fails closed on corrupt downloads | Requires partial-file metadata management and post-download hash verification  | Covers all multi-gigabyte models and runtime archives |
| Flat total-transfer timeouts                                                     | Minimal code change                                                                                                          | Imposes arbitrary bandwidth floors; restarts from byte zero; buffers in memory | Fails large models on slow links                      |
| Shell out to `curl -C -`                                                         | Provides native resume capability                                                                                            | Adds external system tool dependency; fragments download logic                 | Inconsistent across platforms                         |
| Optimistic exit and summary reporting                                            | No error-handling complexity                                                                                                 | Masks failed setup steps; leaves doctor checks incomplete                      | Inaccurate diagnostic status                          |

### ACSM Fulfillment Provisioning

| Option                                                              | Pros                                                                                                             | Cons                                                                    | Quantitative Notes                       |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------- |
| **Setup-managed pinned Calibre ACSM plugin and standalone runtime** | Seamless CLI fulfillment via `calibre-acsm-fulfill`; pins plugin provenance; isolates sensitive activation state | Requires managing isolated Python environment and wrapper scripts       | GPLv3 plugin downloaded, not vendored    |
| Manual user plugin installation                                     | Reduces setup implementation code                                                                                | Complicates onboarding; weakens automated readiness checks              | Shifts configuration burden to user      |
| Provision `libgourou` as separate stack                             | CLI-native ADEPT client                                                                                          | Adds a redundant ACSM stack beside Calibre; manages ADEPT keys directly | Rejected in favor of Calibre integration |

## Decision

AutoShow provisions the local-lite toolchain through managed `runtime/` artifacts on macOS and `apt` on Linux. Nothing resolves through unmanaged global package managers or implicit `PATH` lookups on macOS.

1. **Host provisioning and resolver precedence:** macOS setup does not invoke Homebrew for AutoShow-managed dependencies. Tools are installed and isolated under `runtime/`. Resolver precedence is:
   1. Explicit user override (such as `--bin-dir` or configuration settings).
   2. AutoShow-managed runtime binary, environment, or shim under `runtime/`.
   3. `PATH` only for unmanaged external host prerequisites (Xcode tools, `cmake`, compilers).
2. **Download integrity, transfer concurrency, and health:** All downloads use stall-based inactivity timeouts, stream to resumable `<destination>.part` files guarded by metadata, and verify checksums prior to atomic promotion. Concurrent network transfers are bounded by a shared capacity gate. Setup reports step timing, disk usage, and component health truthfully, exiting non-zero on partial failures. Offline doctor checks validate actual executable execution rather than surface markers.
3. **Hermetic macOS MuPDF and qpdf builds:** Both tools are built from pinned upstream source on macOS. The qpdf build statically links a pinned libjpeg-turbo dependency, selects native crypto, and eliminates external dynamic library linkages. Builds install via isolated staging and atomic directory replacement.
4. **ACSM runtime setup:** Setup provisions the pinned Calibre ACSM Input plugin ZIP into `runtime/tools/acsm-calibre-plugin`, creates the managed Python environment, and generates `calibre-acsm-fulfill` and `calibre-acsm-authorize` execution wrappers. User activation keys, Adobe IDs, and credentials remain private user state and are never logged or stored in project artifacts.

This applies to:

- AutoShow-installed, runtime-managed dependencies on macOS.
- Setup download streaming, retry/resume mechanics, transfer admission, checksum validation, disk cleanup, and doctor diagnostics.
- Pinned source compilation of MuPDF and qpdf on supported macOS hosts.
- Managed ACSM plugin acquisition, Python environment, wrapper generation, and doctor health reporting.

This does not apply to:

- External host build prerequisites (Xcode command line tools, `cmake`, compilers).
- Linux host package management (`apt`).
- Docker container distribution (governed by [ADR-015](ADR-015-distribute-the-cli-as-a-docker-image.md)).
- Hosted provider credential validation (which requires explicit opt-in execution).

## Rationale

- **Host provisioning:** Treating local dependencies as managed runtime assets under `runtime/` aligns macOS with existing patterns used for `uv`, `whisper-cli`, whisperfile, Defuddle, and model assets. It guarantees reproducible versions and avoids mutating host system state.
- **Source builds:** Compiling MuPDF and qpdf from pinned source preserves exact versions and hermetic static linkage without requiring Apple Developer signing credentials, notarization pipelines, or binary distribution infrastructure.
- **Acquisition and reporting:** Stall-based timeouts and chunked resumable streaming decouple download reliability from bandwidth constraints or file sizes. Bounding transfer concurrency prevents network contention, and truthful exit codes ensure automated workflows fail closed on incomplete installations.
- **ACSM fulfillment:** Provisioning the Calibre ACSM plugin and standalone wrapper scripts ensures automated document extraction while strictly isolating sensitive Adobe activation data.

## Consequences

Positive outcomes:

- macOS setup no longer mutates global Homebrew state for AutoShow-owned tools.
- Dependency versions, checksums, and manifests are pinned and verifiable offline.
- `setup --doctor` inspects functional execution readiness rather than surface-level markers.
- Large model and tool downloads reliably resume across network interruptions without memory exhaustion.
- ACSM fulfillment tooling is provisioned via a single command while keeping user credentials secure.
- Build artifacts are isolated and transient staging directories are automatically reclaimed.

Negative outcomes:

- AutoShow maintainers must manage tool-specific download, packaging, and compilation recipes.
- Cold setup on macOS incurs a local compilation step for MuPDF and qpdf.
- Sourcing `ebook-convert` requires extracting the official Calibre application bundle.
- Resumable downloads require managing partial-file metadata and post-download hash verification passes.

## Trade-offs

| Gains                                                                    | Sacrifices                                                                        |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Reproducible macOS setup with pinned versions, checksums, and provenance | Project maintains installation recipes for tools previously delegated to Homebrew |
| Hermetic runtime without mutating global package-manager state           | Cold setup incurs local compilation time for MuPDF and qpdf                       |
| Transfer-size-independent, resumable, and integrity-verified downloads   | Setup manages `.part` metadata and post-download hash passes                      |
| Truthful diagnostic reporting and fail-closed exit codes                 | Partial installs fail explicitly rather than succeeding with warnings             |
| Isolated, single-command ACSM fulfillment runtime                        | Setup maintains pinned external plugin acquisition and wrapper generation         |

## Implementation Note

| Action                                                                                    | Owner                  | Current State                                                                                  |
| ----------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------- |
| Runtime-managed macOS dependencies                                                        | Setup maintainers      | Implemented in `src/utils/runtime-paths.ts`                                                    |
| Resumable downloads, stall timeouts, and concurrency gate                                 | Setup maintainers      | Implemented in `src/cli/commands/setup-and-utilities/setup/setup-download/`                    |
| Honest setup summary reporting, progress heartbeats, and offline doctor checks            | CLI maintainers        | Implemented in `src/cli/commands/setup-and-utilities/setup/`                                   |
| Managed ACSM plugin provisioning, Python env, and fulfillment wrappers                    | Extraction maintainers | Implemented in `src/cli/commands/setup-and-utilities/setup/setup-download/dl-document/acsm.ts` |
| Hermetic macOS MuPDF and qpdf source builds with static linking and manifest verification | Setup maintainers      | Implemented in `src/cli/commands/setup-and-utilities/setup/setup-download/`                    |

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
- **ACSM setup contracts:** Verify plugin extraction, managed Python environment setup, execution wrapper generation, resolver precedence, and isolation of user activation credentials.

## References

- Related ADR: [ADR-005](ADR-005-reduce-environment-variable-surface-area.md)
- Docker image distribution: [ADR-015](ADR-015-distribute-the-cli-as-a-docker-image.md)
- Error and retry vocabulary: [ADR-006](ADR-006-unify-error-handling-vocabulary.md)
- Ingestion and ACSM fulfillment policy: [ADR-001](ADR-001-source-ingestion-and-normalization.md)
- Local OCR engine selection: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- Runtime tool resolution: `src/utils/runtime-paths.ts`
- Setup download and admission: `src/cli/commands/setup-and-utilities/setup/setup-download/download.ts`, `src/cli/commands/setup-and-utilities/setup/setup-download/download-admission.ts`
- Setup orchestration and doctor: `src/cli/commands/setup-and-utilities/setup/run-complete-setup.ts`, `src/cli/commands/setup-and-utilities/setup/run-doctor.ts`
- ACSM plugin provisioning: `src/cli/commands/setup-and-utilities/setup/setup-download/dl-document/acsm.ts`
- MuPDF and qpdf source recipes: `src/cli/commands/setup-and-utilities/setup/setup-download/mupdf-source-build.ts`, `src/cli/commands/setup-and-utilities/setup/setup-download/qpdf-source-build.ts`
- Managed artifact promotion: `src/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact.ts`
- Dependency metadata: `src/cli/commands/setup-and-utilities/setup/dependency-metadata.ts`
- Upstream releases: [MuPDF 1.27.2](https://github.com/ArtifexSoftware/mupdf-downloads/releases/tag/1.27.2), [qpdf 12.3.2](https://github.com/qpdf/qpdf/releases/tag/v12.3.2), [libjpeg-turbo 3.2.0](https://github.com/libjpeg-turbo/libjpeg-turbo/releases/tag/3.2.0)
