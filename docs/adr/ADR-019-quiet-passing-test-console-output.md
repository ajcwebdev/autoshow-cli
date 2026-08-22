# ADR-019: Keep Passing Test Console Output Quiet and Attach Logs Only to Failures

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-15
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed

## Context

`bun t` and `bun test` run in-process production code. The production logger writes tables and banners through `console`, so passing tests dump that output into the suite. Bun then prints `✓` or `✗` plus duration. The signal is inverted: passing tests are noisy, and failing-test logs are interleaved with unrelated concurrent output.

Built-in reporters cannot invert that. JUnit is a post-run sidecar without per-test captured output, `--only-failures` still prints passing-test console writes while hiding result lines, and parallel workers share one stdout/stderr pipe, so the runner cannot reconstruct per-test logs after the fact.

Why now: a full `bun t --budget` run made the inverted console policy the dominant diagnostic problem, independent of which live tests were failing.

## Options Considered

**Option 1 (selected)**

- **Option:** Preload harness that buffers `console.*` per test and flushes only on failure
- **Pros:** Works for `bun test` and `bun t`; keeps Bun's `✓`/`✗` lines; captures in-process logger tables
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
- **Cons:** Still prints passing-test logs; hides the wanted `✓ name [time]` lines
- **Quantitative Notes:** Rejected

**Option 4**

- **Option:** Quiet the production logger for the whole suite
- **Pros:** Smallest logger change
- **Cons:** Failures lose the same logs
- **Quantitative Notes:** Rejected

**Option 5**

- **Option:** Replace JUnit with a custom reporter
- **Pros:** Could theoretically own all result formatting
- **Cons:** Bun has no custom JS reporter
- **Quantitative Notes:** Rejected; JUnit stays a post-run sidecar

## Decision

Passing tests emit only Bun's result line (`✓`, name, duration). Failing tests keep that `✗` line and also print every `console` write from that test. Both `bun test` and `bun t` follow this invert. JUnit remains the additive machine-readable summary for `report.json`. Budget preflight follows the same quiet-on-success rule.

This applies to:

- `bun test` and `bun t` console output for discovered tests.
- In-process production logger writes that already go through `console`.
- Budget preflight progress logging.

It does not apply to:

- Replacing JUnit, `report.json`, `commands.log`, or `latest.log`.
- Subprocess CLI capture already used by tests, which is already quiet on pass.
- Product CLI logging outside the test process.

## Rationale

- Per-test capture is the only place that still knows pass versus fail under parallel Bun workers.
- Buffering `console` captures the human logger without quieting failures.
- JUnit is useful after the run and cannot invert live logs, so it stays a sidecar.

## Consequences

Positive outcomes:

- Passing suites are a list of green result lines.
- A failing test reprints its own logs next to Bun's `✗` line and assertion.

Negative outcomes:

- Failure stacks include a harness frame.
- Writes outside a test callback — module top level, `beforeAll` / `beforeEach` and their `after` counterparts — have no buffer to land in and print unconditionally, including on pass.

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

Implemented in `test/test-utils/test-console-harness.ts`, preloaded from `bunfig.toml`, with budget-preflight quieting in `test/test-runner/runner.ts`.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/runtime-contracts/test-runner-contracts/
```

1. Typecheck and unique source check pass.
2. Passing tests emit no captured console output; failing tests reprint their logs next to the test name, including concurrent tests.

## References

- Related ADR: [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md)
- `test/test-utils/test-console-harness.ts`
- `test/test-runner/runner.ts`
- `bunfig.toml`
- `docs/commands/testing.md`
