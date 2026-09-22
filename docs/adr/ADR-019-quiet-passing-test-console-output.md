# ADR-019: Keep Passing Test Console Output Quiet and Attach Logs Only to Failures

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-15
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed

## Context

`bun t` and `bun test` run in-process production code. The production text logger writes diagnostics through `console`, so passing tests dump that output into the suite. Bun then prints `✓` or `✗` plus duration. Passing tests are noisy, and failing-test logs are interleaved with unrelated concurrent output.

Built-in reporters cannot separate those streams. JUnit is a post-run sidecar without per-test captured output, `--only-failures` still prints passing-test console writes while hiding result lines, and parallel workers share one stdout/stderr pipe, so the runner cannot reconstruct per-test logs after the fact.

Why now: a full `bun t --budget` run made this console policy the dominant diagnostic problem, independent of which live tests were failing.

## Options Considered

**Option 1 (selected)**

- **Option:** Preload harness that buffers `console.*` per test and flushes only on failure
- **Pros:** Works for `bun test` and `bun t`; keeps Bun's `✓`/`✗` lines; captures in-process logger diagnostics
- **Cons:** Extra preload; wrapping the test API adds a harness frame on failure stacks
- **Quantitative Notes:** One preload, one fixture contract, no per-file import rewrite

**Option 2**

- **Option:** Filter `bun test` stdout after the child process exits
- **Pros:** No test-process changes
- **Cons:** Cannot attribute interleaved parallel output to pass or fail
- **Quantitative Notes:** Rejected; parallel file and test workers share one stdout pipe

**Option 3**

- **Option:** `--only-failures` or the `dots` reporter
- **Pros:** Zero new code
- **Cons:** Still prints passing-test logs; hides the `✓ name [time]` lines
- **Quantitative Notes:** n/a

**Option 4**

- **Option:** Quiet the production logger for the whole suite
- **Pros:** Smallest logger change
- **Cons:** Failures lose the same logs
- **Quantitative Notes:** n/a

**Option 5**

- **Option:** Replace JUnit with a custom reporter
- **Pros:** Could own all result formatting
- **Cons:** Bun has no custom JS reporter
- **Quantitative Notes:** n/a

## Decision

Passing tests emit only Bun's result line (`✓`, name, duration) under `bun test`. Failing tests keep that `✗` line and also print every `console` write from that test. Both `bun test` and `bun t` capture console that way. JUnit remains the post-run summary for `report.json`. Budget preflight is quiet on success. `bun t` artifacts default to `output/test-output/`.

This applies to:

- `bun test` and `bun t` console output for discovered tests.
- In-process production logger writes that already go through `console`.
- Budget preflight progress logging.
- Default `bun t` artifact root `output/test-output/`, including timestamped run directories, `latest.log`, and `.test-cache/`.

It does not apply to:

- Replacing JUnit, `report.json`, `commands.log`, or `latest.log`.
- Subprocess CLI capture already used by tests.
- Product CLI logging outside the test process.

### Amendment (2026-09-19): failure-first `bun t` terminal

A full `bun t --budget` run buried failures under passing and skipped result lines, and run cleanup deleted the calibration report with the run directory. Bun's result lines name their test, so `bun t` filters those lines on the terminal. Plain `bun test` prints every result line.

- Hides `✓` and `»` lines and Bun's skipped list. Prints a file header only before output that is shown. When the terminal has been idle for 10 seconds, prints `progress: N passed · N failed · N skipped`. `runner.log` keeps the full stream. `--verbose` prints that stream and skips the progress line.
- After Bun exits, prints a digest: failures with messages, a skip summary, up to five tests that took at least one second, and calibration recommendations. Timing recommendations omit local engines (`whisperfile`, `tesseract`, and `defuddle`).
- Keeps `latest-model-calibration.json` beside `latest.log`. A failed run keeps its directory until the next run's cleanup. A passing run removes it. `--no-cleanup` keeps every run directory.

## Rationale

- Per-test capture is the only place that still knows pass versus fail under parallel Bun workers.
- Buffering `console` captures the human logger and still prints those logs on failure.
- JUnit is useful after the run and cannot invert live logs, so it stays a sidecar.
- Result lines already name their test, so `bun t` hides passes on the terminal while per-test capture owns console bytes.

## Consequences

Positive outcomes:

- Passing `bun test` suites are a list of `✓` result lines. `bun t` keeps those lines in `runner.log` and shows the failure-first terminal from the amendment.
- A failing test reprints its own logs next to Bun's `✗` line and assertion.

Negative outcomes:

- Failure stacks include a harness frame.
- Writes outside a test callback — module top level, `beforeAll` / `beforeEach` and their `after` counterparts — have no per-test buffer and print unconditionally, including on pass.

## Trade-offs

**Trade-off 1**

- **Gain:** Quiet passes and grouped failure logs
- **Sacrifice:** A Bun preload that wraps the test API

**Trade-off 2**

- **Gain:** Concurrent tests keep isolated buffers
- **Sacrifice:** Capture must wrap each test callback rather than filter after the process exits

**Trade-off 3**

- **Gain:** JUnit and metrics matching stay unchanged
- **Sacrifice:** No per-test logs in `junit.xml`

## Implementation Note

The preload is `test/test-utils/test-console-harness.ts`, loaded from `bunfig.toml`. `bun t` terminal filtering is `test/test-runner/terminal-filter.ts`, the end-of-run digest is `test/test-runner/reports/run-digest.ts`, and artifact paths and cleanup are `test/test-runner/artifacts.ts`.

## Test Plan

```bash
bun test test/test-cases/validation/runtime-contracts/test-runner-contracts/console-harness.test.ts test/test-cases/validation/runtime-contracts/test-runner-contracts/terminal-filter.test.ts test/test-cases/validation/runtime-contracts/test-runner-contracts/run-digest.test.ts test/test-cases/validation/runtime-contracts/test-runner-contracts/artifacts-parsing.test.ts test/test-cases/validation/runtime-contracts/test-runner-contracts/model-calibration.test.ts
```

1. Passing tests emit no captured console output. Failing tests reprint their own logs, including when tests run concurrently.
2. `bun t` hides pass and skip result lines, prints headers only before visible output, keeps the full stream in `runner.log`, and `--verbose` restores that stream.
3. The digest leads with failures, summarizes skips, lists up to five tests of at least one second, and omits local engines from timing recommendations.
4. Cleanup keeps `latest.log` and `latest-model-calibration.json`, retains a failed run's directory until the next cleanup, and writes failed and skipped `report.json` entries into `latest.log`.

## References

- Related ADR: [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md)
- Related ADR: [ADR-021](ADR-021-adopt-table-free-text-json-results-and-safe-retry-ownership.md)
- `test/test-utils/test-console-harness.ts`
- `test/test-runner/terminal-filter.ts`
- `test/test-runner/reports/run-digest.ts`
- `test/test-runner/artifacts.ts`
- `bunfig.toml`
- `docs/commands/testing.md`
