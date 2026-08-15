# ADR-008: Decompose Batch Work into Chunk Units and Concurrency Lanes

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-10
- **Date Updated:** 2026-08-14
- **Verification Status:** Passed

## Context

This project splits work into smaller units in at least ten distinct ways, and bounds how many of those units run at once with at least nine distinct controls. `--batch-concurrency` governs every batch-capable command. `--ocr-concurrency` drives a separate adaptive page scheduler with its own auto/fixed mode contract. `--split` produces STT time segments that are then bounded by `--stt-segment-concurrency`. `--provider-concurrency` and `--local-concurrency` sit between all of these as a shared middle layer. Each is documented in its own command page, but the relationships between them are documented nowhere.

The relationships are the part that matters, because these controls **nest and multiply**. A run with `--batch-concurrency 10`, `--provider-concurrency 10`, and an OCR page cap of 32 can have far more requests in flight than any single number suggests. Run-scoped hosted OCR lanes prevent batch items from multiplying a provider/account cap, while pooled multi-provider OCR deliberately multiplies the page cap across independent provider/account lanes inside one document.

Pooled OCR adds another work-selection layer: selected OCR targets do not each own a full-document job. They are admitted as hosted or local targets, then draw individual pages from one shared document queue while their provider/account lanes enforce pressure limits. This makes claim lifecycle, lane sharing, requeue policy, and original-order assembly part of the concurrency architecture rather than only an OCR artifact concern.

The same nesting produced the failure this record was originally opened for. On 2026-07-10, `bun autoshow tts "input/text" --provider grok` over 16 inputs — 721 chunks, batch concurrency 10, hosted TTS chunk concurrency 30 — took 14m 45s against a 4m 57s estimate, and small files finished very late: a 3-chunk file took 14m 12s, a 5-chunk file 13m 58s. The cause was head-of-line blocking. Each active file could enqueue many chunk workers into the shared provider gate, so the provider-wide cap was safe but the queue was dominated by early, large files. `--batch-concurrency 10` also meant later files were not admitted until earlier whole-file jobs completed, even when those later files were tiny.

That diagnosis produced the hosted TTS work queue described below. But the underlying shape — a provider pressure layer plus a work-selection layer, with an outer batch layer that can starve it — recurs in OCR, in STT, and in the generic target scheduler, each implemented separately and each with slightly different semantics for ordering, failure, and whether state is shared across batch items.

Why now: those cross-cutting relationships are the prerequisite for any shared provider-lane contract, and no command page can describe them, because they exist only between commands.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Promote hosted TTS to a batch-level provider work queue with fair chunk scheduling and separate adaptive provider pressure control** | Keeps provider-wide safety; avoids large-file queue domination; admits all batch work early; improves wall-time estimates from the same scheduler model; gives users actionable scheduler summaries | Larger change than the current gate; requires a TTS-specific batch execution path or coordinator; more scheduler state to test | Addresses 721-chunk / 16-file run; targets the 3x estimate miss and late completion of 1-6 chunk files |
| **Use one dynamically claimed page queue for pooled multi-provider OCR while retaining target and provider/account lane admission** | Lets faster targets accept more pages; shares caps across same-account models; permits handoff after failure; preserves source order | Requires claim state, per-page attempt bounds, retirement policy, and page-level telemetry | Independent lanes multiply their caps; same-lane targets share one cap |
| Keep the current provider-wide gate and only tune AIMD/backoff defaults | Smallest change; preserves current architecture | Does not fix head-of-line blocking; estimates still model the wrong execution shape; lower caps may make wall time worse | Can reduce provider errors but not queue unfairness |
| Raise default `--tts-chunk-concurrency` globally or for all provider-specific hosted TTS | May improve best-case speed on accounts that tolerate more load | Risks returning to provider pressure failures; provider/API-key limits vary; hides the scheduling bug by spending more concurrency | The slow run already used 30 in-flight provider chunks; Grok-only TTS later received a narrower implicit default of 50 |
| Lower `--batch-concurrency` for TTS batches | Reduces early queue domination by large files | Leaves provider capacity underused; makes the user tune two interacting flags manually; can slow large books further | `--batch-concurrency 1` would remove cross-file head-of-line blocking but sacrifice batch parallelism |
| Process files shortest-first at the batch layer only | Helps small files complete earlier; simple to explain | Still lets each file enqueue many chunks once active; can starve long files; does not model provider rate limits | Needs precomputed chunk counts but not a true work queue |
| Serialize each file's chunks while keeping multiple files active | Improves cross-file fairness; simple | Throws away the main chunking speedup for long chapters; still has weak estimates | Local Kitten already behaves sequentially; hosted TTS should keep chunk parallelism |
| Fixed per-file chunk cap instead of a dynamic fair-share window | Trivial to reason about and test | Strands provider capacity whenever fewer jobs are runnable than the cap assumes | Retained only as the internal `maxActiveChunksPerJob` test/provider override |
| Wall-clock aging instead of dispatch debt | Familiar starvation remedy | Elapsed time does not measure denied scheduling opportunities, so tests become timing-sensitive | Dispatch debt is an integer counter, so fairness assertions stay deterministic |
| One universal scheduler shared by TTS, OCR, and STT | Single implementation to maintain | The three lanes need different fairness, polling, backfill, and failure policies | Shared extraction is a contract and vocabulary; the three schedulers stay separate |

## Decision

This record is the current-state description of how the CLI breaks work into units and how many of those units it allows to run at once. It inventories every splitting mechanism, every concurrency control, the shared hosted admission coordinator and four domain work selectors that implement them, and the points where those layers multiply rather than compose.

This applies to:

- Every mechanism that turns one input into many units of work: batch items, provider targets, STT time segments, hosted TTS text chunks, OCR pages and PDF page chunks, comic panel groups, and chapter/length export splits.
- Every control that bounds those units: `--batch-concurrency`, `--provider-concurrency`, `--local-concurrency`, `--ocr-concurrency`, `--stt-segment-concurrency`, `--stt-preflight-concurrency`, `--tts-chunk-concurrency`, `--url-provider-concurrency`, comic's `--concurrency`, and the startup policy selected by `--concurrency-mode ramp|immediate`.
- The run-scoped hosted admission coordinator plus the generic `runProviderTargetScheduler`, `HostedTtsBatchCoordinatorImpl`, `HostedOcrSchedulerImpl`, and `SttBatchCoordinator` work selectors.
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
- Recording what is deliberately absent is as valuable as recording what exists. There is no video scene splitting, no music segmentation, and no transcript or context-window chunking in `write`; knowing those are intentional gaps prevents someone from assuming a chunking layer exists where none does.

### Decomposition Inventory

Every mechanism that turns one unit of work into many.

| Mechanism | Unit produced | Control | Default | Implementation |
|---|---|---|---|---|
| Batch item fan-out | one input file/URL through the full pipeline | `--batch-concurrency` | `10` | `src/cli/commands/process-steps/step-1-download/download-targets/download-batch/process-download-batch.ts` |
| Provider target fan-out | one `(service, model)` pair for one item | `--provider-concurrency`, `--local-concurrency` | `10` / `10` | `src/cli/commands/process-steps/provider-target-scheduler.ts` |
| STT audio splitting | contiguous time segment | `--split` plus automatic policy triggers | 30 min, shrunk per provider | `src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-split-policy.ts`, `src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/audio-splitter.ts` |
| STT segment execution | one segment request | `--stt-segment-concurrency` | `10`; local and `mistral` clamp to `1` | `src/cli/commands/process-steps/step-2-extract/step-2-stt/run-stt/split-execution.ts` |
| Hosted TTS text chunking | text chunk | `--tts-chunk-concurrency` | `30`; `50` for Grok-only hosted TTS | `src/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking.ts`, `src/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-scheduler.ts` |
| OCR page processing | one page | `--ocr-concurrency` | local `10`; hosted `auto` | `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/page-processor.ts`, `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-scheduler.ts` |
| Pooled multi-provider OCR | one dynamically claimed document page | `--ocr-provider-mode pool`, `--provider-concurrency`, `--local-concurrency`, `--ocr-concurrency` | mode `fanout`; target caps `10` / `10`; hosted page cap `auto` | `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-provider-pool.ts`, `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-pooled-batch.ts` |
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
| Pooled OCR pages | accepted pages are assembled by original page number regardless of target or completion order | page failures requeue or hand off; target blockers retire one target; account blockers retire a lane; only pages with no remaining eligible target become exhausted |

Deliberately absent: there is no video scene or shot splitting (one clip per target), no music generation segmentation (one request per target), and no transcript or context-window chunking in `step-3-write`, which sends whole prompts.

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
          └─ --stt-segment-concurrency split segments per provider         src/cli/commands/process-steps/step-2-extract/step-2-stt/run-stt/split-execution.ts
             └─ withRetry              per-request backoff and jitter      src/utils/retries.ts
```

Layer 1, batch items. `--batch-concurrency` is defined in `batchFlags` and resolved into the batch option slice consumed by batch-capable commands. `processBatch` runs a strict sequential loop when the value is `1` and `Promise.allSettled` over a polling semaphore when it is greater. The semaphore busy-waits on a 50 ms timer and is not FIFO, so admission order under contention is not guaranteed. The flag is accepted by `metadata`, `download`, `extract`, `write`, `tts`, `resume`, and the STT/OCR flag sets, and is persisted as `defaults.batch.concurrency`. Standalone `image`, `video`, and `music` have no batch path and do not accept it; `comic` uses its own unrelated `--concurrency`.

Layer 2, provider targets. `runProviderTargetScheduler` splits targets into a hosted pool and a local pool that run concurrently, each a bounded worker pool. Within a pool, entries sort by descending `priority` then ascending `index`, which OCR uses to start the slowest providers first. The scheduler contains no retry or backoff of its own. An optional `resourceGate` is acquired inside each worker; `createGenerationResourceGate` uses this to cap total simultaneous work across steps 4 through 7, with capacity set to the maximum of all their provider and local values.

Layer 3, provider lanes and bounded inner work. Four provider schedulers implement the pressure layer, while multi-speaker TTS adds a bounded per-dialogue selector before individual turn invocations. They diverge in three ways worth knowing:

- **Lane scope.** Hosted OCR and TTS key lanes by the shared `service:scopeLabel` identity. OCR defaults to `env-api-key`; TTS defaults to `configured-account`; explicit stable non-secret labels isolate configured account scopes without recording credentials or credential hashes. STT preserves its provider/model slot policy by adapting the model as its scope label.
- **Sharing across batch items.** `SttBatchCoordinator` is created once per batch and shared across all items when there is more than one item and more than one target, so slot accounting is global; it even sizes async poll slots from `--batch-concurrency` directly. Hosted OCR now creates one run-scoped coordinator for document extraction and write batches, then gives each document a scoped queue adapter, so outer batch concurrency cannot multiply the provider/API-key cap. Standalone OCR retains a document-scoped coordinator. `HostedTtsBatchCoordinatorImpl` is run-scoped for directory batches, registered with deferred start behind a one-second registration barrier.
- **Adaptation.** Hosted OCR retains `auto|fixed` maximum selection and can resolve an auto ceiling up to 48 from a matched healthy throughput profile. OCR, TTS, STT, and generic hosted work then share the selected startup mode: ramp adds one lane slot every five seconds under queued demand, while immediate starts at the cap. Explicit 429/rate-limit pressure halves the live lane limit and uses bounded one-probe recovery; 503, timeout, billing, quota, auth, validation, and ambiguous failures keep their domain retry/failure policies. STT retains its fixed per-provider work profiles and resume backfill rules beneath shared admission.

`--ocr-concurrency` carries a mode contract the other flags do not have. It has no CLI default, so an unset value is distinguishable from an explicit one: unset means `auto` and lets the scheduler size its own cap from page count, while any explicit value means `fixed` and becomes a hard cap. Local OCR ignores the adaptive path entirely and runs two independent pools, one for rendering sized at `min(cpuCount, 4)` and one for OCR itself.

In fan-out mode, each selected OCR target still receives the full document. In pool mode, `--provider-concurrency` and `--local-concurrency` admit target workers, not page claims. Each admitted target can fill its applicable lane up to `--ocr-concurrency`; independent lanes therefore multiply total active page requests, while models sharing the same `service:scopeLabel` lane divide that one cap. For example, three independent hosted lanes at a fixed cap of 10 may reach 30 remote page requests, but two models sharing one account lane still contribute at most 10 combined.

### Pooled Multi-Provider OCR Scheduling Model

The pooled OCR selector owns one ordered page ledger and one pending queue per document. A page can have only one current claim. Eligible workers select pending pages dynamically, with admission fairness based on active target work; completion speed therefore changes page share without changing output order. Page preparation is cached by page number so a handoff reuses the provider-neutral input where safe.

A claim is checkpointed before provider work and names its target, lane, attempt number, unique claim ID, and isolated artifact directory. A completion becomes accepted only when the claim ID still matches and the page has no accepted result. Stale or duplicate completions are recorded in telemetry but cannot overwrite canonical output. Accepted pages are assembled by page number, not completion order or provider directory order.

Transient page failures release the claim. A target that already failed a page is skipped for that page while another eligible target exists. Target-specific blockers retire one target; provider/account blockers retire every target sharing the lane. Active work drains, accepted pages remain, and unfinished work becomes eligible for healthy lanes. Ordinary execution gives each target at most one terminal attempt per page; explicit resume re-enablement authorizes a repaired target or lane to try again. Interrupted claims are unfinished rather than terminal attempts.

Pool telemetry records queue depth and peak, claims, accepted pages, requeues, handoffs, exhausted pages, duplicate commits prevented, ambiguous attempts, recovered interrupted claims, retired targets and lanes, lane caps, retry pressure, pause time, per-target active peaks, throughput, page share, and likely gating target. Pricing uses the same independent-lane and shared-lane assumptions, while actual allocation remains throughput- and failure-dependent.

`--split` is likewise not a simple on/off. Splitting also happens automatically when a file exceeds a provider's attachment cap, duration cap, or request budget, so an unsplit-looking command can still produce segments. The 30-minute default is shrunk per provider by the duration cap, the request budget, and a bytes-per-second estimate against 95% of the attachment cap. When a provider still rejects a segment, up to four adaptive passes halve the segment length down to a 60-second floor.

Segmented multi-speaker TTS uses `runDialogueWorkSelector` as a bounded preparation and invocation layer. Hosted targets use the normalized `--tts-chunk-concurrency` value and Kitten uses `--local-concurrency`. The selector assigns one safe `.work-*` directory per source turn, preserves source order when work completes out of order, shares one `AbortSignal` across active invocations, and removes all temporary workspaces before returning or rethrowing. Segmented hosted calls continue into the run-scoped chunk coordinator beneath this selector. Native ElevenLabs and Hume dialogue rendering bypasses the per-turn selector as one provider-target invocation, uses provider-specific sequential batch/continuation loops, and does not emit unattributed feedback into the chunk coordinator.

Two reassembly details are easy to miss. Timestamp offsetting for split STT happens inside each provider adapter rather than at merge time. Speaker labels are not reconciled across segments: each segment diarizes independently and the capability flag is simply ORed, so speaker identities are per-segment.

### Shared Hosted Admission and Pressure Model

All hosted logical requests governed by an existing concurrency control pass through one run-scoped coordinator. Covered work includes provider/model targets, OCR pages, STT segments, TTS chunks and turns, URL/LLM/image/video/music generation, comic LLM/image/QA work, and sound effects. Local providers, rendering, batch preparation, and preflight probes remain immediate. Existing numeric defaults and explicit or auto-resolved caps do not change.

`HostedConcurrencyMode` is `ramp|immediate`, with `ramp` as the CLI and `defaults.concurrency.mode` default. In ramp mode, a provider plus non-secret account-label lane admits one request immediately and adds one live slot every five seconds while demand remains queued. Completed work can be replaced within the live limit. A lane reaches 12 slots after 55 seconds of sustained demand and never exceeds the highest hosted cap registered on that lane; each work class also retains its own configured limit. Different provider/account lanes ramp independently. Immediate mode begins at the configured cap but uses the same pressure protection.

Lane state is shared across batch children, generation stages, resume work within one process, and comic subcommands. Progress survives an idle period in that command but is not persisted. A new command or resume process starts a fresh lane at one in ramp mode. Concurrency mode and live pressure are execution policy, not content, cache, or accepted-work identity.

Only HTTP 429 and explicitly classified provider rate/concurrency responses enter pressure recovery. Billing, authentication, quota exhaustion, validation, timeout, 5xx, and ambiguous create failures keep their existing policies unless a provider explicitly classifies the response as a rate limit. `--tts-allow-ambiguous-redispatch` may authorize the low-level TTS provider retry layer to replay an ambiguous slot, but it does not report lane pressure, raise a cap, skip admission, or weaken exact-token attribution. Pressure halves the lane's live limit with `max(1, floor(limit / 2))`, pauses admission, and lets active work drain. The exact request may retry only after the lane is below the reduced limit and the backoff has elapsed, with one recovery probe active per lane. `Retry-After` is a floor; otherwise delays use the existing half-to-full jitter style over exponential bases of 2, 4, 8, 16, and 30 seconds. Recovery is bounded to five minutes from that request's first pressure response.

A successful probe clears the pressure streak and restarts the five-second ramp toward the original cap; later pressure halves the then-current limit again. Exhaustion preserves status, headers, stage, retry timing, exact work identity, and lane metadata in a structured `retry_exhausted` error. Additive `hostedConcurrency` telemetry is the source of truth for mode, lane identity, configured/current limits, active and queued peaks, class caps, ramp transitions, pressure/backoff events, pause duration, recovery probes, and recovery failures. OCR and TTS summaries project that state instead of maintaining an independent startup controller.

### Hosted TTS Scheduling Model

The run-scoped hosted TTS coordinator owns one lane per provider and non-secret scope label. Each lane has two layers:

1. **Shared admission controller.** Applies the run-scoped startup mode, live lane limit, exact-token 429 feedback, `Retry-After`, recovery budget, and provider pause windows.
2. **Work selector.** Tracks files and their remaining chunks. When the pressure controller has capacity, the work selector picks the next eligible file and starts one chunk for it.

The work selector recalculates a dynamic per-job window on every dispatch as `ceil(currentLimit / runnableJobs)`, clamped to at least one and optionally bounded by the internal `maxActiveChunksPerJob` test/provider override. A job at its window is ineligible while another runnable job remains below its window; a window that shrinks because shared pressure reduced the live limit or because a new job registered stops future dispatches rather than disturbing already-active chunks. Below the starvation threshold, jobs retain the fewest-remaining, fewest-active, fewest-started preference. Every denied dispatch adds integer debt, and a job whose debt reaches the runnable-job threshold wins before the ordinary comparator. A monotonic dispatch sequence breaks ties, so fairness does not depend on wall-clock timing. Original batch order remains the final output order, chunk output remains ordered inside each file, and a failed chunk cancels only its owning file unless the batch failure policy stops the whole run.

This intentionally avoids letting a single `runTtsChunks` call pre-enqueue up to `--tts-chunk-concurrency` waiters. Provider slots are assigned from a central queue at the moment they become available.

When a chunk starts, the coordinator creates an immutable admission token containing the lane identity, internal job identity, public run-local job context, and exact chunk index. Retry and rate-limit feedback must present that token. A coordinator-owned weak association resolves it to the exact job, provider totals aggregate those job events, and no most-recent-active heuristic remains.

Text chunking itself is character-count based. Every provider uses a 2000-character limit except Groq at 200. The splitter prefers the last newline before the limit, falls back to the last space, and hard-cuts otherwise; it has no sentence-boundary or abbreviation awareness.

## API / Type Impact

- `HostedConcurrencyMode`, admission/token, coordinator, pressure-decision, and telemetry types are public through `~/types`. The shared flag persists at `defaults.concurrency.mode`, and explicit CLI values override config.
- One coordinator instance is projected through processing options so batch children, pipeline generation stages, multi-directory resume, and comic work share provider/account pressure state for the life of one command.
- The hosted TTS batch coordinator lives near the TTS utility layer, separate from the low-level provider retry helper.
- Hosted TTS target execution registers chunk jobs with the coordinator instead of each provider calling `runTtsChunks` in isolation.
- `--tts-chunk-concurrency` is the provider-wide hosted maximum for the current run, not a per-file value.
- `--batch-concurrency` means file lifecycle and local-work concurrency for hosted TTS batches, not remote provider request concurrency.
- `--tts-allow-ambiguous-redispatch` controls duplicate-spend authorization in the provider retry/reconciliation layer and does not alter hosted lane sizing or fairness.
- `--ocr-concurrency` carries a two-state mode contract on `ocrConcurrencyMode`: absent means `auto` and the hosted scheduler sizes its own cap; present means `fixed` and the value is a hard cap. The flag intentionally declares no CLI default so the two states stay distinguishable after config merging.
- `--ocr-provider-mode` selects full-document `fanout` or shared-page `pool`; `fanout` remains the default. Pool target admission uses the existing provider/local caps, and page admission uses the existing lane identity and OCR cap.
- Pool scheduler types expose page claims and attempts, target and lane states, accepted-page attribution, and deterministic telemetry. They do not define a second persistence format; ADR-002 owns their canonical projection.
- Multi-speaker turn callbacks receive an immutable explicit invocation and one shared cancellation signal; provider adapters must consume that invocation rather than capture a selection-time voice.
- Additive `hostedConcurrency` telemetry appears in run metadata and is projected into scheduler summaries: mode, lane and class caps, live limits, active and queued peaks, ramp transitions, pressure/backoff events, pause duration, recovery probes, and failures.
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
- Pooled OCR can combine the useful capacity of independent lanes while proving that same-account models do not multiply their cap.
- Dynamic page claims let faster targets make progress without static range ownership, and reverse completion still produces source-ordered output.

Negative outcomes:

- The TTS batch path is more specialized than generic `processBatch` item concurrency.
- Provider code must keep chunk production and chunk scheduling separable.
- Tests need deterministic scheduling hooks to avoid timing-sensitive assertions.
- Defaults stay conservative because provider limits vary by account and can change without notice.
- The inventory has to be revised whenever a lane, flag, or splitting mechanism is added, and it will drift if that does not happen.
- Page-pool fairness, claim recovery, target retirement, and lane retirement add scheduler states that require deterministic tests.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Provider-safe concurrency with fair cross-file progress | More scheduler state and a TTS-specific coordinator |
| Better completion time for tiny and short files | Slightly less raw priority for the earliest large file |
| Estimates tied to actual queue mechanics | Need to persist or sample provider throughput data |
| Actionable post-run diagnostics | More run metadata and summary surface area |
| Preserves user-facing flags | Internals must reinterpret `--batch-concurrency` for hosted TTS remote work |
| Dynamic multi-provider OCR throughput | Page-level claim, attempt, and retirement bookkeeping |

## Implementation Note

- `src/cli/commands/process-steps/hosted-concurrency-coordinator.ts` implements shared admission, five-second ramping, exact-request pressure attribution, bounded recovery, and telemetry. `src/utils/hosted-concurrency-estimator.ts` is the pure no-pressure ramp estimator used by price planning.
- Wall-time estimates in `src/cli/commands/process-steps/step-4-tts/tts-batch-summary.ts` simulate the same work selector, using total chunks, provider cap, adaptive effective capacity, and observed or provider-profile chunk latency. `src/cli/commands/process-steps/step-4-tts/define-tts-command.ts` emits the scheduler summary at the end of batch runs.
- Multi-speaker turn fan-out runs through the bounded, ordered, cancellable selector in `src/cli/commands/process-steps/step-4-tts/dialogue-work-selector.ts` and `src/cli/commands/process-steps/step-4-tts/run-multi-speaker-tts.ts`, which owns safe turn workspaces.
- Extract and write document batches create one OCR coordinator with per-document queue adapters at the run boundary in `src/cli/commands/process-steps/step-1-download/download-targets/download-batch/batch-executor.ts`; standalone OCR remains document-scoped.
- `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-provider-pool.ts` layers the pooled page selector over target admission and provider/account lane identity. `ocr-pooled-batch.ts` supplies isolated attempts and atomic canonical checkpoints without making provider artifacts authoritative.
- TTS, OCR, and STT consume the scheduler-neutral vocabulary in `src/cli/commands/process-steps/provider-lane-contract.ts` and `src/types/generation-core/provider-lane-contract-types.ts` through policy-specific adapters, retaining their own work selection and failure behavior.
- Hosted TTS retry receives the immutable chunk admission plus the explicit ambiguous-redispatch policy; DeepInfra applies its bounded eight-attempt exponential-jitter policy without bypassing the coordinator or deleting retained chunk evidence.

## Test Plan

Run default verification (`bun run check`) and local, no-cost contract validation suites:

```bash
bun run check
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

- Unit-test the work selector with fake chunk tasks:
  - Three same-lane jobs under a cap of six initially receive two chunks each.
  - A 1-chunk or 3-chunk file completes before large files that arrived at the same time.
  - A long file continues to make deterministic progress under sustained replenished short-file work.
  - Provider active count never exceeds `--tts-chunk-concurrency`.
  - Different providers and different non-secret scopes of one provider use independent pressure lanes.
- Unit-test pressure feedback:
  - 429 feedback halves active provider capacity down to 1.
  - `Retry-After` pauses new starts without canceling active chunks.
  - One successful recovery probe clears pressure and restarts one-slot-per-five-second growth toward the configured maximum.
  - Immutable admission tokens attribute retries and 429s to the exact job and reconcile job totals with lane totals.
- Unit-test the shared coordinator with fake clocks and deterministic randomness: ramp mode reaches 12 at 55 seconds of queued demand, immediate mode starts at the cap, replacements start within the live limit, same-lane classes share an aggregate bound, provider/account lanes remain isolated, idle state is retained within a run, cancellation removes waiters, and disposal clears timers.
- Unit-test recovery with active draining, one probe, `Retry-After`, 2–30 second exponential bases, five-minute exhaustion, repeated halving, successful re-ramp, and unchanged handling for billing, quota, auth, validation, timeout, 5xx, and ambiguous failures.
- Unit-test that ambiguous TTS failures stop by default, proceed only with explicit authorization, preserve exact admission evidence across every bounded attempt, and never become hosted-pressure events.
- Unit-test run-scoped OCR admission with two document adapters and prove their combined active page count never exceeds the shared provider cap while their document telemetry remains separate.
- Unit-test pooled OCR claims, independent-lane multiplication, same-lane sharing, hosted/local target admission, fixed and adaptive caps, reverse completion, handoffs, target/lane retirement, exhaustion, and duplicate-commit prevention.
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

Verification evidence for the hosted ramp update is recorded on 2026-08-14 using `bun run check`, `bun t --price`, the targeted CLI help/usage/option-resolution suites, focused local/mock scheduler and domain contracts, and `git diff --check`. No paid or quota-limited provider command is part of this evidence.

## References

- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md) — the hosted OCR lane, page cap, and throughput profiles described in the inventory above
- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — price preflight consumes the same concurrency values when simulating pool wall time
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — provider/model identity, lane eligibility, reasoning, and capability policy
- Related ADR: [ADR-006](ADR-006-unify-error-handling-vocabulary.md) — failure classification, retry vocabulary, and explicit ambiguous-redispatch authorization
- Related ADR: [ADR-014](ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md) — TTS generation-slot evidence, retained artifacts, and resume reconciliation
- Related ADR: [ADR-016](ADR-016-distribute-ocr-pages-across-a-multi-provider-work-pool.md) — the decision to expose fan-out and dynamically claimed pooled OCR modes
- Concurrency defaults: `src/utils/concurrency-defaults.ts`
- Shared hosted admission and recovery: `src/cli/commands/process-steps/hosted-concurrency-coordinator.ts`, `src/types/generation-core/hosted-concurrency-types.ts`
- Clean-ramp price estimator: `src/utils/hosted-concurrency-estimator.ts`
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
- Pooled OCR page selector: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-provider-pool.ts`
- STT batch coordinator: `src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-batch/stt-batch.ts`, `src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-batch/stt-batch-coordinator.ts`, `src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-batch/stt-batch-policy.ts`
- STT splitting: `src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-split-policy.ts`, `src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/audio-splitter.ts`, `src/cli/commands/process-steps/step-2-extract/step-2-stt/run-stt/split-execution.ts`
- Retry policies: `src/utils/retries.ts`
- Command docs: `docs/commands/process-steps/step-4-tts/text-to-speech-and-voice.md`, `docs/commands/process-steps/step-2-extract/02-extract-stt.md`, `docs/commands/process-steps/step-2-extract/03-extract-ocr.md`
