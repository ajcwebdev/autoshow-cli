# ADR-006: Unify the Error-Handling and Diagnostic Vocabulary Across `src/` and `test/`

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-13
- **Date Updated:** 2026-08-14
- **Verification Status:** Passed
- **Supersession:** Absorbs the timestamp and concise diagnostic-rendering decisions from the retired record "Optimize Price Preflight Performance, Test Concurrency, and Token-Efficient Logging"; its production metadata-cache and price-verification decisions are owned by ADR-001 and ADR-002 respectively.

<!-- This record synthesizes production error vocabulary, test failure handling, and human/test-runner diagnostic rendering. All three areas are Accepted and implemented. -->

## Context

Two now-retired descriptive analyses — `src-error.md` for `src/` and `test-error.md` for `test/` — catalog how error handling works today without prescribing fixes. This ADR records the decision to act on the concrete defects and duplication each surfaced, while deliberately keeping the patterns both analyses confirm are healthy.

**Production `src/` (from `src-error.md` Part 3).** The codebase has a well-built centralized core — the `AppError` hierarchy with kind-driven exit codes (`error-handler.ts`), the `withRetry`/`classifyFetchRetry` framework (`retries.ts`), valibot validation, centralized redaction, and a single top-level funnel `cliErrorHandler` — but the pipeline never adopted it. Five fixable issues follow from that one gap:

1. **Two error vocabularies coexist.** ~994 plain `new Error(...)` throw sites in `src` (829 in `process-steps` alone) versus ~323 structured `CLIUsageError`/`AppError` throws. Plain throws funnel to exit 1 but carry no `kind`/`hints`/`metadata`/`stage`.
2. **The typed subclasses are effectively unused.** `AppValidationError`, `AppProviderError`, `AppInfrastructureError`, `AppInternalError` have zero direct `new` call sites; the structured throwers build `new AppError({ kind })` inline, and a subclass appears only as a base for provider REST errors. A full sweep is therefore the *first real adoption* of the structured family, not churn of an established API.
3. **Usage-ness detected by the magic string `name === 'CLIUsageError'`.** The canonical check is re-implemented at five sites and opted into by `UnsupportedArtifactSchemaError extends Error` (which sets `this.name`).
4. **Hints bolted on by substring matching.** `LEGACY_ERROR_HINTS` scans every message for needles (`yt-dlp`, `OPENAI_API_KEY`, …) — a compensating workaround for issue #1.
5. **`pollUntil` throws a plain `Error`** on terminal failure and deadline, unlike its sibling `withRetry` (which throws `new AppError({ kind: 'retry_exhausted' })` with `stage`/`status`/`metadata`). A sixth, smaller item is the duplicated validator-wrapping idiom (catch a low-level throw, re-wrap as `CLIUsageError`).

Issues #3/#4/#5 are all compensations for the root cause #1; closing the gap makes the workarounds deletable rather than maintainable.

**Test suite `test/` (from `test-error.md`).** The Bun-based homegrown runner handles errors at three altitudes (runner/orchestration, shared `test-utils`, inline tests). The catalog surfaced genuine defects/duplication in the centralized layer:

1. Two parallel transient-failure classifiers with overlapping detection (`classifyLiveProviderAvailabilityFailure` vs `classifyAdaptivePressure`).
2. Provider-specific transient predicates scattered across two modules, with the Gemini check duplicated in two different forms.
3. Redundant, unreachable `expect(result.exitCode).toBe(0)` after a `throw` already failed the test (two sites).
4. Retry-once-on-transient hard-coded to Gemini + MiniMax inside the LLM factory; no other factory gets it.
5. No global `unhandledRejection`/`uncaughtException` handlers anywhere in `test/`.

**Human and test-runner diagnostics.** A later price-preflight investigation found that human log lines carried both a zero-based stopwatch prefix such as `[00:00:00.002]` and a local wall-clock prefix such as `[20:57:19]`. The test runner could then add another prefix to already-timestamped logger output. Related values were also spread over multiple lines, multiplying prefixes and making a 165-command preflight exceed 338 log lines. This is a rendering-vocabulary concern: application and runner diagnostics should agree on one timestamp and should keep one logical result on one line.

Why now: this follows the recent line of ADRs that record a plan before the work (see [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md), and the env-var series in [ADR-005](ADR-005-reduce-environment-variable-surface-area.md)). All three areas are now **Accepted and implemented**; the implementation tables record the completed work.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| `src`: do nothing | Plain Errors already funnel to exit 1 | Two-vocabulary split persists; the three workarounds keep accreting; ~994 throws stay structureless | ~994 unchanged throw sites |
| `src`: surgical only (fix #3–#6, leave the plain-Error population) | Small, low-risk | The substring-hint table can't be retired (plain throws still lack hints); the root cause remains | Fixes 4 structural issues; leaves ~994 plain throws |
| **`src`: full sweep + structural fixes** | Adopts `AppError` as the single vocabulary; #3/#4/#5 *dissolve*; every failure gains `kind`/`stage`/`hints`/`metadata`; reuses existing kinds/exit-code mapping/redaction | One large mechanical refactor (~994 sites); per-throw `kind` judgement | Chosen; ~994 sites and 5 duplicated guards |
| `src`: add a 6th `pipeline` error kind | A dedicated bucket for step failures | Splinters the vocabulary; existing kinds already cover every case and all map to exit 1 | Adds 1 error kind |
| **`test`: shared predicate registry; keep the two classifiers** | Eliminates duplication; one source of truth for transient predicates; both classifiers keep distinct return types | One new module + import churn across three files | Chosen; 1 new module and 3 importers |
| `test`: fully merge into one classifier returning `{ pressureKind, reason }` | Single entry point | Couples concurrency back-off to provider reason strings; larger blast radius | Collapses 2 classifiers into 1 |
| `test`: status quo (fix only the redundant `expect`s) | Minimal change | Leaves the duplication/scattered predicates and the Gemini double-definition | Removes 2 assertions only |
| **Diagnostics: one local wall-clock timestamp and one line per logical result** | Consistent chronology, half as many price-preflight lines, and no duplicate prefix | Gives up the zero-relative stopwatch embedded in each output line | 338+ to 172 price-preflight lines |
| Diagnostics: retain stopwatch plus wall-clock prefixes | Preserves both elapsed and local time inline | Cluttered dual prefixes repeat on every line and runner wrapping can add a third | Rejected |

## Decision

### A. Production `src/` — adopt `AppError` as the single throw vocabulary *(Accepted — implemented 2026-06-13)*

1. **Typed subclasses become the canonical throw API.** Add terse factory helpers beside the existing `CLIUsageError` factory — `ProviderError`, `InfraError`, `InternalError`, `ValidationError` — and sweep every plain `new Error(...)` to the right kind:

   | Throw describes… | Becomes |
   |---|---|
   | External/operational failure — subprocess exit, download, file corruption, missing binary | `AppInfrastructureError` |
   | Provider HTTP rejection with status/header evidence | `AppProviderError` |
   | "Should never happen" / config-invariant — no provider configured, unreachable branch | `AppInternalError` |
   | Bad/parse/schema data | `AppValidationError` (or `validateData`) |
   | Bad **user** input at a command boundary | `CLIUsageError` (unchanged) |

Each migrated throw attaches a `stage` and, where remediation exists, structured `hints`. The sweep is by cluster (bulk in `process-steps`: `target-runner.ts`, `batch-executor.ts`, download/STT/document/audio/TTS; remainder in `run-llm.ts`, `dialogue-normalizer.ts`, provider env-var checks, `prompt-loader.ts`, `media-url.ts`, `process-lock.ts`, `bootstrap-broker.ts`). Because every non-usage kind maps to exit 1, a debatable `infrastructure`-vs-`internal` call only changes the diagnostic label, never process behavior — making the sweep low-risk despite its breadth.
2. **Replace magic-string usage detection with `instanceof`.** Rewrite `isCLIUsageError` to `error instanceof AppUsageError || (error instanceof Error && error.name === 'CLIUsageError')` (the name match kept only as a cross-realm fallback), **export** it, delete the five local re-implementations, and convert `UnsupportedArtifactSchemaError` from `extends Error` to `extends AppUsageError`.
3. **Retire `LEGACY_ERROR_HINTS`.** Once the swept throws carry structured `hints`, move the remediation strings to the throw sites (env-var family via a `hintsForMissingEnv(key)` helper) and delete the table; `extractErrorHints` keeps its structured-`hints` and `keyedHintsFor` paths, only the message-substring scan is removed.
4. **Make `pollUntil` throw `AppError`** — terminal failure → `AppError({ kind: 'infrastructure', stage, metadata })`; deadline → `AppError({ kind: 'retry_exhausted', stage, metadata })`, matching `withRetry`.
5. **Consolidate the validator-wrapping idiom** into one `rethrowAsUsage(fn, fallbackHint?)` and route `define-comic-command.ts`'s bespoke wrappers and `download-model-options.ts`'s `validateCliValue` through it.

### B. Test suite `test/` — consolidate the error utilities *(Accepted — implemented)*

1. **Extract provider predicates into one shared registry** (new `test/test-utils/provider-failure-classifiers.ts`). Move every provider-specific transient predicate (GLM, Gemini-image, BFL, Together STT, DeepInfra, the Runway-credits constant) out of `service-test-kit.ts`, and `isGeminiTransientUnavailable`/`isMinimaxTransientUnavailable` out of `define-llm-write-test.ts`, into the registry; reconcile the **two Gemini definitions** (image-availability vs LLM `"code"/"status"` JSON shape) into one predicate or two clearly-named non-overlapping ones. The two public classifiers (`classifyLiveProviderAvailabilityFailure`, `classifyAdaptivePressure`) **stay separate** but import their building blocks from the registry — Option A: shared inputs, distinct outputs.
2. **Generalize retry-once-on-transient.** Lift the inline Gemini/MiniMax retry-once pattern into a shared helper (an option on `runCommandAndExpectOutputDir` or a sibling `runCommandWithTransientRetry`) keyed off the registry, so any factory opts in by passing predicates instead of re-implementing the `warn → Bun.sleep → retry → throw-if-persisted` dance.
3. **Remove the two unreachable assertions** (`expect(result.exitCode).toBe(0)` in `service-test-kit.ts` and `define-llm-write-test.ts`) — the preceding `if (exitCode !== 0) { … throw }` makes them assert nothing; the throw is the real signal and the artifact assertions stay.
4. **Add a global runner-level safety net** — register `unhandledRejection` / `uncaughtException` handlers in `test-runner.ts` that log via `l.error` and set exit code 1, alongside the existing `try/catch`.

### C. Human and test-runner diagnostics — use one timestamp and one line per result *(Accepted — implemented 2026-08-13)*

1. **Use one local wall-clock timestamp.** The human application sink and the test runner format timestamps as `[HH:MM:SS.MMM]`. The prior zero-based stopwatch prefix is removed from rendered output; elapsed duration remains available in explicit summaries where it carries meaning.
2. **Suppress duplicate runner prefixes.** The test runner's console wrapper strips ANSI styling for detection and leaves lines beginning with either `[HH:MM:SS.MMM]` or `[HH:MM:SS]` unchanged. Untimestamped console output receives the canonical millisecond wall-clock prefix.
3. **Render one logical diagnostic per line.** Closely related labels and values, including price-command cost results and single-variant budget decisions, stay on a concise single line without dropping information. ADR-002 owns the exact price-result shapes and benchmark evidence.

### D. Normalize hosted rate-limit recovery at the admission boundary *(Accepted — implemented 2026-08-14)*

HTTP 429 and explicitly classified provider rate/concurrency responses report pressure against the immutable admission token for the exact request. Billing, authentication, quota exhaustion, validation, timeout, 5xx, and ambiguous create failures retain their prior failure and retry policies unless a provider explicitly marks the response as a rate limit. This keeps the semantic error classifier separate from the scheduler pressure controller while giving both a shared structured vocabulary.

The hosted controller preserves `Retry-After`, otherwise applies the existing half-to-full jitter style to exponential bases of 2, 4, 8, 16, and then 30 seconds, and bounds recovery to five minutes from the request's first pressure response. If recovery is exhausted or the next required delay exceeds the remaining budget, the existing `retry_exhausted` shape retains status, headers, stage, retry metadata, exact work identity, work class, and lane identity. Known rate-limit rejection can retry the exact failed request; ambiguous paid create outcomes do not become safe to redispatch merely because hosted concurrency recovery exists.

Provider admission classification is cause-aware and deliberately narrower than generic HTTP retry classification. Only a definite 4xx response other than 408 or 409 proves that a create was rejected before work admission. Network failures, timeouts, missing status, 408, 409, and every 5xx response are ambiguous. A paid create may retry only an explicit pre-admission pressure response such as 425 or 429; generic network and server failures must retain the original request identity for reconciliation. Successful asynchronous creates record the provider task or prediction ID before polling or response decoding continues.

Provider failures remain structured through target and comic aggregation. Wrappers preserve the original cause, status, headers, stage, retryability, request ID, and bounded redacted provider message; command boundaries do not convert an infrastructure failure into a usage error. Voice-provisioning journals record definite provider rejection as terminal `failed`, while uncertain post-dispatch failures remain `reconciliation-required`.

Every concurrent TTS request also writes the same bounded diagnostic fields into its immutable rejection or ambiguity evidence before the target-level failure is finalized. A target may still report one primary failure to the command boundary, but retained request evidence preserves `code`, `status`, `stage`, error name, redacted provider message, request ID, retry delay, and retryability for each request that was already in flight. Provider text is passed through the shared secret, identifier, authorization, URL-credential, query-secret, and email redaction pipeline before it reaches logs or durable JSON.

After that evidence is finalized, a failed TTS target derives one recovery checkpoint through the exact no-provider resume planner. When any completed slots are reusable or any admission remains ambiguous, the same structured infrastructure error appends the retained/total and unresolved counts, the number of reconciliation-blocked slots, the command-appropriate redispatch flag, and the warning that explicitly authorized slots may be purchased again. Recovery diagnostics are best-effort enrichment: integrity or planning errors are not logged separately and never replace the original provider failure.

### Keep (with rationale)

`src/`:

| Pattern | Reason kept |
|---|---|
| The existing `AppError` kinds (no new `pipeline` kind) | `infrastructure`/`internal`/`validation` already cover every case and all map to exit 1 |
| The `name='CLIUsageError'` fallback inside `isCLIUsageError` | Preserves cross-realm / opt-in semantics during the migration so no usage error silently downgrades. **Retired 2026-08-07** — see the history note at the end of this ADR. |

`test/`:

| Pattern | Reason kept |
|---|---|
| Two **public** classifiers with different return types | Intentional separation (semantic reason vs concurrency pressure); only the predicate inputs are consolidated |
| Result-object `runCommand` + factory-layer throw | The "errors as data" low level converting to throws in factories is a deliberate, useful seam |
| Three failure dispositions (throw / `test.skip` / `catch {}`) | Hard failure vs missing-env/over-budget skip vs best-effort reads/cleanup — all intentional |
| Assertion-dominant leaf tests (`toThrow`/`rejects`) | Correct error *assertion*, not error *handling* to refactor |
| Graceful parser degradation in `parsers.ts` | Returning `[]`/`continue` on malformed JSONL/JUnit so one bad line never crashes the run is desired |

This applies to:

- Production error construction and rendering under `src/`, plus shared test failure predicates and runner-level failure handling under `test/`.
- Human application logging and test-runner console rendering.
- No provider-specific failure semantics, provider response contracts, or assertion behavior in leaf tests.

## Rationale

The `src/` core was built but never adopted in the pipeline, and the three workarounds (magic-string detection, substring hints, plain-`Error` `pollUntil`) are symptoms of that single gap; fixing it **deletes** them — `instanceof` replaces a string convention, structured `hints` at throw sites replace a substring scan, and a unified `AppError` makes `pollUntil` consistent for free. The sweep introduces no new machinery, reusing the existing kinds, exit-code mapping, `extractErrorHints`, `extractErrorMetadata`, and `serializeDiagnosticError` — the same "adopt the structure that already exists" move as the type-system work in ADR-003. On the test side, duplication of *detection logic* is the real risk: a provider's error wording changing forces N scattered matchers to be updated. Consolidating the **predicates** (genuinely the same job) while preserving the two **classifiers** (different questions) removes the drift hazard without over-coupling the runner to test-utils semantics; the redundant `expect`s and missing global handlers are small, unambiguous correctness fixes that ride along.

The timestamp and line-shape rules extend that same vocabulary to successful and progress diagnostics. A single local timestamp gives application and test output one chronology, duplicate-prefix detection lets logger output pass safely through the runner, and one-line results preserve all fields while reducing scanning and token overhead.

## Consequences

Positive outcomes:
- `src/`: one error vocabulary — every operational failure carries `kind`/`stage`/`hints`/`metadata` and surfaces them through `cliErrorHandler` and `serializeDiagnosticError`, so JSON diagnostics and user-facing hints become structured everywhere, not only on the ~323 throws that already opt in. `LEGACY_ERROR_HINTS` and the five duplicated guards are **deleted**, not centralized; usage detection becomes type-safe; `pollUntil` and `withRetry` produce the same shape.
- `test/`: one place to update when a provider's transient wording changes; new factories get transient-retry and availability-skipping by importing the registry; dead assertions removed; escaped async rejections produce structured `l.error` output and a deterministic exit code instead of a silent crash.
- Diagnostics: application and runner output share one millisecond wall-clock prefix; already-prefixed lines are not timestamped twice; price preflight renders 172 rather than 338+ lines while preserving the logged data.

Negative outcomes:
- `src/`: a very large mechanical refactor (~994 throw sites) — a missed/mis-typed site is a typecheck failure (CI), not a silent behavior change; per-throw `kind` judgement is mitigated because all non-usage kinds map to exit 1; the `instanceof` switch must retain the `name` fallback so no usage error downgrades mid-migration.
- `test/`: import churn across `service-test-kit.ts`, `define-llm-write-test.ts`, and `adaptive-concurrency.ts` (a careless move could drop a predicate from a classifier chain); reconciling the two Gemini definitions needs judgment so neither surface misfires.
- Diagnostics: each line no longer carries an implicit zero-relative stopwatch; callers that need elapsed time must report it explicitly.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| `src`: structured diagnostics on every failure | One large refactor touching ~994 throw sites |
| `src`: type-safe `instanceof` detection; five duplicated guards deleted | Lose the opt-in-by-arbitrary-class trick — a class must now `extends AppUsageError` |
| `src`: `LEGACY_ERROR_HINTS` retired; remediation at the throw site; `pollUntil` consistent | Hint wording moves into throw sites + a small helper; two `retries.ts` call sites change error type |
| `test`: single source of truth for transient detection; reusable retry for all factories | One extra module + import hop; a shared helper signature general enough for every service |
| `test`: deterministic global failure reporting | Two more process-level listeners in the runner |
| One `[HH:MM:SS.MMM]` prefix and concise single-line results | No per-line stopwatch prefix; compact renderers must keep every material field |

## Implementation Note

The unified `AppError` taxonomy (`ProviderError`, `InfraError`, `InternalError`, `ValidationError`), centralized `isCLIUsageError`, `rethrowAsUsage` validator wrapping, structured retry handling in `pollUntil`, provider failure classification registry in `test/test-utils/provider-failure-classifiers.ts`, cause-aware paid-create admission handling, bounded provider diagnostics, TTS recovery-checkpoint diagnostics, structured target aggregation, normalized hosted-pressure recovery, and `[HH:MM:SS.MMM]` human log format are fully implemented and verified.

## Test Plan

Run default verification (`bun run check`) and local, no-cost contract validation suites:

```bash
bun run check
bun test test/test-cases/validation/cli/cli-usage-errors.test.ts
```

1. Verification confirms `bun run check` and lint clean — no dangling `new Error` in swept clusters.
2. `grep -rn "LEGACY_ERROR_HINTS" src` returns nothing; `grep -rn "name === 'CLIUsageError'" src` returns only the single fallback inside `isCLIUsageError`.
3. Benchmark (text/TTS), comic command, and manifest-schema paths pass; a usage error still exits 2 while an operational failure exits 1 with its hint rendered.
4. Complete no-cost price suite passes all pricing specs with one `[HH:MM:SS.MMM]` prefix per line. ADR-002 retains the duration matrix and price-specific verification details.

## References

- Historical analyses: the retired `src-error.md` and `test-error.md`
- `src/utils/error-handler.ts` — the `AppError` hierarchy, `isCLIUsageError`, `LEGACY_ERROR_HINTS`, `extractErrorHints`, `serializeDiagnosticError`
- `src/utils/retries.ts` — `withRetry` and `pollUntil`
- `src/cli/create-cli.ts` — `cliErrorHandler`; `src/cli/failure-handlers.ts` — process-boundary handlers
- `test/test-utils/service-test-kit.ts`, `test/test-utils/define-llm-write-test.ts`, `test/test-runner/adaptive-concurrency.ts`, `test/test-runner.ts`, `test/test-runner/parsers.ts`
- Precedent for adopting existing structure rather than adding machinery: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md)
- Prior change touching `adaptive-concurrency.ts`, and base-URL/error context: [ADR-005](ADR-005-reduce-environment-variable-surface-area.md)
- Human timestamp renderer: `src/utils/app-logger/sinks/human-sink.ts`
- Test timestamp formatter and console wrapper: `test/test-runner/utils.ts`, `test/test-runner/runner.ts`
- Discovery-cache companion: [ADR-001](ADR-001-source-ingestion-and-normalization.md)
- Price-planning and no-cost-verification companion: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Hosted admission, lane pressure, and recovery companion: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)
