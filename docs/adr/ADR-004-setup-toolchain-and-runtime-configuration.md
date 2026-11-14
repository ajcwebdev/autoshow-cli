# ADR-004: Setup, Toolchain, and Runtime Configuration

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-11-14
- **Verification Status:** Passed

## Context

Local workflows depend on media, document, and rendering tools. Setup must verify installations, report incomplete readiness, and isolate credentials from subprocesses.

## Decision

### Toolchain and readiness

Provide FFmpeg/`ffprobe`, `yt-dlp`, MuPDF `mutool`, `qpdf`, Calibre `ebook-convert`, and Tesseract with English trained data. Manage macOS tools under `runtime/` without Homebrew. Build pinned MuPDF and qpdf from source without package-manager libraries; cold setup also compiles FFmpeg and Tesseract and extracts Calibre. Linux uses existing tools or `apt` for missing dependencies and downloads checksum-verified `yt-dlp` when absent.

Resolve binaries through `--bin-dir`, then managed `runtime/`, then `PATH` on non-macOS hosts. Do not support per-tool environment overrides. Compilers, Xcode tools, and `cmake` remain host prerequisites. Full setup also requires host ImageMagick with TIFF, Fontconfig, and DejaVu Sans; lyric rendering needs FFmpeg `ass` or Pango.

Downloads resume after interruption and verify checksums. Abort after 60 seconds without data or total limits of 15 minutes, extended to 60 minutes for Calibre and whisperfile. Bound concurrent transfers and subprocess diagnostic capture; drain streams even when retained output is truncated. Partial setup fails non-zero. `setup --doctor` executes resolved tools and validates managed provenance. Doctor is advisory; `--strict` exits 2 on any readiness warning, including invalid configuration, missing configured credentials/assets, or unreadable cookies.

### Credentials and environment

Use CLI/configuration for non-credential controls. Admit environment variables only for credentials, standard system conventions, explicit child-process needs, or documented overrides without a CLI equivalent.

One credential registry drives `.env.example`, missing-key errors, and doctor. Missing keys name the variable and remediation URL and exit 2. Report presence, never credential validity, and never save raw keys. Child environments allow only system controls and explicitly needed state; unrelated provider credentials do not propagate. Full setup receives an allowlisted key-name snapshot through internal `AUTOSHOW_SETUP_PROVIDER_PRESENCE`, without credential values; tool children receive neither. Provider endpoints use trusted defaults without runtime base-URL overrides.

[ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md) owns Docker injection; mounted `/app/.env` files are intentionally not loaded.

Non-credential overrides are documented in the [setup guide](../commands/00-setup-and-utilities/setup.md#runtime-environment-overrides):

- `AUTOSHOW_PROJECT_ROOT` relocates the mutable project/runtime root, managed binaries, and project-relative path resolution. Set it before module initialization. Config lookup independently follows the working directory's nearest `package.json`; use `--config-path` to select another file.
- `AUTOSHOW_OCR_PAGE_REQUEST_TIMEOUT_MS` sets the hosted per-page timeout: default `300000`, integer range `1–900000` ms. It does not change whole-document deadlines.
- `AUTOSHOW_SOURCE_IDENTITY_ROOT` and `AUTOSHOW_SOURCE_IDENTITY_ALIAS` map persisted display identities across mounts without changing file access. Use an absolute local root and normalized absolute POSIX alias without traversal.
- `AUTOSHOW_HTTP_PAYLOAD_MAX_BYTES` follows [ADR-019](ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md).

### Shared command-budget reservations

Independent processes may share `AUTOSHOW_BUDGET_LEDGER`, `AUTOSHOW_BUDGET_CENTS`, and `AUTOSHOW_BUDGET_RESERVE_CENTS`; require all three with positive safe-integer cents and an immutable ledger cap. `--require-shared-budget` requires this configuration. Execution supports `write`, `extract`, `download`, `tts`, `image`, `video`, and `music`; unsupported roots fail closed. Help/version and valid price-only commands make no reservation.

Reserve before handlers under a bounded, owner-checked lock with atomic replacement and file/directory synchronization. Count reservations, completed allocations, and uncertain outcomes cumulatively. Reject symlinks, FIFOs, corrupt accounting, and mismatched caps; never automatically clear stale locks or unfinished receipts.

Require complete accepted whole-command pricing before paid dispatch. Neither skipped/unknown prices nor `--allow-over-budget` bypass a reservation. Success books the full allocation; failures retain it as uncertain, and killed processes leave durable holds. This is command-admission accounting, not invoice reconciliation or a provider-enforced cap; external calls do not participate and actual charges may differ.

Reconcile only through the operator tool with receipt ID, immutable cap, integer-cent charge, billing evidence, and `--confirm-stopped`. That flag declares all participating processes stopped and provider requests resolved; it is not remote-completion proof. A charge above its reservation persists a fatal state and blocks further admission. Existing spending approvals remain required. See [shared runtime budgeting](../commands/00-setup-and-utilities/usage.md#shared-runtime-budget).

## Trade-offs

Pinned source builds avoid global package mutation and prebuilt signing infrastructure but add cold compilation and recipe maintenance. Explicit environment allowlists reduce credential exposure but must track tool needs. Conservative budget holds prevent optimistic reuse of uncertain funds but require manual reconciliation.

## Verification

```bash
bun test test/test-cases/validation/setup/
bun test test/test-cases/validation/cli/child-env-contracts.test.ts
bun test test/test-cases/validation/runtime-contracts/spending-ledger.test.ts test/test-cases/validation/runtime-contracts/runtime-spending-budget.test.ts
```

Local contracts cover verified downloads, partial failure, readiness, credential isolation, bounded capture, concurrent reservations, unsafe paths, and explicit reconciliation. They do not validate live credentials or provider invoices. The guarded prebuilt validator is tested but current provisioning has no pinned prebuilt candidates.

## References

- [Setup guide](../commands/00-setup-and-utilities/setup.md)
- `src/cli/commands/setup-and-utilities/setup/`
- `src/utils/runtime-paths.ts` and `src/utils/child-env.ts`
- `src/utils/spending-ledger.ts`, `src/utils/runtime-spending-budget.ts`, and `src/tools/spending-ledger-command.ts`
