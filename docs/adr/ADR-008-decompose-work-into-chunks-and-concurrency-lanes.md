# ADR-008: Decompose Batch Work into Chunk Units and Concurrency Lanes

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-10
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed

## Context

AutoShow splits pipeline work into smaller units and bounds concurrent execution with nested flags. `--batch-concurrency` governs batch-capable commands, `--ocr-concurrency` drives page work, `--split` produces STT time segments bounded by `--stt-segment-concurrency`, and `--provider-concurrency` / `--local-concurrency` fan out provider targets. Each flag is documented on its command page, but the flags **nest and multiply**.

A command combining `--batch-concurrency 10`, `--provider-concurrency 10`, and an OCR page cap of 32 can issue far more concurrent remote requests than any one number suggests. Unbounded nesting previously caused head-of-line blocking: on 2026-07-10, `bun autoshow tts "input/text" --provider grok` over 16 inputs (721 chunks, batch concurrency 10, hosted TTS chunk concurrency 30) took 14m 45s against a 4m 57s estimate. Small 3-chunk and 5-chunk files took nearly 14 minutes because early large files held the shared provider gate until their whole-file jobs finished.

Provider-wide pressure must be decoupled from domain work selection. Outer batch loops must not starve smaller work units or multiply account-level rate limits.

Why now: a shared provider-lane architecture needs an explicit record of how work decomposition, lane scope, fair scheduling, and rate-limit recovery interact across pipeline commands.

## Options Considered

**Option 1 (selected)**

- **Option:** Decouple provider pressure from fair domain work queues behind a run-scoped hosted admission coordinator
- **Pros:** Maintains provider-wide safety; prevents large-job queue starvation; admits batch work early; ties wall-time estimates to real queued work; provides actionable scheduler telemetry
- **Cons:** Requires domain-specific work selectors and coordination state
- **Quantitative Notes:** Fixes the 3x estimate miss on 721-chunk / 16-file TTS batches; enables dynamic multi-provider OCR pooling

**Option 2**

- **Option:** Keep provider-wide FIFO gates and per-item batch concurrency
- **Pros:** Minimal code change; preserves existing gate architecture
- **Cons:** Head-of-line blocking persists; wall-time estimates mismodel execution shape; small files remain starved
- **Quantitative Notes:** Provider errors can be mitigated by lower caps, but queue unfairness remains

**Option 3**

- **Option:** Raise default `--tts-chunk-concurrency` globally
- **Pros:** Improves best-case throughput on high-tier provider accounts
- **Cons:** Increases risk of 429 rate-limit exhaustion; masks scheduling starvation by spending more concurrency
- **Quantitative Notes:** The failing run already used 30 in-flight provider chunks

**Option 4**

- **Option:** Lower `--batch-concurrency` for multi-chunk batches
- **Pros:** Reduces early queue domination by large files
- **Cons:** Underutilizes available provider capacity; forces manual multi-flag tuning; slows large jobs
- **Quantitative Notes:** `--batch-concurrency 1` eliminates cross-file head-of-line blocking but eliminates batch parallelism

**Option 5**

- **Option:** Process files shortest-first at the batch layer only
- **Pros:** Simple heuristic; prioritizes short files
- **Cons:** Active large files can still monopolize chunk slots once started; risks starving long files under continuous short input
- **Quantitative Notes:** Requires precomputed chunk counts without solving provider-level rate-limit coordination

**Option 6**

- **Option:** Serialize chunk execution per file while keeping multiple files active
- **Pros:** Improves cross-file fairness; simple to reason about
- **Cons:** Sacrifices intra-file chunk parallelism for long documents; degrades wall-time for large inputs
- **Quantitative Notes:** Sequential chunking is not used for hosted TTS

**Option 7**

- **Option:** One universal monolithic scheduler for TTS, OCR, and STT
- **Pros:** Single scheduler implementation to maintain
- **Cons:** The domains require incompatible fairness, polling, chunking, and failure semantics
- **Quantitative Notes:** Rejected; domain selectors share a lane vocabulary and admission coordinator instead

## Decision

Adopt a two-layer concurrency architecture: a run-scoped hosted admission coordinator that governs provider/account rate limits, ramp-up, and 429 recovery, plus domain-specific work selectors that decompose units, preserve output order, and dispatch fairly.

This applies to:

- Work decomposition: batch items, provider targets, STT time segments, hosted TTS text chunks, OCR pages, comic panel groups, multi-speaker dialogue turns, and chapter/length splits.
- Public concurrency controls: `--batch-concurrency`, `--provider-concurrency`, `--local-concurrency`, `--ocr-concurrency`, `--stt-segment-concurrency`, `--tts-chunk-concurrency`, comic `--concurrency`, and `--concurrency-mode ramp|immediate`.
- Hidden sibling caps: `--stt-preflight-concurrency` and `--url-provider-concurrency`.
- Output ordering, failure policy, and run-scoped lane lifetime (one command execution, including batch children).

It does not apply to:

- Provider billing beyond feeding queue models into wall-time estimates.
- Provider registry definitions ([ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)) or error classification taxonomies ([ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md)).
- Explicit TTS duplicate-spend authorization (`--allow-ambiguous-redispatch`), owned by [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md) and [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md). Lane pressure recovery does not itself re-authorize duplicate spend.
- Pooled OCR claim, resume, and artifact contracts, owned by [ADR-015](ADR-015-distribute-ocr-pages-across-a-multi-provider-work-pool.md).
- Video scene splitting, music segmentation, or write-prompt chunking: those domains send one request per target.
- Paid-provider live verification. Verification uses deterministic local tests and mocked network calls.

### Nested controls

Flags nest from outermost to innermost. Independent provider/account lanes multiply; models that share an account share one cap.

```text
--batch-concurrency                 files/URLs in flight
  └─ --provider-concurrency         hosted targets per item
     --local-concurrency            local targets per item
        └─ pooled OCR pages         one page claimed at a time; independent lanes multiply, same-account lanes share
        └─ inner hosted work        one shared provider/account lane
           ├─ --tts-chunk-concurrency
           ├─ --ocr-concurrency
           ├─ --stt-segment-concurrency
           └─ dialogue turns        same TTS chunk cap
```

Standalone `image`, `video`, and `music` have no batch path. Comic uses `--concurrency` instead of `--batch-concurrency`. Local engines, rendering, and preflight probes are not held by the hosted ramp.

### Hosted admission

Every hosted request governed by these controls shares one run-scoped coordinator. Lanes are keyed by provider plus account identity so two models on the same credentials share a cap, while independent providers ramp independently. Explicit stable non-secret labels isolate accounts without exposing credentials.

`--concurrency-mode ramp` (default) admits one request per lane immediately and adds one live slot every five seconds while demand is queued, up to the configured cap. `--concurrency-mode immediate` starts at the cap. The mode is persisted at `defaults.concurrency.mode`. Resume starts a fresh ramp and does not restore prior rate-limit pressure.

HTTP 429 and classified rate-limit responses halve the lane's live limit (`max(1, floor(limit / 2))`), pause new admissions, and let in-flight work drain. Delays honor `Retry-After` as a floor, then exponential jitter (2, 4, 8, 16, 30s) bounded to a five-minute recovery window. A successful probe clears the pressure streak and resumes five-second ramping. Non-rate-limit errors (401, 403, 5xx, timeouts) follow domain retry policy and do not halve the lane. Rate-limit events are attributed to the exact file and chunk that received them.

`--price` models a clean ramp with no rate-limit events. Runs record hosted-concurrency mode, lane identity, live limits, peaks, and ramp or backoff events.

### Work units

**Batch items**

- **Unit:** One input file or URL through the pipeline
- **Control:** `--batch-concurrency` (comic: `--concurrency`)
- **Default:** `7`
- **Ordering:** Results re-associated by original index; manifest order is preserved
- **Failure:** Never fails fast; tallies `ok` / `partial` / `incomplete` / `fail`; throws only when `ok === 0` and `fail > 0`

**Provider targets**

- **Unit:** One `(service, model)` target per item
- **Control:** `--provider-concurrency`, `--local-concurrency`
- **Default:** `7` / `7`
- **Ordering:** Results written back by original index
- **Failure:** A failing target never aborts siblings

**STT segments**

- **Unit:** Contiguous audio time segment
- **Control:** `--split` plus `--stt-segment-concurrency`
- **Default:** 30-minute segments, shrunk to provider limits and halved on rejection down to 60 seconds; segment concurrency `7` (local and Mistral clamp to `1`)
- **Ordering:** Merged by segment index
- **Failure:** First error aborts remaining segments
- Hidden `--stt-preflight-concurrency` (default `7`) bounds duration probes. Timestamp offsetting is applied in adapters; diarization speaker identities stay per-segment.

**Hosted TTS chunks**

- **Unit:** Text chunk, split on provider character limits
- **Control:** `--tts-chunk-concurrency`
- **Default:** `30` (`50` for Grok-only hosted TTS)
- **Ordering:** Concatenated in chunk order per file
- **Failure:** A failed chunk cancels only its owning file
- `--tts-chunk-concurrency` is the run-wide hosted cap for a provider, not a per-file cap. `--batch-concurrency` keeps files active and parallelizes local work; it does not cap remote TTS requests. Dispatch waits until every file's chunks are known, then gives each free slot to the earliest-registered file that still has work. A file settles when its own chunks finish.

**Multi-speaker TTS turns**

- **Unit:** One dialogue turn
- **Control:** `--tts-chunk-concurrency`
- **Default:** `30`
- **Ordering:** Written back by source index before concatenation
- **Failure:** First failure aborts remaining turns and cleans isolated turn workspaces
- Voice, rendering, and redispatch contracts belong to [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md). This record only bounds turn concurrency to the shared TTS chunk cap.

**OCR pages**

- **Unit:** One document page (large PDFs fall back to per-page work above 20 pages)
- **Control:** `--ocr-concurrency`
- **Default:** Local `10`; hosted `auto`
- **Ordering:** Assembled by page index
- **Failure:** First error stops scheduling; in-flight work drains; remaining pages are marked canceled
- Omitting `--ocr-concurrency` selects adaptive `auto` sizing. An explicit number is a fixed hard cap.

**Pooled OCR pages**

- **Unit:** Dynamically claimed document page
- **Control:** `--ocr-provider-mode pool`, plus target and OCR caps
- **Default:** Mode `fanout`; OCR target caps `10` / `10`; OCR cap `auto`
- **Ordering:** Assembled by original page number into one composite result
- **Failure:** Page failure requeues to another eligible target; target or lane blockers retire that target or lane; a page is exhausted only when no eligible target remains
- Independent hosted lanes multiply page concurrency up to each lane's cap; models that share an account share one cap. Claim, resume, artifact, and pricing contracts belong to [ADR-015](ADR-015-distribute-ocr-pages-across-a-multi-provider-work-pool.md).

**Chapter and comic splits**

- `--chapters`, `--length`, and `--pdf-chapter-mode` (default `local`) produce chapter files. They are export splits, not hosted-lane work.
- Comic `--panels-per-image` groups panels per generated image (default `1` final / `6` sketch) and comic `--concurrency` (default `7`) bounds that work.

## Rationale

- **Concurrency layers multiply.** Documenting each flag in isolation conceals batch × provider × page-or-chunk caps. A single inventory and nesting model makes the product explicit.
- **Safety is not the same as work selection.** Provider-wide caps prevent rate-limit violations, but queueing whole files behind one gate lets an early large file hold capacity for its entire lifetime. Queueing chunks keeps the lane saturated while each file finishes on its own work.
- **Global work visibility.** Knowing every chunk before dispatch avoids head-of-line bias and lets wall-time estimates use the real queue, including ramp dynamics.
- **Domain-specific adaptation.** TTS, OCR, and STT need different ordering and failure rules. Sharing lanes and admission policy provides safety without one monolithic scheduler.

## Consequences

Positive outcomes:

- A file settles as soon as its own chunks finish instead of waiting for other files' jobs to drain.
- Hosted providers stay inside run-scoped caps with adaptive 429 backoff.
- Large jobs keep throughput because any free lane slot is refilled by the next runnable chunk.
- Wall-time estimates reflect queued work, provider throughput, and ramp dynamics.
- Nested flags can be reasoned about without accidentally over-subscribing an account.
- Batch OCR across documents does not multiply the same account's rate limit.

Negative outcomes:

- Dispatch still prefers earlier-registered inputs while a lane is saturated.
- `--batch-concurrency` no longer means remote TTS request concurrency.
- Concurrency defaults stay conservative to accommodate unannounced provider account limits.
- Runs emit additional scheduler telemetry.

## Trade-offs

**Trade-off 1**

- **Gain:** Provider-safe concurrency with fair cross-file progress
- **Sacrifice:** Domain-specific work selectors instead of one FIFO gate

**Trade-off 2**

- **Gain:** Files settle independently as soon as their own chunks finish
- **Sacrifice:** Dispatch order still favors earlier-registered inputs while a lane is saturated

**Trade-off 3**

- **Gain:** Wall-time estimates based on actual queue mechanics
- **Sacrifice:** Estimates must model provider throughput and clean-ramp behavior

**Trade-off 4**

- **Gain:** Existing flag names and defaults stay usable
- **Sacrifice:** `--batch-concurrency` is file lifecycle for hosted TTS, not remote request concurrency

## Implementation Note

The run-scoped hosted admission coordinator, five-second ramp, exact-request 429 recovery, and telemetry live in `src/cli/commands/process-steps/hosted-concurrency-coordinator.ts`. Clean-ramp price estimates use `src/utils/hosted-concurrency-estimator.ts`. Flag defaults live in `src/utils/concurrency-defaults.ts` and resolve through `src/cli/options/option-resolution/concurrency.ts`.

Hosted TTS chunk dispatch is in `src/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-scheduler.ts`. Multi-speaker turns use `src/cli/commands/process-steps/step-4-tts/dialogue-work-selector.ts`. Hosted OCR page scheduling is in `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-scheduler.ts`. STT segment execution is in `src/cli/commands/process-steps/step-2-extract/step-2-stt/`. Provider target fan-out is in `src/cli/commands/process-steps/provider-target-scheduler.ts`.

## API / Type Impact

- `--concurrency-mode ramp|immediate` defaults to `ramp` and is persisted at `defaults.concurrency.mode`.
- `--tts-chunk-concurrency` is the run-wide hosted maximum for the current provider, default `30` (`50` for Grok-only hosted TTS).
- `--batch-concurrency` bounds how many files stay active. For hosted TTS it does not cap remote chunk requests.
- `--ocr-concurrency` omitted means adaptive `auto`; an explicit number is a fixed cap.
- `--ocr-provider-mode fanout|pool` selects full-document replication versus shared-page pooling; pool mode still uses these lanes.
- Hidden `--stt-preflight-concurrency` and `--url-provider-concurrency` remain the STT probe and URL-target caps.

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/runtime-contracts/hosted-concurrency-contracts.test.ts
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

1. Hosted TTS registers every expected chunk before dispatch, keeps same-lane work in registration order, concatenates chunks in chunk order, and never exceeds `--tts-chunk-concurrency`.
2. Ramp mode grows one slot every five seconds under queued demand; immediate mode starts at the cap; provider/account lanes stay isolated.
3. 429 responses halve a lane down to 1, honor `Retry-After` without cancelling in-flight work, resume ramping after a successful probe, and leave non-rate-limit errors to domain retry policy.
4. Option resolution preserves `--concurrency-mode`, `--tts-chunk-concurrency`, `--batch-concurrency`, `--ocr-concurrency auto|n`, and the hidden STT/URL caps.

Do not run live paid provider, smoke, or e2e tests that call third-party APIs.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — Pipeline state, resume, and price preflight simulation
- Related ADR: [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md) — Unified error handling, retry vocabulary, and TTS duplicate-spend authorization
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md) — Extraction domain architecture and OCR execution contracts
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — Model registry, capabilities, and provider identities
- Related ADR: [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md) — Multi-speaker script-to-audio contracts and generation slots
- Related ADR: [ADR-015](ADR-015-distribute-ocr-pages-across-a-multi-provider-work-pool.md) — Multi-provider OCR page pool architecture
- `src/utils/concurrency-defaults.ts`
- `src/cli/commands/process-steps/hosted-concurrency-coordinator.ts`
- `src/utils/hosted-concurrency-estimator.ts`
- `src/cli/options/option-resolution/concurrency.ts`
- `src/cli/commands/process-steps/provider-target-scheduler.ts`
- `src/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-scheduler.ts`
- `src/cli/commands/process-steps/step-4-tts/dialogue-work-selector.ts`
- `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-scheduler.ts`
- `src/cli/commands/process-steps/step-2-extract/step-2-stt/`
- `test/test-cases/validation/runtime-contracts/hosted-concurrency-contracts.test.ts`
