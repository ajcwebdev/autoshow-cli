# ADR-002: Define Pipeline State, Resume, and Dry-Run Planning

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-08-14
- **Verification Status:** Passed
- **Supersession:** Owns batch work planning, canonical pipeline persistence, pooled OCR page state, and resume price preflight. Source identity, classification, normalization, and discovery caches are owned by [ADR-001](ADR-001-source-ingestion-and-normalization.md); URL and OCR execution and artifacts by [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md); pooled work selection by [ADR-016](ADR-016-distribute-ocr-pages-across-a-multi-provider-work-pool.md); general diagnostic rendering by [ADR-006](ADR-006-unify-error-handling-vocabulary.md).

## Context

Metadata, download, extract, write, generation, and resume need one command-neutral description of the work to perform and one canonical record of work already attempted. Pipeline state was previously split across filenames, envelopes, summaries, and provider checkpoints, so readers needed format versions, artifact kinds, probing order, aliases, and route inference to reconstruct a single run.

Pipeline outputs are disposable execution state, not a durable interchange format. Rerunning is the supported recovery path after the persistence contract changes, so recognition or migration machinery for superseded state adds ambiguity without providing a supported compatibility promise.

Resume can backfill missing provider outputs in existing extract, write, TTS, image, video, and music runs. It accepts the same provider-selection surface as execution — `--provider provider[=model]`, `--all-providers`, `--all-local` — so it can initiate paid or quota-limited calls, but `resume --price` failed with `Unexpected flag: price`, leaving no way to estimate additive work before a paid run.

Why now: resume became a paid-provider entry point without a preflight, and the split persistence layout made both resume and price planning depend on inferring run state instead of reading it.

Pooled multi-provider OCR adds page claims, accepted results, interrupted work, target and lane retirement, and attempt-level usage, but it does not change the persistence decision. That state must live in the same canonical item rather than in provider directories, raw responses, a scheduler checkpoint, or a parallel pool manifest. Resume and `resume --price` must read the stored mode and page ledger so accepted pages are never inferred from artifacts or charged again.

## Options Considered

### Pipeline state

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **One current, unversioned canonical manifest and clean-break reader** | Gives all commands and resume one authority; removes probing, aliases, derived completion state, and compatibility ambiguity | Existing pre-cutover outputs must be regenerated | One `manifest.json` per output root |
| Per-command or per-artifact codecs | Lets each domain evolve independently | Recreates format ownership and dispatch under a new abstraction | n/a |
| Versioned compatibility readers and migration | Could open historical outputs | Preserves obsolete formats even though pipeline state is disposable and unsupported as interchange | n/a |

### Resume price planning

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Add `--price` support to all resume target types** | Makes preflight consistent across extract, write, and generation; avoids surprising paid runs | Requires target-aware planning in several resume handlers | Covers 6 resume kinds: extract, write, TTS, image, video, music |
| Add `--price` only for OCR resume | Smallest implementation | Leaves inconsistent behavior and future paid-resume gaps | Covers 1 extract route |
| Keep rejecting `resume --price` | Preserves implementation simplicity | Requires manual estimates or risks paid provider calls | No implementation work |

### No-cost price verification

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Stable local/remote fixtures plus bounded 25-worker concurrency** | Removes network head-of-line blocking from cost-planning verification | Fixtures must be curated and kept stable | 165/165 pricing specs in 6.5 s |
| Raise concurrency only | No fixture maintenance | Increases contention without removing blocking network work | Slower than the 10-worker baseline |
| Keep live YouTube price cases | Exercises real discovery paths | Four live cases dominated total suite time | 165/165 in 39.1 s |

## Decision

This applies to:

- Command-neutral batch work planning and canonical pipeline persistence.
- Resume execution and price dry-run preflight across extract, write, TTS, image, video, and music routes.

### Command-neutral work planning

Step 0 produces source classification, expansion, format hints, and explicit route selection under ADR-001. This record owns the command-neutral batch work plan that turns those source results into ordered, route-aware pipeline items consumed by download, extract, write, generation, and resume. Domain execution does not rediscover or infer routes from provider metadata.

`article` and `x-space` are distinct explicit routes. One-item and mixed-route batches retain their route in the plan and state. X Spaces keep explicit not-resumable behavior rather than being mistaken for URL articles.

### One pipeline persistence contract

Every pipeline output root contains exactly one unversioned `manifest.json`. The top-level shape is always `{ command, scope, createdAt, updatedAt, source?, items }`; `command` and `scope` are ordinary business fields rather than format selectors. Every item uses the same input, route, output, child-link, status, metadata, and provider-state fields.

Provider identity, artifact location, attempts, running/succeeded/missing/failed/skipped status, resumable remote-job metadata, result summary, and error are stored once in item provider entries. Requested, missing, blocked, completion, and batch-summary views are derived. Provider directories may contain raw domain payloads, but those payloads do not carry pipeline format metadata and never control resume eligibility.

Mixed-route batches use containment-checked child-directory links. Each linked child directory owns its own canonical manifest. Resume validates parent route, child route, index, command, scope, and path containment before reading or rewriting child state.

The canonical reader validates only the current shape, timestamps, statuses, and contained relative paths. It distinguishes a missing canonical file from malformed or invalid current data. It does not recognize, detect, reject by version, migrate, or probe for superseded formats. Corrupt current state fails before provider execution or rewrite. Existing output directories created under an earlier persistence layout must be rerun.

### Canonical pooled OCR page ledger

When an OCR item uses `ocrProviderMode: "pool"`, that same canonical item carries one `ocrPool` ledger. The ledger records the selected mode, required page count, ordered page states, current claims, accepted results, all attempts, provider/model/reasoning attribution, usage and cost evidence, target and lane status, and scheduler telemetry. An accepted page result is committed through the ordinary atomic manifest writer after verifying that its claim is still current and no accepted result exists. Provider directories, page inputs, response caches, raw responses, throughput profiles, and generated diagnostics are evidence or projections only.

Claims stored as running when a process stops are recovered as interrupted unfinished work. Accepted page records remain immutable inputs to composite reassembly and are not rerun. The item is full only when every required page is accepted; exhausted pages make it incomplete even if every remaining target state is terminal. This page ledger is not a separately versioned format: changing its canonical shape follows this ADR's existing unversioned clean-break policy.

### Resume and dry-run planning

`resume --price` is a provider-neutral, non-mutating dry-run cost preflight for exactly the missing, failed, or newly selected additive targets that the same resume command would attempt. It applies to extract STT, OCR, and URL article routes; write LLM resume; and standalone TTS, image, video, and music resume. It supports explicit provider selections and additive resume behavior.

Pooled OCR resume preserves the mode stored in the manifest and continues only unfinished pages. Healthy stored targets remain eligible subject to their prior page attempts; explicitly selected additive targets are added only after current registry and capability validation. Explicitly selecting a previously retired target re-enables that target and its affected lane without invalidating accepted pages. A stored fan-out item cannot resume as pool, and a stored pool cannot resume as fan-out.

For pooled OCR, `resume --price` estimates only unfinished pages with the same lane-sharing and concurrency assumptions used by execution. It does not rewrite claims, targets, completion state, artifacts, or the manifest. If no eligible target or lane remains, price mode does not invent different work.

Price mode performs no provider call, writes no canonical manifest or raw provider artifact, and exits after estimates. Unsupported or insufficiently resumable manifests produce usage errors instead of estimating different work. Execution and price mode use the same target selection and option resolution.

Resume accepts only provider-neutral option slices. It declares no provider-named flags. Such flags fail at argv parsing with `Unexpected flag: <typed spelling including leading dashes>`, matching the rejection path for removed pipeline-prefixed aliases. When canonical provider state cannot reconstruct a tuning value, both execution and price planning resolve it from merged `autoshow.config` or the provider default.

Hosted concurrency mode and live lane pressure are execution policy, not canonical content or cache identity. Resume retains accepted provider, page, segment, chunk, and generation results, then creates a fresh run-scoped coordinator using the current explicit `--concurrency-mode` or `defaults.concurrency.mode`; a new resume process therefore begins a fresh ramp. The manifest may retain additive hosted-concurrency telemetry as historical execution evidence, but it does not use that telemetry to resume a live limit or invalidate accepted work.

Price mode remains side-effect-free and models a clean run with no rate-limit pressure. Its wall-time calculations use the same one-slot-at-time-zero and one-additional-slot-every-five-seconds schedule for each independent provider/account lane, bounded by the resolved work-class cap. Price planning does not persist timers, probes, or inferred provider capacity.

### No-cost verification contract

- Price registries use fast, stable fixtures for cost-planning contracts instead of live YouTube watch/channel scraping. The selected fixtures are `https://ajc.pics/autoshow/examples/2-video.mp4`, `input/examples/batch/2-urls.md`, and `https://ajc.pics/autoshow/examples/0-audio-short.mp3`.
- Price commands and budget variants share a bounded worker pool with `PRICE_CONCURRENCY = 25`. This is test-runner concurrency only; it does not change provider concurrency or public CLI behavior.
- Ordered reporting renders each completed price command once as `[index/total] name — cost: <cost>`. A single-variant budget preflight renders once as `[index/total] key — decision: RUN (cost: <cost>)`.

## Rationale

- One work plan and persistence shape remove duplicated route inference, codecs, completion aliases, and probing order.
- A clean-break reader reflects that generated pipeline state is rebuildable rather than a long-lived interchange format.
- Page-level pool state belongs in that same clean-break manifest because exactly-once acceptance and crash recovery cannot be reconstructed safely from attempt artifacts.
- Explicit routes are required because safe one-item and mixed-route resume cannot rely on inference.
- Resume can spend provider credits, so it must support the same no-cost preflight pattern as normal execution commands, and estimates must include only work that execution would attempt.
- Full route coverage avoids a fragmented rule where `--price` works for OCR but fails elsewhere.
- Provider-named resume flags were rejected because one resume surface spans domains with colliding option names, and canonical/config/default resolution already supplies tuning values.
- A universal execution runner was rejected because retries, cleanup, responses, and artifacts remain domain-specific under ADR-009.
- Fast fixtures remove unrelated remote-site integration latency from cost-planning verification; concurrency alone cannot solve network head-of-line blocking.

## Consequences

Positive outcomes:

- Every producer, benchmark reader, artifact reporter, and resume path uses one canonical persistence boundary.
- Provider progress and completion cannot drift between root summaries, checkpoints, and result envelopes.
- Path traversal and malformed current state fail locally before filesystem escape or provider work.
- Users can price-check multi-directory and additive resume work before any paid provider call.
- Pooled OCR resume preserves accepted pages, recovers interrupted claims, and prices only unfinished work without another checkpoint authority.
- No-cost price verification runs in seconds instead of tens of seconds, with roughly half the log lines.

Negative outcomes:

- Existing pre-cutover pipeline outputs are intentionally not resumable and must be regenerated.
- Resume handlers maintain a dry-run planning path as well as execution.
- Some estimates remain heuristic when canonical state lacks exact source size, duration, prompt, or page-count evidence, and values absent from canonical provider options fall back to configuration or provider defaults.
- Pooled OCR increases canonical item size and write frequency because page claims and accepted results are checkpointed atomically.
- The no-cost runner maintains a 25-worker bound and curated stable fixtures.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| One canonical work/state authority | Pre-cutover output directories must be rebuilt |
| Safe provider-neutral resume price planning | Every resumable domain maintains a shared planning path alongside execution |
| Crash-safe pooled page acceptance | Larger canonical page and attempt ledgers |
| Resume-aware additive estimates | Some manifest-dependent values require configuration/default fallbacks |
| Fast, quiet no-cost price verification | The test runner maintains bounded worker scheduling and curated fixtures |

## API / Type Impact

- The canonical pipeline manifest is the only run-state authority and has no format version.
- `resume` accepts `--price` as a boolean provider-neutral flag.
- The shared price/preflight option slice participates in resume dispatch, and price-mode resume exits before provider runners and state mutation.
- Pooled OCR items carry `ocrProviderMode: "pool"` and one canonical `ocrPool` page ledger; no schema version or parallel pool manifest is introduced.
- Resume exposes `--ocr-provider-mode` only to detect explicit stored-mode mismatches. Omitted mode preserves the manifest value.
- Pooled resume target selection retains accepted pages, treats interrupted claims as unfinished, admits validated additive targets, and re-enables explicitly selected retired targets or lanes.
- Resume composes command-specific STT, OCR, URL, LLM, TTS, image, video, or music options with shared price and concurrency controls; provider-named knobs remain outside its surface.
- Resume projects the current hosted concurrency mode into a new run-scoped coordinator without making that mode part of content, cache, or accepted-work identity.
- Bare `manifest.json` and any domain raw-result files have distinct ownership: domain artifacts may be referenced from canonical state but cannot replace it.

## Implementation Note

- Implemented single current canonical manifest and containment-checked mixed-route child links in `src/cli/commands/process-steps/pipeline-manifest.ts`.
- Implemented `priceFlag` in provider-neutral `resumeFlags` built as `pickFlags` allow-lists in `src/cli/flags/resume-flags.ts`.
- Implemented target resolution for resume planning and execution in `src/cli/commands/setup-and-utilities/resume/`, exiting price mode before provider execution or state mutation.
- Implemented persistence for pooled claims, accepted pages, attempts, target/lane failures, usage, and attribution in `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-pooled-batch.ts` and `src/cli/commands/process-steps/pipeline-manifest.ts`.
- Implemented pool-mode and accepted-page preservation during resume in `src/cli/commands/setup-and-utilities/resume/extract/ocr-resume.ts`.
- Implemented side-effect-free price estimation across STT, OCR, URL, LLM, TTS, image, video, and music resume handlers.
- Retained `--image-*`, `--video-*`, and `--music-*` prefixes on resume to resolve cross-domain option collisions.
- Implemented stable price fixtures, 25-worker bounded concurrency, and single-line result rendering in `test/test-runner/runner.ts`.

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Keep new resumable provider domains on the shared canonical-state and side-effect-free price-planning contracts | Pipeline maintainers | Ongoing guardrail |

## Test Plan

- Canonical contracts cover every process command, single and batch scope, one-item batches, mixed-route child links, all provider statuses, atomic progress updates, missing files, malformed JSON, invalid shapes, corrupt rewrites, and path containment.
- A source guard ensures no superseded pipeline filename, format-version helper, old manifest type, route adapter, checkpoint, or derived summary artifact remains.
- Resume price contracts prove estimates cover selected missing/additive targets, multi-directory totals are reported, manifests stay unchanged, and provider runners are not invoked.
- Pooled OCR contracts prove atomic claim and accepted-page checkpoints, interrupted-claim recovery, accepted-page preservation, additive and explicitly re-enabled targets, stored-mode enforcement, unfinished-page pricing, and canonical-manifest authority.
- Resume flag contracts prove every provider-neutral option is present, provider-named options are absent, and representative rejected flags preserve the user's typed dashed spelling.
- Run `bun run check`, `bun t --price`, `bun test test/test-cases/validation/cli/cli-help-contracts.test.ts`, `bun test test/test-cases/validation/cli/cli-usage-errors.test.ts`, `bun test test/test-cases/validation/cli/option-resolution-contracts/`, `bun test test/test-cases/validation/reports-pricing/price-mode-contracts/`, and targeted manifest tests. Do not run paid provider, smoke, or e2e tests that can call third-party APIs.
- Verification on 2026-08-14 includes the default no-cost checks, targeted resume/option contracts, and clean-ramp pricing coverage without provider calls.

## References

- Source ingestion, identity, normalization, and discovery caches: [ADR-001](ADR-001-source-ingestion-and-normalization.md)
- Extract execution and artifacts: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- Pooled OCR scheduling decision: [ADR-016](ADR-016-distribute-ocr-pages-across-a-multi-provider-work-pool.md)
- Diagnostic-rendering companion: [ADR-006](ADR-006-unify-error-handling-vocabulary.md)
- Hosted scheduling and price-ramp companion: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)
- Canonical persistence boundary: `src/cli/commands/process-steps/pipeline-manifest.ts`
- Resume routing and dispatch: `src/cli/commands/setup-and-utilities/resume/`
- Resume flags: `src/cli/flags/resume-flags.ts`
- Configuration fallback: `src/cli/commands/setup-and-utilities/config/config-merge.ts`
- Aggregate pricing: `src/cli/commands/pricing-orchestration/aggregate-pricing.ts`
- Price worker, fixtures, and result rendering: `test/test-runner/runner.ts`, `test/test-runner/price-commands/registry/`
- Canonical persistence source guard: `test/test-cases/validation/resume-manifests/no-legacy-persistence-contracts.test.ts`
- Resume provider-surface contracts: `test/test-cases/validation/resume-manifests/resume-provider-surface-contracts.test.ts`
