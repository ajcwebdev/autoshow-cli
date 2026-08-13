# ADR-002: Define Pipeline State, Resume, and Dry-Run Planning

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-08-13
- **Verification Status:** Passed
- **Supersession:** Retains the batch-planning and canonical-persistence decisions from the former mixed URL/discovery/persistence record and directly absorbs the complete record "Add Price Preflight to Resume and Keep No-Cost Verification Fast". Source identity, classification, normalization, and discovery-cache correctness moved to ADR-001; URL execution and artifacts moved to ADR-009. It also retains the price-runner fixture, concurrency, result-rendering, and benchmark decisions absorbed earlier from "Optimize Price Preflight Performance, Test Concurrency, and Token-Efficient Logging"; general diagnostic rendering remains owned by ADR-006.

## Context

Metadata, download, extract, write, generation, and resume need one command-neutral description of the work to perform and one canonical record of work already attempted. Earlier pipeline state was split across filenames, envelopes, summaries, and provider checkpoints, so readers needed format versions, artifact kinds, probing order, aliases, and route inference to reconstruct one run.

Pipeline outputs are disposable execution state, not a durable interchange format. Rerunning is the supported recovery path after the persistence contract changes. Recognition or migration machinery for superseded state therefore adds ambiguity without providing a supported compatibility promise.

Resume can backfill missing provider outputs in existing extract, write, TTS, image, video, and music runs. It accepts the same provider-selection surface as execution — `--provider provider[=model]`, `--all-providers`, `--all-local` — so it can initiate paid or quota-limited calls. Before this decision, `resume --price` failed with `Unexpected flag: price`, preventing users from estimating additive work before a paid run.

Once price preflight became the ubiquitous safe planning path, its feedback time mattered. The first full benchmark executed 165 mapped price commands with a 100% pass rate and a suite estimate of 1417.653¢, but took 39.111 seconds. Of those commands, 161 completed in 187–911 ms at roughly 300 ms each, while four live YouTube/remote cases consumed 121.382 seconds of cumulative process time: `transcribe-youtube-single` took 29,009 ms, `transcribe-youtube-channel-batch-1` took 27,076 ms, `transcribe-supadata-auto` took 37,183 ms, and `transcribe-scrapecreators-youtube-transcript` took 28,107 ms. Two slow commands entered the initial ten-worker batch and created head-of-line blocking, delaying the first 38 ordered results until 39.106 seconds.

## Options Considered

### Pipeline state

| Option | Pros | Cons |
|---|---|---|
| **One current, unversioned canonical manifest and clean-break reader** | Gives all commands and resume one authority; removes probing, aliases, derived completion state, and compatibility ambiguity | Existing pre-cutover outputs must be regenerated |
| Per-command or per-artifact codecs | Lets each domain evolve independently | Recreates format ownership and dispatch under a new abstraction |
| Versioned compatibility readers and migration | Could open historical outputs | Preserves obsolete formats even though pipeline state is disposable and unsupported as interchange |

### Resume price planning

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Add `--price` support to all resume target types** | Makes preflight consistent across extract, write, and generation; avoids surprising paid runs | Requires target-aware planning in several resume handlers | Covers 6 resume kinds: extract, write, TTS, image, video, music |
| Add `--price` only for OCR resume | Smallest implementation | Leaves inconsistent behavior and future paid-resume gaps | Covers 1 extract route |
| Keep rejecting `resume --price` | Preserves implementation simplicity | Requires manual estimates or risks paid provider calls | No implementation work |

### No-cost verification performance experiment

| Strategy / Scenario | Price Concurrency | Fixture / Cache / Logging State | Total Suite Duration | Preflight Log Lines | Speedup vs Baseline | Pass Rate |
|---|---:|---|---:|---:|---:|---:|
| Original baseline | 10 | Live YouTube URLs, dual stopwatch timers, two lines per command | 39,111 ms | 338+ | 1.00x | 165/165 |
| Concurrency-only experiment | 25 | Live YouTube URLs and dual timers | 42,549 ms | 338+ | 0.92x | 165/165 |
| Fast-fixture phase | 25 | Direct fixtures and remote metadata caches | 7,625 ms | 338+ | 5.13x | 165/165 |
| Disk-cache phase | 25 | Fast fixtures plus local metadata and batch-list caches | 6,580 ms | 338+ | 5.94x | 165/165 |
| Selected complete strategy | 25 | All caches, unified wall-clock timestamps, single-line results | 6,512 ms | 172 | 6.01x | 165/165 |

Concurrency alone was slower because it increased contention without removing blocking network work. The selected strategy combines non-blocking fixtures, bounded test-runner concurrency, discovery caches owned by ADR-001, and diagnostic rendering owned by ADR-006.

## Decision

### Command-neutral work planning

Step 0 produces source classification, expansion, format hints, and explicit route selection under ADR-001. This record owns the command-neutral batch work plan that turns those source results into ordered, route-aware pipeline items consumed by download, extract, write, generation, and resume. Domain execution does not rediscover or infer routes from provider metadata.

`article` and `x-space` are distinct explicit routes. One-item and mixed-route batches retain their route in the plan and state. X Spaces keep explicit not-resumable behavior rather than being mistaken for URL articles.

### One pipeline persistence contract

Every pipeline output root contains exactly one unversioned `manifest.json`. The top-level shape is always `{ command, scope, createdAt, updatedAt, source?, items }`; `command` and `scope` are ordinary business fields rather than format selectors. Every item uses the same input, route, output, child-link, status, metadata, and provider-state fields.

Provider identity, artifact location, attempts, running/succeeded/missing/failed/skipped status, resumable remote-job metadata, result summary, and error are stored once in item provider entries. Requested, missing, blocked, completion, and batch-summary views are derived. Provider directories may contain raw domain payloads, but those payloads do not carry pipeline format metadata and never control resume eligibility.

Mixed-route batches use containment-checked child-directory links. Each linked child directory owns its own canonical manifest. Resume validates parent route, child route, index, command, scope, and path containment before reading or rewriting child state.

The canonical reader validates only the current shape, timestamps, statuses, and contained relative paths. It distinguishes a missing canonical file from malformed or invalid current data. It does not recognize, detect, reject by version, migrate, or probe for superseded formats. Corrupt current state fails before provider execution or rewrite. Existing output directories created under an earlier persistence layout must be rerun.

### Resume and dry-run planning

`resume --price` is a provider-neutral, non-mutating dry-run cost preflight for exactly the missing, failed, or newly selected additive targets that the same resume command would attempt. It applies to extract STT, OCR, and URL article routes; write LLM resume; and standalone TTS, image, video, and music resume. It supports explicit provider selections and additive resume behavior.

Price mode performs no provider call, writes no canonical manifest or raw provider artifact, and exits after estimates. Unsupported or insufficiently resumable manifests produce usage errors instead of estimating different work. Execution and price mode use the same target selection and option resolution.

Resume accepts only provider-neutral option slices. It declares no provider-named flags. Such flags fail at argv parsing with `Unexpected flag: <typed spelling including leading dashes>`, matching the rejection path for removed pipeline-prefixed aliases. When canonical provider state cannot reconstruct a tuning value, both execution and price planning resolve it from merged `autoshow.config` or the provider default.

### No-cost verification contract

- Price registries use fast, stable fixtures for cost-planning contracts instead of live YouTube watch/channel scraping. The selected fixtures are `https://ajc.pics/autoshow/examples/2-video.mp4`, `input/examples/batch/2-urls.md`, and `https://ajc.pics/autoshow/examples/0-audio-short.mp3`.
- Price commands and budget variants share a bounded worker pool with `PRICE_CONCURRENCY = 25`. This is test-runner concurrency only; it does not change provider concurrency or public CLI behavior.
- Ordered reporting renders each completed price command once as `[index/total] name — cost: <cost>`. A single-variant budget preflight renders once as `[index/total] key — decision: RUN (cost: <cost>)`.
- ADR-001 owns production discovery caches. ADR-006 owns the common wall-clock timestamp, duplicate-prefix suppression, and general one-line diagnostic rule.

## API / Type Impact

- The canonical pipeline manifest is the only run-state authority and has no format version.
- `resume` accepts `--price` as a boolean provider-neutral flag.
- The shared price/preflight option slice participates in resume dispatch.
- Price-mode resume exits before provider runners and state mutation.
- Resume composes command-specific STT, OCR, URL, LLM, TTS, image, video, or music options with shared price and concurrency controls; provider-named knobs remain outside its surface.
- Bare `manifest.json` and any domain raw-result files have distinct ownership: domain artifacts may be referenced from canonical state but cannot replace it.

## Rationale

- One work plan and persistence shape remove duplicated route inference, codecs, completion aliases, and probing order.
- A clean-break reader reflects that generated pipeline state is rebuildable rather than a long-lived interchange format.
- Resume can spend provider credits, so it must support the same no-cost preflight pattern as normal execution commands.
- Resume-aware estimates include only work that execution would attempt, not already-complete providers.
- Full route coverage avoids a fragmented rule where `--price` works for OCR but fails elsewhere.
- Fast fixtures remove unrelated remote-site integration latency from cost-planning verification; concurrency alone cannot solve network head-of-line blocking.

## Consequences

Positive outcomes:

- Every producer, benchmark reader, artifact reporter, and resume path uses one canonical persistence boundary.
- Provider progress and completion cannot drift between root summaries, checkpoints, and result envelopes.
- Path traversal and malformed current state fail locally before filesystem escape or provider work.
- Users can price-check multi-directory and additive resume work before any paid provider call.
- The historical OCR benchmark backfill workflow can estimate the selected new OpenAI and Anthropic targets across existing runs before execution.
- Resume becomes consistent with the rest of the paid-provider surface.
- The historical full price suite improved from 39.111 seconds to 6.512 seconds, a 6.01x speedup and 32.599-second saving per run.
- Historical price output fell from more than 338 lines to 172, about a 50% line reduction and approximately 45% lower log-token overhead without removing information.

Negative outcomes:

- Existing pre-cutover pipeline outputs are intentionally not resumable and must be regenerated.
- The atomic persistence cutover touched producers, resume, benchmarks, tests, help, examples, and committed fixtures together.
- Resume handlers maintain a dry-run planning path as well as execution.
- Some estimates remain heuristic when canonical state lacks exact source size, duration, prompt, or page-count evidence.
- Provider-specific values absent from canonical provider options fall back to configuration or provider defaults.
- The no-cost runner maintains a 25-worker bound and curated stable fixtures.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| One canonical work/state authority | Pre-cutover output directories must be rebuilt |
| Safe provider-neutral resume price planning | Every resumable domain maintains a shared planning path alongside execution |
| Resume-aware additive estimates | Some manifest-dependent values require configuration/default fallbacks |
| 6.01x faster historical no-cost price verification and substantially quieter logs | The test runner maintains bounded 25-worker scheduling and curated fixtures |

## Rejected Alternatives

- A universal Step 2 runner was rejected because retries, cleanup, responses, and artifacts remain domain-specific under ADR-009.
- Per-artifact and per-command codecs were rejected because they recreate format dispatch.
- Compatibility readers, upgrader chains, tombstone readers, and old-format detection were rejected because they preserve unsupported disposable state.
- Route inference was rejected because safe one-item and mixed-route resume needs explicit routes.
- OCR-only price support was rejected because other resume routes can also spend credits.
- Provider-named resume flags were rejected because one resume surface spans domains with colliding option names and canonical/config/default resolution already supplies tuning.

## Implementation Note

| Action | Owner | Current State |
|---|---|---|
| Keep one current canonical manifest and containment-checked mixed-route child links | Pipeline maintainers | Implemented |
| Add `priceFlag` to provider-neutral `resumeFlags` | CLI maintainers | Implemented |
| Resolve the same targets for resume planning and execution | CLI maintainers | Implemented |
| Estimate extract STT/OCR/URL, write LLM, TTS, image, video, and music resume without provider calls | Domain maintainers | Implemented |
| Exit price mode before manifest or artifact writes and provider execution | CLI maintainers | Implemented |
| Build `resumeFlags` as `pickFlags` allow-lists from shared option-name constants | CLI maintainers | Implemented |
| Remove 37 inherited provider-named flags and the resume-only `sttFlags` and `ocrCommandFlags` aggregates | CLI maintainers | Implemented |
| Keep `--image-*`, `--video-*`, and `--music-*` prefixes on resume because short names collide across its domains | CLI maintainers | Implemented |
| Replace live YouTube price cases with stable direct media and batch fixtures | Test maintainers | Implemented |
| Increase bounded price-worker concurrency from 10 to 25 after fixture optimization | Test maintainers | Implemented in `test/test-runner/runner.ts` |
| Render price-command and single-budget decisions in the exact one-line shapes | Test maintainers | Implemented in `test/test-runner/runner.ts` |
| Verify the five-stage 165-command benchmark matrix | Test maintainers | Verified |

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Keep new resumable provider domains on the shared canonical-state and side-effect-free price-planning contracts | Pipeline maintainers | Ongoing guardrail |

## Test Plan

- Canonical contracts cover every process command, single and batch scope, one-item batches, mixed-route child links, all provider statuses, atomic progress updates, missing files, malformed JSON, invalid shapes, corrupt rewrites, and path containment.
- A source guard ensures no superseded pipeline filename, format-version helper, old manifest type, route adapter, checkpoint, or derived summary artifact remains.
- Resume price contracts prove estimates cover selected missing/additive targets, multi-directory totals are reported, manifests stay unchanged, and provider runners are not invoked.
- Resume flag contracts prove every provider-neutral option is present, provider-named options are absent, and representative rejected flags preserve the user's typed dashed spelling.
- Run `bun run check`, `bun t --price`, `bun test test/test-cases/validation/cli/cli-help-contracts.test.ts`, `bun test test/test-cases/validation/cli/cli-usage-errors.test.ts`, `bun test test/test-cases/validation/cli/option-resolution-contracts/`, `bun test test/test-cases/validation/reports-pricing/price-mode-contracts/`, and targeted manifest tests. Do not run paid provider, smoke, or e2e tests that can call third-party APIs.
- Historical optimization benchmark: `bun t --price` passed 165/165 pricing specs in 6.512 seconds, reported the then-current 1417.653¢ estimate, and emitted 172 preflight lines.
- Consolidation verification on 2026-08-13: `bun t --price` passed 165/165 pricing specs and reported 1420.395¢ without provider calls.

## References

- Source ingestion, identity, normalization, and discovery caches: [ADR-001](ADR-001-source-ingestion-and-normalization.md)
- Extract execution and artifacts: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- Diagnostic-rendering companion: [ADR-006](ADR-006-unify-error-handling-vocabulary.md)
- Canonical persistence boundary: `src/cli/commands/process-steps/pipeline-manifest.ts`
- Resume routing: `src/cli/commands/setup-and-utilities/resume/`
- Resume flags: `src/cli/flags/resume-flags.ts`
- Resume dispatch: `src/cli/commands/setup-and-utilities/resume/resume-dispatch.ts`
- OCR resume: `src/cli/commands/setup-and-utilities/resume/extract/ocr-resume.ts`
- Configuration fallback: `src/cli/commands/setup-and-utilities/config/config-merge.ts`
- Aggregate pricing: `src/cli/commands/pricing-orchestration/aggregate-pricing.ts`
- Price worker and result rendering: `test/test-runner/runner.ts`
- Price timestamp formatting: `test/test-runner/utils.ts`
- Price fixtures: `test/test-runner/price-commands/registry/download.ts`, `test/test-runner/price-commands/registry/stt.ts`
- Canonical persistence source guard: `test/test-cases/validation/resume-manifests/no-legacy-persistence-contracts.test.ts`
- Resume provider-surface contracts: `test/test-cases/validation/resume-manifests/resume-provider-surface-contracts.test.ts`
