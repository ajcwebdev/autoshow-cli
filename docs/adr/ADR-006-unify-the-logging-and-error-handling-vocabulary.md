# ADR-006: Unify and Enforce the Logging and Error-Handling Vocabulary Across `src/` and `test/`

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-13
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed
- **Supersession:** Absorbs the timestamp and concise diagnostic-rendering decisions from the retired record "Optimize Price Preflight Performance, Test Concurrency, and Token-Efficient Logging"; its production metadata-cache and price-verification decisions are owned by ADR-001 and ADR-002 respectively.

## Context

Production error handling already had a centralized core — the `AppError` hierarchy with kind-driven exit codes, `withRetry` / `classifyFetchRetry`, schema validation, redaction, and a single `cliErrorHandler` funnel — but most throw sites still used plain `Error`. Unstructured throws exited 1 with no `kind`, `hints`, `metadata`, or `stage`. Usage detection compared `name === 'CLIUsageError'`. Remediation hints were recovered by scanning message text. `pollUntil` threw plain errors, unlike `withRetry`. Deterministic failures (failed code-signature checks, malformed 200 bodies) were retried because `retryable` was unset.

The test runner duplicated transient-failure classifiers, scattered provider-specific predicates, and intercepted console output with helpers that replaced the [ADR-019](ADR-019-quiet-passing-test-console-output.md) harness and swallowed captured lines when a test failed.

Human logs carried both a zero-based stopwatch prefix (`[00:00:00.002]`) and a local wall-clock prefix (`[20:57:19]`); the test runner could add a third. Related values were spread across many lines.

The same split existed on the logging side. Commands wrote `console.*` and `process.stdout` because the logger had no sanctioned channel for a result that is neither a price estimate nor a file-producing completion, no category-filter API, and no `category` / `metadata` on `warn` and `debug`. A one-time error sweep then decayed because nothing mechanically enforced it: custom classes sat outside `AppError`, HTTP-error shapes disagreed, and error-message matching was used as control flow.

Why now: unifying the vocabularies without a standing check is what produced the drift. This record commits to one error vocabulary, one output channel, and the contracts that keep both.

## Options Considered

**Option 1 (selected)**

- **Option:** `src`: full `AppError` sweep plus the structural fixes (instanceof usage detection, co-located hints, `pollUntil` alignment, shared validator wrapping)
- **Pros:** One throw vocabulary; substring-hint and magic-name workarounds dissolve; every failure gains `kind` / `stage` / `hints` / `metadata`; reuses existing kinds, exit-code mapping, and redaction
- **Cons:** Large mechanical refactor; each throw needs a `kind` judgement
- **Quantitative Notes:** Full `src/` throw-site population

**Option 2**

- **Option:** `src`: surgical only (fix usage detection, hints, `pollUntil`, and validator wrapping; leave plain `Error` throws)
- **Pros:** Small, low-risk
- **Cons:** The substring-hint table cannot be retired; the two-vocabulary split remains
- **Quantitative Notes:** Rejected; root cause remains

**Option 3**

- **Option:** `src`: do nothing
- **Pros:** Plain Errors already funnel to exit 1
- **Cons:** Two-vocabulary split persists; the workarounds keep accreting
- **Quantitative Notes:** Rejected

**Option 4**

- **Option:** `src`: add a sixth `pipeline` error kind
- **Pros:** A dedicated bucket for step failures
- **Cons:** Splinters the vocabulary; existing kinds already cover every case and all map to exit 1
- **Quantitative Notes:** Rejected; adds 1 unused kind

**Option 5 (selected)**

- **Option:** `test`: shared predicate registry; keep the two classifiers
- **Pros:** One source of truth for transient predicates; both classifiers keep distinct return types
- **Cons:** One new module plus import churn
- **Quantitative Notes:** Chosen; 1 new module

**Option 6**

- **Option:** `test`: fully merge into one classifier returning `{ pressureKind, reason }`
- **Pros:** Single entry point
- **Cons:** Couples concurrency back-off to provider reason strings; larger blast radius
- **Quantitative Notes:** Rejected

**Option 7**

- **Option:** `test`: status quo (fix only the redundant `expect`s)
- **Pros:** Minimal change
- **Cons:** Leaves the duplication and scattered provider predicates
- **Quantitative Notes:** Rejected

**Option 8 (selected)**

- **Option:** Diagnostics: one local wall-clock timestamp and one line per logical result
- **Pros:** Consistent chronology, fewer preflight lines, no duplicate prefix
- **Cons:** Gives up the zero-relative stopwatch embedded in each output line
- **Quantitative Notes:** Chosen; price-preflight lines roughly halved

**Option 9**

- **Option:** Diagnostics: retain stopwatch plus wall-clock prefixes
- **Pros:** Preserves both elapsed and local time inline
- **Cons:** Dual prefixes repeat on every line; runner wrapping can add a third
- **Quantitative Notes:** Rejected

**Option 10 (selected)**

- **Option:** Logging and enforcement: close the logger and error-core gaps, and pin both vocabularies with source-scan contract tests whose every exception is named in an in-file allowlist
- **Pros:** Failures surface in the suite rather than in the next audit; the sanctioned channels remove the reason callers went around the convention; no new tooling
- **Cons:** A grep-based contract can miss an unusual spelling and needs its allowlist maintained
- **Quantitative Notes:** n/a

**Option 11**

- **Option:** Logging and enforcement: adopt ESLint with `no-console` and `no-restricted-syntax` on `NewExpression[callee.name='Error']`
- **Pros:** AST-accurate; per-directory overrides are first-class
- **Cons:** Introduces a linter to a repository that has none; the contract greps already pin these two rules
- **Quantitative Notes:** Rejected

**Option 12**

- **Option:** Logging and enforcement: re-run the sweep and re-record this ADR as verified, without enforcement
- **Pros:** Smallest change; no new tests to maintain
- **Cons:** The failure mode being repaired — a `Passed` record while the vocabulary drifted
- **Quantitative Notes:** Rejected; the missing piece is the standing check

## Decision

Adopt `AppError` and its typed subclasses as the single throw vocabulary across `src/`, and `src/utils/app-logger/` as the single diagnostic output channel. Consolidate provider failure classification under a shared test registry, standardize human and test-runner logs on a single local millisecond wall-clock timestamp (`[HH:MM:SS.MMM]`) with single-line results, normalize hosted rate-limit recovery at admission boundaries, and enforce both vocabularies with source-scan contract tests whose every exception is named and justified in an in-file allowlist.

This applies to:

- Production error construction, wrapping, and exit-code mapping across `src/`.
- Every diagnostic byte a command emits: `.ts` files under `src/` carry no `console.*` and no `process.stdout` / `process.stderr` writes outside the logger sink layer and the declared stdout-payload files, and no `throw new Error(`.
- Shared test failure classification, transient retry helpers, runner-level error handling, and console/sink capture across `test/`: no reassignment of `console.*` and no `l.config.sinks` mutation outside `test/test-utils/test-console-harness.ts` and `test/test-utils/console-capture.ts`.
- Human application logging and test-runner console timestamping and single-line result formatting.
- Hosted provider admission classification, rate-limit recovery backoff, and recovery checkpoint diagnostics.
- The exemption categories themselves: logger sink primitives, and stdout payloads whose bytes are the document the user asked for (`--help`, `--version`, `metadata --markdown` frontmatter, and the two standalone `bun run` report tools).

It does not apply to:

- Provider-specific API response payload schemas or low-level HTTP transport logic.
- Domain assertions inside leaf test files (`expect(...).toThrow(...)`), and test assertion style beyond the capture-helper consolidation.
- Message-matching that classifies external provider or tool prose, which is retained deliberately; see Keep (with rationale).
- The unified provider-credential registry, `doctor --strict`, the spawn environment allowlist, and the versioned HMAC-derived `accountScopeHash`, which [ADR-005](ADR-005-reduce-environment-variable-surface-area.md) owns. This record owns only the shared error contract and exit-code vocabulary those surfaces use.
- Alternative logger sink transports beyond the human and NDJSON sinks that exist.

### A. Production `src/` — `AppError` is the single throw vocabulary

Throw sites use the typed subclass that matches the failure:

**Throw 1**

- **Throw describes…:** External/operational failure — subprocess exit, download, file corruption, missing binary
- **Becomes:** `AppInfrastructureError`

**Throw 2**

- **Throw describes…:** Provider HTTP rejection with status/header evidence
- **Becomes:** `AppProviderError`

**Throw 3**

- **Throw describes…:** Config-invariant / unreachable branch
- **Becomes:** `AppInternalError`

**Throw 4**

- **Throw describes…:** Bad/parse/schema data
- **Becomes:** `AppValidationError` (or `validateData`)

**Throw 5**

- **Throw describes…:** Bad user input at a command boundary
- **Becomes:** `CLIUsageError`

Each throw attaches a `stage` and, where remediation exists, structured `hints`. Non-usage kinds map to exit code 1, so `infrastructure` vs `internal` refines the diagnostic label without changing the process exit. Deterministic failures set `retryable: false`. Usage detection is `instanceof AppUsageError`. Hints live at the throw site (`hintsForMissingEnv(key)`); there is no global substring-scanning hint table. `pollUntil` throws `AppError` with `infrastructure` or `retry_exhausted`, matching `withRetry`. Command option parsing wraps through `rethrowAsUsage`. No error class exists outside the `AppError` family. Control flow reads structured fields (`metadata.missingEnvVar`, `isMissingArtifactError`, `hasErrorCode`), not message text.

### B. Test suite `test/` — one classifier registry and one capture module

Provider-specific transient predicates live in `test/test-utils/provider-failure-classifiers.ts`. The two public classifiers (`classifyLiveProviderAvailabilityFailure` and `classifyAdaptivePressure`) stay separate and source predicates from that registry. Tests that opt into retry-once-on-transient use `runCommandWithTransientRetry`. The runner registers `unhandledRejection` and `uncaughtException` handlers that report the error chain and exit with the error's own normalized code. `test/test-utils/console-capture.ts` is the only sanctioned way to intercept console output or swap logger sinks; it replays captured lines on failure. Fixtures construct real `AppError` subclasses.

### C. Diagnostics — one timestamp, one line per result

Application and test-runner logs use `[HH:MM:SS.MMM]`. Lines that already carry that prefix are not wrapped again. Closely related labels and values (price estimates, single-variant budget decisions) emit on one line.

### D. Retry, backoff, and hosted rate-limit recovery

HTTP 429 and provider rate/concurrency rejections retry against the immutable admission token for that request. Non-rate-limit failures keep their standard policies. Hosted recovery honors `Retry-After` or applies bounded jittered exponential backoff, capped at five minutes; exhausted attempts throw `retry_exhausted` with status, headers, stage, retry metadata, and work/lane identity.

`--allow-ambiguous-redispatch` authorizes reconciliation of a stored TTS slot at resume and nothing else. An ambiguous admission is never redispatched in flight. When the flag is omitted, ambiguity halts to prevent duplicate billing.

`RETRY_POLICIES` in `src/utils/retries.ts` owns every attempt count and ceiling. A provider classifier may normalize a provider's error shape into structured fields; it may not override the class's retry decision afterwards. `withRetry` honors `retryable: false`, the non-retryable status set, and `Retry-After` even when the caller passes no classifier. Classifiers read the whole cause chain through `extractErrorMetadata`. Exhaustion is `retry_exhausted` with `attemptsMade` / `maxAttempts` / `elapsedMs` / `stopReason`; downstream accounting asks for the kind, not the message. `logRetryAttempt` is the single retry log shape; no retry is silent. Test predicates derive status and network patterns from production constants and must not contradict them.

### E. Logging — the central logger is the only output channel

`l.report.result(data, options)` is the sanctioned channel for a structured result that is neither a price estimate nor a file-producing completion. `suppressLogCategories(categories)` filters inside `write` and returns a restore handle; the CLI dispatcher clears suppression at the start of every command. `debug`, `warn`, and `error` take the same `LogWriteOptions` as `write`, with `category` required. Call sites pass text and structure, never ANSI escape codes. The only bytes written directly to stdout are the document the user asked for — `--help`, `--version`, `metadata --markdown` frontmatter, and the standalone `bun run` report tools — each named in the enforcement allowlist.

### F. Enforcement — standing source-scan contracts

`test/test-cases/validation/runtime-contracts/output-vocabulary-contracts.test.ts` and `retry-vocabulary-contracts.test.ts` scan `src/` and `test/` and fail with the offending `file:line` on a raw output site, a plain `throw new Error(`, a duck-typed `Object.assign(new Error(...))`, a `process.exit` outside the failure handlers, an unsanctioned console/sink mutation, a backoff sleep outside the retry engine, or a policy number outside the policy modules. Allowlists are in-file constants, each with a comment stating why the file is exempt. This record's `Verification Status` means the contracts pass.

## Rationale

- **Single vocabulary:** `cliErrorHandler` and `serializeDiagnosticError` can extract `kind`, `stage`, `hints`, and `metadata` from every failure.
- **No substring workarounds:** Co-located hints and `instanceof` replace message scanning and `name === 'CLIUsageError'`.
- **One test registry:** Provider error signatures update in one place; availability skipping and concurrency throttling stay independent.
- **Readable diagnostics:** `[HH:MM:SS.MMM]` and single-line results remove duplicate prefixes and cut preflight volume without dropping detail.
- **Safe paid operations:** Rate-limit recovery is separate from ambiguous create outcomes, so paid calls are never duplicated without `--allow-ambiguous-redispatch`.
- **Classification over prose:** Structured fields (`metadata.missingEnvVar`, artifact predicates, `retryable: false`) keep retry, batch-blocking, and fallback decisions stable when wording changes.
- **Standing contracts:** A one-time sweep does not hold; the suite fails when a violation lands.

## Consequences

Positive outcomes:

- Every failure carries `kind`, `stage`, `hints`, and `metadata`, including across provider REST clients.
- `--json`, `--log-format`, `--quiet`, and the configured log level are honored by every command, including voice management and `config --show`.
- Deterministic security and validation failures are not retried.
- Missing-credential failures exit 2 (usage), not 1.
- Captured test output still dumps on failure through the ADR-019 harness.
- Unified `[HH:MM:SS.MMM]` timestamps with no duplicate runner prefix.
- Ambiguous TTS admissions cannot double-bill; resume uses `--allow-ambiguous-redispatch` and reports retained / unresolved / blocked slot counts.

Negative outcomes:

- Call sites needing elapsed duration must log it explicitly; there is no per-line stopwatch prefix.
- Replaying ambiguous paid operations requires `--allow-ambiguous-redispatch` and cannot be resolved automatically.
- Voice-management and `config --show` human output is a rendered detail table rather than pretty-printed JSON; machine consumers must pass `--json`. `--json` emits both the NDJSON log event and the raw result line.
- `AppUsageError.name` is `'AppUsageError'` rather than `'CLIUsageError'`.
- The allowlists are a maintenance surface: an exemption added without justification would weaken the contract.

## Trade-offs

**Trade-off 1**

- **Gain:** Structured diagnostics on every failure
- **Sacrifice:** Every throw site must pick a kind, stage, and retryability instead of `new Error(message)`

**Trade-off 2**

- **Gain:** Type-safe `instanceof` usage detection
- **Sacrifice:** Custom error classes must extend `AppUsageError`

**Trade-off 3**

- **Gain:** Unified `[HH:MM:SS.MMM]` prefix and concise single-line logs
- **Sacrifice:** No per-line stopwatch prefix; callers format elapsed times explicitly

**Trade-off 4**

- **Gain:** Both vocabularies fail the suite at the offending `file:line` the moment they are violated
- **Sacrifice:** Line-based greps cannot see an unusual spelling, so the contract pins the common case rather than proving the invariant

**Trade-off 5**

- **Gain:** One sanctioned structured-result channel, so result payloads honor `--json` / `--quiet` / `--log-format`
- **Sacrifice:** Commands whose entire output was raw JSON change their human-mode rendering

**Trade-off 6**

- **Gain:** Category suppression is first-class and scoped to the run that asked for it
- **Sacrifice:** `suppressLogCategories` still mutates process-wide state; correctness depends on the restore handle or the dispatcher's per-command reset

## Implementation Note

Implemented in `src/utils/error-handler.ts`, `src/utils/retries.ts`, `src/utils/app-logger/`, `src/cli/create-cli.ts`, and `src/cli/failure-handlers.ts`. Test-side owners are `test/test-utils/provider-failure-classifiers.ts`, `test/test-utils/console-capture.ts`, and `test/test-cases/validation/runtime-contracts/`. Passing-test console quieting is owned by [ADR-019](ADR-019-quiet-passing-test-console-output.md).

`Verification Status: Passed` means the runtime-contract greps pass, not that a sweep was performed on a date. The standing pin is: no plain `throw new Error(` in `src/` (empty allowlist), no raw console or stdout writes outside logger sinks and declared stdout payloads, custom error classes extend `AppError`, and test capture goes through `console-capture.ts`.

## Keep (with rationale)

`src/`:

**Pattern 1: The existing `AppError` kinds (no new `pipeline` kind)**

- **Pattern:** The existing `AppError` kinds (no new `pipeline` kind)
- **Reason kept:** `usage`, `provider_http`, `retry_exhausted`, `validation`, `infrastructure`, and `internal` cover all runtime scenarios and map cleanly to process exit codes.

**Pattern 2: Provider and tool prose matchers**

- **Pattern:** Message-text matching in `pdf-chunk-fallback-classifier.ts`, `qpdf-health.ts`, `split-limits.ts`, and `classifyHostedRateLimitPressure`
- **Reason kept:** The upstream source is a provider HTTP error body or a binary's stderr, which has no machine-readable counterpart. Each site names that source, and structured fields are consulted first.

**Pattern 3: Comic's compact one-line log shape**

- **Pattern:** `comicLog.header/line/output/summary` keep their `label key=value` form rather than becoming tables
- **Reason kept:** The compact shape is comic's output contract, pinned by `comic-logging-contracts.test.ts`.

**Pattern 4: `metadata --markdown` and help/version stdout writes**

- **Pattern:** Direct `process.stdout` writes for documents the user asked for
- **Reason kept:** Sink decoration would corrupt the payload, so these are allowlisted rather than migrated.

**Pattern 5: `exec()` exhaustion returns the last `ExecResult`**

- **Pattern:** `exec()` logs exhaustion structurally but still returns the last failed `ExecResult`
- **Reason kept:** Callers derive domain errors from stderr; collapsing those into `retry_exhausted` would lose the tool-specific message.

`test/`:

**Pattern 1: Two public classifiers with different return types**

- **Pattern:** Two public classifiers with different return types
- **Reason kept:** Preserves the separation between semantic provider availability and adaptive concurrency pressure.

**Pattern 2: Result-object `runCommand` + factory-layer throw**

- **Pattern:** Result-object `runCommand` + factory-layer throw
- **Reason kept:** Lower-level utilities treat failures as data; high-level factories convert them to throws.

**Pattern 3: Three failure dispositions (throw / `test.skip` / `catch {}`)**

- **Pattern:** Three failure dispositions (throw / `test.skip` / `catch {}`)
- **Reason kept:** Differentiates hard failures, missing environment/budget skips, and best-effort resource cleanup.

**Pattern 4: Assertion-dominant leaf tests (`toThrow`/`rejects`)**

- **Pattern:** Assertion-dominant leaf tests (`toThrow`/`rejects`)
- **Reason kept:** Standard unit-test error assertion, not error-handling infrastructure.

**Pattern 5: Graceful parser degradation in `parsers.ts`**

- **Pattern:** Graceful parser degradation in `parsers.ts`
- **Reason kept:** Malformed JSONL/JUnit log lines skip without crashing test summary generation.

**Pattern 6: Duck-typed error fixtures in `app-error-contracts.test.ts`**

- **Pattern:** Hand-assembled error lookalikes retained in one file
- **Reason kept:** They are the negative cases proving duck-typed impostors are not accepted as `AppError`s.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/runtime-contracts/
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

1. `bun run check` proves the unique-source-name invariant and that the repository type-checks after the class hierarchy and type-surface changes.
2. `runtime-contracts/` proves the enforcement greps, the `AppError` contracts (including `AppUsageError.name`, usage errors exiting 2, operational errors exiting 1 with structured hints), the retry contracts over production-shaped fixtures including `retry_exhausted` metadata, and the logger escape hatches.
3. The three CLI suites prove help output, usage-error exit codes and messages, and option resolution across native parser errors extending `AppUsageError`.
4. The enforcement contracts confirm `LEGACY_ERROR_HINTS` is absent, `throw new Error(` is absent, and raw output is either gone or allowlisted.

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
- `src/utils/error-handler.ts` — `AppError` hierarchy, `isCLIUsageError`, `extractErrorHints`, `serializeDiagnosticError`
- `src/utils/retries.ts` — `withRetry`, `pollUntil`, `RETRY_POLICIES`, `classifyFetchRetry`, `classifyPaidCreateRetry`
- `src/utils/app-logger/` — logger core, sinks, reporter, `emitResult`, redaction, human tables
- `src/cli/create-cli.ts` — `cliErrorHandler`
- `src/cli/failure-handlers.ts` — Process-boundary error handlers
- `test/test-cases/validation/runtime-contracts/output-vocabulary-contracts.test.ts` — Standing logging and error vocabulary contracts
- `test/test-cases/validation/runtime-contracts/retry-vocabulary-contracts.test.ts` — Standing retry vocabulary contracts
- `test/test-utils/console-capture.ts` — Sole sanctioned console and sink capture module
- `test/test-utils/provider-failure-classifiers.ts` — Shared provider failure predicates
- `test/test-runner/utils.ts` and `test/test-runner/runner.ts` — Test timestamp formatter and console wrapper
