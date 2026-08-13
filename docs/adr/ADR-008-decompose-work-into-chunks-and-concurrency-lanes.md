# ADR-008: Decompose Batch Work into Chunk Units and Concurrency Lanes

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-10
- **Date Updated:** 2026-08-13
- **Verification Status:** Passed
- **Supersession:** Reframed from the narrower record "Schedule Hosted TTS as a Provider Work Queue" to the broader topic it now serves. The hosted TTS work-queue decision, its trade study, and its scheduling model are preserved below as one documented lane among several.

## Context

This project splits work into smaller units in at least ten distinct ways, and bounds how many of those units run at once with at least nine distinct controls. Until now only one pairing was written down: hosted TTS chunks under `--tts-chunk-concurrency`, sitting inside directory batches under `--batch-concurrency`.

That was too narrow to be useful. `--batch-concurrency` governs every batch-capable command, not just TTS. `--ocr-concurrency` drives a completely separate adaptive page scheduler with its own auto/fixed mode contract. `--split` produces STT time segments that are then bounded by `--stt-segment-concurrency`. `--provider-concurrency` and `--local-concurrency` sit between all of these as a shared middle layer. Each is documented in its own command page, but the relationships between them are documented nowhere.

The relationships are the part that matters, because these controls **nest and multiply**. A run with `--batch-concurrency 10`, `--provider-concurrency 10`, and an OCR page cap of 32 can have far more requests in flight than any single number suggests, because each document builds its own hosted OCR scheduler. The same nesting is what produced the failure this record was originally opened for.

Observed run, 2026-07-10:

- Command: `bun autoshow tts "input/text" --provider grok`
- Inputs: 16
- Batch concurrency: 10
- Hosted TTS chunk concurrency: 30
- Total chunks: 721
- Estimated wall time: 4m 57s
- Actual wall time: 14m 45s
- Largest files in the first wave: 115, 116, 78, 51, and 46 chunks
- Later file with the largest chunk count: 218 chunks

The run was about 3x slower than the estimate, and some small files finished very late — a 3-chunk file took 14m 12s, a 5-chunk file 13m 58s, a 6-chunk file 8m 42s. The cause was head-of-line blocking: each active file could enqueue many chunk workers into the shared provider gate, so the provider-wide cap was safe but the queue was dominated by early, large files. `--batch-concurrency 10` also meant later files were not admitted until earlier whole-file jobs completed, even when those later files were tiny.

That diagnosis produced the hosted TTS work queue described below. But the underlying shape — a provider pressure layer plus a work-selection layer, with an outer batch layer that can starve it — recurs in OCR, in STT, and in the generic target scheduler, each implemented separately and each with slightly different semantics for ordering, failure, and whether state is shared across batch items.

Why now: `docs/adr/README.md` already identifies this gap in its own consolidation analysis, observing that ADR-008 and ADR-009 describe "one two-layer pattern … implemented separately" and recommending a record that defines the shared contract. Documenting the full inventory first is the prerequisite for any such contract, and for correcting two claims in this record's own implementation history that the code does not support.

## Options Considered

Two distinct decisions are recorded here: how to schedule hosted TTS chunks (the original 2026-07-10 trade study), and how to scope the record itself (2026-07-25).

Scheduling hosted TTS chunk work:

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Promote hosted TTS to a batch-level provider work queue with fair chunk scheduling and separate adaptive provider pressure control** | Keeps provider-wide safety; avoids large-file queue domination; admits all batch work early; improves wall-time estimates from the same scheduler model; gives users actionable scheduler summaries | Larger change than the current gate; requires a TTS-specific batch execution path or coordinator; more scheduler state to test | Addresses 721-chunk / 16-file run; targets the 3x estimate miss and late completion of 1-6 chunk files |
| Keep the current provider-wide gate and only tune AIMD/backoff defaults | Smallest change; preserves current architecture | Does not fix head-of-line blocking; estimates still model the wrong execution shape; lower caps may make wall time worse | Can reduce provider errors but not queue unfairness |
| Raise default `--tts-chunk-concurrency` globally or for all provider-specific hosted TTS | May improve best-case speed on accounts that tolerate more load | Risks returning to provider pressure failures; provider/API-key limits vary; hides the scheduling bug by spending more concurrency | The slow run already used 30 in-flight provider chunks; Grok-only TTS later received a narrower implicit default of 50 |
| Lower `--batch-concurrency` for TTS batches | Reduces early queue domination by large files | Leaves provider capacity underused; makes the user tune two interacting flags manually; can slow large books further | `--batch-concurrency 1` would remove cross-file head-of-line blocking but sacrifice batch parallelism |
| Process files shortest-first at the batch layer only | Helps small files complete earlier; simple to explain | Still lets each file enqueue many chunks once active; can starve long files; does not model provider rate limits | Needs precomputed chunk counts but not a true work queue |
| Serialize each file's chunks while keeping multiple files active | Improves cross-file fairness; simple | Throws away the main chunking speedup for long chapters; still has weak estimates | Local Kitten already behaves sequentially; hosted TTS should keep chunk parallelism |

Scoping this record:

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Reframe this record as one current-state inventory of every decomposition mechanism and concurrency lane** | One place to see how the layers nest and multiply; makes the OCR/STT/TTS divergences visible instead of scattered across three records; discharges the README's own Rank 2 recommendation; surfaces the two overstated implementation claims | Larger record; must be revised whenever a new lane or flag is added; mixes a historical trade study with a current-state survey | Covers 7 splitting mechanisms, 9 concurrency controls, 4 schedulers across 8 commands |
| Leave this record TTS-only and open a separate ADR for the shared provider-lane contract | Keeps each record small and single-purpose | A contract record with no inventory behind it would re-derive the same research; leaves `--batch-concurrency`, `--split`, and `--ocr-concurrency` undocumented as a system | Would add another record while leaving the documentation gap open |
| Document each mechanism in its own command page only | No ADR churn; keeps docs close to the flags | This is the current state, and it is exactly why the nesting is undocumented; command pages cannot describe cross-command interactions | 9 command pages already document these flags individually |

## Decision

This record is the current-state description of how the CLI breaks work into units and how many of those units it allows to run at once. It inventories every splitting mechanism, every concurrency control, the four schedulers that implement them, and the points where those layers multiply rather than compose.

This applies to:

- Every mechanism that turns one input into many units of work: batch items, provider targets, STT time segments, hosted TTS text chunks, OCR pages and PDF page chunks, comic panel groups, and chapter/length export splits.
- Every control that bounds those units: `--batch-concurrency`, `--provider-concurrency`, `--local-concurrency`, `--ocr-concurrency`, `--stt-segment-concurrency`, `--stt-preflight-concurrency`, `--tts-chunk-concurrency`, `--url-provider-concurrency`, and comic's `--concurrency`.
- The four schedulers: the generic `runProviderTargetScheduler`, `HostedTtsBatchCoordinatorImpl`, `HostedOcrSchedulerImpl`, and `SttBatchCoordinator`.
- Ordering guarantees, failure policies, and whether scheduler state is shared across batch items or rebuilt per item.

It explicitly does not cover:

- Local Kitten TTS chunk execution. Kitten remains local and sequential unless a separate local-performance ADR changes it.
- Provider billing or pricing calculations beyond using better wall-time estimates.
- Model selection, provider registries, or retry vocabulary, which belong to their own records.
- Any paid-provider verification command. Implementation is validated with mocked provider calls and local/no-cost tests.

## Rationale

- The layers multiply, and only a combined view shows it. `--batch-concurrency` and `--ocr-concurrency` are each individually safe, but because a hosted OCR scheduler is built per document rather than per run, ten concurrent documents can each open their own page cap. The STT coordinator makes the opposite choice and shares one instance across the whole batch. Neither choice is wrong, but the divergence is invisible when each is documented alone.
- Provider safety and work fairness are different problems. A provider-wide cap limits total in-flight calls, but FIFO waiter queues can still let one large file occupy many future starts. A work queue keeps the provider saturated while distributing starts across files deliberately.
- The scheduler needs visibility into all work. If only the first `--batch-concurrency` files are chunked and admitted, a small file outside that first wave cannot be scheduled early. Pre-chunking all inputs gives the scheduler the information needed to avoid long-file bias and to estimate wall time from the real amount of queued work.
- Fairness should not destroy throughput. A bounded per-file window and a fair policy beat one-chunk-at-a-time serialization; long files continue to receive parallel chunks when capacity is available.
- Estimates should share the same model as execution. A pre-run estimate that ignores the provider queue, adaptive backoff, and total chunk work keeps missing reality.
- Recording what is deliberately absent is as valuable as recording what exists. There is no video scene splitting, no music segmentation, and no transcript or context-window chunking in `write`; knowing those are intentional gaps prevents someone from assuming a chunking layer exists where none does.
- Two claims in this record's prior implementation history were not supported by the code. A current-state record that is wrong about the current state is worse than no record, so those claims are corrected below and moved to Follow-up Actions.

## Decomposition Inventory

Every mechanism that turns one unit of work into many.

| Mechanism | Unit produced | Control | Default | Implementation |
|---|---|---|---|---|
| Batch item fan-out | one input file/URL through the full pipeline | `--batch-concurrency` | `10` | `src/cli/commands/process-steps/step-1-download/download-targets/download-batch/process-download-batch.ts` |
| Provider target fan-out | one `(service, model)` pair for one item | `--provider-concurrency`, `--local-concurrency` | `10` / `10` | `src/cli/commands/process-steps/provider-target-scheduler.ts` |
| STT audio splitting | contiguous time segment | `--split` plus automatic policy triggers | 30 min, shrunk per provider | `src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-split-policy.ts`, `src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/audio-splitter.ts` |
| STT segment execution | one segment request | `--stt-segment-concurrency` | `10`; local and `mistral` clamp to `1` | `src/cli/commands/process-steps/step-2-extract/step-2-stt/run-stt/split-execution.ts` |
| Hosted TTS text chunking | text chunk | `--tts-chunk-concurrency` | `30`; `50` for Grok-only hosted TTS | `src/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking.ts`, `src/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-scheduler.ts` |
| OCR page processing | one page | `--ocr-concurrency` | local `10`; hosted `auto` | `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/page-processor.ts`, `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-scheduler.ts` |
| PDF page-chunk fallback | single-page PDF or rendered PNG | inherits the OCR page cap | forced per-page above 20 pages | `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/pdf-chunk-fallback.ts` |
| Chapter/export splitting | chapter file | `--chapters`, `--length`, `--pdf-chapter-mode` | `--pdf-chapter-mode local` | `src/cli/commands/process-steps/step-2-extract/step-2-ocr/chapter-export-defaults.ts`, `src/cli/commands/process-steps/step-2-extract/step-2-ocr/chapter-artifact-filenames.ts` |
| Comic panel grouping | N panels per generated image | `--panels-per-image`, comic `--concurrency` | `10` | `src/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/comic-page-utils.ts` |
| Multi-speaker TTS segments | one dialogue turn | `--tts-chunk-concurrency` for hosted targets; `--local-concurrency` for Kitten | `30` / `10` | `src/cli/commands/process-steps/step-4-tts/run-multi-speaker-tts.ts`, `src/cli/commands/process-steps/step-4-tts/dialogue-work-selector.ts` |

Ordering and failure semantics differ per mechanism, and the differences are load-bearing:

| Mechanism | Output ordering | Failure policy |
|---|---|---|
| Batch items | re-associated by array index, so manifest order is preserved regardless of completion order | never fails fast; outcomes tally into `ok`/`partial`/`incomplete`/`fail`; the caller throws only when `ok === 0 && fail > 0` |
| Provider targets | results written back by original `index`, so output order always matches input target order | per-target `try`/`catch`; a failing target never aborts siblings; callers decide whether to throw |
| STT segments | merged by sorting on `segmentIndex` | first error aborts scheduling and rethrows |
| Hosted TTS chunks | concatenated in chunk order per file | a failed chunk cancels only its owning file |
| Multi-speaker TTS turns | written back by source index before concatenation, regardless of completion order | first failure aborts the shared dialogue signal, prevents queued turns from starting, drains active turns, removes every `.work-*` directory, and rethrows the first failure |
| OCR pages | written into a pre-sized results array, so order is by page index | first error stops scheduling; in-flight work drains; remaining pages marked `canceled` in the audit |

Deliberately absent: there is no video scene or shot splitting (one clip per target), no music generation segmentation (one request per target), and no transcript or context-window chunking in `step-3-write`, which sends whole prompts.

## Concurrency Layer Model

The controls nest from outermost to innermost:

```text
--batch-concurrency            items in flight              processBatch / runWithSemaphore
  └─ --provider-concurrency    hosted targets per item      runProviderTargetScheduler (hosted pool)
     --local-concurrency       local targets per item       runProviderTargetScheduler (local pool)
       └─ generation resource gate  cross-step 4/5/6/7 cap  createResourceGate (FIFO semaphore)
          ├─ dialogue turn selector    hosted/local turn cap  runDialogueWorkSelector
          ├─ --tts-chunk-concurrency   AIMD per TTS provider, run-global   HostedTtsBatchCoordinatorImpl
          ├─ --ocr-concurrency         auto AIMD / fixed cap per OCR lane  HostedOcrSchedulerImpl
          ├─ STT slot profiles         launch 1-4, poll min(8, batchConc)  SttBatchCoordinator
          └─ --stt-segment-concurrency split segments per provider         src/cli/commands/process-steps/step-2-extract/step-2-stt/run-stt/split-execution.ts
             └─ withRetry              per-request backoff and jitter      src/utils/retries.ts
```

Layer 1, batch items. `--batch-concurrency` is defined in `batchFlags` and resolved into the batch option slice consumed by batch-capable commands. `processBatch` runs a strict sequential loop when the value is `1` and `Promise.allSettled` over a polling semaphore when it is greater. The semaphore busy-waits on a 50 ms timer and is not FIFO, so admission order under contention is not guaranteed. The flag is accepted by `metadata`, `download`, `extract`, `write`, `tts`, `resume`, and the STT/OCR flag sets, and is persisted as `defaults.batch.concurrency`. Standalone `image`, `video`, and `music` have no batch path and do not accept it; `comic` uses its own unrelated `--concurrency`.

Layer 2, provider targets. `runProviderTargetScheduler` splits targets into a hosted pool and a local pool that run concurrently, each a bounded worker pool. Within a pool, entries sort by descending `priority` then ascending `index`, which OCR uses to start the slowest providers first. The scheduler contains no retry or backoff of its own. An optional `resourceGate` is acquired inside each worker; `createGenerationResourceGate` uses this to cap total simultaneous work across steps 4 through 7, with capacity set to the maximum of all their provider and local values.

Layer 3, provider lanes and bounded inner work. Four provider schedulers implement the pressure layer, while multi-speaker TTS adds a bounded per-dialogue selector before individual turn invocations. They diverge in three ways worth knowing:

- **Lane scope.** Hosted OCR and TTS key lanes by the shared `service:scopeLabel` identity. OCR defaults to `env-api-key`; TTS defaults to `configured-account`; explicit stable non-secret labels isolate configured account scopes without recording credentials or credential hashes. STT preserves its provider/model slot policy by adapting the model as its scope label.
- **Sharing across batch items.** `SttBatchCoordinator` is created once per batch and shared across all items when there is more than one item and more than one target, so slot accounting is global; it even sizes async poll slots from `--batch-concurrency` directly. Hosted OCR now creates one run-scoped coordinator for document extraction and write batches, then gives each document a scoped queue adapter, so outer batch concurrency cannot multiply the provider/API-key cap. Standalone OCR retains a document-scoped coordinator. `HostedTtsBatchCoordinatorImpl` is run-scoped for directory batches, registered with deferred start behind a one-second registration barrier.
- **Adaptation.** Hosted OCR ramps `+2` per half-cap clean window while fast-ramping and `+1` afterward, halves on 429/503/timeout, and can raise its ceiling to 48 from a matched healthy throughput profile. Hosted TTS ramps `+1` once the success streak reaches the current limit and halves on 429 with a two-second default pause. STT uses fixed per-provider slot profiles with a warm-up gate rather than continuous adaptation, degrading a provider after two consecutive retryable failures and backfilling it in a later resume pass.

`--ocr-concurrency` carries a mode contract the other flags do not have. It has no CLI default, so an unset value is distinguishable from an explicit one: unset means `auto` and lets the scheduler size its own cap from page count, while any explicit value means `fixed` and becomes a hard cap. Local OCR ignores the adaptive path entirely and runs two independent pools, one for rendering sized at `min(cpuCount, 4)` and one for OCR itself.

`--split` is likewise not a simple on/off. Splitting also happens automatically when a file exceeds a provider's attachment cap, duration cap, or request budget, so an unsplit-looking command can still produce segments. The 30-minute default is shrunk per provider by the duration cap, the request budget, and a bytes-per-second estimate against 95% of the attachment cap. When a provider still rejects a segment, up to four adaptive passes halve the segment length down to a 60-second floor.

Segmented multi-speaker TTS uses `runDialogueWorkSelector` as a bounded preparation and invocation layer. Hosted targets use the normalized `--tts-chunk-concurrency` value and Kitten uses `--local-concurrency`. The selector assigns one safe `.work-*` directory per source turn, preserves source order when work completes out of order, shares one `AbortSignal` across active invocations, and removes all temporary workspaces before returning or rethrowing. Segmented hosted calls continue into the run-scoped chunk coordinator beneath this selector. Native ElevenLabs and Hume dialogue rendering bypasses the per-turn selector as one provider-target invocation, uses provider-specific sequential batch/continuation loops, and does not emit unattributed feedback into the chunk coordinator.

Two reassembly details are easy to miss. Timestamp offsetting for split STT happens inside each provider adapter rather than at merge time. Speaker labels are not reconciled across segments: each segment diarizes independently and the capability flag is simply ORed, so speaker identities are per-segment.

## Hosted TTS Scheduling Model

The run-scoped hosted TTS coordinator owns one lane per provider and non-secret scope label. Each lane has two layers:

1. **Pressure controller.** Tracks `maxLimit`, `currentLimit`, active requests, 429 feedback, `Retry-After`, retry delay, success streaks, and provider pause windows.
2. **Work selector.** Tracks files and their remaining chunks. When the pressure controller has capacity, the work selector picks the next eligible file and starts one chunk for it.

The work selector recalculates a dynamic per-job window on every dispatch as `ceil(currentLimit / runnableJobs)`, optionally bounded by the internal `maxActiveChunksPerJob` test/provider override. A job at its window is ineligible while another runnable job remains below its window. Below the starvation threshold, jobs retain the fewest-remaining, fewest-active, fewest-started preference. Every denied dispatch adds integer debt, and a job whose debt reaches the runnable-job threshold wins before the ordinary comparator. A monotonic dispatch sequence breaks ties, so fairness does not depend on wall-clock timing. Original batch order remains the final output order, chunk output remains ordered inside each file, and a failed chunk cancels only its owning file unless the batch failure policy stops the whole run.

This intentionally avoids letting a single `runTtsChunks` call pre-enqueue up to `--tts-chunk-concurrency` waiters. Provider slots are assigned from a central queue at the moment they become available.

When a chunk starts, the coordinator creates an immutable admission token containing the lane identity, internal job identity, public run-local job context, and exact chunk index. Retry and rate-limit feedback must present that token. A coordinator-owned weak association resolves it to the exact job, provider totals aggregate those job events, and no most-recent-active heuristic remains.

Text chunking itself is character-count based. Every provider uses a 2000-character limit except Groq at 200. The splitter prefers the last newline before the limit, falls back to the last space, and hard-cuts otherwise; it has no sentence-boundary or abbreviation awareness.

## API / Type Impact

- The hosted TTS batch coordinator lives near the TTS utility layer, separate from the low-level provider retry helper.
- Hosted TTS target execution registers chunk jobs with the coordinator instead of each provider calling `runTtsChunks` in isolation.
- `--tts-chunk-concurrency` is the provider-wide hosted maximum for the current run, not a per-file value.
- `--batch-concurrency` means file lifecycle and local-work concurrency for hosted TTS batches, not remote provider request concurrency.
- `--ocr-concurrency` carries a two-state mode contract on `ocrConcurrencyMode`: absent means `auto` and the hosted scheduler sizes its own cap; present means `fixed` and the value is a hard cap. The flag intentionally declares no CLI default so the two states stay distinguishable after config merging.
- Multi-speaker turn callbacks receive an immutable explicit invocation and one shared cancellation signal; provider adapters must consume that invocation rather than capture a selection-time voice.
- Scheduler telemetry appears in run metadata: provider max/current limits, started and completed chunks, retry counts, 429 counts, queue wait, active time, pause time, and chunk latency percentiles.
- `provider-lane-contract.ts` and `provider-lane-contract-types.ts` define scheduler-neutral lane identity, admissions, completions, pressure feedback, cancellation, and telemetry vocabulary. TTS, OCR, and STT consume the contract through policy-specific adapters rather than one universal scheduling algorithm.

## Consequences

Positive outcomes:

- Small files are no longer stuck behind a large file's pre-enqueued chunk workers.
- Hosted providers remain protected by provider-wide concurrency and 429-aware backoff.
- Large files keep most of the chunking speedup because idle provider slots can still be filled by long-file chunks.
- Wall-time estimates can be based on total queued chunks, provider throughput, and adaptive capacity rather than per-file assumptions.
- The nesting and multiplication of concurrency layers is documented in one place, so tuning a run no longer requires reading four command pages and inferring the interactions.
- The divergences between the four schedulers are explicit, which is the prerequisite for deciding whether to unify them.
- Exact admission attribution makes provider retry and 429 totals reconcilable to individual TTS jobs and chunks.
- Run-scoped OCR lanes make `--ocr-concurrency` a run-level provider/API-key bound for document extraction and write batches instead of a per-document multiplier.

Negative outcomes:

- The TTS batch path is more specialized than generic `processBatch` item concurrency.
- Provider code must keep chunk production and chunk scheduling separable.
- Tests need deterministic scheduling hooks to avoid timing-sensitive assertions.
- Defaults stay conservative because provider limits vary by account and can change without notice.
- This record now has to be revised whenever a lane, flag, or splitting mechanism is added, and it will drift if that does not happen.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Provider-safe concurrency with fair cross-file progress | More scheduler state and a TTS-specific coordinator |
| Better completion time for tiny and short files | Slightly less raw priority for the earliest large file |
| Estimates tied to actual queue mechanics | Need to persist or sample provider throughput data |
| Actionable post-run diagnostics | More run metadata and summary surface area |
| Preserves user-facing flags | Internals must reinterpret `--batch-concurrency` for hosted TTS remote work |
| One record covering every decomposition mechanism | A longer record mixing a historical trade study with a current-state survey |

## Implementation Note

| Action | Owner | Current State |
|---|---|---|
| Add a `HostedTtsBatchCoordinator` that owns provider lanes, file jobs, chunk jobs, pressure state, and scheduler telemetry | TTS maintainers | Done in `src/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-scheduler.ts` |
| Split hosted provider runners so chunk request execution can be supplied as a callback to the coordinator while preserving ordered concatenation | TTS maintainers | Done via `runTtsChunks` job registration |
| Pre-scan TTS directory inputs to compute hosted chunk counts before provider requests start | TTS maintainers | Done |
| Replace per-file `runTtsChunks` worker fan-out with central work selection that starts chunks only when provider capacity is available | TTS maintainers | Done |
| Keep the existing provider-scoped AIMD/backoff behavior as the pressure-control layer and feed all hosted 429s into it | TTS maintainers | Done via `src/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-retry.ts` |
| Rework hosted TTS wall-time estimates to use total chunks, provider cap, adaptive effective capacity, and observed/provider-profile chunk latency | TTS maintainers | Done in `src/cli/commands/process-steps/step-4-tts/tts-batch-summary.ts` |
| Emit a hosted TTS scheduler summary at the end of batch runs | TTS maintainers | Done in `src/cli/commands/process-steps/step-4-tts/define-tts-command.ts` |
| Add deterministic unit tests for fair queueing, small-file completion, provider-independent lanes, 429 backoff, and success ramp-up | TTS maintainers | Done |
| Add mocked Grok/OpenAI provider contract tests proving concurrent files share the coordinator and preserve final audio order | TTS maintainers | Done |
| Replace unbounded multi-speaker turn fan-out with a bounded, ordered, cancellable selector that owns safe turn workspaces | TTS maintainers | Done in `src/cli/commands/process-steps/step-4-tts/dialogue-work-selector.ts` and `src/cli/commands/process-steps/step-4-tts/run-multi-speaker-tts.ts` |
| Add deterministic selector tests for caps, reverse completion, queued cancellation, invocation signals, and cleanup | TTS maintainers | Done in `test/test-cases/validation/media-generation/tts-dialogue-work-selector.test.ts` |

## Completed Scheduler Alignment

This subordinate implementation completed the previously recommended five-phase scheduler sequence.

- **Completion Status:** Implemented and locally verified on 2026-08-12
- **Scope:** Hosted TTS per-file fairness, starvation prevention, exact retry attribution, non-secret lane identity, run-scoped OCR admission, and the shared provider-lane contract
- **Compatibility:** No new CLI flag; TTS, OCR, and STT retain their policy-specific work selection and failure behavior

| Previous State | Completed Transition | Current State |
|---|---|---|
| TTS used an unbounded overflow pass, wall-clock selection tiebreaks, and provider-only retry feedback; TTS lanes were provider-only; OCR built a scheduler per document; shared semantics were prose only. | Implemented dynamic fair-share, dispatch debt, immutable admission tokens, scoped lane identity, run-scoped OCR document adapters, and scheduler-neutral contract types in the prescribed order. | The accepted ADR, scheduler behavior, estimator, telemetry, tests, and concurrency inventory now agree. |

### Implementation

| Phase | Completed Behavior | Evidence |
|---|---|---|
| 1. Fair-share window | Every TTS selection recomputes `ceil(currentLimit / runnableJobs)`, clamps it to at least one, honors the internal `maxActiveChunksPerJob` override, and leaves already-active chunks alone if a lower AIMD limit or new job shrinks the share. The batch estimator simulates the same selector. | `src/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-scheduler.ts`, `src/cli/commands/process-steps/step-4-tts/tts-batch-summary.ts`, dynamic-window scheduler contracts |
| 2. Deterministic aging | Runnable eligible jobs accrue integer dispatch debt whenever another job wins. Debt at the runnable-job threshold takes precedence over shortest-remaining selection, and monotonic dispatch sequence replaces wall-clock fairness. | Replenished-short-job starvation contract and deterministic start-order assertions |
| 3. Exact attribution | Each selected chunk receives a frozen admission token and frozen public context. `withHostedTtsRetry`, `notifyRetry`, and `notifyRateLimit` carry that token; a coordinator-owned weak association resolves the exact job. Batch target and dialogue adapters supply stable run-local input, target, turn, and segment context. | Exact two-job retry/429 reconciliation contract; provider totals equal summed job totals |
| 4. Lane scope and OCR lifetime | The shared lane key is `service:scopeLabel`; credential-like labels and 64-hex hashes are rejected. TTS state is keyed by lane, with independent pressure for different scopes. Extract and write document batches create one OCR coordinator and per-document queue adapters; standalone OCR remains document-scoped. | Same-provider/different-scope TTS contract; two-document OCR cap contract; `src/cli/commands/process-steps/step-1-download/download-targets/download-batch/batch-executor.ts` run boundary |
| 5. Shared contract | Scheduler-neutral types define lane identity, admission/completion, pressure feedback, cancellation, and telemetry vocabulary. TTS consumes identity, admissions, and pressure feedback; OCR consumes identity and pressure feedback; STT projects its unchanged provider/model policy through the same identity. Concrete schedulers remain separate. | `src/cli/commands/process-steps/provider-lane-contract.ts`, `src/types/generation-core/provider-lane-contract-types.ts`, TTS/OCR/STT adapters and identity contracts |

### Alternatives retained from the recommendation

| Option | Resolution |
|---|---|
| Least-active or round-robin only | Rejected because it provides no explicit window and does not solve attribution or scope. |
| Fixed per-file cap | Retained only as an internal override; rejected as the default because it can strand provider capacity. |
| Wall-clock aging | Rejected in favor of dispatch debt because elapsed-time tests do not measure denied scheduling opportunities. |
| One universal scheduler | Rejected. The shared extraction is a contract and vocabulary; TTS, OCR, and STT keep different fairness, polling, backfill, and failure policies. |
| Provider-only TTS and per-document OCR indefinitely | Rejected and replaced by non-secret scoped TTS lanes and run-scoped batch OCR admission. |

## Follow-up Actions

No follow-up actions remain for this scheduler-alignment step.

| Action | Owner | Current State |
|---|---|---|

## Test Plan

- Unit-test the work selector with fake chunk tasks:
  - Three same-lane jobs under a cap of six initially receive two chunks each.
  - A 1-chunk or 3-chunk file completes before large files that arrived at the same time.
  - A long file continues to make deterministic progress under sustained replenished short-file work.
  - Provider active count never exceeds `--tts-chunk-concurrency`.
  - Different providers and different non-secret scopes of one provider use independent pressure lanes.
- Unit-test pressure feedback:
  - 429 feedback halves active provider capacity down to 1.
  - `Retry-After` pauses new starts without canceling active chunks.
  - Successful chunks gradually raise capacity back toward the configured maximum.
  - Immutable admission tokens attribute retries and 429s to the exact job and reconcile job totals with lane totals.
- Unit-test run-scoped OCR admission with two document adapters and prove their combined active page count never exceeds the shared provider cap while their document telemetry remains separate.
- Contract-test shared lane identities with stable human-readable scopes and reject credentials or credential hashes as scope labels.
- Contract-test hosted providers only with mocked network calls:
  - Grok concurrent file jobs share one coordinator.
  - OpenAI or Groq chunked jobs preserve chunk order and final concatenation.
  - Provider retry wrappers report 429 feedback to the coordinator.
- Contract-test multi-speaker turn selection with local fakes:
  - Active work never exceeds the hosted or local cap.
  - Reverse completion still yields source-ordered segment concatenation.
  - One failed turn aborts active work, prevents queued starts, and leaves no `.work-*` directories.
- CLI tests:
  - Help still describes `--tts-chunk-concurrency` as hosted provider-wide.
  - Estimates for multi-file hosted TTS use the shared queue model.
  - Batch summaries include scheduler telemetry.
- Verification commands:
  - `bun run check`
  - `bun t --price`
  - `git diff --check`
  - Targeted local/no-cost tests under `test/test-cases/validation/providers/tts-provider-contracts/`
  - Targeted hosted OCR scheduler and runtime retry/target-scheduler contracts
  - Targeted CLI help and option-resolution tests

Verification on 2026-08-12 passed `bun run check`, `git diff --check`, all 165 mapped `bun t --price` commands, 83 focused TTS provider/retry/target-scheduler/OCR contracts, 34 TTS pricing/timing/batch-output contracts, 25 CLI help contracts, 2 relevant concurrency option contracts, 7 bounded dialogue-selector contracts, and 10 hosted dialogue contracts. No paid or quota-limited provider command ran.

## References

- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md) — the hosted OCR lane, page cap, and throughput profiles described in the inventory above
- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — price preflight consumes the same concurrency values when simulating pool wall time
- Concurrency defaults: `src/utils/concurrency-defaults.ts`
- Flag definitions: `src/cli/flags/shared-flags.ts`, `src/cli/flags/tts-flags.ts`
- Flag resolution: `src/cli/options/option-resolution/concurrency.ts`
- Generic batch executor: `src/cli/commands/process-steps/step-1-download/download-targets/download-batch/process-download-batch.ts`
- Generic target scheduler: `src/cli/commands/process-steps/provider-target-scheduler.ts`
- Cross-step resource gate: `src/utils/resource-gate.ts`, `src/cli/commands/process-steps/step-3-write/generation-resource-gate.ts`
- Shared provider-lane contract: `src/cli/commands/process-steps/provider-lane-contract.ts`, `src/types/generation-core/provider-lane-contract-types.ts`
- Hosted TTS coordinator: `src/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-scheduler.ts`
- Hosted TTS retry feedback: `src/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-retry.ts`
- TTS chunking limits: `src/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking.ts`, `src/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils.ts`
- TTS batch entry point: `src/cli/commands/process-steps/step-4-tts/run-tts.ts`, `src/cli/commands/process-steps/step-4-tts/define-tts-command.ts`
- Hosted OCR scheduler: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-scheduler.ts`
- Run-scoped OCR batch boundary: `src/cli/commands/process-steps/step-1-download/download-targets/download-batch/batch-executor.ts`
- OCR page processing: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/page-processor.ts`, `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/pdf-chunk-fallback.ts`
- STT batch coordinator: `src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-batch/stt-batch.ts`, `src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-batch/stt-batch-coordinator.ts`, `src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-batch/stt-batch-policy.ts`
- STT splitting: `src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-split-policy.ts`, `src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/audio-splitter.ts`, `src/cli/commands/process-steps/step-2-extract/step-2-stt/run-stt/split-execution.ts`
- Retry policies: `src/utils/retries.ts`
- Command docs: `docs/commands/process-steps/step-4-tts/text-to-speech.md`, `docs/commands/process-steps/step-2-extract/02-extract-stt.md`, `docs/commands/process-steps/step-2-extract/03-extract-ocr.md`
