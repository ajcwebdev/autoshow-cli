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

Provide FFmpeg/`ffprobe`, `yt-dlp`, MuPDF `mutool`, `qpdf`, Calibre `ebook-convert`, Tesseract with English trained data and image codecs, ImageMagick, Pango, Fontconfig, fonts, and supporting worker runtimes. Provision the complete toolchain beneath `runtime/`, including transitive third-party libraries, build helpers, dependency configuration, models, package installations, caches, locks, and temporary workspaces. Source, frozen manifests, authored inputs, and requested outputs retain their established locations.

Build pinned macOS native dependencies from verified upstream sources. Bootstrap additional build helpers under runtime; Apple's compiler/SDK and the initial CLI launcher form the explicit host boundary. Debian/Ubuntu payloads and dependencies are verified and extracted privately rather than installed into the host system. Container images distribute immutable seed artifacts and activate managed installations inside the mounted runtime root.

Resolve application dependencies only through validated runtime paths. `--bin-dir` may select a directory within that root, with symlink routes checked for escape. Do not support per-tool environment overrides or implicit global-tool discovery. Child environments specify private cache/temp, library, delegate, and font paths while preserving credential isolation. Keep fonts private rather than registering them globally. Managed FFmpeg provides the `ass` filter; the supported Pango fallback and ImageMagick operations use the same managed dependencies.

Stage replacements separately, validate capabilities and complete payload metadata, then promote atomically. Retain the last working installation after download, build, validation, or interruption failures. Validate native dependency closure recursively and permit external references only to approved platform libraries. Reuse compatible artifacts by source pins, recipe revision, architecture, dependency identities, payload integrity, and capability checks.

The pinned, signed macOS Calibre 9.9 distribution contains five optional GUI/test plugins whose four Qt frameworks are absent from the upstream bundle. Preserve the signed bundle unchanged, record the six unresolved dependency edges in its receipt, and restrict the exception to those exact plugin images. Before every `ebook-convert` dispatch, recheck the signature and absent frameworks, and use a process sandbox to deny networking and reads of those images; signature assessment uses its own network-denied child sandbox. Fail closed when the required sandbox is unavailable. All other dependency edges remain subject to strict closure validation. Support CLI conversion, with a functional setup check; these optional GUI/test components remain unavailable.

Downloads resume after interruption and verify checksums. Abort after 60 seconds without data or total limits of 15 minutes, extended to 60 minutes for Calibre and whisperfile. Bound concurrent transfers and subprocess diagnostic capture; drain streams even when retained output is truncated. Partial setup fails non-zero. `setup --dry-run` plans work without filesystem mutation. Targeted toolchain, OCR, rendering, and alignment steps provision their dependency graphs and execute functional capability checks. `setup --doctor` verifies complete managed receipts/resources without installation or repair; safe macOS executable probes run with writes and networking denied. Probe execution is deferred to setup on platforms without the read-only sandbox, and for tools that cannot be probed safely. Doctor is advisory; `--strict` exits 2 on any readiness warning, including invalid configuration, missing configured credentials/assets, or unreadable cookies.

### Credentials and environment

Use CLI/configuration for non-credential controls. Admit environment variables only for credentials, standard system conventions, explicit child-process needs, or documented overrides without a CLI equivalent.

One credential registry drives `.env.example`, missing-key errors, and doctor. Missing keys name the variable and remediation URL and exit 2. Report presence, never credential validity, and never save raw keys. Child environments allow only system controls and explicitly needed state; unrelated provider credentials do not propagate. Full setup receives an allowlisted key-name snapshot through internal `AUTOSHOW_SETUP_PROVIDER_PRESENCE`, without credential values; tool children receive neither. Provider endpoints use trusted defaults without runtime base-URL overrides.

[ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md) owns Docker injection; mounted `/app/.env` files are intentionally not loaded.

Non-credential overrides are documented in the [setup guide](../commands/00-setup-and-utilities/setup.md#runtime-environment-overrides):

- `AUTOSHOW_PROJECT_ROOT` relocates the mutable project/runtime root, managed binaries, and project-relative path resolution. Set it before module initialization. Saved configuration defaults to `runtime/autoshow.json`; preserve legacy configuration during migration, and use `--config-path` to select another file explicitly.
- `AUTOSHOW_OCR_PAGE_REQUEST_TIMEOUT_MS` sets the hosted per-page timeout: default `300000`, integer range `1–900000` ms. It does not change whole-document deadlines.
- `AUTOSHOW_SOURCE_IDENTITY_ROOT` and `AUTOSHOW_SOURCE_IDENTITY_ALIAS` map persisted display identities across mounts without changing file access. Use an absolute local root and normalized absolute POSIX alias without traversal.
- `AUTOSHOW_HTTP_PAYLOAD_MAX_BYTES` follows [ADR-019](ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md).

### Shared command-budget reservations

Independent processes may share `AUTOSHOW_BUDGET_LEDGER`, `AUTOSHOW_BUDGET_CENTS`, and `AUTOSHOW_BUDGET_RESERVE_CENTS`; require all three with positive safe-integer cents and an immutable ledger cap. `--require-shared-budget` requires this configuration. Execution supports `write`, `extract`, `download`, `tts`, `image`, `video`, and `music`; unsupported roots fail closed. Help/version and valid price-only commands make no reservation.

Reserve before handlers under a bounded, owner-checked lock with atomic replacement and file/directory synchronization. Count reservations, completed allocations, and uncertain outcomes cumulatively. Reject symlinks, FIFOs, corrupt accounting, and mismatched caps; never automatically clear stale locks or unfinished receipts.

Require complete accepted whole-command pricing before paid dispatch. Neither skipped/unknown prices nor `--allow-over-budget` bypass a reservation. Success books the full allocation; failures retain it as uncertain, and killed processes leave durable holds. This is command-admission accounting, not invoice reconciliation or a provider-enforced cap; external calls do not participate and actual charges may differ.

Reconcile only through the operator tool with receipt ID, immutable cap, integer-cent charge, billing evidence, and `--confirm-stopped`. That flag declares all participating processes stopped and provider requests resolved; it is not remote-completion proof. A charge above its reservation persists a fatal state and blocks further admission. Existing spending approvals remain required. See [shared runtime budgeting](../commands/00-setup-and-utilities/usage.md#shared-runtime-budget).

## Trade-offs

Pinned source builds avoid global package mutation and prebuilt signing infrastructure but add cold compilation, storage, and recipe maintenance. Complete dependency closure improves relocation and reproducibility while requiring functional codec, font, and rendering probes. Explicit environment allowlists reduce credential exposure but must track tool needs. Conservative budget holds prevent optimistic reuse of uncertain funds but require manual reconciliation.

## Verification

```bash
bun test test/test-cases/validation/setup/
bun test test/test-cases/validation/cli/child-env-contracts.test.ts
bun test test/test-cases/validation/runtime-contracts/spending-ledger.test.ts test/test-cases/validation/runtime-contracts/runtime-spending-budget.test.ts
```

Local contracts cover verified downloads, partial failure, readiness, credential isolation, bounded capture, concurrent reservations, unsafe paths, and explicit reconciliation. They do not validate live credentials or provider invoices. The guarded MuPDF/qpdf prebuilt distribution validator remains tested; those native recipes use source artifacts. Managed JavaScript runtimes use separately verified upstream distribution artifacts.

## References

- [Setup guide](../commands/00-setup-and-utilities/setup.md)
- `src/cli/commands/setup-and-utilities/setup/`
- `src/utils/runtime-paths.ts` and `src/utils/child-env.ts`
- `src/utils/spending-ledger.ts`, `src/utils/runtime-spending-budget.ts`, and `src/tools/spending-ledger-command.ts`
