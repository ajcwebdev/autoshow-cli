# ADR-006: Unify the Logging and Error-Handling Vocabulary

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-13
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed
- **Supersession:** Absorbs the timestamp and concise diagnostic-rendering decisions from the retired record "Optimize Price Preflight Performance, Test Concurrency, and Token-Efficient Logging". [ADR-021](ADR-021-adopt-table-free-text-json-results-and-safe-retry-ownership.md) supersedes this record's logging/output contract and TTS-only ambiguous-redispatch scope. This record remains authoritative for the `AppError` vocabulary, single CLI error funnel, and standing source enforcement.

## Context

Production failures already passed through one handler, but most throw sites still used plain `Error`. Those runs exited 1 with no `kind`, `hints`, `metadata`, or `stage`. Usage detection compared class names, remediation hints were scraped from message text, and deterministic failures were retried because retryability was unset. A one-time conversion to `AppError` then drifted, because nothing checked new throws.

Why now: the vocabulary stays unified only if the suite rejects a new plain `Error` when it lands.

## Options Considered

**Option 1 (selected)**

- **Option:** Full `AppError` sweep: one throw type, structured usage detection, co-located hints, aligned retry helpers, and shared validator wrapping
- **Pros:** One throw vocabulary; message scanning and class-name checks go away; every failure has `kind`, `stage`, `hints`, and `metadata`
- **Cons:** Large mechanical refactor; each throw needs a `kind` judgement
- **Quantitative Notes:** Every production throw site under `src/`

**Option 2**

- **Option:** Fix usage detection, hints, retry helpers, and validator wrapping, and leave plain `Error` throws in place
- **Pros:** Small, low-risk
- **Cons:** Message-scanning hints stay; two throw vocabularies remain
- **Quantitative Notes:** Rejected; root cause remains

**Option 3**

- **Option:** Do nothing on the error vocabulary
- **Pros:** Plain `Error` throws already exit 1
- **Cons:** Two vocabularies remain, and the workarounds keep accreting
- **Quantitative Notes:** Rejected

**Option 4**

- **Option:** Add a sixth `pipeline` error kind
- **Pros:** A dedicated bucket for step failures
- **Cons:** Splinters the vocabulary; the existing kinds already cover every case and all map to exit 1
- **Quantitative Notes:** Rejected; adds 1 unused kind

**Option 5 (selected)**

- **Option:** Pin the throw vocabulary with source-scan contract tests, and name every exception in an in-file allowlist
- **Pros:** Drift fails the suite; no new tooling
- **Cons:** A text scan can miss an unusual spelling, and each allowlist entry has to stay justified
- **Quantitative Notes:** n/a

**Option 6**

- **Option:** Adopt ESLint to ban `new Error(`
- **Pros:** AST-accurate; per-directory overrides are first-class
- **Cons:** Introduces a linter this repository does not otherwise use; a source-scan test already pins the rule
- **Quantitative Notes:** Rejected

**Option 7**

- **Option:** Re-run the sweep and mark this record verified, without a standing check
- **Pros:** Smallest change
- **Cons:** Repeats the failure mode: a `Passed` record while the vocabulary drifts
- **Quantitative Notes:** Rejected; the missing piece is the standing check

## Decision

`AppError` and its typed subclasses are the only throw type in `src/`. One CLI error handler maps those errors to exit codes and diagnostics. Source-scan contract tests keep new code on that vocabulary; every exception is named in an in-file allowlist.

This applies to:

- Production error construction, wrapping, and exit-code mapping across `src/`.
- Standing source checks that reject a new plain `Error` outside a named allowlist.

It does not apply to:

- Provider response schemas and HTTP transport.
- Test assertion style, and passing-test console quieting, which [ADR-019](ADR-019-quiet-passing-test-console-output.md) owns.
- Classifying external provider or tool prose that has no structured field.
- The output protocol, log timestamps, `--json`, and TTS ambiguous redispatch, which [ADR-021](ADR-021-adopt-table-free-text-json-results-and-safe-retry-ownership.md) owns.
- Lane pressure, ramp, and 429 policy, which [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) owns.
- The credential registry, `setup --doctor --strict`, and the spawn environment allowlist, which [ADR-005](ADR-005-reduce-environment-variable-surface-area.md) owns. This record owns only the error contract and exit codes those surfaces use.

Usage failures — bad command input and missing credentials — exit 2. Every other `AppError` kind exits 1. `infrastructure` and `internal` change the diagnostic label, not the process exit. The kinds are `usage`, `provider_http`, `retry_exhausted`, `validation`, `infrastructure`, and `internal`. Each error carries a `stage` and, where remediation exists, structured `hints`. Deterministic failures are not retried. Control flow reads structured fields, not message text.

## Rationale

- **Single vocabulary:** every failure carries `kind`, `stage`, `hints`, and `metadata` through the CLI error handler.
- **Stable exits:** usage detection uses the error type, so a wording change cannot move a failure between exit 2 and exit 1.
- **Hints on the error:** remediation lives in `hints`, so callers do not scrape message text.
- **Standing check:** a one-time sweep does not hold; the suite fails when a plain `Error` lands.

## Consequences

Positive outcomes:

- Failures report `kind`, `stage`, `hints`, and `metadata`.
- Bad input and missing credentials exit 2. Every other kind exits 1.
- Deterministic security and validation failures are not retried.

Negative outcomes:

- Message text is not a stable interface. Scripts should use the exit code, `kind`, and `hints`.
- A deterministic failure stops the run. Another attempt will not succeed until the input or the check changes.

## Trade-offs

**Trade-off 1**

- **Gain:** Structured diagnostics on every failure
- **Sacrifice:** Every throw site must pick a kind, stage, and retryability instead of `new Error(message)`

**Trade-off 2**

- **Gain:** A vocabulary violation fails the suite at the offending line
- **Sacrifice:** The check recognizes the common spellings, so an unusual construction can slip through until the pattern or its allowlist is updated

## Implementation Note

The handler, kinds, and exit mapping live in `src/utils/error-handler.ts`. Retry classification lives in `src/utils/retries.ts`. The CLI handler is `src/cli/failure-handlers.ts`, wired from `src/cli/create-cli.ts`. The standing scans live under `test/test-cases/validation/runtime-contracts/`.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/runtime-contracts/
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

1. `bun run check` type-checks the error types.
2. `runtime-contracts/` proves the source scans, usage exit 2, operational exit 1 with structured hints, and `retry_exhausted` metadata.
3. The CLI suites prove usage-error exits and messages, including native parser errors that extend `AppUsageError`.

## References

- Related ADR: [ADR-001](ADR-001-source-ingestion-and-normalization.md)
- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md)
- Related ADR: [ADR-005](ADR-005-reduce-environment-variable-surface-area.md)
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)
- Related ADR: [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md)
- Related ADR: [ADR-016](ADR-016-govern-readme-command-examples-as-executable-contracts.md)
- Related ADR: [ADR-017](ADR-017-sound-effects-and-multi-track-soundscape-pipeline.md)
- Related ADR: [ADR-019](ADR-019-quiet-passing-test-console-output.md)
- Related ADR: [ADR-021](ADR-021-adopt-table-free-text-json-results-and-safe-retry-ownership.md)
- `src/utils/error-handler.ts`
- `src/utils/retries.ts`
- `src/cli/create-cli.ts`
- `src/cli/failure-handlers.ts`
- `test/test-cases/validation/runtime-contracts/`
