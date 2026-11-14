# ADR-007: Work Units and Concurrency Lanes

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-10
- **Date Updated:** 2026-11-14
- **Verification Status:** Passed

## Context

Item, target, and request concurrency control different work. Domain scheduling must preserve order and failure semantics while sharing provider/account limits without reserving capacity for an entire file.

## Decision

Use domain work selectors behind one hosted admission coordinator per command run, including batch children, comic LLM/image/QA/dialogue/sound effects, and voice auditions. Models using the same provider/account share a lane; independent lanes run concurrently. Local engines, rendering, and duration probes bypass hosted ramps.

### Admission and recovery

`--concurrency-mode ramp` defaults to one immediate request, adding one live slot every five seconds while work is queued up to the cap. `immediate` starts at the cap. Persist the choice at `defaults.concurrency.mode`; resume starts a fresh ramp.

A 429 or classified rate-pressure response reaching the coordinator halves the lane's live limit, with minimum one, pauses admission, and lets in-flight work finish. Recovery uses jittered 2, 4, 8, 16, and 30 second bases, honors a larger `Retry-After`, and admits a recovery probe within a five-minute budget. Success resumes admission and ramping. Other errors follow domain retry policy without halving the lane.

Adapters may retain conservative request retries and cooldowns that consume a rejection before the outer scheduler sees it. Mistral STT serializes its shared pass and honors `Retry-After` or a 60-second fallback. TTS and OCR report per-request pressure directly. Exhausted inner retries are terminal; outer schedulers must not replay an exhausted or ambiguous composite target. Paid redispatch always follows [ADR-005](ADR-005-cli-error-result-and-retry-contract.md); lane recovery cannot authorize duplicate spend. `--price` models a clean ramp without rate-limit events.

### Work controls

- `--batch-concurrency` caps pipeline items; `--provider-concurrency` and `--local-concurrency` cap targets per item. These caps generally default to seven, with OCR target caps ten. Results retain input/target order; sibling failures follow the command's completion contract.
- `--step-concurrency stt-segment=N` caps `--split` ranges, default seven and clamped to one for local engines and Mistral. Merge in source order; failure aborts remaining segments. `stt-preflight` separately caps local duration checks, default seven.
- `--step-concurrency tts-chunk=N` caps hosted requests across files: default 30, Grok-only 50, all-provider shortcut two, and Soniox maximum three. Earlier files receive dispatch priority; later files may start after earlier chunks are dispatched, without waiting for their completion. Assembly preserves chunk/turn order; failure cancels the owning file's remaining chunks or segmented dialogue turns. Hosted directory TTS uses this shared cap, not `--batch-concurrency`.
- `--step-concurrency ocr-page=N` defaults to local ten or hosted adaptive `auto`; explicit values impose a hard ceiling. Stop new scheduling on failure while in-flight work drains. [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md) owns pooled claims and lane retirement.
- Comic panel groups use `--provider-concurrency` (default seven) and `--panels-per-image` (default one final/six sketch). Sound effects use `--step-concurrency sfx=N`, default two.
- Standalone `image`, `video`, hosted `music`, and local lyric-video batches have no `--batch-concurrency` cap.

These controls are nested limits rather than a simple product. [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md) owns scoped flag definitions and per-command applicability.

## Trade-offs

Shared request admission reuses capacity and centralizes provider pressure, while separate domain selectors retain ordering and failure behavior. Earlier-file TTS priority favors predictable dispatch over equal progress. Throughput estimates model the queue and clean ramp, not unknown account limits or live recovery.

## Verification

```bash
bun test test/test-cases/validation/runtime-contracts/hosted-concurrency-contracts.test.ts
bun test test/test-cases/validation/audio/tts/tts-provider-contracts/tts-scheduler-fairness-contracts.test.ts
```

Local contracts cover ramping, independent/shared lanes, pressure recovery, file priority, ordered output, and shared request caps.

## References

- Coordinator: `src/cli/commands/command-shared/hosted-concurrency-coordinator.ts`; target admission: `provider-target-scheduler.ts`; pressure classification: `hosted-rate-limit-pressure.ts` in the same directory
- Request hooks: `src/cli/commands/audio/tts/tts-utils/hosted-tts-retry.ts`, `src/cli/commands/text/ocr/ocr-utils/ocr-retry.ts`
- Mistral retry/cooldown: `src/cli/commands/stt/diarization/stt-mistral/`; audition scheduling: `src/cli/commands/audio/voice/canonical-voice-audition.ts`
