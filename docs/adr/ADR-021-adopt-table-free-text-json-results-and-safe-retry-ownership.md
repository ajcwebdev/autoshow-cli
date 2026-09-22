# ADR-021: Adopt Table-Free Text, JSON Results, and Safe Retry Ownership

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-09-01
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed
- **Supersession:** Supersedes ADR-006's logging/output contract and its TTS-only ambiguous-redispatch scope. ADR-006 remains authoritative for the `AppError` vocabulary, single CLI error funnel, and standing source enforcement.

## Context

`bun autoshow` could print text, JSON, text and JSON together, or a human table. Output could span multiple physical lines, diagnostics and results could share stdout, and a JSON run could end without one identifiable result. A paid request could also be sent again after a timeout, a lost response, or an outcome the CLI could not classify, including by a second retry loop around the same call.

People still need readable output. Agents and scripts need one deterministic result on stdout and diagnostics that stay off that stream. Paid work needs a fail-closed rule: a provider rejection that explicitly allows another try may be retried, and a timeout, network loss, accepted-but-incomplete response, or unknown outcome stops unless saved work is explicitly reconciled.

Why now: the 2026-09-01 logging and retry audits found that output consumers could not identify one terminal result and that overlapping retries could duplicate billed work.

## Options Considered

**Option 1 (selected)**

- **Option:** Delete terminal tables, keep one-line text as the default, make `--json` the only alternate protocol, emit exactly one terminal result, and give each provider call one retry policy
- **Pros:** Clean stdout/stderr separation, bounded human output, stable machine envelopes, and conservative paid-create behavior
- **Cons:** Breaks table output, naked JSON payloads, and `--log-format`
- **Quantitative Notes:** Two output modes, one terminal result per invocation, and a maximum five-minute provider-directed delay

**Option 2**

- **Option:** Consolidate table builders while retaining human, JSON, and both modes
- **Pros:** Smaller compatibility break
- **Cons:** Leaves presentation data in the output path and still mixes protocols on stdout
- **Quantitative Notes:** Rejected; three output modes still have no single stdout rule

**Option 3**

- **Option:** Keep separate retry behavior per provider and document the paid-operation expectations
- **Pros:** Less behavior change for callers
- **Cons:** A paid request can still be sent twice, and documentation does not stop that
- **Quantitative Notes:** Rejected; more than one retry loop can send the same provider call

## Decision

`bun autoshow` has two output modes: default one-line text and the versioned `--json` protocol. In text mode, help, version, and `metadata --markdown` write that document to stdout. `metadata --markdown` cannot be combined with `--json`. Terminal tables and `--log-format` are removed. Every invocation ends with exactly one terminal result. A later failure replaces a prepared success, so the result matches the invocation outcome. If the CLI cannot produce that single result, the invocation fails as an internal error.

Automatic retry follows the kind of request. A paid create is sent again only for HTTP 425 or 429, or when the provider's structured verdict says the admission was rejected and may be retried. A replay-safe upload may retry a timeout or network failure. A read of a provider result that was already accepted may retry. Any other ambiguous paid admission stops until a later invocation passes `--allow-ambiguous-redispatch` against the saved evidence. A provider-directed delay waits at most five minutes. When retries or polling are exhausted, the invocation stops and that request is not sent again.

This applies to:

- Every `bun autoshow` command, including help, version, setup, utilities, batches, and comic commands.
- Text diagnostics, `--json` results, errors, retries, provider polling, and price output.
- Persisted TTS generation slots, including comic audio and resume, that use `--allow-ambiguous-redispatch` to authorize a later request while keeping the saved evidence.

It does not apply to:

- Intentional Markdown tables in documentation or generated report artifacts.
- Standalone analyzer and audit JSON documents, `report.json`, or repository tools whose machine interfaces are not the `bun autoshow` protocol.
- Provider pricing, capability, and concurrency ownership assigned to ADR-008 and ADR-010.

## Rationale

- Callers can decide success from one stdout record and can pipe that record without taking in diagnostics.
- One physical line per text event keeps human output bounded while preserving the timestamp, level marker, color, and batch prefix.
- Help, version, and markdown metadata remain readable documents, and every other command keeps a single stdout result.
- Paid work is retried only when the provider explicitly allows another attempt.
- Uploads that are safe to replay, and reads of a result the provider has already accepted, can survive a transient transport failure without opening a second charge.
- Exhausting retries or polling ends the invocation, so the same paid request stops there.

## Consequences

Positive outcomes:

- Text output has no tables and is one physical line per event.
- JSON mode emits versioned log records on stderr and exactly one versioned result record on stdout.
- Help, version, parse errors, runtime failures, dry runs, and quiet mode share that result contract. Text-mode help and version also print the requested document, and `metadata --markdown` prints frontmatter instead of a JSON result.
- A retry or poll that gives up is final for that invocation.
- The project test runner evaluates each selected paid command once and reads structured price results.

Negative outcomes:

- Table output and naked JSON payloads are gone. Machine-readable payloads are `result.data`.
- `--log-format` exits 2 and directs the caller to text or `--json`.
- An ambiguous paid admission stops the run. Continuing requires `--allow-ambiguous-redispatch` on a later invocation that still has the saved evidence, and that request can be billed again.

## Trade-offs

**Trade-off 1**

- **Gain:** Deterministic stdout for scripts and agents
- **Sacrifice:** Simultaneous human and JSON output, and table views

**Trade-off 2**

- **Gain:** Paid creates are not replayed after an unknown outcome
- **Sacrifice:** Some transient failures need an explicit later reconciliation instead of an automatic retry

**Trade-off 3**

- **Gain:** Callers can rely on structured retry metadata, and `retryable: false` is final
- **Sacrifice:** Message text alone cannot authorize another attempt

## API / Type Impact

Log records use `{ schemaVersion: 1, type: "log", timestamp, runId, level, category, message, command?, step?, context?, metadata?, error? }` on stderr. Terminal records use `{ schemaVersion: 1, type: "result", timestamp, runId, command?, status, exitCode, durationMs, message, data?, error?, hints? }` on stdout. `--json=false` and `--no-json` select text mode. Diagnostic level controls never suppress the terminal result.

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/runtime-contracts/
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

1. Text mode stays one physical line per event, diagnostics stay off stdout, and each invocation produces one terminal result.
2. Table output and `--log-format` stay removed, and `--log-format` exits 2 with guidance toward text or `--json`.
3. A paid create retries only an explicit 425 or 429 or a rejected-and-retryable verdict. Timeouts, network loss, and unknown outcomes stop. Exhausting retries or polling does not start another attempt.
4. The price pass runs every mapped estimate command once and reads structured cost data without calling a provider.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Related ADR: [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md)
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- Related ADR: [ADR-019](ADR-019-quiet-passing-test-console-output.md)
