# ADR-006: Unify the Error-Handling and Diagnostic Vocabulary Across `src/` and `test/`

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-13
- **Date Updated:** 2026-08-15
- **Verification Status:** Passed
- **Supersession:** Absorbs the timestamp and concise diagnostic-rendering decisions from the retired record "Optimize Price Preflight Performance, Test Concurrency, and Token-Efficient Logging"; its production metadata-cache and price-verification decisions are owned by ADR-001 and ADR-002 respectively.

## Context

An architectural audit of error handling across `src/` and `test/` surfaced fragmentation across production error handling, test failure classification, and diagnostic log rendering, despite existing foundational primitives.

**Production `src/`.** The codebase defined a centralized error core — the `AppError` hierarchy with kind-driven exit codes (`error-handler.ts`), the `withRetry`/`classifyFetchRetry` framework (`retries.ts`), schema validation, centralized redaction, and a single top-level funnel `cliErrorHandler` — but pipeline execution modules had not adopted it. Five concrete issues stemmed from this gap:

1. **Two error vocabularies coexist:** ~994 plain `new Error(...)` throw sites in `src/` (829 in `process-steps/` alone) versus ~323 structured `CLIUsageError`/`AppError` throws. Plain throws funnel to exit code 1 but carry no `kind`, `hints`, `metadata`, or `stage`.
2. **Typed subclasses are unused:** `AppValidationError`, `AppProviderError`, `AppInfrastructureError`, and `AppInternalError` had zero direct `new` call sites; structured throwers built `new AppError({ kind })` inline. A complete sweep represents the first uniform adoption of the structured family.
3. **Usage detection via magic string:** Usage error detection relied on `name === 'CLIUsageError'`, re-implemented at five sites and opted into by `UnsupportedArtifactSchemaError extends Error`.
4. **Hints attached via substring scanning:** `LEGACY_ERROR_HINTS` scanned every error message for keywords (`yt-dlp`, `OPENAI_API_KEY`, etc.) as a compensating workaround for unformatted throws.
5. **`pollUntil` inconsistency:** `pollUntil` threw plain `Error` instances on terminal failure and deadline, unlike `withRetry` (which threw `new AppError({ kind: 'retry_exhausted' })` with `stage`, `status`, and `metadata`). Additionally, validator-wrapping logic was duplicated across command definitions.

**Test suite `test/`.** The test runner and harness exhibited duplication and missing safety nets:

1. Two parallel transient-failure classifiers with overlapping detection (`classifyLiveProviderAvailabilityFailure` vs `classifyAdaptivePressure`).
2. Provider-specific transient predicates scattered across multiple modules, including duplicate definitions of Gemini transient errors.
3. Redundant, unreachable `expect(result.exitCode).toBe(0)` assertions after preceding `throw` statements.
4. Retry-once logic hardcoded to Gemini and MiniMax inside one test factory rather than shared across providers.
5. No global `unhandledRejection` or `uncaughtException` handlers in the test runner.

**Human and test-runner diagnostics.** Human log output emitted both a zero-based stopwatch prefix (`[00:00:00.002]`) and a local wall-clock prefix (`[20:57:19]`), while the test runner appended an additional prefix to already-timestamped logs. Spreading related output values across multiple lines caused single preflight runs to exceed 338 log lines.

Why now: Unifying error structures, test failure classifiers, and log formatting resolves active drift across provider transient retry logic, eliminates brittle substring-matching workarounds, and ensures consistent diagnostic output across CLI runs and test runners.

## Options Considered

**Option 1**

- **Option:** `src`: do nothing
- **Pros:** Plain Errors already funnel to exit 1
- **Cons:** Two-vocabulary split persists; the three workarounds keep accreting; ~994 throws stay structureless
- **Quantitative Notes:** ~994 unchanged throw sites

**Option 2**

- **Option:** `src`: surgical only (fix #3–#6, leave the plain-Error population)
- **Pros:** Small, low-risk
- **Cons:** The substring-hint table can't be retired (plain throws still lack hints); the root cause remains
- **Quantitative Notes:** Fixes 4 structural issues; leaves ~994 plain throws

**Option 3 (selected)**

- **Option:** `src`: full sweep + structural fixes
- **Pros:** Adopts `AppError` as the single vocabulary; #3/#4/#5 *dissolve*; every failure gains `kind`/`stage`/`hints`/`metadata`; reuses existing kinds/exit-code mapping/redaction
- **Cons:** One large mechanical refactor (~994 sites); per-throw `kind` judgement
- **Quantitative Notes:** Chosen; ~994 sites and 5 duplicated guards

**Option 4**

- **Option:** `src`: add a 6th `pipeline` error kind
- **Pros:** A dedicated bucket for step failures
- **Cons:** Splinters the vocabulary; existing kinds already cover every case and all map to exit 1
- **Quantitative Notes:** Adds 1 error kind

**Option 5 (selected)**

- **Option:** `test`: shared predicate registry; keep the two classifiers
- **Pros:** Eliminates duplication; one source of truth for transient predicates; both classifiers keep distinct return types
- **Cons:** One new module + import churn across three files
- **Quantitative Notes:** Chosen; 1 new module and 3 importers

**Option 6**

- **Option:** `test`: fully merge into one classifier returning `{ pressureKind, reason }`
- **Pros:** Single entry point
- **Cons:** Couples concurrency back-off to provider reason strings; larger blast radius
- **Quantitative Notes:** Collapses 2 classifiers into 1

**Option 7**

- **Option:** `test`: status quo (fix only the redundant `expect`s)
- **Pros:** Minimal change
- **Cons:** Leaves the duplication/scattered predicates and the Gemini double-definition
- **Quantitative Notes:** Removes 2 assertions only

**Option 8 (selected)**

- **Option:** Diagnostics: one local wall-clock timestamp and one line per logical result
- **Pros:** Consistent chronology, half as many price-preflight lines, and no duplicate prefix
- **Cons:** Gives up the zero-relative stopwatch embedded in each output line
- **Quantitative Notes:** 338+ to 172 price-preflight lines

**Option 9**

- **Option:** Diagnostics: retain stopwatch plus wall-clock prefixes
- **Pros:** Preserves both elapsed and local time inline
- **Cons:** Cluttered dual prefixes repeat on every line and runner wrapping can add a third
- **Quantitative Notes:** Rejected

## Decision

Adopt `AppError` and its typed subclasses as the single throw vocabulary across `src/`, consolidate provider failure classification and transient retry logic under `test/test-utils/provider-failure-classifiers.ts`, standardize human and test-runner log diagnostics on a single local millisecond wall-clock timestamp (`[HH:MM:SS.MMM]`) with single-line results, and normalize hosted rate-limit recovery at admission boundaries.

This applies to:

- Production error construction, wrapping, and exit-code mapping across `src/`.
- Shared test failure classification, transient retry helpers, and runner-level error handling across `test/`.
- Human application logging and test-runner console timestamping and single-line result formatting.
- Hosted provider admission classification, rate-limit recovery backoff, and recovery checkpoint diagnostics.

It does not apply to:

- Provider-specific API response payload schemas or low-level HTTP transport logic.
- Domain assertion assertions inside leaf test files (`expect(...).toThrow(...)`).
- Alternative logger sink transports (e.g. structured JSON event streams).

### A. Production `src/` — Adopt `AppError` as the single throw vocabulary

1. **Typed subclasses become the canonical throw API.** Add terse factory helpers beside the existing `CLIUsageError` factory — `ProviderError`, `InfraError`, `InternalError`, `ValidationError` — and sweep plain `new Error(...)` call sites to the appropriate typed subclass:

**Throw describes… 1: External/operational failure — subprocess exit, download, file corruption, missing binary**

- **Throw describes…:** External/operational failure — subprocess exit, download, file corruption, missing binary
- **Becomes:** `AppInfrastructureError`

**Throw describes… 2: Provider HTTP rejection with status/header evidence**

- **Throw describes…:** Provider HTTP rejection with status/header evidence
- **Becomes:** `AppProviderError`

**Throw describes… 3: "Should never happen" / config-invariant — no provider configured, unreachable branch**

- **Throw describes…:** "Should never happen" / config-invariant — no provider configured, unreachable branch
- **Becomes:** `AppInternalError`

**Throw describes… 4: Bad/parse/schema data**

- **Throw describes…:** Bad/parse/schema data
- **Becomes:** `AppValidationError` (or `validateData`)

**Throw describes… 5: Bad **user** input at a command boundary**

- **Throw describes…:** Bad **user** input at a command boundary
- **Becomes:** `CLIUsageError` (unchanged)

   Each migrated throw attaches a `stage` and, where remediation exists, structured `hints`. Because non-usage kinds map to exit code 1, classification distinctions between `infrastructure` and `internal` refine diagnostic labels without altering process exit behavior.
2. **Replace magic-string usage detection with `instanceof`.** Export `isCLIUsageError` using `error instanceof AppUsageError`, delete local string-matching re-implementations, and ensure usage error classes inherit from `AppUsageError`.
3. **Retire `LEGACY_ERROR_HINTS`.** With structured `hints` co-located at throw sites (including env-var guidance via `hintsForMissingEnv(key)`), the global substring-scanning lookup table is deleted. `extractErrorHints` evaluates structured `hints` and `keyedHintsFor`.
4. **Make `pollUntil` throw `AppError`.** Terminal polling failures throw `AppError({ kind: 'infrastructure', stage, metadata })` and deadlines throw `AppError({ kind: 'retry_exhausted', stage, metadata })`, aligning with `withRetry`.
5. **Consolidate validator wrapping.** Provide a shared `rethrowAsUsage(fn, fallbackHint?)` helper to standardize option parsing and validation error wrapping across CLI commands.

### B. Test suite `test/` — Consolidate error and retry utilities

1. **Extract provider predicates into a shared registry.** Consolidate all provider-specific transient predicates into `test/test-utils/provider-failure-classifiers.ts`. The two public classifiers (`classifyLiveProviderAvailabilityFailure` and `classifyAdaptivePressure`) remain separate for distinct use cases (availability skipping vs. adaptive concurrency) but source predicates from this common registry.
2. **Generalize retry-once-on-transient.** Provide a reusable helper (`runCommandWithTransientRetry`) utilizing registry predicates so test factories can opt into transient retry without re-implementing backoff and sleep logic.
3. **Remove unreachable assertions.** Eliminate dead assertions (`expect(result.exitCode).toBe(0)`) placed after unconditional throw statements.
4. **Add runner safety net.** Register global `unhandledRejection` and `uncaughtException` handlers in `test-runner.ts` that log via `l.error` and exit with code 1.

### C. Human and test-runner diagnostics — Standardize on single-timestamp, single-line results

1. **Single wall-clock timestamp:** Format application and test-runner log timestamps uniformly as `[HH:MM:SS.MMM]`. Remove the zero-based stopwatch prefix from rendered output.
2. **Suppress duplicate runner prefixes:** Strip ANSI formatting during runner log inspection and pass lines starting with `[HH:MM:SS.MMM]` or `[HH:MM:SS]` through without prepending additional timestamps.
3. **Single-line result formatting:** Emit closely related labels and values (such as price estimates and single-variant budget decisions) on a concise single line.

### D. Normalize hosted rate-limit recovery at the admission boundary

1. **Rate-limit classification:** HTTP 429 and provider rate/concurrency rejections report pressure against the immutable admission token for the exact request. Non-rate-limit failures (billing, auth, quota exhaustion, validation, timeouts, 5xx) retain standard failure policies unless explicitly classified as rate limits.
2. **Bounded jittered backoff:** Hosted recovery respects `Retry-After` headers or applies half-to-full jitter backoff across exponential bases (2, 4, 8, 16, 30s), bounded to five minutes. Exhausted attempts throw a structured `retry_exhausted` error retaining status, headers, stage, retry metadata, work identity, and lane identity.
3. **Ambiguity vs. definite rejection:** Only definite 4xx responses (excluding 408 and 409) prove rejection prior to work admission. Network failures, timeouts, and 5xx responses are treated as ambiguous. Ambiguous paid operations are not redispatched automatically.
4. **Explicit redispatch authorization:** The `--tts-allow-ambiguous-redispatch` flag is the sole public mechanism authorizing re-dispatch of ambiguous TTS generation slots during fresh runs or resumes. When omitted, ambiguity halts execution to prevent duplicate billing; when provided, bounded provider retries (e.g. up to 8 attempts for DeepInfra) are authorized with duplicate-purchase warnings.
5. **Structured aggregation and redaction:** Target and composite workflows preserve underlying cause, status, headers, stage, retryability, request ID, and redacted provider messages. All provider diagnostic text passes through the central redaction pipeline prior to logging or disk storage.
6. **Recovery checkpoints:** Failed targets compute non-destructive recovery checkpoints. When reusable completed slots or ambiguous admissions exist, structured infrastructure errors report retained, unresolved, and reconciliation-blocked slot counts alongside required redispatch flag guidance.

## Rationale

- **Single Vocabulary:** Adopting `AppError` and typed subclasses across all modules eliminates the bifurcation between plain and structured errors, allowing `cliErrorHandler` and `serializeDiagnosticError` to reliably extract `kind`, `stage`, `hints`, and `metadata`.
- **Elimination of Fragile Workarounds:** Replacing substring matching (`LEGACY_ERROR_HINTS`) and string comparison (`name === 'CLIUsageError'`) with co-located hints and `instanceof` checks makes error handling maintainable and type-safe.
- **Unified Test Failure Logic:** Centralizing provider failure predicates in `provider-failure-classifiers.ts` creates a single point of update when provider error signatures change, while preserving the independent responsibilities of availability filtering and concurrency throttling.
- **Diagnostic Signal-to-Noise:** Standardizing on `[HH:MM:SS.MMM]` and single-line result logs removes redundant timestamps and reduces diagnostic log volume by roughly half without discarding diagnostic detail.
- **Safe Paid Operations:** Explicitly separating rate-limit recovery from ambiguous execution outcomes guarantees that paid external API calls are never duplicated silently without explicit user authorization.

## Keep (with rationale)

`src/`:

**Pattern 1: The existing `AppError` kinds (no new `pipeline` kind)**

- **Pattern:** The existing `AppError` kinds (no new `pipeline` kind)
- **Reason kept:** `infrastructure`, `internal`, `validation`, and `usage` cover all runtime scenarios and map cleanly to process exit codes.

`test/`:

**Pattern 1: Two **public** classifiers with different return types**

- **Pattern:** Two **public** classifiers with different return types
- **Reason kept:** Preserves intentional separation between semantic provider availability and adaptive concurrency pressure.

**Pattern 2: Result-object `runCommand` + factory-layer throw**

- **Pattern:** Result-object `runCommand` + factory-layer throw
- **Reason kept:** Deliberate separation: lower-level utilities treat failures as data while high-level factories convert them to throws.

**Pattern 3: Three failure dispositions (throw / `test.skip` / `catch {}`)**

- **Pattern:** Three failure dispositions (throw / `test.skip` / `catch {}`)
- **Reason kept:** Differentiates hard failures, missing environment/budget skips, and best-effort resource cleanup.

**Pattern 4: Assertion-dominant leaf tests (`toThrow`/`rejects`)**

- **Pattern:** Assertion-dominant leaf tests (`toThrow`/`rejects`)
- **Reason kept:** Standard unit test error assertion, not error handling infrastructure.

**Pattern 5: Graceful parser degradation in `parsers.ts`**

- **Pattern:** Graceful parser degradation in `parsers.ts`
- **Reason kept:** Allows malformed JSONL/JUnit log lines to skip without crashing test summary generation.

## Consequences

Positive outcomes:

- `src/`: A single structured error vocabulary where every failure carries `kind`, `stage`, `hints`, and `metadata`, surfacing structured diagnostics through `cliErrorHandler` and `serializeDiagnosticError`.
- `src/`: Type-safe usage detection via `instanceof`, removal of `LEGACY_ERROR_HINTS`, and consistent error contracts between `pollUntil` and `withRetry`.
- `test/`: Centralized provider transient predicates in a shared registry; generalized transient-retry and availability skipping; deterministic global error reporting via runner-level uncaught exception handlers.
- Diagnostics: Unified `[HH:MM:SS.MMM]` timestamp across application and test runners without duplicate prefixing, and concise single-line result logs.
- Hosted Operations: Explicit boundary between rate-limit pressure recovery and ambiguous create outcomes, preventing accidental duplicate billing while enabling clean resume checkpoints.

Negative outcomes:

- Broad mechanical refactoring across ~994 throw sites in `src/`.
- Call sites needing elapsed duration must compute and log it explicitly rather than relying on automatic stopwatch prefixes.
- Replaying ambiguous paid operations requires explicit flag authorization (`--tts-allow-ambiguous-redispatch`) and cannot be resolved automatically by the concurrency controller.

## Trade-offs

**Trade-off 1**

- **Gain:** `src`: Structured diagnostics on every failure
- **Sacrifice:** Large refactor touching ~994 throw sites

**Trade-off 2**

- **Gain:** `src`: Type-safe `instanceof` usage detection and centralized `rethrowAsUsage`
- **Sacrifice:** Custom error classes must extend `AppUsageError`

**Trade-off 3**

- **Gain:** `src`: Remediation hints at throw sites; `pollUntil` consistent with `withRetry`
- **Sacrifice:** Retired global substring matching table

**Trade-off 4**

- **Gain:** `test`: Single registry for transient provider detection and reusable retry helper
- **Sacrifice:** An extra module hop (`provider-failure-classifiers.ts`) for test utilities

**Trade-off 5**

- **Gain:** `test`: Deterministic runner failure reporting
- **Sacrifice:** Process-level error listeners in the runner

**Trade-off 6**

- **Gain:** Diagnostics: Unified `[HH:MM:SS.MMM]` prefix and concise single-line logs
- **Sacrifice:** Removed per-line stopwatch prefix; callers must format elapsed times explicitly

## Implementation Note

The unified `AppError` taxonomy (`ProviderError`, `InfraError`, `InternalError`, `ValidationError`), type-safe `isCLIUsageError`, `rethrowAsUsage` validator wrapping, structured retry handling in `pollUntil`, provider failure classification registry in `test/test-utils/provider-failure-classifiers.ts`, cause-aware paid-create admission handling, explicit bounded TTS ambiguous-redispatch authorization (`--tts-allow-ambiguous-redispatch`), bounded provider diagnostics, TTS recovery-checkpoint diagnostics, structured target aggregation, normalized hosted-pressure recovery, and `[HH:MM:SS.MMM]` human log formatting are fully implemented and verified across `src/` and `test/`. `forwardSpawnOutput` now skips lines that already carry that timestamp. Passing-test console quieting is owned by [ADR-020](ADR-020-quiet-passing-test-console-output.md).

## Test Plan

Run default verification (`bun run check`) and local, no-cost contract validation suites:

```bash
bun run check
bun test test/test-cases/validation/cli/cli-usage-errors.test.ts
bun test test/test-cases/validation/runtime/retry-error-contracts.test.ts
bun test test/test-cases/validation/media-generation/tts-current-render-recovery.test.ts
```

1. Verification confirms `bun run check` and linter pass with zero errors.
2. Grep verification confirms `LEGACY_ERROR_HINTS` is removed from `src/`.
3. Contract tests verify that usage errors exit with code 2, operational errors exit with code 1 with structured hints, and retry exhausted errors preserve metadata.
4. Console diagnostics output a single `[HH:MM:SS.MMM]` prefix per line with no duplicate runner prefixes.

## References

- Related ADR: [ADR-001](ADR-001-source-ingestion-and-normalization.md)
- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md)
- Related ADR: [ADR-005](ADR-005-reduce-environment-variable-surface-area.md)
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)
- Related ADR: [ADR-014](ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md)
- Related ADR: [ADR-018](ADR-018-sound-effects-and-multi-track-soundscape-pipeline.md)
- Related ADR: [ADR-020](ADR-020-quiet-passing-test-console-output.md)
- `src/utils/error-handler.ts` — `AppError` hierarchy, `isCLIUsageError`, `extractErrorHints`, `serializeDiagnosticError`
- `src/utils/retries.ts` — `withRetry` and `pollUntil`
- `src/cli/create-cli.ts` — `cliErrorHandler`
- `src/cli/failure-handlers.ts` — Process-boundary error handlers
- `src/utils/app-logger/sinks/human-sink.ts` — Human timestamp renderer
- `test/test-utils/provider-failure-classifiers.ts` — Shared provider failure predicates
- `test/test-runner/utils.ts` and `test/test-runner/runner.ts` — Test timestamp formatter and console wrapper
