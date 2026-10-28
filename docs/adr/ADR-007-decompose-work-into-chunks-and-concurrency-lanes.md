# ADR-007: Decompose Batch Work into Chunk Units and Concurrency Lanes

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-10
- **Date Updated:** 2026-10-28
- **Verification Status:** Passed
- **Supersession:** [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md) replaces the earlier concurrency flag spellings with `--step-concurrency <scope>=N` and shared `--provider-concurrency`. The lane architecture and hosted admission policy remain accepted.

## Context

Batch, provider, and intra-step concurrency flags control different units, so their values alone do not describe total remote request pressure. Holding a provider slot for an entire file also prevents later work from using capacity while that file waits or finishes its remaining chunks.

Provider pressure must stay separate from work ordering. Shared provider and account limits constrain requests, while each domain chooses its next runnable unit and preserves output order.

Why now: nested concurrency controls and whole-file scheduling require one policy for work decomposition, shared request limits, and rate-limit recovery across pipeline commands.

## Options Considered

**Option 1 (selected)**

- **Option:** Decouple provider pressure from domain work queues behind a run-scoped hosted admission coordinator
- **Pros:** Keeps a provider-wide cap without reserving slots until a whole file finishes; wall-time estimates follow the real queue
- **Cons:** A work selector per domain and run-scoped lane state
- **Quantitative Notes:** One shared cap per provider/account lane for the command run

**Option 2**

- **Option:** Keep provider-wide first-in-first-out gates and per-item batch concurrency
- **Pros:** Smallest change
- **Cons:** Head-of-line blocking and starved small files remain
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Raise the default `--step-concurrency tts-chunk` value globally
- **Pros:** Higher best-case throughput on high-tier accounts
- **Cons:** More 429 risk without separating provider limits from work ordering
- **Quantitative Notes:** n/a

**Option 4**

- **Option:** One universal scheduler for TTS, OCR, and STT
- **Pros:** One scheduler to maintain
- **Cons:** Those domains need different fairness, polling, chunking, and failure behavior
- **Quantitative Notes:** Rejected; domain selectors share lane vocabulary and admission policy instead

## Decision

Use a run-scoped hosted admission coordinator for provider and account limits, ramp-up, and 429 recovery. Domain work selectors split requests into units and preserve output order; hosted TTS gives earlier files dispatch priority rather than guaranteeing equal progress across files.

This applies to:

- Work units: batch items, provider targets, STT time segments, hosted TTS text chunks, OCR pages, comic panel groups, sound-effect requests, and multi-speaker dialogue turns.
- Public controls: `--batch-concurrency`, `--provider-concurrency`, `--local-concurrency`, `--step-concurrency` (`ocr-page`, `stt-segment`, `stt-preflight`, `tts-chunk`, `sfx`), and `--concurrency-mode ramp|immediate`.
- Output order, failure behavior, and lane lifetime for one command execution, including its batch children.

It does not apply to:

- Provider billing, except that queue shape feeds wall-time estimates.
- Provider registry definitions ([ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)) or error classification ([ADR-005](ADR-005-cli-error-result-and-retry-contract.md)).
- Explicit TTS duplicate-spend authorization (`--allow-ambiguous-redispatch`), owned by [ADR-005](ADR-005-cli-error-result-and-retry-contract.md) for retry and redispatch and by [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md) for the paid slots it protects. Lane recovery does not re-authorize duplicate spend.
- Pooled OCR claim, resume, and artifact contracts, owned by [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md).
- Chapter export splitting, video scene splitting, music segmentation, and write-prompt chunking.

### Nested controls

`--batch-concurrency` controls pipeline items; `--provider-concurrency` and `--local-concurrency` control targets per item; `--step-concurrency` controls work inside a step. Hosted requests also pass through a shared provider/account lane, so these values are not a simple product. Independent lanes can run concurrently, while models using the same account share a lane. Local engines, rendering, and duration probes do not use the hosted ramp.

Standalone `image`, `video`, and hosted `music` have no `--batch-concurrency` path. Local lyric-video rendering uses `music --batch` without that cap. Comic image and panel work uses `--provider-concurrency` (default `7`) instead of `--batch-concurrency`.

### Hosted admission

Every hosted request under these controls shares one coordinator for the command run, including comic LLM, image, QA, dialogue, and sound-effect work. A lane is keyed by provider plus account, so two models on the same credentials share a cap and independent providers ramp on their own.

`--concurrency-mode ramp` (default) admits one request on a lane immediately, then adds one live slot every five seconds while work is queued, up to the configured cap. `--concurrency-mode immediate` starts at the cap. The mode is stored at `defaults.concurrency.mode`. Resume starts a new ramp and does not restore earlier rate-limit pressure.

HTTP 429 and classified rate-limit responses halve that lane's live limit, never below 1, pause new admissions, and let in-flight work finish. Recovery uses jittered backoff with bases of 2, 4, 8, 16, and 30 seconds and honors a larger normalized `Retry-After`, within a five-minute recovery budget. The affected work is retried as a recovery probe; a successful probe restores normal admissions and the five-second ramp. Other errors, including 401, 403, 5xx, and timeouts, follow that domain's retry policy and do not halve the lane.

`--price` models a clean ramp with no rate-limit events.

### Work units

**Batch items and provider targets**

- **Unit:** An input file or URL, containing one or more provider/model targets
- **Controls:** `--batch-concurrency`, `--provider-concurrency`, and `--local-concurrency`, generally defaulting to `7`; OCR target caps default to `10`
- **Behavior:** Results retain input and target order. Failed work does not automatically abort siblings; exit behavior follows the command's completion contract

**STT segments**

- **Unit:** A contiguous audio time range
- **Control:** `--split` and `--step-concurrency stt-segment=N`
- **Behavior:** Segments merge in source order. Segment concurrency defaults to `7`, clamped to `1` for local engines and Mistral; a failure aborts remaining segments

**STT preflight**

- **Unit:** Media-duration checks before transcription
- **Control:** `--step-concurrency stt-preflight=N`
- **Default:** `7`
- **Behavior:** Bounds local preflight work rather than hosted requests

**Hosted TTS chunks**

- **Unit:** A text chunk within provider request limits
- **Control:** `--step-concurrency tts-chunk=N`
- **Default:** `30`; `50` for Grok-only hosted TTS; `2` for the all-provider shortcut; Soniox never exceeds `3`
- **Behavior:** The cap is shared across the provider's files. Earlier files receive chunk dispatch priority, and audio is concatenated in chunk order. A failed chunk cancels its owning file's remaining work

Hosted TTS directory batches share one scheduler across files. `--batch-concurrency` does not cap active hosted TTS files or requests; use `--step-concurrency tts-chunk=N` to constrain those requests. A later file can start once earlier files have dispatched their chunks, without waiting for all earlier audio to finish.

**Multi-speaker TTS turns**

- **Unit:** One dialogue turn
- **Control:** `--step-concurrency tts-chunk=N`
- **Behavior:** Segmented rendering uses the shared TTS chunk cap, preserves source order, and aborts remaining turns on failure. Native dialogue requests and voice, rendering, and redispatch rules belong to [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md)

**OCR pages**

- **Unit:** One document page
- **Control:** `--step-concurrency ocr-page=N`
- **Default:** Local `10`; hosted `auto`
- **Behavior:** Pages assemble in source order. Hosted OCR selects adaptive sizing when the flag is omitted and a fixed cap when a number is supplied; a failure stops new scheduling while in-flight work drains

**Pooled OCR pages**

- **Unit:** A document page claimed from a shared queue
- **Control:** `--ocr-provider-mode pool`, plus `--provider-concurrency`, `--local-concurrency`, and `--step-concurrency ocr-page`
- **Default:** Mode `fanout`; OCR target caps `10` / `10`; page cap `auto`
- **Behavior:** Independent hosted lanes can process pages concurrently; models on one account share a lane cap. Composite output, page failures, and lane retirement belong to [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md)

**Comic panel groups and sound effects**

- **Unit:** A comic panel group or one sound-effect request
- **Control:** `--panels-per-image` and `--provider-concurrency` for comic panels; `--step-concurrency sfx=N` for sound effects
- **Default:** Comic panel groups `1` final / `6` sketch; comic provider concurrency `7`; sound-effect concurrency `2`
- **Behavior:** Image, QA, dialogue, and sound-effect work share hosted admission. Scene audio and presentation belong to [ADR-013](ADR-013-comic-scene-audio-and-presentation.md)

## Rationale

- Separate controls for items, targets, and requests let operators constrain the unit that causes pressure without treating all concurrency flags as interchangeable.
- Request-level admission keeps available capacity usable instead of reserving it until an entire file finishes. Stable TTS file priority preserves predictable dispatch order, with later files using capacity once earlier chunks have been dispatched.
- TTS, OCR, and STT need different ordering and failure rules. Shared admission provides common limits and recovery without forcing them through one scheduler.

## Consequences

Positive outcomes:

- A file finishes when its own chunks finish, without waiting for other files to drain.
- A rate-limit response reduces pressure and allows bounded recovery before failing the affected work.
- Wall-time estimates follow the queued work, provider throughput, and the clean ramp.

Negative outcomes:

- While a lane is full, earlier-registered inputs are still preferred.
- `--batch-concurrency` does not limit remote TTS requests.
- Defaults stay conservative because provider accounts can impose limits the CLI is not told about.

## Trade-offs

**Trade-off 1**

- **Gain:** Shared provider limits with request-level capacity reuse
- **Sacrifice:** A work selector per domain instead of one shared first-in-first-out gate

**Trade-off 2**

- **Gain:** Wall-time estimates follow the queue that will run
- **Sacrifice:** Estimates have to model provider throughput and a clean ramp

**Trade-off 3**

- **Gain:** Intra-step caps share `--step-concurrency <scope>=N`
- **Sacrifice:** Hosted TTS request pressure must be controlled with the chunk cap rather than the batch-item cap

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/runtime-contracts/hosted-concurrency-contracts.test.ts
bun test test/test-cases/validation/audio/tts/tts-provider-contracts/tts-scheduler-fairness-contracts.test.ts
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

1. Hosted TTS prioritizes earlier files, lets later files use capacity after earlier chunks are dispatched, preserves result order, and stays within the shared chunk cap.
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
