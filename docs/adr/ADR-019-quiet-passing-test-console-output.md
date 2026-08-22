# ADR-019: Keep Passing Test Console Output Quiet and Attach Logs Only to Failures

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-15
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed

## Context

`bun t` and `bun test` run in-process production code. The default human logger writes `info` and `success` tables through `console`, so passing TTS, OCR, resume, and generation contract tests dump config tables and result banners into the suite output. Bun's default reporter then prints `✓` or `✗` plus duration. The result is inverted signal: passing tests are noisy, and failing-test logs are interleaved with unrelated concurrent output.

JUnit is already an additive sidecar for `report.json` and metrics matching. Bun 1.3.14 exposes only the default console reporter, `junit`, and `dots`. JUnit cases do not include `<system-out>` / `<system-err>`, and `--only-failures` still prints passing-test console writes while hiding result lines. The runner cannot reconstruct per-test logs after the fact because `--parallel` and `--max-concurrency` share stdout/stderr pipes.

Why now: a full `bun t --budget` run made the inverted console policy the dominant diagnostic problem, independent of which live tests were failing.

## Options Considered

**Option 1 (selected)**

- **Option:** Preload harness that buffers `console.*` per test and flushes only on failure
- **Pros:** Works for `bun test` and `bun t`; keeps Bun's `✓`/`✗` lines; captures in-process logger tables
- **Cons:** Extra preload; wrapping `expect` and the test registrars adds a harness frame on failure stacks
- **Quantitative Notes:** One preload, one fixture contract, no per-file import rewrite

**Option 2**

- **Option:** Filter lines in `forwardSpawnOutput` after `bun test` exits
- **Pros:** No test-process changes
- **Cons:** Cannot attribute interleaved parallel output to pass or fail
- **Quantitative Notes:** Rejected; 10-way file and test concurrency

**Option 3**

- **Option:** `--only-failures` or the `dots` reporter
- **Pros:** Zero new code
- **Cons:** Still prints passing-test logs; hides the wanted `✓ name [time]` lines
- **Quantitative Notes:** Rejected

**Option 4**

- **Option:** `reconfigureLogger({ quiet: true })` for the whole suite
- **Pros:** Smallest logger change
- **Cons:** Failures lose the same logs
- **Quantitative Notes:** Rejected

**Option 5**

- **Option:** Replace JUnit with a custom reporter
- **Pros:** Could theoretically own all result formatting
- **Cons:** Bun 1.3.14 has no custom JS reporter
- **Quantitative Notes:** Rejected; JUnit stays a post-run sidecar

## Decision

Passing tests emit only Bun's result line (`✓`, name, duration). Failing tests keep that `✗` line and also print every `console` write from that test. Capture happens inside the Bun test process via `bunfig.toml` preload of `test/test-utils/test-console-harness.ts`.

The harness intercepts `console.log` / `warn` / `error` / `info` / `debug` and, through `mock.module('bun:test')`, wraps `expect` plus the `test` and `it` registrars. Each test callback runs inside an `AsyncLocalStorage` buffer, so writes accumulate per test instead of streaming. A failed matcher marks the buffer failed and the wrapped callback flushes it, as does any error thrown out of the callback. The registrars are Proxies that forward property access to the originals, so `test.skip`, `test.each`, and `test.concurrent` stay intact. JUnit remains the additive machine-readable summary for `report.json`. Budget preflight keeps its start line, summary table, skip list, and failed variants, and no longer lists every runnable key.

This applies to:

- `bun test` and `bun t` console output for discovered tests.
- In-process production logger writes that already go through `console`.
- Budget preflight progress logging in `test/test-runner/runner.ts`.

It does not apply to:

- Replacing JUnit, `report.json`, `commands.log`, or `latest.log`.
- Changing `runCommand` capture, which is already quiet on pass.
- Product CLI logging outside the test process.

## Rationale

- Per-test capture is the only place that still knows pass versus fail under parallel Bun workers.
- Buffering `console` also captures the human logger without quieting failures.
- JUnit is useful after the run and useless for live log invert, so it stays a sidecar.
- Dropping per-key `decision: RUN` lines applies the same quiet-on-success rule to budget preflight.

## Consequences

Positive outcomes:

- Passing suites are a list of green result lines.
- A failing test reprints its own logs next to Bun's `✗` line and assertion.
- Already-timestamped app-log lines are not double-prefixed by the runner.

Negative outcomes:

- Failure stacks include a harness frame.
- Writes outside a test callback — module top level, `beforeAll` / `beforeEach` and their `after` counterparts — have no buffer to land in and print unconditionally, including on pass.

## Trade-offs

**Trade-off 1**

- **Gain:** Quiet passes and grouped failure logs
- **Sacrifice:** A Bun preload and an `expect` plus registrar wrap

**Trade-off 2**

- **Gain:** Concurrent tests keep isolated buffers
- **Sacrifice:** `AsyncLocalStorage` around test callbacks

**Trade-off 3**

- **Gain:** JUnit and metrics matching stay unchanged
- **Sacrifice:** No per-test logs in `junit.xml`

## Implementation Note

Implemented in `test/test-utils/test-console-harness.ts`, `bunfig.toml`, and `test/test-runner/runner.ts`. `forwardSpawnOutput` reuses `lineHasTimedOutputPrefix` so runner timestamps honor ADR-006.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/runtime-contracts/test-runner-contracts/
bun test test/test-cases/validation/providers/tts-provider-contracts/openai-grok-groq.test.ts
```

1. The harness contract spawns the noisy sequential and `test.concurrent` fixtures and asserts each passing log is absent while the failing log and test name remain.
2. `lineHasTimedOutputPrefix` accepts stamped lines and rejects bare result lines.
3. A previously noisy in-process TTS file stays at result-line volume on pass.

## References

- Related ADR: [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md)
- `test/test-utils/test-console-harness.ts`
- `test/test-runner/runner.ts`
- `test/test-runner/utils.ts`
- `bunfig.toml`
- `docs/commands/testing.md`
