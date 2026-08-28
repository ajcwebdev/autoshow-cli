# ADR-006: Unify the Logging and Error-Handling Vocabulary

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-13
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed
- **Supersession:** Absorbs the timestamp and concise diagnostic-rendering decisions from the retired record "Optimize Price Preflight Performance, Test Concurrency, and Token-Efficient Logging"; that record's production metadata-cache and price-verification decisions are owned by [ADR-001](ADR-001-source-ingestion-and-normalization.md) and [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) respectively.

## Context

Production error handling already had a centralized core — the `AppError` hierarchy with kind-driven exit codes, retries, redaction, and a single `cliErrorHandler` funnel — but most throw sites still used plain `Error`. Unstructured throws exited 1 with no `kind`, `hints`, `metadata`, or `stage`. Usage detection compared class names. Remediation hints were recovered by scanning message text. Deterministic failures such as failed code-signature checks were retried because retryability was unset.

Human logs carried both a zero-based stopwatch prefix (`[00:00:00.002]`) and a local wall-clock prefix (`[20:57:19]`); the test runner could add a third. Related values were spread across many lines. Commands wrote `console.*` and `process.stdout` because the logger had no sanctioned channel for a result that is neither a price estimate nor a file-producing completion. A one-time error sweep then decayed because nothing mechanically enforced it.

Why now: unifying the vocabularies without a standing check is what produced the drift. This record commits to one error vocabulary, one output channel, and the contracts that keep both.

## Options Considered

**Option 1 (selected)**

- **Option:** Full `AppError` sweep plus the structural fixes: `instanceof` usage detection, co-located hints, aligned retry helpers, and shared validator wrapping
- **Pros:** One throw vocabulary; substring-hint and magic-name workarounds dissolve; every failure gains `kind` / `stage` / `hints` / `metadata`
- **Cons:** Large mechanical refactor; each throw needs a `kind` judgement
- **Quantitative Notes:** Full `src/` throw-site population

**Option 2**

- **Option:** Surgical only: fix usage detection, hints, retry helpers, and validator wrapping; leave plain `Error` throws
- **Pros:** Small, low-risk
- **Cons:** The substring-hint table cannot be retired; the two-vocabulary split remains
- **Quantitative Notes:** Rejected; root cause remains

**Option 3**

- **Option:** Do nothing on the error vocabulary
- **Pros:** Plain Errors already funnel to exit 1
- **Cons:** Two-vocabulary split persists; the workarounds keep accreting
- **Quantitative Notes:** Rejected

**Option 4**

- **Option:** Add a sixth `pipeline` error kind
- **Pros:** A dedicated bucket for step failures
- **Cons:** Splinters the vocabulary; existing kinds already cover every case and all map to exit 1
- **Quantitative Notes:** Rejected; adds 1 unused kind

**Option 5 (selected)**

- **Option:** Diagnostics: one local wall-clock timestamp and one line per logical result
- **Pros:** Consistent chronology, fewer preflight lines, no duplicate prefix
- **Cons:** Gives up the zero-relative stopwatch embedded in each output line
- **Quantitative Notes:** Chosen; price-preflight lines roughly halved

**Option 6**

- **Option:** Diagnostics: retain stopwatch plus wall-clock prefixes
- **Pros:** Preserves both elapsed and local time inline
- **Cons:** Dual prefixes repeat on every line; runner wrapping can add a third
- **Quantitative Notes:** Rejected

**Option 7 (selected)**

- **Option:** Close the logger and error-core gaps, and pin both vocabularies with source-scan contract tests whose every exception is named in an in-file allowlist
- **Pros:** Failures surface in the suite rather than in the next audit; the sanctioned channels remove the reason callers went around the convention; no new tooling
- **Cons:** A grep-based contract can miss an unusual spelling and needs its allowlist maintained
- **Quantitative Notes:** n/a

**Option 8**

- **Option:** Adopt ESLint with `no-console` and a ban on `new Error(`
- **Pros:** AST-accurate; per-directory overrides are first-class
- **Cons:** Introduces a linter to a repository that has none; the contract greps already pin these two rules
- **Quantitative Notes:** Rejected

**Option 9**

- **Option:** Re-run the sweep and re-record this ADR as verified, without enforcement
- **Pros:** Smallest change; no new tests to maintain
- **Cons:** The failure mode being repaired — a `Passed` record while the vocabulary drifted
- **Quantitative Notes:** Rejected; the missing piece is the standing check

## Decision

Adopt `AppError` and its typed subclasses as the single throw vocabulary across `src/`, and `src/utils/app-logger/` as the single diagnostic output channel. Standardize human and test-runner logs on a single local millisecond wall-clock timestamp (`[HH:MM:SS.MMM]`) with single-line results. Normalize hosted rate-limit recovery at admission boundaries. Enforce both vocabularies with source-scan contract tests whose every exception is named and justified in an in-file allowlist.

This applies to:

- Production error construction, wrapping, and exit-code mapping across `src/`.
- Every diagnostic byte a command emits, except the stdout documents listed under Keep.
- Human application logging and test-runner console timestamping and single-line result formatting.
- Hosted provider admission classification, rate-limit recovery backoff, and recovery checkpoint diagnostics.
- Shared test failure classification and the sanctioned console/sink capture module.

It does not apply to:

- Provider-specific API response payload schemas or low-level HTTP transport logic.
- Domain assertions inside leaf test files, and test assertion style beyond capture-helper consolidation.
- Message-matching that classifies external provider or tool prose, which is retained deliberately; see Keep (with rationale).
- The unified provider-credential registry, `setup --doctor --strict`, the spawn environment allowlist, and the versioned HMAC-derived `accountScopeHash`, which [ADR-005](ADR-005-reduce-environment-variable-surface-area.md) owns. This record owns only the shared error contract and exit-code vocabulary those surfaces use.
- Passing-test console quieting, which [ADR-019](ADR-019-quiet-passing-test-console-output.md) owns.
- Alternative logger sink transports beyond the human and NDJSON sinks that exist.
- Lane pressure, ramp, and 429-halving policy, which [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) owns.

Usage failures — bad command input and missing credentials — exit 2. Every other `AppError` kind exits 1; `infrastructure` versus `internal` changes the diagnostic label, not the process exit. The kinds are `usage`, `provider_http`, `retry_exhausted`, `validation`, `infrastructure`, and `internal`. Each throw carries a `stage` and, where remediation exists, structured `hints`. Deterministic failures are not retried. Control flow reads structured fields, not message text.

Logs use `[HH:MM:SS.MMM]`. Lines that already carry that prefix are not wrapped again. Closely related labels and values (price estimates, single-variant budget decisions) emit on one line. `--json`, `--log-format`, `--quiet`, and the configured log level apply to every command. The only bytes written directly to stdout are documents the user asked for.

HTTP 429 and provider rate or concurrency rejections retry against the same admission for that request. Hosted recovery honors `Retry-After` or applies bounded jittered exponential backoff, capped at five minutes; exhausted attempts throw `retry_exhausted`. `--allow-ambiguous-redispatch` authorizes reconciliation of a stored TTS slot at resume and nothing else. An ambiguous admission is never redispatched in flight. When the flag is omitted, ambiguity halts to prevent duplicate billing.

## Rationale

- **Single vocabulary:** every failure carries `kind`, `stage`, `hints`, and `metadata` through to the CLI error handler.
- **No substring workarounds:** co-located hints and `instanceof` replace message scanning and magic class-name checks.
- **Readable diagnostics:** `[HH:MM:SS.MMM]` and single-line results remove duplicate prefixes and cut preflight volume without dropping detail.
- **Safe paid operations:** rate-limit recovery is separate from ambiguous create outcomes, so paid calls are never duplicated without `--allow-ambiguous-redispatch`.
- **Classification over prose:** structured fields keep retry, batch-blocking, and fallback decisions stable when wording changes.
- **Standing contracts:** a one-time sweep does not hold; the suite fails when a violation lands.

## Consequences

Positive outcomes:

- Every failure carries `kind`, `stage`, `hints`, and `metadata`.
- `--json`, `--log-format`, `--quiet`, and the configured log level are honored by every command, including voice management and `config --show`.
- Deterministic security and validation failures are not retried.
- Missing-credential failures exit 2 (usage), not 1.
- Unified `[HH:MM:SS.MMM]` timestamps with no duplicate runner prefix.
- Ambiguous TTS admissions cannot double-bill; resume uses `--allow-ambiguous-redispatch` and reports retained, unresolved, and blocked slot counts.

Negative outcomes:

- Call sites needing elapsed duration must log it explicitly; there is no per-line stopwatch prefix.
- Replaying ambiguous paid operations requires `--allow-ambiguous-redispatch` and cannot be resolved automatically.
- Voice-management and `config --show` human output is a rendered detail table rather than pretty-printed JSON; machine consumers must pass `--json`. `--json` emits both the NDJSON log event and the raw result line.
- The allowlists are a maintenance surface: an exemption added without justification would weaken the contract.

## Trade-offs

**Trade-off 1**

- **Gain:** Structured diagnostics on every failure
- **Sacrifice:** Every throw site must pick a kind, stage, and retryability instead of `new Error(message)`

**Trade-off 2**

- **Gain:** Unified `[HH:MM:SS.MMM]` prefix and concise single-line logs
- **Sacrifice:** No per-line stopwatch prefix; callers format elapsed times explicitly

**Trade-off 3**

- **Gain:** Both vocabularies fail the suite at the offending `file:line` the moment they are violated
- **Sacrifice:** Line-based greps cannot see an unusual spelling, so the contract pins the common case rather than proving the invariant

**Trade-off 4**

- **Gain:** One sanctioned structured-result channel, so result payloads honor `--json` / `--quiet` / `--log-format`
- **Sacrifice:** Commands whose entire output was raw JSON change their human-mode rendering

## Implementation Note

Implemented in `src/utils/error-handler.ts`, `src/utils/retries.ts`, `src/utils/app-logger/`, `src/cli/create-cli.ts`, and `src/cli/failure-handlers.ts`. Test-side owners are `test/test-utils/provider-failure-classifiers.ts`, `test/test-utils/console-capture.ts`, and `test/test-cases/validation/runtime-contracts/`. Passing-test console quieting is owned by [ADR-019](ADR-019-quiet-passing-test-console-output.md).

## Keep (with rationale)

**Keep 1**

- **Pattern:** The existing `AppError` kinds (no new `pipeline` kind)
- **Reason kept:** `usage`, `provider_http`, `retry_exhausted`, `validation`, `infrastructure`, and `internal` cover all runtime scenarios and map cleanly to process exit codes.

**Keep 2**

- **Pattern:** Direct `process.stdout` writes for `--help`, `--version`, and `metadata --markdown` frontmatter
- **Reason kept:** These bytes are the document the user asked for. Sink decoration would corrupt the payload, so they are allowlisted rather than migrated.

**Keep 3**

- **Pattern:** Comic's compact `label key=value` log lines
- **Reason kept:** The compact shape is comic's output contract, pinned by `comic-logging-contracts.test.ts`.

**Keep 4**

- **Pattern:** Message-text matching against provider HTTP bodies and tool stderr
- **Reason kept:** Those upstream sources have no machine-readable counterpart. Structured fields are consulted first.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/runtime-contracts/
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

1. `bun run check` proves the repository type-checks after the class hierarchy and type-surface changes.
2. `runtime-contracts/` proves the enforcement greps, the `AppError` contracts (usage errors exiting 2, operational errors exiting 1 with structured hints), the retry contracts including `retry_exhausted` metadata, and the logger escape hatches.
3. The three CLI suites prove help output, usage-error exit codes and messages, and option resolution across native parser errors extending `AppUsageError`.

## References

- Related ADR: [ADR-001](ADR-001-source-ingestion-and-normalization.md)
- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md)
- Related ADR: [ADR-005](ADR-005-reduce-environment-variable-surface-area.md)
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)
- Related ADR: [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md)
- Related ADR: [ADR-016](ADR-016-govern-readme-command-examples-as-executable-contracts.md)
- Related ADR: [ADR-017](ADR-017-sound-effects-and-multi-track-soundscape-pipeline.md)
- Related ADR: [ADR-019](ADR-019-quiet-passing-test-console-output.md)
- `src/utils/error-handler.ts`
- `src/utils/retries.ts`
- `src/utils/app-logger/`
- `src/cli/create-cli.ts`
- `src/cli/failure-handlers.ts`
- `test/test-cases/validation/runtime-contracts/output-vocabulary-contracts.test.ts`
- `test/test-cases/validation/runtime-contracts/retry-vocabulary-contracts.test.ts`
- `test/test-utils/console-capture.ts`
- `test/test-utils/provider-failure-classifiers.ts`
