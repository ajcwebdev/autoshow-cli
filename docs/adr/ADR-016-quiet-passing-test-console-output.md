# ADR-016: Quiet Passing Tests

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-15
- **Date Updated:** 2026-11-14
- **Verification Status:** Passed

## Context

Interleaved passing-test logs obscure failures and cannot be reliably attributed after capture. Diagnostics must remain available when their test fails.

## Decision

Buffer `console.log`, `info`, `warn`, `error`, and `debug` inside test callbacks. Discard those logs on success and print them on failure, including concurrent tests. Hooks, module initialization, direct stream writes, and subprocess capture remain outside this buffer.

`bunfig.toml` loads temporary-file isolation before console capture. `bun t` hides passing and skipped result lines; `--verbose` restores the complete stream retained in `runner.log`. The terminal shows idle progress and a digest ordered by failures, skips, slow tests, and calibration recommendations. JUnit still feeds `report.json`.

Artifacts live under `output/test-output/`, with stable latest-run summaries. Successful runs remove their current directory only when it contains no protected evidence, unless `--no-cleanup` is set. Price-only runs retain it. Explicit `--cleanup` removes only confirmed successful prior runner artifacts, preserving active, failed, interrupted, unknown, and TTS/audio evidence.

## Trade-offs

Per-test buffering preserves failure context at the cost of a test wrapper and an extra stack frame. Post-process filtering cannot recover attribution; globally silencing the logger would discard useful failure diagnostics. Captured console logs are not added to JUnit.

## Verification

```bash
bun test test/test-cases/validation/runtime-contracts/test-runner-contracts/console-harness.test.ts test/test-cases/validation/runtime-contracts/test-runner-contracts/terminal-filter.test.ts test/test-cases/validation/runtime-contracts/test-runner-contracts/run-digest.test.ts test/test-cases/validation/runtime-contracts/test-runner-contracts/runner-preservation.test.ts
```

These local contracts cover concurrent capture, terminal filtering, digest ordering, and evidence-preserving cleanup.

## References

- [Testing guide](../commands/testing.md)
- [ADR-005: Product logging](ADR-005-cli-error-result-and-retry-contract.md)
- `test/test-utils/test-console-harness.ts`, `test/test-runner/`
