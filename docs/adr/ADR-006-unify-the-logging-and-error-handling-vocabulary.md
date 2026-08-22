# ADR-006: Unify and Enforce the Logging and Error-Handling Vocabulary Across `src/` and `test/`

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-13
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed
- **Supersession:** Absorbs the timestamp and concise diagnostic-rendering decisions from the retired record "Optimize Price Preflight Performance, Test Concurrency, and Token-Efficient Logging"; its production metadata-cache and price-verification decisions are owned by ADR-001 and ADR-002 respectively. Extended on 2026-08-20 from the error vocabulary alone to the whole diagnostic vocabulary — errors, logging, and the standing contracts that enforce both.

## Context

This record began as an architectural audit of error handling across `src/` and `test/`, which surfaced fragmentation across production error handling, test failure classification, and diagnostic log rendering despite existing foundational primitives. A second audit two months later found that the same fragmentation existed on the logging side, and — more importantly — that the first sweep had partially decayed because nothing mechanically enforced it. Both findings are recorded here because they describe one vocabulary, not two.

**Production `src/` error handling.** The codebase defined a centralized error core — the `AppError` hierarchy with kind-driven exit codes (`error-handler.ts`), the `withRetry`/`classifyFetchRetry` framework (`retries.ts`), schema validation, centralized redaction, and a single top-level funnel `cliErrorHandler` — but pipeline execution modules had not adopted it. Five concrete issues stemmed from this gap:

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

**Logging vocabulary across `src/` and `test/`.** A follow-up audit on 2026-08-19 classified every log line in `src/` (1,344 TypeScript files) and `test/` (511) against the central utilities and found 42 raw `console.*` and `process.stdout.write` sites in `src/` bypassing `src/utils/app-logger/`. The largest cluster was structural rather than careless: `emitResult` was private to `reporter.ts`, so a command whose result is neither a price estimate nor a file-producing completion had no sanctioned channel, and `define-voice-command.ts` reached for `console.log(JSON.stringify(..., null, 2))` 26 times — ignoring `--json`, `--log-format`, and `--quiet` entirely. Similarly, the logger had no category-filtering API, so step-8-comic invented process-wide sink monkey-patching; and `l.warn`/`l.debug` could not carry `category` or `metadata` at all, which is why 99 shorthand sites were structurally category-less. In `test/`, the [ADR-019](ADR-019-quiet-passing-test-console-output.md) harness was holding — no stray debugging `console.log` existed in any test body — but five hand-rolled console-capture helpers each replaced the harness's interceptor, and output produced inside a capture window was swallowed even when the test failed.

**Enforcement.** The same audit measured the error sweep recorded here against its own post-sweep baseline. It held at roughly 98%, but 65 plain `throw new Error(` sites had reappeared or been missed, and three clusters carried real consequences rather than cosmetic ones. `setup-download/managed-artifact.ts` raised 14 supply-chain assertions — code-signature verification, Team ID and identity mismatch, Mach-O architecture mismatch, symlink and file-type rejection, SHA-256 manifest mismatch — as plain errors, so `retryable` was `undefined` and `classifyFetchRetry`'s default branch treated deterministic security failures as transient and retried them. The Inworld WebSocket client used plain errors throughout, discarding a provider status code it had already parsed. The TTS execution preflight threw bare `HTTP ${status}` errors into a catch that collapsed all six probes into one generic observation with no status, stage, or cause. Alongside those, 16 custom error classes existed outside `error-handler.ts` of which 14 did not extend `AppError`, five parallel HTTP-error normalizations disagreed on shape, "partial completion → exit 2" had three unrelated spellings, and 29 sites used error-message string matching as control flow — including several that matched messages this repository generates itself.

Why now: unifying error structures, test failure classifiers, and log formatting resolves active drift across provider transient retry logic, eliminates brittle substring-matching workarounds, and ensures consistent diagnostic output across CLI runs and test runners. The 2026-08-19 audit then showed that recording a verified sweep is not enough on its own: this record already carried `Verification Status: Passed` while 65 plain throws accumulated, so the fix has to change what the record commits to — a standing check rather than a one-time verification.

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

**Option 10 (selected)**

- **Option:** Logging and enforcement: repair the drift, close the structural gaps in the logger and error core that caused it, and convert both vocabularies into standing source-scan contract tests with explicit, documented allowlists
- **Pros:** Failures surface in the suite rather than in the next audit; the escape hatches remove the reason callers went around the convention; allowlist entries force each exception to be named and justified; no new tooling or dependency
- **Cons:** A grep-based contract can be defeated by an unusual spelling and needs its allowlist maintained
- **Quantitative Notes:** Chosen; 65 plain throws and 42 raw output sites removed, 16 custom error classes folded into the `AppError` family, 15 contract tests added

**Option 11**

- **Option:** Logging and enforcement: adopt ESLint with `no-console` and `no-restricted-syntax` on `NewExpression[callee.name='Error']`
- **Pros:** AST-accurate rather than line-based; per-directory overrides are a first-class feature
- **Cons:** Introduces a linter, its configuration, and its plugin surface to a repository that has deliberately had none; achieves the same pin as the contract greps for these two rules
- **Quantitative Notes:** Rejected; the contract grep achieves the same pin without new tooling

**Option 12**

- **Option:** Logging and enforcement: re-run the sweep and re-record this ADR as verified, without enforcement
- **Pros:** Smallest change; no new tests to maintain
- **Cons:** Exactly what produced the drift being repaired — the record already carried `Verification Status: Passed` while 65 plain throws accumulated
- **Quantitative Notes:** Rejected; the failure mode is the absence of a standing check

## Decision

Adopt `AppError` and its typed subclasses as the single throw vocabulary across `src/` and `src/utils/app-logger/` as the single diagnostic output channel, consolidate provider failure classification and transient retry logic under `test/test-utils/provider-failure-classifiers.ts`, standardize human and test-runner log diagnostics on a single local millisecond wall-clock timestamp (`[HH:MM:SS.MMM]`) with single-line results, normalize hosted rate-limit recovery at admission boundaries, and enforce both vocabularies with source-scan contract tests whose every exception is named and justified in an in-file allowlist.

This applies to:

- Production error construction, wrapping, and exit-code mapping across `src/`.
- Every diagnostic byte a command emits: `.ts` files under `src/` carry no `console.*` and no `process.stdout`/`process.stderr` writes outside the logger sink layer and the declared stdout-payload files, and no `throw new Error(`, with no exceptions.
- Shared test failure classification, transient retry helpers, runner-level error handling, and console/sink capture across `test/`: no reassignment of `console.*` and no `l.config.sinks` mutation outside `test/test-utils/test-console-harness.ts` and `test/test-utils/console-capture.ts`.
- Human application logging and test-runner console timestamping and single-line result formatting.
- Hosted provider admission classification, rate-limit recovery backoff, and recovery checkpoint diagnostics.
- The exemption categories themselves: logger sink primitives, and stdout payloads whose bytes are the document the user asked for (`--help`, `--version`, `metadata --markdown` frontmatter, and the two standalone `bun run` report tools).

It does not apply to:

- Provider-specific API response payload schemas or low-level HTTP transport logic.
- Domain assertions inside leaf test files (`expect(...).toThrow(...)`), and test assertion style beyond the capture-helper consolidation; shifting the 635-prose-to-12-classification assertion balance is incremental per-suite work, not a contract.
- Message-matching that classifies external provider or tool prose, which is retained deliberately and documented at each site with the upstream source it reads; see Keep (with rationale).
- The unified provider-credential registry, `doctor --strict`, the spawn environment allowlist, and the versioned HMAC-derived `accountScopeHash`, which were completed by [ADR-005](ADR-005-reduce-environment-variable-surface-area.md) Pass 5 on 2026-08-21. This record owns only Pass 5's shared error contract and exit-code vocabulary.
- Alternative logger sink transports beyond the human and NDJSON sinks that exist.

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

   Each migrated throw attaches a `stage` and, where remediation exists, structured `hints`. Because non-usage kinds map to exit code 1, classification distinctions between `infrastructure` and `internal` refine diagnostic labels without altering process exit behavior. Throws whose failure is deterministic — a failed code-signature check, a 200 response with a malformed body — set `retryable: false`, because the retry-on-any-error default would otherwise reach them.
2. **Replace magic-string usage detection with `instanceof`.** Export `isCLIUsageError` using `error instanceof AppUsageError`, delete local string-matching re-implementations, and ensure usage error classes inherit from `AppUsageError`.
3. **Retire `LEGACY_ERROR_HINTS`.** With structured `hints` co-located at throw sites (including env-var guidance via `hintsForMissingEnv(key)`), the global substring-scanning lookup table is deleted. `extractErrorHints` evaluates structured `hints` and `keyedHintsFor`.
4. **Make `pollUntil` throw `AppError`.** Terminal polling failures throw `AppError({ kind: 'infrastructure', stage, metadata })` and deadlines throw `AppError({ kind: 'retry_exhausted', stage, metadata })`, aligning with `withRetry`.
5. **Consolidate validator wrapping.** Provide a shared `rethrowAsUsage(fn, fallbackHint?)` helper to standardize option parsing and validation error wrapping across CLI commands.
6. **One class per concern, inside the family.** No error class exists outside the `AppError` hierarchy: provider REST errors, artifact reservation conflicts, OCR structured-response failures, native parser usage errors, and batch partial completion all extend it, so `kind`, exit code, and the process-level failure handlers behave identically regardless of which subsystem raised the failure.
7. **Classify on structure, not on prose.** Decisions that used to read an error message read a field instead: `metadata.missingEnvVar` for a missing credential, `isMissingArtifactError`/`isArtifactConflictError` for artifact absence and conflict, a single `hasErrorCode` for errno checks, and a single `classifyPaidCreateRetry` implementation.

### B. Test suite `test/` — Consolidate error, retry, and capture utilities

1. **Extract provider predicates into a shared registry.** Consolidate all provider-specific transient predicates into `test/test-utils/provider-failure-classifiers.ts`. The two public classifiers (`classifyLiveProviderAvailabilityFailure` and `classifyAdaptivePressure`) remain separate for distinct use cases (availability skipping vs. adaptive concurrency) but source predicates from this common registry.
2. **Generalize retry-once-on-transient.** Provide a reusable helper (`runCommandWithTransientRetry`) utilizing registry predicates so test factories can opt into transient retry without re-implementing backoff and sleep logic.
3. **Remove unreachable assertions.** Eliminate dead assertions (`expect(result.exitCode).toBe(0)`) placed after unconditional throw statements, and assert the specific expected exit code rather than `not.toBe(0)`.
4. **Add runner safety net.** Register global `unhandledRejection` and `uncaughtException` handlers in `test-runner.ts` that report the whole error chain and exit with the error's own normalized code.
5. **One console-capture module.** `test/test-utils/console-capture.ts` is the only sanctioned way for a test to intercept console output or swap logger sinks. It replays captured lines back through the harness-owned console so a failing test still dumps what it captured, and it snapshots and restores suppressed log categories.
6. **Production-shaped error fixtures.** Test fixtures construct real `AppError` subclasses rather than `Object.assign(new Error(...), {...})` impostors, so a fixture cannot pass while production classification would take a different branch.

### C. Human and test-runner diagnostics — Standardize on single-timestamp, single-line results

1. **Single wall-clock timestamp:** Format application and test-runner log timestamps uniformly as `[HH:MM:SS.MMM]`. Remove the zero-based stopwatch prefix from rendered output.
2. **Suppress duplicate runner prefixes:** Strip ANSI formatting during runner log inspection and pass lines starting with `[HH:MM:SS.MMM]` or `[HH:MM:SS]` through without prepending additional timestamps.
3. **Single-line result formatting:** Emit closely related labels and values (such as price estimates and single-variant budget decisions) on a concise single line.

### D. Normalize hosted rate-limit recovery at the admission boundary

1. **Rate-limit classification:** HTTP 429 and provider rate/concurrency rejections report pressure against the immutable admission token for the exact request. Non-rate-limit failures (billing, auth, quota exhaustion, validation, timeouts, 5xx) retain standard failure policies unless explicitly classified as rate limits.
2. **Bounded jittered backoff:** Hosted recovery respects `Retry-After` headers or applies half-to-full jitter backoff across exponential bases (2, 4, 8, 16, 30s), bounded to five minutes. Exhausted attempts throw a structured `retry_exhausted` error retaining status, headers, stage, retry metadata, work identity, and lane identity.
3. **Ambiguity vs. definite rejection:** Only definite 4xx responses (excluding 408 and 409) prove rejection prior to work admission. Network failures, timeouts, and 5xx responses are treated as ambiguous. Ambiguous paid operations are not redispatched automatically.
4. **Explicit redispatch authorization:** The `--allow-ambiguous-redispatch` flag is the sole public mechanism authorizing re-dispatch of ambiguous TTS generation slots. *Amended 2026-08-20:* it authorizes reconciliation of a **stored** slot at resume and nothing else. An ambiguous admission is never redispatched in flight, for any provider. Three providers (DeepInfra, Speechify, Grok) previously forwarded the flag into the chunk pipeline and re-purchased the chunk mid-run while the rest only reconciled at resume; the flag now means one thing everywhere. When omitted, ambiguity halts execution to prevent duplicate billing; when provided, the reconciliation blockers clear with a duplicate-purchase warning.
5. **Structured aggregation and redaction:** Target and composite workflows preserve underlying cause, status, headers, stage, retryability, request ID, and redacted provider messages. All provider diagnostic text passes through the central redaction pipeline prior to logging or disk storage.
6. **Recovery checkpoints:** Failed targets compute non-destructive recovery checkpoints. When reusable completed slots or ambiguous admissions exist, structured infrastructure errors report retained, unresolved, and reconciliation-blocked slot counts alongside required redispatch flag guidance.

### D-bis. Retry, backoff, and polling — one engine and one policy table (amended 2026-08-20)

A follow-up audit found a parallel retry layer beside the central one: nine hand-rolled attempt loops, four bespoke polls, a second copy of the delay math, a second copy of the abort-aware sleep, and four satellite policy constants whose numbers had drifted for the same class of operation. These decisions consolidate it.

1. **The class table owns every number.** `RETRY_POLICIES` in `src/utils/retries.ts` holds one policy per class, and the satellite constants (hosted TTS, DeepInfra, OCR create, OCR page request, URL article) are derived from it or live beside it. One operation class has one attempt count and one ceiling: hosted creates run 4 attempts on a 30s ceiling, STT submissions included; poll lifecycles run 6; the conservative paid-create tier keeps 2 attempts because its second attempt exists for a definite rejection alone. DeepInfra TTS no longer carries a private 8-attempt policy. A class with no callers is deleted, not left in the table.
2. **The classifier decides, the call site declares the class.** A provider-specific classifier may normalize a provider's error shape — Gemini reports its HTTP status inside the response body — but it may not override the class's decision afterwards. `classifyGeminiRetry` restates the parsed status as a structured field and defers; it previously overrode the conservative refusal for 408/5xx, which redispatched a paid create after an ambiguous admission while its logs and `retry_exhausted` metadata still claimed the conservative class.
3. **The deterministic-error convention holds without a classifier.** `withRetry` applies `classifyRetryFloor` when a caller passes none, so `retryable: false`, the non-retryable status set, and `Retry-After` are honored everywhere. They previously lived only inside `classifyFetchRetry`, which meant a 404 model URL or a wrong checksum pin burned all three multi-gigabyte download attempts.
4. **Retry decisions read the whole cause chain.** Both classifiers extract status, headers, and the retryable flag through `extractErrorMetadata`; reading only the top-level error meant a deterministic 401 wrapped once reached the default branch and was retried.
5. **Exhaustion is `retry_exhausted`, and its wording is a contract.** Poll deadlines, the async-STT poll engine, the sound-effect dispatch loop, the process-lock wait, and the structured-output compat loop all exhaust into `retry_exhausted` with `attemptsMade`/`maxAttempts`/`elapsedMs`/`stopReason`, and `pollUntil` carries a snapshot of the last poll result. Downstream accounting asks for the kind rather than matching the message. `exec()` is the documented exception: it still returns the last failed `ExecResult` so callers keep their stderr-derived domain errors, and logs the exhaustion structurally instead.
6. **One retry-attempt record.** `logRetryAttempt` is the single retry log shape, used by `withRetry` and by the loops that cannot run under it. Callers enrich it through `retryLogMetadata` rather than emitting a second line. No retry is silent: the OpenAI OCR schema loop, the sound-effect dispatch, the tesseract DPI re-render, the Mistral cooldown gate, and the process-lock wait all report now.
7. **The test suite derives its retry vocabulary from production.** `provider-failure-classifiers.ts` builds its status and network patterns from `RETRYABLE_STATUS_CODES` / `NON_RETRYABLE_STATUS_CODES` / `NETWORK_FAILURE_SPELLINGS` rather than re-typing them, and no test predicate may contradict a production policy — in particular, a test predicate must not re-run a paid create that `classifyPaidCreateRetry` refused, and a retry-exhaustion banner counts as transient pressure only when its stop reason is transient.

### E. Logging — the central logger is the only output channel

1. **A sanctioned channel for every result shape.** `l.report.result(data, options)` is public: it writes one structured event carrying the payload as `metadata`, renders it for humans as a table or sections, and passes the payload through `emitResult`. A command whose output is neither a price estimate nor a file-producing completion no longer has a reason to call `console.log`.
2. **First-class category filtering.** `suppressLogCategories(categories)` filters inside `write` before any sink is reached, so derived loggers observe it too, and returns a restore handle. Callers scope suppression to the run that asked for it; the CLI dispatcher additionally clears suppression at the start of every command.
3. **Structured `warn` and `debug`.** `debug`, `warn`, and `error` take the identical `LogWriteOptions` object `write` takes, so `category` and `metadata` are available at every level rather than only through `l.write`, and `category` is required rather than defaulted.
4. **Styling belongs to the sink.** Log call sites pass text and structure, never ANSI escape codes; baking color into a message string before it reaches the sink is what made `--no-color` and redaction unable to cleanly strip it.
5. **Stdout payloads are declared, not incidental.** The only bytes written directly to stdout are the document the user asked for — `--help`, `--version`, `metadata --markdown` frontmatter, and the standalone `bun run` report tools — and each such file is named in the enforcement allowlist.

### F. Enforcement — standing source-scan contracts

1. **The contracts live in the suite.** `test/test-cases/validation/runtime-contracts/output-vocabulary-contracts.test.ts` scans every `.ts` file under `src/` and `test/` and fails with the offending `file:line` when a raw output site, a plain `throw new Error(` or other builtin error throw, a duck-typed `Object.assign(new Error(...))`, a `process.exit` outside the failure handlers, or an unsanctioned console/sink mutation appears. Its sibling `retry-vocabulary-contracts.test.ts` (added 2026-08-20) shares the same scanning helpers in `source-vocabulary-scanner.ts` and does the same for the retry vocabulary: a backoff sleep outside the retry engine, a policy number outside the policy modules, a second copy of the delay math or the abort-aware sleep, a retry class with no callers, or a test predicate that re-types production's status vocabulary.
2. **Every exception is named.** Allowlists are in-file constants — `LOGGER_SINK_FILES`, `PAYLOAD_STDOUT_FILES`, `PLAIN_THROW_ALLOWLIST` (empty), `ASSIGNED_ERROR_ALLOWLIST` (empty), `PROCESS_EXIT_ALLOWLIST`, `TEST_CAPTURE_OWNERS` — each with a comment stating why the file is exempt, and a companion contract fails when an entry names a file that no longer exists. Adding an exemption is a reviewable diff rather than a silent omission.
3. **Verification is standing, not one-time.** This record's `Verification Status` now means the contracts pass, not that a sweep was performed on a date.

## Rationale

- **Single vocabulary:** Adopting `AppError` and typed subclasses across all modules eliminates the bifurcation between plain and structured errors, allowing `cliErrorHandler` and `serializeDiagnosticError` to reliably extract `kind`, `stage`, `hints`, and `metadata`.
- **Elimination of fragile workarounds:** Replacing substring matching (`LEGACY_ERROR_HINTS`) and string comparison (`name === 'CLIUsageError'`) with co-located hints and `instanceof` checks makes error handling maintainable and type-safe.
- **Unified test failure logic:** Centralizing provider failure predicates in `provider-failure-classifiers.ts` creates a single point of update when provider error signatures change, while preserving the independent responsibilities of availability filtering and concurrency throttling.
- **Diagnostic signal-to-noise:** Standardizing on `[HH:MM:SS.MMM]` and single-line result logs removes redundant timestamps and reduces diagnostic log volume by roughly half without discarding diagnostic detail.
- **Safe paid operations:** Explicitly separating rate-limit recovery from ambiguous execution outcomes guarantees that paid external API calls are never duplicated silently without explicit user authorization.
- **Missing primitives, not carelessness:** The logging drift is explained by gaps in the logger, not by inattention — the 26-site voice-command cluster existed because `emitResult` was private, and comic's sink monkey-patching existed because the logger had no category filter. Adding the escape hatches removes the incentive that the enforcement would otherwise have to fight.
- **A standing contract is what survives the next sweep:** A one-time verification plus reviewer discipline demonstrably does not hold across 1,344 source files; the contract tests fail in the suite the moment a violation lands rather than in the next audit.
- **Classification over prose is what makes the error contract worth enforcing:** Because `requireApiKey` carries `metadata.missingEnvVar`, OCR structured-response failures are a class rather than a regex, and artifact absence and conflict are predicates, message wording can change without silently breaking retry, batch-blocking, or fallback decisions.
- **`retryable: false` is a correctness fix, not a style preference:** Retrying a failed code-signature verification or a 200-with-malformed-body cannot succeed, and the retry-on-any-error default was reaching both.

## Consequences

Positive outcomes:

- `src/`: A single structured error vocabulary where every failure carries `kind`, `stage`, `hints`, and `metadata`, surfacing structured diagnostics through `cliErrorHandler` and `serializeDiagnosticError`.
- `src/`: Type-safe usage detection via `instanceof`, removal of `LEGACY_ERROR_HINTS`, and consistent error contracts between `pollUntil` and `withRetry`.
- `src/`: Every provider REST client throws an `AppProviderError`, so exit codes and the process-level failure handlers behave identically across providers instead of only on the replicate path.
- `src/`: `--json`, `--log-format`, `--quiet`, and the configured log level are honored by every command, including voice management and `config --show`.
- `src/`: Deterministic security and validation failures are no longer retried.
- `test/`: Centralized provider transient predicates in a shared registry; generalized transient-retry and availability skipping; deterministic global error reporting via runner-level uncaught exception handlers.
- `test/`: A capture window in a failing test replays its captured output into the ADR-019 harness, so consolidating the five helpers closed a debuggability gap rather than only removing duplication.
- Diagnostics: Unified `[HH:MM:SS.MMM]` timestamp across application and test runners without duplicate prefixing, and concise single-line result logs.
- Hosted operations: Explicit boundary between rate-limit pressure recovery and ambiguous create outcomes, preventing accidental duplicate billing while enabling clean resume checkpoints.

Negative outcomes:

- Broad mechanical refactoring across ~994 throw sites in `src/`, plus a 65-site re-sweep and a 42-site output migration.
- Call sites needing elapsed duration must compute and log it explicitly rather than relying on automatic stopwatch prefixes.
- Replaying ambiguous paid operations requires explicit flag authorization (`--allow-ambiguous-redispatch`) and cannot be resolved automatically by the concurrency controller.
- Missing-credential failures exit 2 rather than 1, and `AppUsageError.name` is `'AppUsageError'` rather than `'CLIUsageError'`. Both are deliberate corrections of an inconsistency, and both are observable.
- Voice-management and `config --show` human output is a rendered detail table rather than pretty-printed JSON; machine consumers must pass `--json`, which is what the flag is for. `--json` on a migrated command now emits both the NDJSON log event and the raw result line, matching what `report.complete` and `report.estimate` already did.
- The allowlists are a maintenance surface: an exemption added without justification would weaken the contract silently.

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

**Trade-off 7**

- **Gain:** Both vocabularies fail the suite the moment they are violated, with the offending `file:line` named
- **Sacrifice:** Line-based greps cannot see an unusual spelling (a computed `globalThis['console']`), so the contract pins the common case rather than proving the invariant

**Trade-off 8**

- **Gain:** One sanctioned structured-result channel means result payloads honor the output flags
- **Sacrifice:** Commands whose entire output was raw JSON change their human-mode rendering, a visible behavior change for anyone parsing default output instead of `--json`

**Trade-off 9**

- **Gain:** Category suppression is first-class and scoped, so comic's filtering no longer mutates sinks and cannot leak past the run that asked for it
- **Sacrifice:** `suppressLogCategories` still mutates process-wide state; correctness depends on callers using the returned restore handle or the dispatcher's per-command reset

**Trade-off 10**

- **Gain:** Test fixtures construct real `AppError` subclasses, so a fixture cannot pass while production classification would differ
- **Sacrifice:** Fields a test reads directly off the error object must stay own properties rather than moving into `metadata`, so the conversion is not purely mechanical

## Implementation Note

The unified `AppError` taxonomy (`ProviderError`, `InfraError`, `InternalError`, `ValidationError`), type-safe `isCLIUsageError`, `rethrowAsUsage` validator wrapping, structured retry handling in `pollUntil`, the provider failure classification registry in `test/test-utils/provider-failure-classifiers.ts`, cause-aware paid-create admission handling, explicit bounded TTS ambiguous-redispatch authorization (`--allow-ambiguous-redispatch`), bounded provider diagnostics, TTS recovery-checkpoint diagnostics, structured target aggregation, normalized hosted-pressure recovery, and `[HH:MM:SS.MMM]` human log formatting are implemented across `src/` and `test/`. `forwardSpawnOutput` skips lines that already carry that timestamp. Passing-test console quieting is owned by [ADR-019](ADR-019-quiet-passing-test-console-output.md).

The 2026-08-19 logging and enforcement work shipped across the logger core (`src/utils/app-logger/`), the error core (`src/utils/error-handler.ts`), and the call sites the audit named:

- **Logger escape hatches** — `l.report.result` (`reporter.ts`), category suppression with a restore handle (`app-logger.ts`, `core.ts`), and options-carrying `l.warn`/`l.debug` (`core.ts`, taking the same required-`category` options object as `l.write`).
- **Output migration** — `define-voice-command.ts` (26 sites), `src/tools/repo-snapshot.ts` (7), `metadata-output.ts`, `dispatcher.ts`, and `define-config-command.ts`; `audit-ocr-token-shapes.ts` moved from `cli/commands/` to `src/tools/`.
- **Error sweep** — all 65 plain throws typed by kind with `retryable` set where the failure is deterministic; the two throw-as-goto sentinels restructured into ordinary control flow.
- **Class consolidation** — native parser errors extend `AppUsageError` (removing the duck-type bridge and the `error-handler` ↔ `native-errors` import cycle); `GeminiRestError`, `OpenAIRestError`, `SoundEffectProviderError`, `ArtifactReservationConflictError`, `OcrStructuredResponseError`, and `XApiError` extend the family; `httpResponseError` and the anthropic/mistral REST profiles return `AppProviderError`; batch and resume partial completion collapsed onto `ProviderBatchCompletionError`/`partialCompletionError`.
- **Classification over prose** — `requireApiKey` marks `metadata.missingEnvVar`; `isMissingArtifactError`/`isArtifactConflictError` replace the ENOENT and "already exists" regexes; `hasErrorCode` has one definition; `classifyPaidCreateRetry` has one implementation.
- **Test consolidation** — `test/test-utils/console-capture.ts`, `cli-assertions.ts`, and `value-assertions.ts`; `expectProviderHttpError`, `unexpectedFetch`, and `unexpectedCall` in `rest-contract-helpers.ts`; provider transient predicates and `TERMINAL_TTS_FAILURES` centralized in `provider-failure-classifiers.ts`.
- **Comic facade** — the parallel `l` shim is `comicWrite`, the ANSI-baking `bold`/`cyan` helpers and the no-op `.dim` are gone, valibot issues emit one structured event rendered as a table, and pipeline-log suppression is scoped through `withSuppressedPipelineLogs`.

### Measured outcome

Counted against the 2026-08-19 audit's own baseline:

- **Raw `console.*` and stdout writes in `src/`:** 50 sites, 42 of them violations, reduced to 15 — 8 logger-sink primitives and 7 stdout payloads, each allowlisted and documented.
- **Plain `throw new Error(` in `src/`:** 65 reduced to 0, with an empty allowlist.
- **Custom error classes not extending `AppError`:** 14 of 16 reduced to 0.
- **Hand-rolled console-capture helpers in `test/`:** 5 helpers plus 3 `captureLogEvents` copies and 2 inline sink swaps, reduced to 1 shared module.
- **`Object.assign(new Error(...))` provider fixtures:** 53 reduced to 4 — the deliberate impostors that `app-error-contracts.test.ts` uses to prove duck-typed lookalikes are rejected.
- **Loose `expect(result.exitCode).not.toBe(0)` assertions:** 11 reduced to 0.
- **Mechanical enforcement:** none, replaced by 15 standing contract tests.

### Deliberate departures from the audit's plan

- **Price previews use `l.report.result`, not `l.report.estimate`.** `report.estimate` takes an `AggregatedPriceEstimate`, a discriminated union over pipeline steps. Voice-management previews are not pipeline steps and carry `operation`, `mutation`, `providerCalls`, and `pricing` fields the type does not model, so routing them through it would have meant inventing a fake step kind. They use `report.result` with `category: 'pricing'` and a `dryRun: true` marker, which honors `--json`/`--quiet`/`--log-format` and flows through `emitResult` without distorting the pricing type.
- **`metadata --markdown` stays a direct stdout write.** The frontmatter document exists to be piped verbatim, a contract pinned by `metadata-markdown.test.ts`, and sink decoration would corrupt it. Only the JSON branch moved to `report.result`; the markdown branch is allowlisted alongside the help and `--version` payloads.
- **The dispatcher's "No command specified. Showing help:" line was dropped rather than relocated.** The help output that immediately follows says the same thing.
- **The audit's claim that mistral's bare `new Error(...)` "loses status and headers entirely" is inaccurate.** `createProviderRestClient` assigns status and headers onto every profile whose `diagnostics` is not `'factory'`, mistral included. The real defect was the missing `kind` and `AppError` membership, which is what the fix addresses.
- **The audit's "94 Missing / 66 Expected" throw-guard counts are actually 8 and 37.** `requireDefined` and `expectArtifact` were added and adopted where they fit rather than manufacturing churn toward a count that was never there.
- **Only the *setup* `BATCH_BLOCKING_*_MESSAGE_PATTERNS` were deleted.** Those matched `requireApiKey`'s own message and are replaced by the structural `metadata.missingEnvVar` marker. The *model* patterns match provider prose ("model not found"), which is legitimate message-matching under Keep, so they were kept and documented.
- **`run-lyrics-video.ts` uses `InfraError` with an explicit `exitCode: 1`, not `AppUsageError`.** A lyric-video batch finishing with failed items is an execution outcome, not a usage mistake; `AppUsageError` would have silently changed its exit code from 1 to 2. The hand-rolled cast was removed without changing observable behavior.

### Defects found while implementing that the audit did not name

- **Category suppression leaked across the whole process.** The first `suppressLogCategories` implementation mutated global state that nothing cleared, so comic tests silently muted `pipeline` events for every suite that ran after them. Fixed three ways: the function returns a restore handle, the comic commands are wrapped in `withSuppressedPipelineLogs`, and the CLI dispatcher clears suppression at the start of every command.
- **`error-handler.ts` ↔ `native-errors.ts` import cycle.** Making the native parser errors extend `AppUsageError` would have created a class-extends cycle that fails at module-evaluation time. Broken by moving `nativeUsageMessage`'s formatting into the subclasses as an `AppUsageError.usageMessage` field, which removed `error-handler`'s import of `native-errors` entirely.
- **`classifyHostedRateLimitPressure` could not see `AppError` metadata.** Its `readNestedErrorValue` walked own properties only, so a structured `AppProviderError` carrying `category` in `metadata` was invisible to rate-limit classification while a hand-assembled plain error still matched. Fixed at the reader.
- **Two duck-typed fields moved into `metadata` broke their readers.** `attemptsMade` (url-provider-registry) and the OCR pool's test markers were read as own properties. The production reader now goes through `extractErrorMetadata`; the test-local markers stayed own properties, with a comment explaining why.

## Keep (with rationale)

`src/`:

**Pattern 1: The existing `AppError` kinds (no new `pipeline` kind)**

- **Pattern:** The existing `AppError` kinds (no new `pipeline` kind)
- **Reason kept:** `usage`, `provider_http`, `retry_exhausted`, `validation`, `infrastructure`, and `internal` cover all runtime scenarios and map cleanly to process exit codes.

**Pattern 2: Provider and tool prose matchers**

- **Pattern:** Message-text matching in `pdf-chunk-fallback-classifier.ts`, `qpdf-health.ts`, `split-limits.ts`, and `classifyHostedRateLimitPressure`
- **Reason kept:** Their upstream source is a provider's HTTP error body or a binary's stderr, which carries no machine-readable counterpart. Each site carries a comment naming that source, and structured fields are consulted first.

**Pattern 3: Comic's compact one-line log shape**

- **Pattern:** `comicLog.header/line/output/summary` keep their `label key=value` form rather than becoming tables
- **Reason kept:** The compact shape is comic's deliberate output contract, pinned by `comic-logging-contracts.test.ts`; only the facade's hazards were removed.

**Pattern 4: `metadata --markdown` and help/version stdout writes**

- **Pattern:** Direct `process.stdout` writes for documents the user asked for
- **Reason kept:** Sink decoration would corrupt the payload, so these are allowlisted rather than migrated.

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

**Pattern 6: The four `Object.assign(new Error(...))` fixtures in `app-error-contracts.test.ts`**

- **Pattern:** Hand-assembled error lookalikes retained in one file
- **Reason kept:** They are the negative cases proving that duck-typed impostors are not accepted as `AppError`s; converting them would delete the assertion.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/runtime-contracts/
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
bun test test/test-cases/validation/
```

1. `bun run check` proves the unique-source-name invariant and that the whole repository type-checks after the class hierarchy and type-surface changes.
2. `runtime-contracts/` proves the enforcement greps, the `AppError` contracts (including `AppUsageError.name`, the usage exit code, and that usage errors exit 2 while operational errors exit 1 with structured hints), the retry contracts over production-shaped fixtures including `retry_exhausted` metadata preservation, and the three logger escape hatches.
3. The three CLI suites prove help output, usage-error exit codes and messages, and option resolution across the native parser errors extending `AppUsageError`.
4. `validation/` proves the full no-cost surface: 1,929 tests across 294 files covering the migrated voice-management result payloads, provider REST error uniformity, OCR and STT classification, comic logging, single `[HH:MM:SS.MMM]` prefixes with no duplicate runner prefix, and the runner's own contracts.
5. Grep verification confirms `LEGACY_ERROR_HINTS` is absent from `src/`; the enforcement contracts confirm the same for plain `throw new Error(` and unallowlisted raw output.

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
- `src/utils/retries.ts` — `withRetry`, `pollUntil`, `classifyFetchRetry`, `classifyPaidCreateRetry`
- `src/utils/app-logger/` — logger core, sinks, reporter, `emitResult`, redaction, human tables
- `src/cli/create-cli.ts` — `cliErrorHandler`
- `src/cli/failure-handlers.ts` — Process-boundary error handlers
- `test/test-cases/validation/runtime-contracts/output-vocabulary-contracts.test.ts` — Standing logging and error vocabulary contracts
- `test/test-utils/console-capture.ts` — Sole sanctioned console and sink capture module
- `test/test-utils/provider-failure-classifiers.ts` — Shared provider failure predicates
- `test/test-runner/utils.ts` and `test/test-runner/runner.ts` — Test timestamp formatter and console wrapper
