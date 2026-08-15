# ADR-020: Keep Passing Test Console Output Quiet and Attach Logs Only to Failures

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-15
- **Date Updated:** 2026-08-15
- **Verification Status:** Passed

## Context

`bun t` and `bun test` run in-process production code. The default human logger writes `info` and `success` tables through `console`, so passing TTS, OCR, resume, and generation contract tests dump config tables and result banners into the suite output. Bun's default reporter then prints `✓` or `✗` plus duration. The result is inverted signal: passing tests are noisy, and failing-test logs are interleaved with unrelated concurrent output.

JUnit is already an additive sidecar for `report.json` and metrics matching. Bun 1.3.14 exposes only the default console reporter, `junit`, and `dots`. JUnit cases do not include `<system-out>` / `<system-err>`, and `--only-failures` still prints passing-test console writes while hiding result lines. The runner cannot reconstruct per-test logs after the fact because `--parallel` and `--max-concurrency` share stdout/stderr pipes.

Why now: a full `bun t --budget` run made the inverted console policy the dominant diagnostic problem, independent of which live tests were failing.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Preload harness that buffers `console.*` per test and flushes only on failure** | Works for `bun test` and `bun t`; keeps Bun's `✓`/`✗` lines; captures in-process logger tables | Extra preload; wrapping `expect` adds a harness frame on assertion stacks | One preload, one fixture contract, no per-file import rewrite |
| Filter lines in `forwardSpawnOutput` after `bun test` exits | No test-process changes | Cannot attribute interleaved parallel output to pass or fail | Rejected; 10-way file and test concurrency |
| `--only-failures` or the `dots` reporter | Zero new code | Still prints passing-test logs; hides the wanted `✓ name [time]` lines | Rejected |
| `reconfigureLogger({ quiet: true })` for the whole suite | Smallest logger change | Failures lose the same logs | Rejected |
| Replace JUnit with a custom reporter | Could theoretically own all result formatting | Bun 1.3.14 has no custom JS reporter | Rejected; JUnit stays a post-run sidecar |

## Decision

Passing tests emit only Bun's result line (`✓`, name, duration). Failing tests keep that `✗` line and also print every `console` write from that test. Capture happens inside the Bun test process via `bunfig.toml` preload of `test/test-utils/test-console-harness.ts`.

The harness intercepts `console.log` / `warn` / `error` / `info` / `debug`, wraps `expect` through `mock.module('bun:test')`, and buffers writes in a per-test variable reset from `beforeEach`. Assertion failures mark the buffer failed and `afterEach` flushes it. The harness does not wrap `test` / `it`, so `test.skip` and `test.each` stay intact. JUnit remains the additive machine-readable summary for `report.json`. Budget preflight keeps its start line, summary table, skip list, and failed variants, and no longer lists every runnable key.

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

- Assertion stacks include a harness frame.
- A synchronous `throw` that never passes through `expect` does not flush buffered logs; the thrown error remains visible.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Quiet passes and grouped failure logs | A Bun preload and `expect` wrap |
| Concurrent tests keep isolated buffers | `AsyncLocalStorage` around test callbacks |
| JUnit and metrics matching stay unchanged | No per-test logs in `junit.xml` |

## Implementation Note

Implemented in `test/test-utils/test-console-harness.ts`, `bunfig.toml`, and `test/test-runner/runner.ts`. `forwardSpawnOutput` reuses `lineHasTimedOutputPrefix` so runner timestamps honor ADR-006.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/runtime/test-runner-contracts/
bun test test/test-cases/validation/providers/tts-provider-contracts/openai-grok-groq.test.ts
```

1. The harness contract spawns the noisy fixture and asserts the passing log is absent while the failing log and test name remain.
2. `lineHasTimedOutputPrefix` accepts stamped lines and rejects bare result lines.
3. A previously noisy in-process TTS file stays at result-line volume on pass.

## References

- Related ADR: [ADR-006](ADR-006-unify-error-handling-vocabulary.md)
- `test/test-utils/test-console-harness.ts`
- `test/test-runner/runner.ts`
- `test/test-runner/utils.ts`
- `bunfig.toml`
- `docs/tests/local-tests.md`
