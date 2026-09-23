# ADR-005: CLI Error, Result, and Retry Contract

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-13
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed
- **Supersession:** Absorbs "Unify the Logging and Error-Handling Vocabulary" and "Adopt Table-Free Text, JSON Results, and Safe Retry Ownership". This record is the accepted authority for the `AppError` vocabulary, the single CLI error funnel, standing source enforcement, the text and `--json` output protocol, and provider retry and redispatch ownership.

## Context

Most throw sites used plain `Error`, so failures exited 1 with no `kind`, `hints`, `metadata`, or `stage`, remediation hints were scraped from message text, and deterministic failures were retried. A one-time conversion drifted because nothing checked new throws.

`bun autoshow` could print text, JSON, both, or a human table, output could span multiple lines, diagnostics and results shared stdout, and a JSON run could end without one identifiable result. A paid request could be sent again after a timeout, a lost response, or an unclassifiable outcome, including by a second retry loop around the same call.

People need readable output. Agents and scripts need one deterministic result on stdout with diagnostics kept off that stream. Paid work needs a fail-closed rule: only a provider rejection that explicitly allows another try may be retried.

Why now: the vocabulary stays unified only if the suite rejects a new plain `Error` when it lands, and the 2026-09-01 logging and retry audits found that consumers could not identify one terminal result and that overlapping retries could duplicate billed work.

## Options Considered

### Error vocabulary

**Option 1 (selected)**

- **Option:** Full `AppError` sweep: one throw type, structured usage detection, co-located hints, and aligned retry helpers
- **Pros:** Every failure carries `kind`, `stage`, `hints`, and `metadata`; message scanning and class-name checks go away
- **Cons:** Each throw needs a `kind` judgement
- **Quantitative Notes:** Every production throw site

**Option 2**

- **Option:** Patch usage detection, hints, and retry helpers around plain `Error` throws, or leave them alone
- **Pros:** Small and low-risk
- **Cons:** Rejected; two throw vocabularies remain and the workarounds keep accreting
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Add a sixth `pipeline` error kind for step failures
- **Pros:** A dedicated bucket
- **Cons:** Rejected; the existing kinds cover every case and all map to exit 1
- **Quantitative Notes:** n/a

**Option 4 (selected)**

- **Option:** Pin the vocabulary with source-scan contract tests and an in-file allowlist for every exception
- **Pros:** Drift fails the suite with no new tooling
- **Cons:** A text scan can miss an unusual spelling, and each allowlist entry must stay justified
- **Quantitative Notes:** n/a

**Option 5**

- **Option:** Adopt ESLint to ban `new Error(`, or rely on a one-time sweep with no standing check
- **Pros:** ESLint is AST-accurate; a bare sweep is the smallest change
- **Cons:** Rejected; a linter this repository does not otherwise use, and a sweep without a standing check repeats the drift
- **Quantitative Notes:** n/a

### Output protocol and retry ownership

**Option 1 (selected)**

- **Option:** Delete terminal tables, keep one-line text as the default, make `--json` the only alternate protocol, emit exactly one terminal result, and give each provider call one retry policy
- **Pros:** Clean stdout and stderr separation, stable machine envelopes, conservative paid-create behavior
- **Cons:** Breaks table output, naked JSON payloads, and `--log-format`
- **Quantitative Notes:** Two output modes; one terminal result per invocation

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

`AppError` and its typed subclasses are the only throw type in production code, one CLI error handler maps them to exit codes and diagnostics, `bun autoshow` has exactly two output modes and ends every invocation with exactly one terminal result, and each provider call has one retry policy that never replays a paid create after an unknown outcome.

The error kinds are `usage`, `provider_http`, `retry_exhausted`, `validation`, `infrastructure`, and `internal`. Usage failures, meaning bad command input and missing credentials, exit 2. Every other kind exits 1; `infrastructure` and `internal` change the diagnostic label, not the exit. Each error carries a `stage` and, where remediation exists, structured `hints`. Deterministic failures are not retried. Source-scan contract tests keep new code on that vocabulary, and every exception is named in an in-file allowlist.

The two output modes are default one-line text and the versioned `--json` protocol. In text mode, help, version, and `metadata --markdown` write that document to stdout; `metadata --markdown` cannot be combined with `--json`. Terminal tables and `--log-format` are removed. A later failure replaces a prepared success, so the result matches the invocation outcome, and if the CLI cannot produce that single result the invocation fails as an internal error.

A paid create is sent again only for HTTP 425 or 429, or when the provider's structured verdict says the admission was rejected and may be retried. A replay-safe upload may retry a timeout or network failure, and a read of an already accepted provider result may retry. Any other ambiguous paid admission stops until a later invocation passes `--allow-ambiguous-redispatch` against the saved evidence. A provider-directed delay waits at most five minutes. When retries or polling are exhausted, the invocation stops and that request is not sent again.

This applies to:

- Every `bun autoshow` command, including help, version, setup, utilities, batches, and comic commands.
- Error construction, exit-code mapping, text diagnostics, `--json` results, retries, provider polling, and price output.
- Persisted TTS generation slots, including comic audio and resume, that use `--allow-ambiguous-redispatch` to authorize a later request while keeping the saved evidence.

It does not apply to:

- HTTP transport bodies and payload ceilings, which [ADR-019](ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md) owns.
- Test assertion style and passing-test console quieting, which [ADR-016](ADR-016-quiet-passing-test-console-output.md) owns.
- Classifying external provider or tool prose that has no structured field.
- Lane pressure, ramp, and 429 lane halving, which [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md) owns. Lane recovery does not re-authorize duplicate spend.
- The credential registry, `setup --doctor --strict`, and the spawn environment allowlist, which [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md) owns.
- Intentional Markdown tables in documentation and report artifacts, and standalone analyzer or audit JSON documents such as `report.json`, which are not the `bun autoshow` protocol.
- Provider pricing and capability ownership, assigned to [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md).
- TTS slot identity, render identity, and what a slot reuses, which [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md) owns. This record owns only whether and when a request may be sent again.

## Rationale

- Usage detection reads the error type, so a wording change cannot move a failure between exit 2 and exit 1, and remediation lives in `hints` rather than in scraped message text.
- A one-time sweep does not hold; only a standing check keeps the vocabulary unified.
- One stdout record lets callers decide success and pipe the result without taking in diagnostics, while one physical line per text event keeps human output bounded.
- Paid work is retried only when the provider explicitly allows another attempt; replay-safe uploads and reads of accepted results can survive a transient failure without opening a second charge, and exhausting retries ends the invocation so the same request stops there.

## Consequences

Positive outcomes:

- Failures report `kind`, `stage`, `hints`, and `metadata`, with bad input and missing credentials on exit 2 and everything else on exit 1.
- JSON mode emits versioned log records on stderr and exactly one versioned result record on stdout; help, version, parse errors, runtime failures, dry runs, and quiet mode share that contract.
- Deterministic failures are not retried, and a retry or poll that gives up is final for that invocation.
- The project test runner evaluates each selected paid command once and reads structured price results.

Negative outcomes:

- Message text is not a stable interface; scripts use the exit code, `kind`, and `hints`.
- Table output and naked JSON payloads are gone. Machine-readable payloads are `result.data`, and `--log-format` exits 2 with guidance toward text or `--json`.
- An ambiguous paid admission stops the run. Continuing requires `--allow-ambiguous-redispatch` on a later invocation that still has the saved evidence, and that request can be billed again.

## Trade-offs

**Trade-off 1**

- **Gain:** Structured diagnostics on every failure, enforced at the offending line
- **Sacrifice:** Every throw site picks a kind, stage, and retryability, and an unusual construction can slip past the scan until its pattern or allowlist is updated

**Trade-off 2**

- **Gain:** Deterministic stdout for scripts and agents
- **Sacrifice:** Simultaneous human and JSON output, and table views

**Trade-off 3**

- **Gain:** Paid creates are never replayed after an unknown outcome, and `retryable: false` is final
- **Sacrifice:** Some transient failures need an explicit later reconciliation instead of an automatic retry

## API / Type Impact

Log records use `{ schemaVersion: 1, type: "log", timestamp, runId, level, category, message, command?, step?, context?, metadata?, error? }` on stderr. Terminal records use `{ schemaVersion: 1, type: "result", timestamp, runId, command?, status, exitCode, durationMs, message, data?, error?, hints? }` on stdout. `--json=false` and `--no-json` select text mode. Diagnostic level controls never suppress the terminal result. Native parser errors are usage errors and exit 2.

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/runtime-contracts/
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

1. The source scans hold, usage errors exit 2, operational errors exit 1 with structured hints, and `retry_exhausted` carries metadata.
2. Text mode stays one physical line per event, diagnostics stay off stdout, each invocation produces one terminal result, and `--log-format` exits 2.
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
