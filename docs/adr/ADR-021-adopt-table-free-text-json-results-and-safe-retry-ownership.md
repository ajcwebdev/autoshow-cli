# ADR-021: Adopt Table-Free Text, JSON Results, and Safe Retry Ownership

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-09-01
- **Date Updated:** 2026-09-01
- **Verification Status:** Passed
- **Supersession:** Supersedes ADR-006's logging/output contract and its TTS-only ambiguous-redispatch scope. ADR-006 remains authoritative for the `AppError` vocabulary, single CLI error funnel, and standing source enforcement.

## Context

The logger supported text, JSON, simultaneous text-and-JSON output, and a separate human-table data model. Those modes let presentation details leak into logger calls, allowed multiline physical output, and made stdout unsafe for automation. JSON commands could emit diagnostic records and naked domain payloads without one reliable terminal record. Retry policy was similarly distributed across wrappers and call sites, so a paid create could be replayed by more than one owner or after an ambiguous admission.

The CLI must remain readable for people while becoming deterministic for agents and scripts. Paid operations also need a fail-closed contract: rejected admissions may retry, but timeouts, network loss, accepted-but-incomplete responses, and unknown outcomes must stop unless persisted work is explicitly reconciled.

Why now: the 2026-09-01 logging and retry audits found that output consumers could not identify one terminal result and that overlapping retry ownership could duplicate billed work.

## Options Considered

**Option 1 (selected)**

- **Option:** Delete terminal tables, keep one-line text as the default, make `--json` the only alternate protocol, stage exactly one terminal result, and centralize retries in `withRetry`
- **Pros:** Clean stdout/stderr separation, bounded human output, stable machine envelopes, one retry owner, and conservative paid-create semantics
- **Cons:** Intentionally breaks table output, naked JSON payloads, and `--log-format`; requires broad command and test migration
- **Quantitative Notes:** Two output modes, one terminal result per invocation, seven retry classes, and a maximum five-minute provider-directed delay

**Option 2**

- **Option:** Consolidate table builders while retaining human, JSON, and both modes
- **Pros:** Smaller compatibility break and less call-site churn
- **Cons:** Preserves presentation-specific logger data and permits protocol contamination
- **Quantitative Notes:** Rejected because three output modes still lack one stdout ownership rule

**Option 3**

- **Option:** Keep provider-specific retry wrappers and document paid-operation expectations
- **Pros:** Minimal implementation work
- **Cons:** Cannot prove call-count safety or prevent nested replay
- **Quantitative Notes:** Rejected because multiple loops can own one provider dispatch

## Decision

`bun autoshow` has two output modes: default one-line text diagnostics and the versioned `--json` protocol. The table subsystem and `--log-format` are deleted. Every invocation stages exactly one terminal result, and `withRetry` is the sole dispatch-attempt loop with conservative paid-create classification and explicit persisted ambiguity reconciliation.

This applies to:

- Every `bun autoshow` command, including help, version, setup, utilities, batches, subprocess-backed paths, and comic leaf commands.
- Production diagnostics, terminal result envelopes, error serialization, retry classification, polling, and test-runner price parsing.
- Persisted paid-generation slots that use `--allow-ambiguous-redispatch` to authorize a linked later request without deleting prior evidence.

It does not apply to:

- Intentional Markdown tables in documentation or generated report artifacts.
- Standalone analyzer and audit JSON documents, `report.json`, or repository tools whose machine interfaces are not the `bun autoshow` protocol.
- Provider pricing, capability, and concurrency ownership assigned to ADR-008 and ADR-010.

## Rationale

- One result-only stdout record lets callers decide success from structured data without parsing diagnostics.
- Diagnostic-only stderr composes with pipes and prevents child-process bytes or ANSI escapes from corrupting machine output.
- One physical line per text event preserves the established timestamp, glyph, color, and batch prefix while bounding terminal volume.
- Invocation-scoped result staging detects missing and duplicate completions and discards a pending success after a later failure.
- A stable retry reason code separates automation from prose and makes `retryable: false` authoritative.
- Conservative create policy protects paid work because only explicit 425/429 or a structured rejected-and-retryable verdict can redispatch automatically.

## Consequences

Positive outcomes:

- Text output is concise, table-free, and always one physical line per event.
- JSON mode emits versioned log records on stderr and exactly one versioned result record on stdout.
- Help, version, parse errors, runtime failures, dry runs, and quiet mode share the same result contract.
- Retry and poll exhaustion is terminal and cannot trigger an outer replay.
- The project test runner evaluates each selected paid command once and consumes structured price results.

Negative outcomes:

- Existing table snapshots and consumers of naked JSON payloads must migrate to `result.data`.
- `--log-format` has no compatibility alias and exits 2 with guidance to use text or `--json`.
- Commands must explicitly stage an aggregate result at their outer boundary; missing or duplicate staging is an internal error.

## Trade-offs

**Trade-off 1**

- **Gain:** Deterministic stdout for scripts and agents
- **Sacrifice:** Simultaneous human and JSON output and presentation-specific table models

**Trade-off 2**

- **Gain:** Fail-closed paid-operation retries
- **Sacrifice:** Some transient but ambiguous failures require explicit reconciliation instead of automatic replay

**Trade-off 3**

- **Gain:** Stable structured reason codes and complete metadata
- **Sacrifice:** More explicit classification at transport boundaries

## Implementation Note

The output contract is implemented in `src/utils/app-logger/`, `src/cli/create-cli.ts`, and `src/cli/native/dispatcher.ts`. Error and retry ownership live in `src/utils/error-handler.ts` and `src/utils/retries.ts`. Command boundaries stage domain payloads under `result.data`, and the test runner requests `--json` for price commands without whole-command replay.

## API / Type Impact

Log records use `{ schemaVersion: 1, type: "log", timestamp, runId, level, category, message, command?, step?, context?, metadata?, error? }` on stderr. Terminal records use `{ schemaVersion: 1, type: "result", timestamp, runId, command?, status, exitCode, durationMs, message, data?, error?, hints? }` on stdout. `--json=false` selects text mode. Diagnostic level controls never suppress the terminal result.

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/runtime-contracts/
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

1. Source contracts prove the table subsystem, presentation fields, plain throws, nested log errors, and handwritten retry loops do not return.
2. Logger and CLI contracts prove one-line text, clean stream separation, one terminal result, error redaction, invocation reset, and result-staging failures.
3. Retry contracts prove status matrices, provider delay bounds, abort propagation, terminal nested exhaustion, response re-asks, and conservative paid call counts.
4. The price pass proves every mapped estimate command runs once and yields structured cost data without provider execution.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Related ADR: [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md)
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- Related ADR: [ADR-019](ADR-019-quiet-passing-test-console-output.md)
- `src/utils/app-logger/`
- `src/utils/error-handler.ts`
- `src/utils/retries.ts`
- `test/test-runner/`
- `test/test-cases/validation/runtime-contracts/`
