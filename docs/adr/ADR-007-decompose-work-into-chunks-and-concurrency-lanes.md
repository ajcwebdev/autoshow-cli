# ADR-007: Decompose Batch Work into Chunk Units and Concurrency Lanes

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-10
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed
- **Supersession:** The intra-step concurrency flag spellings `--ocr-concurrency`, `--stt-segment-concurrency`, `--stt-preflight-concurrency`, `--tts-chunk-concurrency`, and `--sfx-concurrency`, plus `--url-provider-concurrency`, are superseded by [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md), which replaces them with `--step-concurrency <scope>=N` and the shared `--provider-concurrency` lane. The lane architecture, hosted admission coordinator, and fair-queue behavior recorded here remain accepted and unchanged.

## Context

Batch, provider, and intra-step concurrency flags nest and multiply, so `--batch-concurrency 10` with `--provider-concurrency 10` and an OCR page cap of 32 can issue far more concurrent remote requests than any one of those numbers suggests. A provider-wide first-in-first-out gate also starved smaller work: a 16-file hosted TTS run on 2026-07-10 took about three times its estimate because early large files held the shared gate until each whole file finished.

Provider pressure has to stay separate from which unit runs next, so an outer batch loop neither starves smaller units nor multiplies one account's rate limit.

Why now: the shared provider-lane architecture needs one record of how work decomposition, lane scope, fair scheduling, and rate-limit recovery interact across pipeline commands.

## Options Considered

**Option 1 (selected)**

- **Option:** Decouple provider pressure from fair domain work queues behind a run-scoped hosted admission coordinator
- **Pros:** Keeps a provider-wide cap without letting one large file hold it; wall-time estimates follow the real queue
- **Cons:** A work selector per domain and run-scoped lane state
- **Quantitative Notes:** Closes the roughly 3x estimate miss on the 2026-07-10 run

**Option 2**

- **Option:** Keep provider-wide first-in-first-out gates and per-item batch concurrency
- **Pros:** Smallest change
- **Cons:** Head-of-line blocking and starved small files remain
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Raise the default `--step-concurrency tts-chunk` value globally
- **Pros:** Higher best-case throughput on high-tier accounts
- **Cons:** More 429 risk, and extra concurrency hides starvation instead of scheduling around it
- **Quantitative Notes:** The failing run was already at 30 in-flight chunks

**Option 4**

- **Option:** Lower `--batch-concurrency` for multi-chunk batches
- **Pros:** Large files dominate the early queue less
- **Cons:** Leaves provider capacity idle and needs hand tuning per run
- **Quantitative Notes:** `--batch-concurrency 1` removes cross-file blocking and batch parallelism together

**Option 5**

- **Option:** Process files shortest-first at the batch layer only
- **Pros:** Short files start sooner
- **Cons:** A started large file still holds chunk slots, and a stream of short inputs can starve long files
- **Quantitative Notes:** n/a

**Option 6**

- **Option:** Serialize chunk execution per file while keeping multiple files active
- **Pros:** Cross-file fairness is easy to explain
- **Cons:** Gives up intra-file chunk parallelism and lengthens large inputs
- **Quantitative Notes:** Rejected

**Option 7**

- **Option:** One universal scheduler for TTS, OCR, and STT
- **Pros:** One scheduler to maintain
- **Cons:** Those domains need different fairness, polling, chunking, and failure behavior
- **Quantitative Notes:** Rejected; domain selectors share lane vocabulary and admission policy instead

## Decision

Use two layers: a run-scoped hosted admission coordinator for provider and account rate limits, ramp-up, and 429 recovery, and domain work selectors that split work into units, keep output order, and dispatch fairly.

This applies to:

- Work units: batch items, provider targets, STT time segments, hosted TTS text chunks, OCR pages, comic panel groups, sound-effect requests, multi-speaker dialogue turns, and chapter or length splits.
- Public controls: `--batch-concurrency`, `--provider-concurrency`, `--local-concurrency`, `--step-concurrency` (`ocr-page`, `stt-segment`, `stt-preflight`, `tts-chunk`, `sfx`), and `--concurrency-mode ramp|immediate`.
- Output order, failure behavior, and lane lifetime for one command execution, including its batch children.

It does not apply to:

- Provider billing, except that queue shape feeds wall-time estimates.
- Provider registry definitions ([ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)) or error classification ([ADR-005](ADR-005-cli-error-result-and-retry-contract.md)).
- Explicit TTS duplicate-spend authorization (`--allow-ambiguous-redispatch`), owned by [ADR-005](ADR-005-cli-error-result-and-retry-contract.md) for retry and redispatch and by [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md) for the paid slots it protects. Lane recovery does not re-authorize duplicate spend.
- Pooled OCR claim, resume, and artifact contracts, owned by [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md).
- Video scene splitting, music segmentation, and write-prompt chunking. Those domains send one request per target.

### Nested controls

Flags nest from outermost to innermost. Independent provider or account lanes multiply. Models that share an account share one cap. Local engines, rendering, and duration probes are not held by the hosted ramp.

```text
--batch-concurrency                      files or URLs in flight
  └─ --provider-concurrency              hosted targets per item, including URL backends
     --local-concurrency                 local targets per item
        └─ pooled OCR pages              one page claimed at a time
        └─ inner hosted work             one shared provider or account lane
           ├─ --step-concurrency tts-chunk
           ├─ --step-concurrency ocr-page
           ├─ --step-concurrency stt-segment
           ├─ --step-concurrency sfx
           └─ dialogue turns             same TTS chunk cap
```

Standalone `image`, `video`, and hosted `music` have no `--batch-concurrency` path. Local lyric-video rendering uses `music --batch` without that cap. Comic image and panel work uses `--provider-concurrency` (default `7`) instead of `--batch-concurrency`.

### Hosted admission

Every hosted request under these controls shares one coordinator for the command run, including comic LLM, image, QA, dialogue, and sound-effect work. A lane is keyed by provider plus account, so two models on the same credentials share a cap and independent providers ramp on their own.

`--concurrency-mode ramp` (default) admits one request on a lane immediately, then adds one live slot every five seconds while work is queued, up to the configured cap. `--concurrency-mode immediate` starts at the cap. The mode is stored at `defaults.concurrency.mode`. Resume starts a new ramp and does not restore earlier rate-limit pressure.

HTTP 429 and classified rate-limit responses halve that lane's live limit, never below 1, pause new admissions, and let in-flight work finish. The next delay uses `Retry-After` as a floor, then exponential jitter of 2, 4, 8, 16, and 30 seconds, inside a five-minute recovery window. A successful request clears the backoff and returns to the five-second ramp. Other errors, including 401, 403, 5xx, and timeouts, follow that domain's retry policy and do not halve the lane.

`--price` models a clean ramp with no rate-limit events.

### Work units

**Batch items**

- **Unit:** One input file or URL through the pipeline
- **Control:** `--batch-concurrency` (comic image and panel work uses `--provider-concurrency`)
- **Default:** `7`
- **Ordering:** Results keep their original index, and manifest order is preserved
- **Failure:** The batch does not stop at the first error. It tallies `ok`, `partial`, `incomplete`, and `fail`, and fails only when nothing succeeded and something failed

**Provider targets**

- **Unit:** One `(service, model)` target per item
- **Control:** `--provider-concurrency`, `--local-concurrency`
- **Default:** `7` / `7`
- **Ordering:** Results are written back by original index
- **Failure:** A failing target does not abort its siblings

**STT segments**

- **Unit:** A contiguous audio time range
- **Control:** `--split` and `--step-concurrency stt-segment=N`
- **Default:** 30-minute segments, shrunk to the provider limit and halved on rejection down to 60 seconds; segment concurrency `7`, clamped to `1` for local engines and Mistral
- **Ordering:** Merged by segment index
- **Failure:** The first error aborts the remaining segments

**STT preflight**

- **Unit:** Parallel extract price estimates
- **Control:** `--step-concurrency stt-preflight=N`
- **Default:** `7`
- **Ordering:** n/a; this scope bounds local price estimation and is not a hosted request lane
- **Failure:** n/a

**Hosted TTS chunks**

- **Unit:** A text chunk split on the provider character limit
- **Control:** `--step-concurrency tts-chunk=N`
- **Default:** `30`; `50` for Grok-only hosted TTS; `2` for the all-provider shortcut
- **Ordering:** Concatenated in chunk order within each file
- **Failure:** A failed chunk cancels only its owning file
- The value is the run-wide hosted cap for that provider, not a per-file cap. `--batch-concurrency` keeps files active and does not cap remote TTS requests. Free slots go to earlier-registered files that still have work, and a file is done when its own chunks finish.

**Multi-speaker TTS turns**

- **Unit:** One dialogue turn
- **Control:** `--step-concurrency tts-chunk=N`
- **Default:** `30`
- **Ordering:** Written back by source index before concatenation
- **Failure:** The first failure aborts the remaining turns
- Voice, rendering, and redispatch rules belong to [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md).

**OCR pages**

- **Unit:** One document page. PDFs larger than 20 pages fall back to per-page work
- **Control:** `--step-concurrency ocr-page=N`
- **Default:** Local `10`; hosted `auto`
- **Ordering:** Assembled by page index
- **Failure:** The first error stops new scheduling, in-flight work drains, and the remaining pages are marked canceled
- Omitting the flag selects adaptive `auto` sizing. An explicit number is a fixed cap.

**Pooled OCR pages**

- **Unit:** A document page claimed from a shared queue
- **Control:** `--ocr-provider-mode pool`, plus `--provider-concurrency`, `--local-concurrency`, and `--step-concurrency ocr-page`
- **Default:** Mode `fanout`; OCR target caps `10` / `10`; page cap `auto`
- **Ordering:** Assembled by original page number into one composite result
- **Failure:** Page, target, and lane retirement belong to [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md)
- Independent hosted lanes multiply page concurrency up to each lane's cap. Models on one account share that cap.

**Chapter, comic, and sound-effect splits**

- **Unit:** A chapter file, a comic panel group, or one sound-effect request
- **Control:** `--chapters`, `--length`, and `--pdf-chapter-mode` (default `local`) for chapters; `--panels-per-image` and `--provider-concurrency` for comic panels; `--step-concurrency sfx=N` for sound effects
- **Default:** Comic panel groups `1` final / `6` sketch; comic provider concurrency `7`; sound-effect concurrency `2`
- **Ordering:** Each split keeps its source index
- **Failure:** Sound-effect requests share the hosted lanes above. Chapter files are an export split and do not enter those lanes
- Comic panel groups and sound-effect requests are consumed by [ADR-013](ADR-013-comic-scene-audio-and-presentation.md); this record owns only their lane and cap vocabulary.

## Rationale

- Isolated flag descriptions hide the product of batch, provider, and page or chunk caps. One nesting model is what an operator has to reason about.
- A provider cap stops rate-limit violations, but a whole-file queue still lets one early large file hold that cap. Queuing every chunk before dispatch keeps the lane busy, lets each file finish on its own work, and gives `--price` the queue that will actually run.
- TTS, OCR, and STT need different order and failure rules, so shared lanes and one admission policy provide the cap without forcing those domains through one scheduler. Raising a single default, sorting files by length, or serializing chunks leaves either starvation or idle capacity in place.

## Consequences

Positive outcomes:

- A file finishes when its own chunks finish, without waiting for other files to drain.
- A 429 shrinks the lane instead of failing the run, and a free lane slot is filled by the next runnable chunk.
- Wall-time estimates follow the queued work, provider throughput, and the clean ramp.

Negative outcomes:

- While a lane is full, earlier-registered inputs are still preferred.
- `--batch-concurrency` is no longer the remote TTS request cap.
- Defaults stay conservative because provider accounts can impose limits the CLI is not told about.

## Trade-offs

**Trade-off 1**

- **Gain:** A provider-safe cap with fair progress across files
- **Sacrifice:** A work selector per domain instead of one shared first-in-first-out gate

**Trade-off 2**

- **Gain:** Wall-time estimates follow the queue that will run
- **Sacrifice:** Estimates have to model provider throughput and a clean ramp

**Trade-off 3**

- **Gain:** Intra-step caps share `--step-concurrency <scope>=N`
- **Sacrifice:** For hosted TTS, `--batch-concurrency` is how many files stay active, not how many remote requests run

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/runtime-contracts/hosted-concurrency-contracts.test.ts
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

1. Hosted TTS registers every chunk before dispatch, keeps same-lane work in registration order, concatenates in chunk order, and stays within `--step-concurrency tts-chunk`.
2. Ramp mode adds one slot every five seconds while work is queued, immediate mode starts at the cap, and provider and account lanes stay isolated.
3. A 429 halves a lane down to 1, honors `Retry-After`, leaves in-flight work running, and leaves other errors to the domain retry policy.
4. `--step-concurrency ocr-page` resolves to `auto` when omitted and to a fixed cap when set, alongside `--concurrency-mode` and `--batch-concurrency`.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — Pipeline state, resume, and price preflight
- Related ADR: [ADR-005](ADR-005-cli-error-result-and-retry-contract.md) — Error vocabulary, retry ownership, and TTS duplicate-spend authorization
- Related ADR: [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md) — OCR execution, pooled page claims, and artifacts
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — Model registry and provider identity
- Related ADR: [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md) — TTS chunks, multi-speaker turns, and paid slots
- Related ADR: [ADR-013](ADR-013-comic-scene-audio-and-presentation.md) — Comic panel groups and sound-effect requests on shared lanes
- Related ADR: [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md) — `--step-concurrency <scope>=N` and the retired concurrency spellings
