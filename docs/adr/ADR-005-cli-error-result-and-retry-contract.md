# ADR-005: CLI Error, Result, and Retry Contract

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-13
- **Date Updated:** 2026-10-28
- **Verification Status:** Passed
- **Supersession:** Absorbs "Unify the Logging and Error-Handling Vocabulary" and "Adopt Table-Free Text, JSON Results, and Safe Retry Ownership".

## Context

Failures need a consistent error category, exit code, and remediation hints. Plain `Error` throws and message-based usage detection made those contracts unstable, and a one-time conversion did not prevent drift.

Mixed output formats made it difficult to identify a terminal result. Overlapping retry loops could repeat a paid request after a timeout or lost response without knowing whether it had already been billed.

People need readable output. Agents and scripts need one deterministic result on stdout with diagnostics kept off that stream. Paid work needs a fail-closed rule: only a provider rejection that explicitly allows another try may be retried.

Why now: inconsistent results and overlapping retries exposed callers to unreliable automation and duplicate charges, requiring one enforced error, output, and retry contract.

## Options Considered

### Error vocabulary

**Option 1 (selected)**

- **Option:** Use `AppError`, structured usage detection, and remediation hints throughout production code, enforced by contract tests
- **Pros:** Every failure carries `kind`, `stage`, `hints`, and `metadata`; message scanning and class-name checks go away
- **Cons:** Each throw needs a `kind` judgement, and enforcement must be maintained
- **Quantitative Notes:** Every production throw site

**Option 2**

- **Option:** Patch usage detection, hints, and retry helpers around plain `Error` throws, or leave them alone
- **Pros:** Small and low-risk
- **Cons:** Rejected; two throw vocabularies remain and the workarounds keep accreting
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Add a separate `pipeline` error kind for step failures
- **Pros:** A dedicated bucket
- **Cons:** Rejected; existing error kinds already describe step failures
- **Quantitative Notes:** n/a

### Output protocol and retry ownership

**Option 1 (selected)**

- **Option:** Use text by default and `--json` for one terminal result, with one retry policy per provider call
- **Pros:** Clean stdout and stderr separation, stable machine envelopes, conservative paid-create behavior
- **Cons:** Breaks table output, naked JSON payloads, and `--log-format`
- **Quantitative Notes:** Two output modes; one terminal result per JSON invocation

**Option 2**

- **Option:** Consolidate table builders while retaining human, JSON, and combined modes
- **Pros:** Smaller compatibility break
- **Cons:** Rejected; three output modes still have no single stdout rule
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Keep per-provider retry behavior and document the paid-operation expectations
- **Pros:** Less behavior change
- **Cons:** Rejected; a paid request can still be sent twice, and documentation does not stop that
- **Quantitative Notes:** n/a

## Decision

`AppError` and its typed subclasses are the only throw type in production code, and one CLI error handler maps them to exit codes and diagnostics. `bun autoshow` has two output modes, emits exactly one terminal result in JSON mode, and gives each provider call one retry policy that never automatically replays a paid create after an unknown outcome.

The error kinds are `usage`, `provider_http`, `retry_exhausted`, `validation`, `infrastructure`, and `internal`. Usage failures, meaning bad command input and missing credentials, exit 2. Other kinds default to exit 1; explicit command contracts can override that default, including exit 2 for incomplete provider batches and exit 64 for a required-image-model policy violation. Each error carries a `stage` and, where remediation exists, structured `hints`. Deterministic failures are not retried, and contract tests enforce the vocabulary.

The two output modes are default text with one line per diagnostic event and the versioned `--json` protocol. JSON mode emits diagnostics on stderr and one terminal result on stdout. Text diagnostics use stderr when stdout is piped; an interactive terminal can show informational events on stdout. Help, version, and `metadata --markdown` write their text document to stdout; `metadata --markdown` cannot be combined with `--json`. Terminal tables and `--log-format` are removed. A later failure replaces a prepared success, and a missing or duplicate terminal result is an internal error; text mode does not emit the JSON result envelope.

A paid create is sent again only for HTTP 425 or 429, or when the provider's structured verdict says the admission was rejected and may be retried, unless the failure is explicitly non-retryable or identifies a billing or quota problem. A replay-safe upload may retry a timeout or network failure, and a read of an already accepted provider result may retry. An ambiguous paid admission stops automatic retries. Persisted TTS runs, including comic audio, require a later invocation with `--allow-ambiguous-redispatch` to authorize repurchasing unrecoverable work while preserving saved evidence and completed audio. A provider-directed delay waits at most five minutes. Exhausted retries or polling do not start another attempt within that invocation.

This applies to:

- Every `bun autoshow` command, including help, version, setup, utilities, batches, and comic commands.
- Error construction, exit-code mapping, text diagnostics, `--json` results, retries, provider polling, and price output.
- Persisted TTS generation slots, including comic audio and resume, that use `--allow-ambiguous-redispatch` to authorize a later request while keeping the saved evidence.

It does not apply to:

- HTTP transport bodies and payload ceilings, which [ADR-019](ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md) owns.
- Test assertion style and passing-test console quieting, which [ADR-016](ADR-016-quiet-passing-test-console-output.md) owns.
- Lane pressure, ramp, and 429 lane halving, which [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md) owns. Lane recovery does not re-authorize duplicate spend.
- The credential registry, `setup --doctor --strict`, and the spawn environment allowlist, which [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md) owns.
- Documentation formatting and standalone analyzer or audit output outside `bun autoshow`.
- Provider pricing and capability ownership, assigned to [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md).
- TTS slot identity, render identity, and what a slot reuses, which [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md) owns. This record owns only whether and when a request may be sent again.

## Rationale

- Usage detection reads the error type, so a wording change cannot move a failure between exit 2 and exit 1, and remediation lives in `hints` rather than in scraped message text.
- A one-time sweep does not hold; only a standing check keeps the vocabulary unified.
- One JSON stdout record lets callers decide success and pipe the result without taking in diagnostics, while one physical line per text event keeps human output bounded.
- Paid work is retried only when the provider explicitly allows another attempt; replay-safe uploads and reads of accepted results can survive a transient failure without opening a second charge, and exhausting retries ends the invocation so the same request stops there.

## Consequences

Positive outcomes:

- Failures report `kind`, `stage`, `hints`, and `metadata`, with bad input and missing credentials on exit 2 and other failures defaulting to exit 1 unless the command defines an override.
- JSON mode emits versioned log records on stderr and exactly one versioned result record on stdout; help, version, parse errors, runtime failures, dry runs, and quiet mode share that contract.
- Deterministic failures are not retried, and a retry or poll that gives up is final for that invocation.

Negative outcomes:

- Message text is not a stable interface; scripts use the exit code, `kind`, and `hints`.
- Table output and naked JSON payloads are gone. Machine-readable payloads are `result.data`, and `--log-format` exits 2 with guidance toward text or `--json`.
- An ambiguous paid admission stops automatic retries. Persisted TTS recovery requires explicit redispatch authorization for unrecoverable work, which can be billed again.

## Trade-offs

**Trade-off 1**

- **Gain:** Consistent diagnostics and remediation hints
- **Sacrifice:** Error categorization and enforcement require ongoing maintenance

**Trade-off 2**

- **Gain:** Deterministic stdout for scripts and agents
- **Sacrifice:** Simultaneous human and JSON output, and table views

**Trade-off 3**

- **Gain:** Paid creates are never automatically replayed after an unknown outcome, and `retryable: false` is final
- **Sacrifice:** Some transient failures need an explicit later reconciliation instead of an automatic retry

## API / Type Impact

In JSON mode, log records use `{ schemaVersion: 1, type: "log", timestamp, runId, level, category, message, command?, step?, context?, metadata?, error? }` on stderr. Terminal records use `{ schemaVersion: 1, type: "result", timestamp, runId, command?, status, exitCode, durationMs, message, data?, error?, hints? }` on stdout. `--json=false` and `--no-json` select text mode. Diagnostic level controls never suppress the JSON terminal result. Native parser errors are usage errors and exit 2.

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/runtime-contracts/app-error-contracts.test.ts test/test-cases/validation/runtime-contracts/output-vocabulary-contracts.test.ts
bun test test/test-cases/validation/runtime-contracts/retry-policy-contracts.test.ts test/test-cases/validation/runtime-contracts/retry-create-admission-contracts.test.ts
bun test test/test-cases/validation/cli/json-output-contracts.test.ts test/test-cases/validation/cli/required-image-model-contracts.test.ts
```

1. Error contracts and source enforcement hold, including usage exit 2, default operational exit 1, structured hints, and the image-policy exit 64 override.
2. Text diagnostics stay one physical line per event and use stderr when stdout is piped; JSON mode emits one terminal result on stdout with diagnostics on stderr, and `--log-format` exits 2.
3. A paid create retries only an explicit 425 or 429 or a rejected-and-retryable verdict; timeouts, network loss, and unknown outcomes stop, and exhaustion does not start another attempt.
4. The price pass runs every mapped estimate command once and reads structured cost data without calling a provider.

## References

- Related ADR: [ADR-001](ADR-001-source-ingestion-and-normalization.md)
- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md)
- Related ADR: [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md)
- Related ADR: [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md)
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- Related ADR: [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md)
- Related ADR: [ADR-013](ADR-013-comic-scene-audio-and-presentation.md)
- Related ADR: [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md)
- Related ADR: [ADR-016](ADR-016-quiet-passing-test-console-output.md)
- Related ADR: [ADR-019](ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md)
- `src/utils/error-handler.ts`
- `src/utils/app-logger/result-emitter.ts`
- `src/utils/retry-classification.ts`
