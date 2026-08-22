# ADR-004: Manage the Setup Runtime and Toolchain Lifecycle

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed
- **Supersession:** Docker distribution is governed separately by [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md). This record remains accepted authority for host setup reliability and toolchain lifecycle.

## Context

AutoShow requires a local-lite tool set — FFmpeg and `ffprobe`, `yt-dlp`, MuPDF `mutool`, `qpdf`, Calibre `ebook-convert`, and Tesseract with English trained data — on macOS and Linux. Those tools must resolve the same way on every host: a user override if provided, otherwise a project-managed install under `runtime/`, otherwise an unmanaged system tool.

Several issues motivated unifying this lifecycle:

1. **Host provisioning drift.** macOS setup previously used Homebrew for several tools while other dependencies already lived under `runtime/`. Homebrew installs mutated global system state, varied by machine, and drifted from the managed runtime used for `whisper-cli`, whisperfile, and local models. Linux hosts continue to use `apt`.
2. **Download reliability and integrity.** Setup downloads used total-transfer timeouts that aborted large assets on ordinary bandwidth. Retries restarted from byte zero, downloads lacked checksum verification, and unthrottled concurrent downloads saturated the link.
3. **Truthful reporting and diagnostics.** Setup could exit 0 after failed steps, and `setup --doctor` inspected version flags rather than whether the installed binaries actually run.
4. **Hermetic toolchain delivery.** Upstream MuPDF and qpdf releases do not publish prebuilt macOS CLI binaries. Default source builds risked linking against host Homebrew libraries instead of portable system linkage.

Why now: host provisioning, download integrity, and offline diagnostic health require one authoritative lifecycle.

## Options Considered

### Host Dependency Source

**Option 1 (selected)**

- **Option:** Runtime-managed macOS dependencies
- **Pros:** Pinned versions, checksum verification, cacheable installs; avoids global package-manager mutation
- **Cons:** Requires download, build, and management logic per tool
- **Quantitative Notes:** Replaces 6 Homebrew-managed install paths

**Option 2**

- **Option:** Keep Homebrew on macOS
- **Pros:** Lower initial implementation cost; uses familiar package names
- **Cons:** Mutates global machine state; introduces environment drift; less reproducible
- **Quantitative Notes:** Preserves 6 Homebrew-managed paths

**Option 3**

- **Option:** Manual user-installed dependencies
- **Pros:** Minimal setup code
- **Cons:** Degrades onboarding; weakens `setup --doctor` validation
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
- **Cons:** Reintroduces package-manager dependency and breaks the hermetic runtime boundary
- **Quantitative Notes:** Reintroduces Homebrew dependencies

**Option 4**

- **Option:** Project-hosted signed prebuilts
- **Pros:** Eliminates local compilation time
- **Cons:** Requires Apple Developer credentials, signing, notarization, and binary release infrastructure
- **Quantitative Notes:** High operational overhead

### Setup Transfer, Health, and Reporting

**Option 1 (selected)**

- **Option:** Stall-based timeouts, resumable `.part` streaming, and checksum verification
- **Pros:** Transfer success independent of file size; retries resume remaining bytes; fails closed on corrupt downloads
- **Cons:** Requires partial-file handling and post-download hash verification
- **Quantitative Notes:** Covers multi-gigabyte models and runtime archives

**Option 2**

- **Option:** Flat total-transfer timeouts
- **Pros:** Minimal code change
- **Cons:** Imposes arbitrary bandwidth floors; restarts from byte zero
- **Quantitative Notes:** Fails large models on slow links

**Option 3**

- **Option:** Shell out to `curl -C -`
- **Pros:** Provides native resume capability
- **Cons:** Adds an external system-tool dependency; fragments download logic
- **Quantitative Notes:** Inconsistent across platforms

**Option 4**

- **Option:** Optimistic exit and summary reporting
- **Pros:** No error-handling complexity
- **Cons:** Masks failed setup steps; leaves doctor checks incomplete
- **Quantitative Notes:** Inaccurate diagnostic status

## Decision

AutoShow provisions the local-lite toolchain through managed `runtime/` artifacts on macOS and `apt` on Linux. macOS managed tools do not resolve through Homebrew or implicit `PATH` lookups.

1. **Host provisioning and resolver precedence:** macOS setup does not invoke Homebrew for AutoShow-managed dependencies. Tools are installed under `runtime/`. Resolver precedence is:
   1. Explicit `--bin-dir` override.
   2. AutoShow-managed binary under `runtime/`.
   3. `PATH` only for tools AutoShow does not manage on that host (Linux `apt` installs, and build prerequisites such as Xcode tools, `cmake`, and compilers).
2. **Download integrity, transfer concurrency, and health:** Downloads use stall-based inactivity timeouts, stream to resumable `<destination>.part` files, and verify checksums before the finished file is installed. Concurrent network transfers are bounded. Setup reports step timing, disk usage, and component health truthfully, and exits non-zero on partial failures. `setup --doctor` runs the installed binaries rather than inspecting version flags.
3. **Hermetic macOS MuPDF and qpdf builds:** Both tools are built from pinned upstream source on macOS as hermetic binaries with no host package-manager libraries. qpdf statically links a pinned libjpeg-turbo rather than a Homebrew JPEG library.

This applies to:

- AutoShow-installed, runtime-managed dependencies on macOS.
- Setup download resume, checksum validation, bounded transfer concurrency, disk cleanup, and doctor diagnostics.
- Pinned source compilation of MuPDF and qpdf on supported macOS hosts.

It does not apply to:

- External host build prerequisites (Xcode command line tools, `cmake`, compilers).
- Linux host package management (`apt`).
- Docker container distribution (governed by [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)).
- Hosted provider credential validity (setup and `setup --doctor` report key presence only).

## Rationale

- **Host provisioning:** Treating local dependencies as managed runtime assets under `runtime/` aligns macOS with the pattern already used for `whisper-cli`, whisperfile, Defuddle, and model assets. It pins versions and avoids mutating host system state.
- **Source builds:** Compiling MuPDF and qpdf from pinned source preserves exact versions and hermetic linkage without Apple Developer signing credentials, notarization pipelines, or binary distribution infrastructure.
- **Acquisition and reporting:** Stall-based timeouts and resumable streaming decouple download reliability from bandwidth and file size. Bounding transfer concurrency prevents network contention, and truthful exit codes make incomplete installs fail closed.

## Consequences

Positive outcomes:

- macOS setup no longer mutates global Homebrew state for AutoShow-owned tools.
- Dependency versions and checksums are pinned and verifiable offline.
- `setup --doctor` checks that binaries actually run.
- Large model and tool downloads resume across network interruptions.
- Transient `runtime/build` working trees are removed after setup.

Negative outcomes:

- AutoShow maintainers must manage tool-specific download, packaging, and compilation recipes.
- Cold setup on macOS compiles MuPDF and qpdf locally.
- Sourcing `ebook-convert` requires extracting the official Calibre application bundle.
- Resumable downloads add partial-file and checksum bookkeeping.

## Trade-offs

**Trade-off 1**

- **Gain:** Reproducible macOS setup with pinned versions and checksums
- **Sacrifice:** Project maintains installation recipes for tools previously delegated to Homebrew

**Trade-off 2**

- **Gain:** Hermetic runtime without mutating global package-manager state
- **Sacrifice:** Cold setup incurs local compilation time for MuPDF and qpdf

**Trade-off 3**

- **Gain:** Transfer-size-independent, resumable, and integrity-verified downloads
- **Sacrifice:** Setup manages `.part` files and post-download hash checks

**Trade-off 4**

- **Gain:** Truthful diagnostic reporting and fail-closed exit codes
- **Sacrifice:** Partial installs fail explicitly rather than succeeding with warnings

## Implementation Note

- Runtime-managed macOS dependencies — resolved in `src/utils/runtime-paths.ts` and installed in `src/cli/commands/setup-and-utilities/setup/setup-download/macos-managed-tools.ts`
- Resumable downloads, stall timeouts, and bounded transfer concurrency — implemented in `src/cli/commands/setup-and-utilities/setup/setup-download/`
- Setup summary reporting and offline doctor checks — implemented in `src/cli/commands/setup-and-utilities/setup/`
- Hermetic macOS MuPDF and qpdf source builds — implemented in `src/cli/commands/setup-and-utilities/setup/setup-download/`

## Keep (with rationale)

- `config/deps.json` remains a supported user override merged over default dependency metadata.
- Transient `runtime/build` trees are pruned automatically after setup.

## Test Plan

Verification is automated through default check routines and focused contract validation suites:

```bash
bun run check
bun test test/test-cases/validation/setup/
```

1. Downloads resume from partial files, reject corrupt leftovers, and fail closed on checksum mismatch.
2. Setup bounds concurrent transfers, reports progress while long steps run, fails non-zero on partial installs, and `setup --doctor` checks that binaries actually run.
3. MuPDF and qpdf installs validate platform, hermetic linkage, and complete replacement of the previous install.

## References

- Related ADR: [ADR-001](ADR-001-source-ingestion-and-normalization.md) — ebook normalization and Calibre-backed conversion
- Related ADR: [ADR-005](ADR-005-reduce-environment-variable-surface-area.md) — `--bin-dir` override and credential-presence doctor policy
- Related ADR: [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md) — error and retry vocabulary
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md) — local OCR engine this toolchain provisions
- Related ADR: [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md) — Docker distribution
- Runtime tool resolution: `src/utils/runtime-paths.ts`
- Setup download and admission: `src/cli/commands/setup-and-utilities/setup/setup-download/download.ts`, `src/cli/commands/setup-and-utilities/setup/setup-download/download-admission.ts`
- Setup orchestration and doctor: `src/cli/commands/setup-and-utilities/setup/run-complete-setup.ts`, `src/cli/commands/setup-and-utilities/setup/run-doctor.ts`
- MuPDF and qpdf source recipes: `src/cli/commands/setup-and-utilities/setup/setup-download/mupdf-source-build.ts`, `src/cli/commands/setup-and-utilities/setup/setup-download/qpdf-source-build.ts`
- Managed artifact promotion: `src/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact.ts`
- Dependency metadata: `src/cli/commands/setup-and-utilities/setup/dependency-metadata.ts`
- Upstream releases: [MuPDF 1.27.2](https://github.com/ArtifexSoftware/mupdf-downloads/releases/tag/1.27.2), [qpdf 12.3.2](https://github.com/qpdf/qpdf/releases/tag/v12.3.2), [libjpeg-turbo 3.2.0](https://github.com/libjpeg-turbo/libjpeg-turbo/releases/tag/3.2.0)
