# ADR-008: Decompose Batch Work into Chunk Units and Concurrency Lanes

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-10
- **Date Updated:** 2026-08-14
- **Verification Status:** Passed

## Context

AutoShow splits pipeline work into smaller units in ten distinct ways and bounds concurrent execution with nine separate controls. `--batch-concurrency` governs batch-capable commands, `--ocr-concurrency` drives an adaptive page scheduler, `--split` produces STT time segments bounded by `--stt-segment-concurrency`, while `--provider-concurrency` and `--local-concurrency` manage target fan-out across providers. Each control is documented on its own command page, but the cross-cutting relationships between them were previously undocumented.

These controls **nest and multiply**. A command combining `--batch-concurrency 10`, `--provider-concurrency 10`, and an OCR page cap of 32 can produce far more concurrent remote requests than any single number indicates. Unbounded nesting previously caused severe head-of-line blocking: on 2026-07-10, `bun autoshow tts "input/text" --provider grok` over 16 inputs (721 chunks, batch concurrency 10, hosted TTS chunk concurrency 30) took 14m 45s against a 4m 57s estimate. Small 3-chunk and 5-chunk files took nearly 14 minutes to complete because early large files dominated the shared provider gate and later files waited for entire file jobs to finish.

This failure revealed a recurring architectural requirement across TTS, OCR, STT, and generic target scheduling: provider-wide pressure management must be decoupled from domain work selection, and outer batch loops must not starve smaller work units or multiply account-level rate limits.

Why now: establishing a shared provider-lane concurrency architecture requires explicitly defining how work decomposition, lane scopes, dynamic fair scheduling, and rate-limit recovery interact across all pipeline commands.

## Options Considered

| Option                                                                                                       | Pros                                                                                                                                                                                | Cons                                                                                                                     | Quantitative Notes                                                                                           |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **Decouple provider pressure from fair domain work queues behind a run-scoped hosted admission coordinator** | Maintains provider-wide safety; prevents large-job queue starvation; admits batch work early; ties wall-time estimates to real queued work; provides actionable scheduler telemetry | Requires domain-specific work selectors and coordination state                                                           | Fixes the 3x estimate miss on 721-chunk / 16-file TTS batches; enables dynamic multi-provider OCR pooling    |
| Keep provider-wide FIFO gates and per-item batch concurrency                                                 | Minimal code change; preserves existing gate architecture                                                                                                                           | Head-of-line blocking persists; wall-time estimates mismodel execution shape; small files remain starved                 | Provider errors can be mitigated by lower caps, but queue unfairness remains                                 |
| Raise default `--tts-chunk-concurrency` globally                                                             | Improves best-case throughput on high-tier provider accounts                                                                                                                        | Increases risk of 429 rate-limit exhaustion; masks underlying scheduling starvation by spending more concurrency         | The failing run already used 30 in-flight provider chunks                                                    |
| Lower `--batch-concurrency` for multi-chunk batches                                                          | Reduces early queue domination by large files                                                                                                                                       | Underutilizes available provider capacity; forces manual multi-flag tuning; slows large jobs                             | Setting `--batch-concurrency 1` eliminates cross-file head-of-line blocking but eliminates batch parallelism |
| Process files shortest-first at the batch layer only                                                         | Simple heuristic; prioritizes short files                                                                                                                                           | Active large files can still monopolize chunk slots once started; risks starving long files under continuous short input | Requires precomputed chunk counts without solving provider-level rate-limit coordination                     |
| Serialize chunk execution per file while keeping multiple files active                                       | Improves cross-file fairness; simple to reason about                                                                                                                                | Sacrifices intra-file chunk parallelism for long documents; degrades wall-time for large inputs                          | Sequential chunking is not used for hosted TTS                                                               |
| One universal monolithic scheduler for TTS, OCR, and STT                                                     | Single scheduler implementation to maintain                                                                                                                                         | The domains require incompatible fairness, polling, chunking, and failure semantics                                      | Domain-specific selectors share a common lane vocabulary and admission coordinator instead                   |

## Decision

Adopt a two-layer concurrency architecture: a shared, run-scoped hosted admission and pressure coordinator (`HostedConcurrencyCoordinator`) that governs provider/account lane rate limits, ramp-up, and 429 recovery, combined with domain-specific work selectors (hosted TTS work queue, pooled/fan-out OCR scheduler, STT batch coordinator, and dialogue turn selector) that manage unit decomposition, ordering guarantees, and fair work dispatch.

This applies to:

- Every work decomposition mechanism: batch items, provider targets, STT time segments, hosted TTS text chunks, OCR pages and PDF chunks, comic panel groups, multi-speaker dialogue turns, and chapter/length splits.
- Every concurrency control: `--batch-concurrency`, `--provider-concurrency`, `--local-concurrency`, `--ocr-concurrency`, `--stt-segment-concurrency`, `--stt-preflight-concurrency`, `--tts-chunk-concurrency`, `--url-provider-concurrency`, comic `--concurrency`, and `--concurrency-mode ramp|immediate`.
- The run-scoped hosted admission coordinator and the four domain work selectors: `runProviderTargetScheduler`, `HostedTtsBatchCoordinatorImpl`, `HostedOcrSchedulerImpl`, and `SttBatchCoordinator`.
- Output ordering guarantees, failure policies, and lifecycle scope (run-scoped vs document/batch-scoped).

It explicitly does not cover:

- Provider billing or pricing calculations beyond feeding accurate queue models into wall-time estimates.
- Provider registry definitions (ADR-010) or error classification taxonomies (ADR-006).
- Paid-provider live verification. Verification relies on deterministic local tests and mocked network calls.

### Decomposition Inventory

The table below catalogs every mechanism that decomposes work into smaller execution units:

| Mechanism                 | Unit Produced                               | Control                                                            | Default                                              | Implementation                                                                                                                                                                       |
| ------------------------- | ------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Batch item fan-out        | Single input file/URL through full pipeline | `--batch-concurrency`                                              | `10`                                                 | `src/cli/commands/process-steps/step-1-download/download-targets/download-batch/process-download-batch.ts`                                                                           |
| Provider target fan-out   | One `(service, model)` target per item      | `--provider-concurrency`, `--local-concurrency`                    | `10` / `10`                                          | `src/cli/commands/process-steps/provider-target-scheduler.ts`                                                                                                                        |
| STT audio splitting       | Contiguous time segment                     | `--split` + automatic policy triggers                              | 30 min (shrunk per provider limits)                  | `src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-split-policy.ts`, `src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/audio-splitter.ts`               |
| STT segment execution     | Single audio segment request                | `--stt-segment-concurrency`                                        | `10` (local and Mistral clamp to `1`)                | `src/cli/commands/process-steps/step-2-extract/step-2-stt/run-stt/split-execution.ts`                                                                                                |
| Hosted TTS text chunking  | Text chunk                                  | `--tts-chunk-concurrency`                                          | `30` (`50` for Grok-only hosted TTS)                 | `src/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking.ts`, `src/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-scheduler.ts`                           |
| OCR page processing       | Single document page                        | `--ocr-concurrency`                                                | Local `10`; hosted `auto`                            | `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/page-processor.ts`, `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-scheduler.ts` |
| Pooled multi-provider OCR | Dynamically claimed document page           | `--ocr-provider-mode pool`, target & OCR caps                      | Mode `fanout`; target caps `10`/`10`; OCR cap `auto` | `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-provider-pool.ts`, `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-pooled-batch.ts`                      |
| PDF page-chunk fallback   | Single-page PDF or rendered PNG             | Inherits OCR page cap                                              | Forced per-page above 20 pages                       | `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/pdf-chunk-fallback.ts`                                                                                           |
| Chapter/export splitting  | Chapter text file                           | `--chapters`, `--length`, `--pdf-chapter-mode`                     | `--pdf-chapter-mode local`                           | `src/cli/commands/process-steps/step-2-extract/step-2-ocr/chapter-export-defaults.ts`, `src/cli/commands/process-steps/step-2-extract/step-2-ocr/chapter-artifact-filenames.ts`      |
| Comic panel grouping      | N panels per generated image                | `--panels-per-image`, comic `--concurrency`                        | `10`                                                 | `src/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/comic-page-utils.ts`                                                                                     |
| Multi-speaker TTS turns   | Single dialogue turn                        | `--tts-chunk-concurrency` (hosted) / `--local-concurrency` (local) | `30` / `10`                                          | `src/cli/commands/process-steps/step-4-tts/run-multi-speaker-tts.ts`, `src/cli/commands/process-steps/step-4-tts/dialogue-work-selector.ts`                                          |

Output ordering and failure semantics differ deliberately per mechanism:

| Mechanism               | Output Ordering                                                                          | Failure Policy                                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Batch items             | Re-associated by array index; manifest order is preserved regardless of completion order | Never fails fast; tallies outcomes into `ok`/`partial`/`incomplete`/`fail`; throws only when `ok === 0 && fail > 0`                           |
| Provider targets        | Results written back by original index; output matches target input order                | Per-target `try`/`catch`; a failing target never aborts siblings                                                                              |
| STT segments            | Merged by sorting on `segmentIndex`                                                      | First error aborts scheduling and rethrows                                                                                                    |
| Hosted TTS chunks       | Concatenated in chunk order per file                                                     | A failed chunk cancels only its owning file job                                                                                               |
| Multi-speaker TTS turns | Written back by source index before concatenation                                        | First failure aborts shared signal, drains active turns, cleans all `.work-*` directories, and rethrows                                       |
| OCR pages               | Written into pre-sized results array by page index                                       | First error stops scheduling, in-flight work drains, remaining pages marked `canceled` in audit                                               |
| Pooled OCR pages        | Assembled by original page number into composite result                                  | Page failure requeues to another target; target/lane blockers retire target/lane; pages become exhausted only when no eligible target remains |

*Deliberately absent:* There is no video scene/shot splitting (one clip per target), no music generation segmentation (one request per target), and no prompt chunking in `step-3-write` (whole prompts sent).

### Concurrency Layer Model

The controls nest from outermost to innermost:

```text
--batch-concurrency            items in flight              processBatch / runWithSemaphore
  └─ --provider-concurrency    hosted targets per item      runProviderTargetScheduler (hosted pool)
     --local-concurrency       local targets per item       runProviderTargetScheduler (local pool)
        └─ pooled OCR shared page queue   one claim per page  runOcrPagePool
           ├─ independent OCR lane A      up to lane cap      adaptive/fixed hosted scheduler
           ├─ independent OCR lane B      up to lane cap      adaptive/fixed hosted scheduler
           └─ same-account models         share one lane cap  service:scopeLabel identity
        └─ generation resource gate  cross-step 4/5/6/7 cap  createResourceGate (FIFO semaphore)
           ├─ dialogue turn selector    hosted/local turn cap  runDialogueWorkSelector
           ├─ --tts-chunk-concurrency   class cap; shared hosted lane        HostedTtsBatchCoordinatorImpl
           ├─ --ocr-concurrency         auto/fixed cap; shared hosted lane   HostedOcrSchedulerImpl
           ├─ STT slot profiles         launch 1-4, poll min(8, batchConc)  SttBatchCoordinator
           └─ --stt-segment-concurrency split segments per provider         split-execution.ts
              └─ withRetry              per-request backoff and jitter      retries.ts
```

- **Layer 1 (Batch Items):** `--batch-concurrency` bounds active file/URL pipelines in `processBatch`. Standalone `image`, `video`, and `music` have no batch path; `comic` uses its own `--concurrency`.
- **Layer 2 (Provider Targets):** `runProviderTargetScheduler` splits targets into concurrent hosted and local pools, sorting by priority then index to start slower engines earlier. An optional `resourceGate` caps concurrent work across steps 4–7.
- **Layer 3 (Provider Lanes & Inner Work):** Run-scoped hosted coordinator tracks provider/account pressure, while domain selectors manage fine-grained chunk and page dispatch.

### Shared Hosted Admission and Pressure Model

All hosted network requests governed by concurrency controls pass through the run-scoped `HostedConcurrencyCoordinator`. Covered work includes model targets, OCR pages, STT segments, TTS chunks/turns, and generation tasks. Local providers, local rendering, and preflight checks execute immediately.

- **Lane Scoping:** Lanes are keyed by `service:scopeLabel` (e.g., `openai:configured-account` or `mistral:env-api-key`). OCR and TTS share lanes across batch items; STT adapts its provider/model slot policy into scope labels. Explicit stable non-secret labels isolate accounts without exposing credentials.
- **Concurrency Modes (`ramp|immediate`):** In `ramp` mode (the default), each lane admits one request immediately and adds one live slot every five seconds under queued demand, capping at the configured maximum. In `immediate` mode, lanes start directly at the cap.
- **Pressure Recovery:** HTTP 429 and classified rate-limit responses halve the lane's live limit (`max(1, floor(limit / 2))`), pause new admissions, and allow active requests to drain. Delays observe `Retry-After` headers as a floor, with exponential jitter backoff (2, 4, 8, 16, 30s) bounded to a 5-minute recovery window. A successful probe clears the pressure streak and resumes 5-second slot ramping. Non-rate-limit errors (401, 403, 5xx, timeouts) follow their domain retry policies without triggering lane halving.
- **Telemetry:** Additive `hostedConcurrency` telemetry records mode, lane identities, live limits, active/queued peaks, ramp transitions, backoff events, and probe outcomes.

### Domain Work Selectors

#### Hosted TTS Work Queue

The hosted TTS coordinator (`HostedTtsBatchCoordinatorImpl`) decouples chunk dispatch from whole-file batch lifecycles:

- **Dynamic Fair-Share Window:** For each dispatch, the coordinator computes `ceil(currentLimit / runnableJobs)`. A job reaching its window is paused while other runnable jobs remain below theirs.
- **Starvation Prevention:** Jobs denied scheduling accumulate integer dispatch debt. When a job's debt reaches the runnable-job count, it is scheduled ahead of standard comparator ordering, ensuring deterministic progress without wall-clock drift.
- **Immutable Admission Tokens:** Each chunk receives a unique token containing lane ID, internal job ID, and chunk index, ensuring retries and rate-limit events attribute exactly to the responsible file.
- **Chunk Limits:** Character-based chunking uses a 2000-character ceiling (200 for Groq), splitting on newlines or spaces.

#### Pooled OCR Page Selector

In `--ocr-provider-mode pool` (ADR-016), OCR targets do not process whole documents independently:

- **Shared Page Ledger:** A single source-ordered page queue is maintained per document. Eligible target workers dynamically claim pending pages.
- **Lane Multiplication vs Sharing:** Independent hosted lanes (e.g., Google and Mistral) multiply page concurrency up to their respective caps, while models sharing a `service:scopeLabel` lane share a single lane limit.
- **Claim Lifecycle:** Claims are checkpointed with unique claim IDs. Completed pages commit only if their claim ID matches and the page lacks an accepted result, preventing stale duplicate overwrites.

#### STT and Multi-Speaker Dialogue Selectors

- **STT Splitting and Offsetting:** `--split` defaults to 30-minute segments, dynamically reduced based on provider attachment/duration budgets. If rejected, adaptive halving passes reduce segment length down to a 60-second floor. Timestamp offsetting occurs inside provider adapters; diarization speaker identities remain per-segment.
- **Multi-Speaker Dialogue Turns:** `runDialogueWorkSelector` manages turn execution with bounded concurrency (`--tts-chunk-concurrency` for hosted). It assigns isolated `.work-*` workspaces per turn, preserves source ordering upon completion, and aborts and cleans workspaces immediately on error.

## Rationale

- **Concurrency Layers Multiply:** Documenting controls in isolation conceals exponential multiplication (e.g., batch concurrency × provider concurrency × page cap). A centralized inventory and layer model makes interactions explicit.
- **Decoupling Safety from Fairness:** Provider-wide caps prevent remote rate-limit violations, but FIFO waiter queues allow large files to dominate capacity. Dynamic fair-share windows ensure small jobs complete promptly while keeping provider capacity saturated.
- **Global Work Visibility:** Pre-chunking all batch inputs allows the scheduler to avoid head-of-line bias and produce accurate wall-time estimates from actual queued work.
- **Domain-Specific Adaptation:** TTS, OCR, and STT require fundamentally different ordering, failure, and backfill semantics; sharing a lane vocabulary and admission coordinator provides safety without forcing artificial algorithmic unification.

## API / Type Impact

- `HostedConcurrencyMode`, admission tokens, coordinator, and telemetry types are public through `~/types`. The shared mode is configured via `--concurrency-mode` and persisted at `defaults.concurrency.mode`.
- The run-scoped coordinator instance is threaded through options so batch children, multi-stage pipelines, and resume processes share lane pressure state within a command execution.
- `--tts-chunk-concurrency` defines the provider-wide hosted maximum for the current run, not a per-file limit.
- `--batch-concurrency` governs file lifecycle and local-work parallelism for hosted TTS batches, not remote request concurrency.
- `--ocr-concurrency` maintains a two-state contract: omitted means adaptive `auto` sizing, while an explicit numeric value establishes a `fixed` hard cap.
- `--ocr-provider-mode fanout|pool` selects full-document replication vs dynamic shared-page pooling.
- `provider-lane-contract.ts` and `provider-lane-contract-types.ts` define scheduler-neutral lane identity, admission, completion, pressure, and telemetry contracts consumed by domain adapters.

## Consequences

Positive outcomes:

- Eliminates head-of-line blocking: small files complete in seconds rather than waiting behind large batch jobs.
- Hosted providers are protected by run-scoped concurrency caps and adaptive 429 backoff.
- Large jobs retain high throughput by utilizing idle lane capacity when other jobs are satisfied.
- Accurate wall-time estimates reflect total queued chunks, provider throughput profiles, and ramp dynamics.
- Clear documentation of nested concurrency interactions prevents accidental over-concurrency.
- Exact admission tokens allow provider retries and rate limits to be attributed precisely to specific jobs and chunks.
- Run-scoped OCR lanes prevent multi-document batch runs from multiplying account-level rate limits.

Negative outcomes:

- Schedulers carry additional internal state (dispatch debt, dynamic windows, probe state).
- Domain implementations must keep chunk/page preparation decoupled from scheduling.
- Additional telemetry and diagnostics increase run metadata surface area.
- Concurrency defaults must remain conservative to accommodate unannounced provider account limits.

## Trade-offs

| Gains                                                   | Sacrifices                                                        |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| Provider-safe concurrency with fair cross-file progress | Additional coordinator state and domain-specific work selectors   |
| Fast completion times for small files                   | Slightly reduced raw burst priority for the initial large file    |
| Wall-time estimates based on actual queue mechanics     | Requirement to model and sample provider throughput profiles      |
| Actionable post-run diagnostics and telemetry           | Increased run metadata surface area                               |
| Preserved user-facing flag ergonomics                   | Internal reinterpretation of `--batch-concurrency` for hosted TTS |
| Dynamic multi-provider OCR throughput                   | Bookkeeping for page claims, attempts, and target retirement      |

## Implementation Note

- `src/cli/commands/process-steps/hosted-concurrency-coordinator.ts` implements shared admission, 5-second ramping, exact-request pressure attribution, bounded recovery, and telemetry. `src/utils/hosted-concurrency-estimator.ts` provides the clean-ramp estimator for price planning.
- `src/cli/commands/process-steps/step-4-tts/tts-batch-summary.ts` simulates the fair work selector to produce wall-time estimates, and `src/cli/commands/process-steps/step-4-tts/define-tts-command.ts` emits scheduler summaries after batch runs.
- `src/cli/commands/process-steps/step-4-tts/dialogue-work-selector.ts` and `src/cli/commands/process-steps/step-4-tts/run-multi-speaker-tts.ts` implement bounded multi-speaker turn fan-out with isolated workspaces.
- `src/cli/commands/process-steps/step-1-download/download-targets/download-batch/batch-executor.ts` initializes the run-scoped OCR coordinator with per-document queue adapters for batch extract/write.
- `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-provider-pool.ts` and `ocr-pooled-batch.ts` implement pooled OCR page claims, attempt tracking, and canonical checkpoints.
- `src/cli/commands/process-steps/provider-lane-contract.ts` and `src/types/generation-core/provider-lane-contract-types.ts` provide the scheduler-neutral contract consumed by domain adapters.

## Test Plan

Run standard verification and targeted contract suites:

```bash
bun run check
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

- **Fair Work Selector Unit Tests:**
  - Verify same-lane jobs under a fixed cap receive equal initial chunk allocations.
  - Verify short files (1–3 chunks) complete before concurrent large files.
  - Verify long files make deterministic progress under continuous short-file arrival.
  - Verify active requests never exceed `--tts-chunk-concurrency`.
- **Pressure and Recovery Unit Tests:**
  - Verify 429 responses halve active lane capacity down to 1.
  - Verify `Retry-After` pauses admissions without cancelling in-flight work.
  - Verify successful recovery probes restore 5-second ramping toward the configured cap.
  - Verify admission tokens attribute retries and rate limits to exact jobs.
- **Shared Coordinator Unit Tests:**
  - Verify ramp mode reaches 12 slots after 55s of queued demand; immediate mode starts at cap.
  - Verify provider/account lanes remain strictly isolated.
  - Verify non-rate-limit errors (401, 403, 5xx, timeouts) do not trigger lane halving.
- **Domain Selector Contract Tests:**
  - Verify run-scoped OCR coordinator bounds aggregate active pages across multiple document adapters.
  - Verify pooled OCR claims, attempt isolation, and duplicate-commit prevention.
  - Verify multi-speaker turn selector bounds concurrency, preserves source ordering, and cleans workspaces on error.
- **Verification Commands:**
  - `bun run check`
  - `bun t --price`
  - `git diff --check`
  - Targeted test suites under `test/test-cases/validation/providers/tts-provider-contracts/` and `test/test-cases/validation/cli/`

Verification evidence recorded on 2026-08-14 using `bun run check`, `bun t --price`, option-resolution test suites, local scheduler contract suites, and `git diff --check`. No paid or quota-limited network calls are used in verification.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — Pipeline state, resume, and price preflight simulation
- Related ADR: [ADR-006](ADR-006-unify-error-handling-vocabulary.md) — Unified error handling and retry vocabulary
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md) — Extraction domain architecture and OCR execution contracts
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — Model registry, capabilities, and provider identities
- Related ADR: [ADR-014](ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md) — Multi-speaker script-to-audio contracts and generation slots
- Related ADR: [ADR-016](ADR-016-distribute-ocr-pages-across-a-multi-provider-work-pool.md) — Multi-provider OCR page pool architecture
- Concurrency defaults: `src/utils/concurrency-defaults.ts`
- Shared hosted coordinator: `src/cli/commands/process-steps/hosted-concurrency-coordinator.ts`, `src/types/generation-core/hosted-concurrency-types.ts`
- Price ramp estimator: `src/utils/hosted-concurrency-estimator.ts`
- Flag definitions and resolution: `src/cli/flags/shared-flags.ts`, `src/cli/flags/tts-flags.ts`, `src/cli/options/option-resolution/concurrency.ts`
- Batch executor: `src/cli/commands/process-steps/step-1-download/download-targets/download-batch/process-download-batch.ts`, `batch-executor.ts`
- Target scheduler and resource gate: `src/cli/commands/process-steps/provider-target-scheduler.ts`, `src/utils/resource-gate.ts`, `src/cli/commands/process-steps/step-3-write/generation-resource-gate.ts`
- Provider lane contract: `src/cli/commands/process-steps/provider-lane-contract.ts`, `src/types/generation-core/provider-lane-contract-types.ts`
- Hosted TTS coordinator: `src/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-scheduler.ts`, `hosted-tts-retry.ts`
- Multi-speaker dialogue selector: `src/cli/commands/process-steps/step-4-tts/dialogue-work-selector.ts`, `src/cli/commands/process-steps/step-4-tts/run-multi-speaker-tts.ts`
- Hosted OCR scheduler & pooled batch: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-scheduler.ts`, `ocr-provider-pool.ts`, `ocr-pooled-batch.ts`
- STT batch coordinator & splitting: `src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-batch/stt-batch-coordinator.ts`, `src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-split-policy.ts`, `split-execution.ts`
