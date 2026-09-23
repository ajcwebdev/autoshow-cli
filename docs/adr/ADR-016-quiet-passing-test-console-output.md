# ADR-016: Keep Passing Test Console Output Quiet and Attach Logs Only to Failures

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-15
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed

## Context

`bun t` and `bun test` run in-process production code whose text logger writes through `console`, so passing tests dump diagnostics into the suite and failing-test logs interleave with unrelated concurrent output. Built-in reporters cannot separate those streams: JUnit is a post-run sidecar without per-test console, `--only-failures` still prints passing-test writes, and parallel workers share one stdout pipe, so nothing downstream can reconstruct per-test logs. A full `bun t --budget` run also buried failures under passing and skipped result lines.

Why now: console policy had become the dominant diagnostic problem in full runs, independent of which live tests were failing.

## Options Considered

**Option 1 (selected)**

- **Option:** A test preload that buffers `console.*` per test and flushes only on failure, plus a failure-first `bun t` terminal
- **Pros:** Works for `bun test` and `bun t`, keeps Bun's result lines, captures in-process logger diagnostics
- **Cons:** Wrapping the test API adds a harness frame on failure stacks
- **Quantitative Notes:** One preload, no per-file import rewrite

**Option 2**

- **Option:** Filter Bun's output after the process exits, or rely on `--only-failures`, the `dots` reporter, or a custom reporter
- **Pros:** No test-process changes
- **Cons:** Rejected; interleaved parallel output cannot be attributed to pass or fail afterwards, the built-in reporters still print passing-test logs, and Bun has no custom JS reporter
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Quiet the production logger for the whole suite
- **Pros:** Smallest logger change
- **Cons:** Rejected; failures lose the same logs
- **Quantitative Notes:** n/a

## Decision

Under `bun test`, passing tests emit only Bun's result line and failing tests keep that line plus every `console` write from that test. `bun t` captures console the same way and adds a failure-first terminal. JUnit remains the post-run summary for `report.json`. Budget preflight is quiet on success. `bun t` artifacts default to `output/test-output/`, with timestamped run directories, `latest.log`, and `.test-cache/`.

The `bun t` terminal hides `✓` and `»` lines and Bun's skipped list, prints a file header only before output that is shown, and prints `progress: N passed · N failed · N skipped` after 10 seconds of idle terminal. `runner.log` keeps the full stream; `--verbose` prints that stream and skips the progress line. After Bun exits, `bun t` prints a digest: failures with messages, a skip summary, up to five tests that took at least one second, and calibration recommendations that omit the local engines `whisperfile`, `tesseract`, and `defuddle`. It keeps `latest-model-calibration.json` beside `latest.log`. A failed run keeps its directory until the next run's cleanup, a passing run removes it, and `--no-cleanup` keeps every run directory. Plain `bun test` prints every result line.

This applies to:

- `bun test` and `bun t` console output for discovered tests, including in-process production logger writes and budget preflight progress logging.
- The default `bun t` artifact root and its cleanup.

It does not apply to:

- Replacing JUnit, `report.json`, `commands.log`, or `latest.log`.
- Subprocess CLI capture already used by tests.
- Product CLI logging outside the test process, which [ADR-005](ADR-005-cli-error-result-and-retry-contract.md) owns.

## Rationale

- Per-test capture is the only place that still knows pass versus fail under parallel Bun workers, and buffering `console` there keeps the human logger's output available on failure.
- JUnit is useful after the run but cannot invert live logs, so it stays a sidecar.
- Result lines already name their test, so `bun t` can hide passes on the terminal while the full stream stays in `runner.log`.

## Consequences

Positive outcomes:

- A passing `bun test` suite is a list of result lines, and `bun t` shows failures first with the full stream kept on disk.
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

The console harness is a Bun test preload configured in `bunfig.toml`. `bun t` owns the terminal filter, the end-of-run digest, and artifact cleanup; usage is in the [testing guide](../commands/testing.md).

## Test Plan

```bash
bun test test/test-cases/validation/runtime-contracts/test-runner-contracts/
```

1. Passing tests emit no captured console output, and failing tests reprint their own logs even when tests run concurrently.
2. `bun t` hides pass and skip lines, prints headers only before visible output, keeps the full stream in `runner.log`, and `--verbose` restores it.
3. The digest leads with failures, summarizes skips, lists up to five slow tests, and omits local engines from timing recommendations.
4. Cleanup keeps `latest.log` and `latest-model-calibration.json`, retains a failed run's directory until the next cleanup, and writes failed and skipped `report.json` entries into `latest.log`.

## References

- Related ADR: [ADR-005](ADR-005-cli-error-result-and-retry-contract.md)
- [Testing guide](../commands/testing.md)
