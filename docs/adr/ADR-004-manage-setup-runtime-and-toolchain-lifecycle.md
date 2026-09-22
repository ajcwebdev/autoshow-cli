# ADR-004: Manage the Setup Runtime and Toolchain Lifecycle

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed
- **Supersession:** Docker distribution is governed separately by [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md). This record remains accepted authority for host setup reliability and toolchain lifecycle.

## Context

AutoShow requires a local-lite tool set — FFmpeg and `ffprobe`, `yt-dlp`, MuPDF `mutool`, `qpdf`, Calibre `ebook-convert`, and Tesseract with English trained data — on macOS and Linux. Resolution order is an explicit `--bin-dir` override when that directory contains the binary, then a project-managed install under `runtime/` when this host installs one, then `PATH` on non-macOS hosts.

Several issues motivated unifying this lifecycle:

1. **Host provisioning drift.** macOS setup previously used Homebrew for several tools while other dependencies already lived under `runtime/`. Homebrew installs mutated global system state, varied by machine, and drifted from the managed runtime used for whisperfile and local models.
2. **Download reliability and integrity.** Setup downloads used total-transfer timeouts that aborted large assets on ordinary bandwidth. Retries restarted from byte zero, downloads lacked checksum verification, and unthrottled concurrent downloads saturated the link.
3. **Truthful reporting and diagnostics.** Setup could exit 0 after failed steps, and `setup --doctor` inspected version flags rather than whether the installed binaries actually run.
4. **Hermetic toolchain delivery.** Upstream MuPDF and qpdf releases do not publish prebuilt macOS CLI binaries, so those tools have to be compiled without picking up Homebrew libraries.

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
- **Pros:** Reproducible, project-managed binaries; no signing or release hosting infrastructure needed
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

- **Option:** Stall-based timeouts, resumable downloads, and checksum verification
- **Pros:** Transfer success independent of file size; retries resume remaining bytes; fails closed on corrupt downloads
- **Cons:** Requires resume handling and post-download hash verification
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

AutoShow provisions the local-lite toolchain as managed `runtime/` artifacts on macOS. On Linux, `yt-dlp` is a checksum-verified binary under `runtime/`; FFmpeg, MuPDF `mutool`, `qpdf`, Calibre `ebook-convert`, and Tesseract are installed with `apt`. macOS copies of these tools do not resolve through Homebrew or implicit `PATH` lookups.

1. **Host provisioning and resolver precedence:** macOS setup does not invoke Homebrew for AutoShow-managed dependencies. Those tools are installed under `runtime/`. Resolver precedence is:
   1. Explicit `--bin-dir` override when that directory contains the tool.
   2. AutoShow-managed binary under `runtime/`.
   3. `PATH` on non-macOS hosts when no override or managed binary is present. Linux setup uses that fallback for `apt` installs, and it accepts an existing `yt-dlp` on `PATH` instead of downloading one. Build prerequisites such as Xcode tools, `cmake`, and compilers always come from the host.
2. **Download integrity and reporting:** Downloads resume after interruption and verify checksums before install. A transfer aborts after 60 seconds without new data, and also when elapsed time reaches 15 minutes, or 60 minutes for the Calibre disk image and the whisperfile binary. Concurrent network transfers are bounded. Setup reports step timing, disk usage, and component health truthfully, and exits non-zero on partial failures. `setup --doctor` runs the installed binaries rather than inspecting version flags.
3. **Hermetic macOS MuPDF and qpdf builds:** Both tools are built from pinned upstream source on macOS as hermetic binaries with no host package-manager libraries. The qpdf recipe compiles pinned libjpeg-turbo into that binary. Cold macOS setup also compiles FFmpeg against a static LAME library and Tesseract against Leptonica.

This applies to:

- AutoShow-installed, runtime-managed dependencies on macOS, and the Linux `yt-dlp` binary under `runtime/`.
- Setup download resume, checksum validation, bounded transfer concurrency, and doctor diagnostics.
- Pinned source compilation on supported macOS hosts: MuPDF, qpdf with libjpeg-turbo, FFmpeg with LAME, and Tesseract with Leptonica.

It does not apply to:

- External host build prerequisites (Xcode command line tools, `cmake`, compilers).
- Linux host package management (`apt`).
- Docker container distribution (governed by [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)).
- Hosted provider credential validity (setup and `setup --doctor` report key presence only).

## Rationale

- **Host provisioning:** Treating local dependencies as managed runtime assets under `runtime/` aligns macOS with the pattern already used for whisperfile, Defuddle, and model assets. It pins versions and avoids mutating host system state.
- **Source builds:** Compiling MuPDF and qpdf from pinned source, with qpdf linked to pinned libjpeg-turbo, preserves exact versions and hermetic linkage without Apple Developer signing, notarization, or binary distribution infrastructure.
- **Acquisition and reporting:** Stall detection aborts a transfer that stops receiving data without treating a slow but active transfer as failed. A total deadline remains as a backstop. Resumable downloads continue from the last received byte. Bounding transfer concurrency prevents network contention, and truthful exit codes make incomplete installs fail closed.

## Consequences

Positive outcomes:

- macOS setup no longer mutates global Homebrew state for AutoShow-owned tools.
- Dependency versions and checksums are pinned and verifiable offline.
- `setup --doctor` checks that binaries actually run.
- Large model and tool downloads resume across network interruptions.

Negative outcomes:

- AutoShow maintainers must manage tool-specific download, packaging, and compilation recipes.
- Cold setup on macOS compiles MuPDF, qpdf with libjpeg-turbo, FFmpeg with LAME, and Tesseract with Leptonica.
- Sourcing `ebook-convert` requires extracting the official Calibre application bundle.
- Resumable downloads add resume and checksum bookkeeping.

## Trade-offs

**Trade-off 1**

- **Gain:** Reproducible macOS setup with pinned versions and checksums
- **Sacrifice:** Project maintains installation recipes for tools previously delegated to Homebrew

**Trade-off 2**

- **Gain:** Hermetic runtime without mutating global package-manager state
- **Sacrifice:** Cold setup incurs local compilation time for MuPDF, qpdf, FFmpeg, and Tesseract

**Trade-off 3**

- **Gain:** Resumable, stall-aware, and integrity-verified downloads
- **Sacrifice:** Setup owns resume and checksum verification

**Trade-off 4**

- **Gain:** Truthful diagnostic reporting and fail-closed exit codes
- **Sacrifice:** Partial installs fail explicitly rather than succeeding with warnings

## Implementation Note

Managed macOS tools resolve through `src/utils/runtime-paths.ts` and install from `src/cli/commands/setup-and-utilities/setup/setup-download/macos-managed-tools.ts`. Download resume, checksum verification, and bounded transfer concurrency live under `src/cli/commands/setup-and-utilities/setup/setup-download/`. Setup orchestration, summary reporting, and `setup --doctor` live under `src/cli/commands/setup-and-utilities/setup/`. User-facing behavior is documented in `docs/commands/00-setup-and-utilities/setup.md`.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/setup/
```

1. Interrupted downloads resume; corrupt downloads fail closed on checksum mismatch.
2. Setup fails non-zero on partial installs, reports progress while long steps run, and `setup --doctor` checks that binaries actually run.
3. macOS MuPDF and qpdf install as managed tools from pinned source rather than Homebrew.

## References

- Related ADR: [ADR-001](ADR-001-source-ingestion-and-normalization.md)
- Related ADR: [ADR-005](ADR-005-reduce-environment-variable-surface-area.md)
- Related ADR: [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md)
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- Related ADR: [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)
- `docs/commands/00-setup-and-utilities/setup.md`
- `src/utils/runtime-paths.ts`
- `src/cli/commands/setup-and-utilities/setup/setup-download/macos-managed-tools.ts`
- `src/cli/commands/setup-and-utilities/setup/dependency-metadata.ts`
- `test/test-cases/validation/setup/`
