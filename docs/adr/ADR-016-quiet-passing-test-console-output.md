# ADR-016: Keep Passing Test Console Output Quiet and Attach Logs Only to Failures

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-15
- **Date Updated:** 2026-10-28
- **Verification Status:** Passed

## Context

Before per-test console capture, `bun t` and `bun test` mixed passing-test diagnostics with failures. Filtering the combined output could not reliably attribute interleaved logs to individual tests, and JUnit supplied a post-run summary rather than live diagnostics. Passing and skipped result lines also buried failures in large runs.

Why now: console policy had become the dominant diagnostic problem in full runs, independent of which live tests were failing.

## Options Considered

**Option 1 (selected)**

- **Option:** A test preload that buffers `console.*` per test and flushes only on failure, plus a failure-first `bun t` terminal
- **Pros:** Works for `bun test` and `bun t`, keeps Bun's result lines, captures in-process logger diagnostics
- **Cons:** Wrapping the test API adds a harness frame on failure stacks
- **Quantitative Notes:** One preload, no per-file import rewrite

**Option 2**

- **Option:** Filter the combined output after the process exits
- **Pros:** No test-process changes
- **Cons:** Rejected; interleaved console output cannot reliably be attributed to passing or failing tests afterwards
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Quiet the production logger for the whole suite
- **Pros:** Smallest logger change
- **Cons:** Rejected; failures lose the same logs
- **Quantitative Notes:** n/a

## Decision

Buffer `console.log`, `console.info`, `console.warn`, `console.error`, and `console.debug` calls within test callbacks, discarding captured logs on success and printing them on failure. `bun t` additionally hides passing and skipped result lines while retaining the full stream in `runner.log`; `--verbose` restores that stream on the terminal.

The terminal provides idle progress updates and a final digest ordered by failures, skips, slow tests, and model calibration recommendations. JUnit remains the post-run input to `report.json`. Artifacts default to `output/test-output/`, with stable `latest.log` and `latest-model-calibration.json` summaries. Successful test runs remove their current run directory when it contains no protected evidence, unless `--no-cleanup` is selected; price-only runs retain it by default. Earlier runs require explicit `--cleanup`, which preserves active, failed, interrupted, unknown, and TTS/audio evidence.

This applies to:

- `bun test` and `bun t` console output within test callbacks, including in-process text logger writes.
- The default `bun t` artifact root and its cleanup.

It does not apply to:

- Replacing JUnit, `report.json`, `commands.log`, or `latest.log`.
- Subprocess CLI capture already used by tests.
- Direct stream writes and runner-level progress, including budget preflight summaries.
- Product CLI logging outside the test process, which [ADR-005](ADR-005-cli-error-result-and-retry-contract.md) owns.

## Rationale

- Per-test capture is the only place that still knows pass versus fail under parallel Bun workers, and buffering `console` there keeps the human logger's output available on failure.
- JUnit is useful after the run but cannot invert live logs, so it stays a sidecar.
- Result lines already name their test, so `bun t` can hide passes on the terminal while the full stream stays in `runner.log`.

## Consequences

Positive outcomes:

- Passing test callbacks add no captured console logs, and `bun t` keeps the full result stream on disk while prioritizing failures on the terminal.
- A failing test reprints its own logs next to Bun's `✗` line and assertion.

Negative outcomes:

- Failure stacks include a harness frame.
- Writes outside a test callback, such as module top level and `beforeAll` or `beforeEach` hooks, have no per-test buffer and print unconditionally.

## Trade-offs

**Trade-off 1**

- **Gain:** Quiet passes and grouped failure logs, even for concurrent tests
- **Sacrifice:** A Bun preload that wraps each test callback

**Trade-off 2**

- **Gain:** JUnit and metrics matching stay unchanged
- **Sacrifice:** No per-test logs in `junit.xml`

## Implementation Note

The console harness in `test/test-utils/test-console-harness.ts` is a preload configured in `bunfig.toml`. `test/test-runner/` owns terminal filtering, the digest, and artifact retention; usage is in the [testing guide](../commands/testing.md).

## Test Plan

```bash
bun test test/test-cases/validation/runtime-contracts/test-runner-contracts/console-harness.test.ts test/test-cases/validation/runtime-contracts/test-runner-contracts/terminal-filter.test.ts test/test-cases/validation/runtime-contracts/test-runner-contracts/run-digest.test.ts test/test-cases/validation/runtime-contracts/test-runner-contracts/runner-preservation.test.ts
```

1. Passing tests emit no captured console output, and failing tests reprint their own logs even when tests run concurrently.
2. `bun t` hides pass and skip lines, prints headers only before visible output, keeps the full stream in `runner.log`, and `--verbose` restores it.
3. The digest leads with failures, summarizes skips, and ranks slow tests and calibration recommendations.
4. Explicit prior-run cleanup removes only confirmed successful runner artifacts while preserving other evidence; price-only mode retains current and prior run artifacts by default.

## References

- Related ADR: [ADR-005](ADR-005-cli-error-result-and-retry-contract.md)
- [Testing guide](../commands/testing.md)
