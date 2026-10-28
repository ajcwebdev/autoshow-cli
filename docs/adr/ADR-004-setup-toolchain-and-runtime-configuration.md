# ADR-004: Setup, Toolchain, and Runtime Configuration

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-10-28
- **Verification Status:** Passed
- **Supersession:** Absorbs "Reduce the Environment-Variable Surface Area" in full. Docker distribution and the container credential boundary are governed by [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md). This record is the accepted authority for host setup, the toolchain lifecycle, and the environment-variable surface.

## Context

AutoShow requires FFmpeg and `ffprobe`, `yt-dlp`, MuPDF `mutool`, `qpdf`, Calibre `ebook-convert`, and Tesseract with English trained data for local workflows on macOS and Linux. The pinned macOS MuPDF and qpdf dependencies use source builds that avoid host package-manager libraries. Full setup also requires host-provided ImageMagick with TIFF support, Fontconfig, and DejaVu Sans; lyric rendering requires FFmpeg's `ass` filter or Pango.

Previously, macOS provisioning depended on Homebrew, interrupted downloads restarted from zero, and setup could report success after failed steps. Configuration had accumulated unused variables, redundant binary overrides, inconsistent missing-credential errors, and unrestricted credential inheritance into child processes.

Why now: host provisioning, download integrity, offline diagnostics, and the configuration surface describe one runtime, and a configuration audit showed the CLI documenting and inheriting variables it does not use.

## Options Considered

### Host Dependency Source

**Option 1 (selected)**

- **Option:** Runtime-managed macOS dependencies under `runtime/`
- **Pros:** Pinned versions, checksum verification, no global package-manager mutation
- **Cons:** The project maintains download and build recipes per tool
- **Quantitative Notes:** n/a

**Option 2**

- **Option:** Keep Homebrew on macOS
- **Pros:** Lower implementation cost
- **Cons:** Mutates global machine state and drifts between machines
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Manual user-installed dependencies
- **Pros:** Minimal setup code
- **Cons:** Degrades onboarding and weakens `setup --doctor`
- **Quantitative Notes:** n/a

### macOS MuPDF and qpdf Delivery

**Option 1 (selected)**

- **Option:** Hermetic host source builds from pinned upstream source
- **Pros:** Reproducible binaries with no signing or release-hosting infrastructure
- **Cons:** Compilation time on cold setup
- **Quantitative Notes:** n/a

**Option 2**

- **Option:** Upstream prebuilts or Homebrew bottles
- **Pros:** No local compilation
- **Cons:** The pinned dependencies use source archives, and bottles reintroduce the package-manager dependency
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Project-hosted signed prebuilts
- **Pros:** No local compilation
- **Cons:** Requires Apple Developer credentials, notarization, and binary release infrastructure
- **Quantitative Notes:** n/a

### Setup Transfer, Health, and Reporting

**Option 1 (selected)**

- **Option:** Stall-based timeouts, resumable downloads, checksum verification, and truthful exit codes
- **Pros:** Transfer success independent of file size; retries resume; corrupt downloads and partial installs fail closed
- **Cons:** Setup owns resume and hash bookkeeping
- **Quantitative Notes:** Covers multi-gigabyte model and runtime archives

**Option 2**

- **Option:** Flat total-transfer timeouts with optimistic exit codes
- **Pros:** Minimal code
- **Cons:** Imposes bandwidth floors, restarts from byte zero, and masks failed steps
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Shell out to `curl -C -`
- **Pros:** Native resume
- **Cons:** Adds a system-tool dependency and fragments download behavior across platforms
- **Quantitative Notes:** n/a

### Environment-Variable Surface

**Option 1 (selected)**

- **Option:** Keep credentials, standard system variables, and values spawned processes must receive; replace everything else with CLI flags, typed parameters, OS APIs, or trusted defaults; one credential list, one missing-key error, a `setup --doctor --strict` gate, and an allowlisted child environment
- **Pros:** `.env.example` matches behavior, `--bin-dir` replaces per-tool overrides, one missing-key contract, a CI readiness gate, no credential leakage into spawned tools
- **Cons:** Removes ad-hoc environment escape hatches
- **Quantitative Notes:** n/a

**Option 2**

- **Option:** Leave the surface as-is and fix inconsistencies as they surface
- **Pros:** No migration
- **Cons:** Rejected; the lists had already drifted into dead entries and divergent errors, and every new provider repeats that drift
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Remove every non-credential variable, including values passed into spawned processes
- **Pros:** Smallest runtime surface
- **Cons:** Breaks child processes that must receive explicit state
- **Quantitative Notes:** n/a

**Option 4**

- **Option:** Replace environment credentials with a credential file or OS keychain
- **Pros:** Credentials leave the environment entirely
- **Cons:** Rejected; environment variables are the standard credential channel that deployment guides and the Docker credential boundary ([ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)) assume, and an allowlist already stops inheritance
- **Quantitative Notes:** n/a

## Decision

AutoShow provisions the managed toolchain under `runtime/` on macOS and limits environment configuration to credentials, explicit child-process needs, standard system conventions, and documented overrides without a CLI equivalent. On Linux, setup downloads a checksum-verified `yt-dlp` under `runtime/` when none is available and installs missing FFmpeg, MuPDF `mutool`, `qpdf`, Calibre `ebook-convert`, and Tesseract through `apt`.

1. **Host provisioning and resolver precedence:** macOS setup does not invoke Homebrew for AutoShow-managed dependencies. Resolver precedence is:
   1. Explicit `--bin-dir` override when that directory contains the tool. `--bin-dir` is the only binary location override; per-tool environment variables are not supported.
   2. AutoShow-managed binary under `runtime/`.
   3. `PATH` on non-macOS hosts when no override or managed binary is present. Linux setup uses that fallback for `apt` installs and accepts an existing `yt-dlp` on `PATH` instead of downloading one. Build prerequisites such as Xcode tools, `cmake`, and compilers always come from the host.
2. **Download integrity and reporting:** Downloads resume after interruption and verify checksums before install. A transfer aborts after 60 seconds without new data, and also when elapsed time reaches 15 minutes, or 60 minutes for the Calibre disk image and the whisperfile binary. Concurrent network transfers are bounded. Setup reports step timing, disk usage, and component health truthfully, and exits non-zero on partial failures. `setup --doctor` executes the resolved binaries and validates managed MuPDF and qpdf provenance.
3. **Hermetic macOS builds:** MuPDF and qpdf are built from pinned source without host package-manager libraries. Cold macOS setup also compiles FFmpeg and Tesseract.
4. **Runtime configuration surface:** Provider credentials stay environment variables and are listed in `.env.example`. One credential list drives missing-key hints and `setup --doctor`. A missing credential fails with one error that names the variable, includes a hint URL, and exits 2. `setup --doctor` stays advisory. `setup --doctor --strict` exits 2 when configured defaults lack credentials, configuration is invalid, configured cookies are unreadable, or a required runtime or model asset is unavailable. Spawned children receive `PATH`, `HOME`, terminal controls, and values they explicitly need, never the parent credential set. Saved run output does not store raw credential values. Provider clients use trusted default endpoints; runtime base-URL overrides are not supported.

This applies to:

- AutoShow-managed dependencies on macOS and the Linux `yt-dlp` binary under `runtime/`, including their download, verification, compilation, and doctor diagnostics.
- Runtime environment variables, `.env.example`, `--bin-dir`, provider endpoints, missing-credential failures, `setup --doctor --strict`, and what spawned children inherit.

It does not apply to:

- External host build and rendering prerequisites, including ImageMagick, Fontconfig, DejaVu fonts, and Pango, and Linux host package management through `apt`.
- Docker image contents, mounts, and publication, and credential delivery through Docker's `--env-file` and `-e` options. [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md) owns the container credential boundary; mounted `/app/.env` files are intentionally not loaded.
- Hosted provider credential validity. Setup and `setup --doctor` report key presence only.
- Standard system variables such as `PATH`, `HOME`, `NO_COLOR`, and `FORCE_COLOR`.
- Error classes and rendering. The missing-credential contract uses the error taxonomy that [ADR-005](ADR-005-cli-error-result-and-retry-contract.md) owns.
- The payload-limit behavior of `AUTOSHOW_HTTP_PAYLOAD_MAX_BYTES`, which [ADR-019](ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md) owns. This record admits it as a production override with no CLI equivalent.

## Rationale

- Managed runtime assets pin versions and checksums and avoid mutating host system state, matching how whisperfile and model assets were already delivered.
- Pinned source builds give exact versions and hermetic linkage without Apple signing, notarization, or binary distribution infrastructure.
- Stall detection aborts a transfer that stops receiving data without treating a slow but active transfer as failed, and truthful exit codes make incomplete installs fail closed.
- A variable that does nothing, or that duplicates a flag, does not belong in `.env.example` or help text, and a trusted default endpoint is not configuration.
- Environment variables remain the credential channel because deployment guides and the Docker credential boundary assume them; an inheritance allowlist stops the leakage without changing how keys are supplied.
- One credential list and one exit code make a missing key predictable for scripts, and `setup --doctor --strict` gives CI a fail-closed gate while default doctor stays advisory.

## Consequences

Positive outcomes:

- macOS setup no longer mutates global Homebrew state, and dependency versions and checksums are verifiable offline.
- Large downloads resume across interruptions, and `setup --doctor` checks that binaries actually run.
- `.env.example` lists only variables the CLI reads, `--bin-dir` is the only binary override, and missing credentials share one error and exit code.
- `setup --doctor --strict` can gate CI, and spawned tools do not receive unrelated credentials.

Negative outcomes:

- Cold macOS setup compiles MuPDF, qpdf, FFmpeg, and Tesseract, and `ebook-convert` is extracted from the official Calibre application bundle.
- Per-tool binary environment overrides and runtime base-URL repointing are unavailable.
- Each tool's child-environment allowlist has to stay accurate; omitting a variable the tool reads can break that tool.

## Trade-offs

**Trade-off 1**

- **Gain:** Reproducible, hermetic macOS setup with pinned versions and checksums
- **Sacrifice:** The project maintains installation recipes and cold setup compiles four tools

**Trade-off 2**

- **Gain:** Resumable, stall-aware, integrity-verified downloads and fail-closed reporting
- **Sacrifice:** Partial installs fail explicitly rather than succeeding with warnings

**Trade-off 3**

- **Gain:** A configuration surface that matches what the CLI reads, with trusted default endpoints
- **Sacrifice:** Rarely used environment overrides and endpoint repointing

**Trade-off 4**

- **Gain:** One missing-credential contract and per-process credential isolation
- **Sacrifice:** Exit code 2 for missing keys, and per-tool allowlists that must track what third-party tools read

## Implementation Note

Setup and doctor are implemented under `src/cli/commands/setup-and-utilities/setup/`. `src/utils/runtime-paths.ts` enforces resolver precedence, including the absence of a macOS `PATH` fallback; `src/utils/child-env.ts` controls child inheritance. User-facing configuration and setup behavior are documented in the [setup guide](../commands/00-setup-and-utilities/setup.md).

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/setup/
bun test test/test-cases/validation/cli/child-env-contracts.test.ts
```

1. Interrupted downloads resume, corrupt downloads fail closed on checksum mismatch, and partial installs exit non-zero.
2. `setup --doctor` stays advisory and `setup --doctor --strict` exits 2 for missing configured credentials and other readiness warnings.
3. `.env.example` stays aligned with the credential list.
4. A spawned child does not see unrelated provider credentials.

## References

- Related ADR: [ADR-001](ADR-001-source-ingestion-and-normalization.md)
- Related ADR: [ADR-005](ADR-005-cli-error-result-and-retry-contract.md)
- Related ADR: [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md)
- Related ADR: [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)
- Related ADR: [ADR-019](ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md)
- [Setup](../commands/00-setup-and-utilities/setup.md)
