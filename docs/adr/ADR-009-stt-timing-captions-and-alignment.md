# ADR-009: STT Timing, Captions, and Alignment

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-11
- **Date Updated:** 2026-10-28
- **Verification Status:** Passed
- **Supersession:** Absorbs the STT execution and artifact decisions from "Extract Execution and Artifact Contracts". OCR execution moved to [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md) and URL execution to [ADR-001](ADR-001-source-ingestion-and-normalization.md).

## Context

Step 2 STT runs after [ADR-001](ADR-001-source-ingestion-and-normalization.md) has classified and normalized a source and [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) has supplied the work plan. STT owns its retries, normalized output, and artifacts; canonical progress stays in the ADR-002 manifest, and raw responses and derived files are not resume authority.

Caption export dropped words, lost fractional offsets, and labeled timing and speakers without saying which evidence produced them. Provider words, reconstructed tokens, generated timestamps, and retrieved caption spans are different kinds of evidence, and repairing a caption file must keep a successful transcription without running provider inference again.

Why now: the September 2026 STT audit needed one execution and artifact contract that preserves timing evidence, exports coverage-checked captions, and states the limits of automatic alignment.

## Options Considered

**Option 1 (selected)**

- **Option:** Preserve canonical timing evidence and derive coverage-checked captions and explicit local alignment artifacts from it
- **Pros:** Retains complete text, original boundaries, provenance, and successful provider work; supports offline regeneration
- **Cons:** Requires provenance, coverage checks, and visible limits on inferred timing
- **Quantitative Notes:** Five local subtitle formats: SRT, VTT, ASS, TTML, and LRC

**Option 2**

- **Option:** Depend on native subtitle exports or the transcript-video renderer
- **Pros:** Reuses provider formatting or an established rendering path
- **Cons:** Leaves integrations without native exports uncovered and couples captions to inference or video rendering
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Replace missing or invalid provider boundaries with uniformly spaced words and treat automatic alignment as verified timing
- **Pros:** Superficially consistent word cues
- **Cons:** Hides source defects and confuses interpolation with acoustic evidence
- **Quantitative Notes:** Rejected; observed zero-duration words require explicit repair provenance

## Decision

Save canonical STT evidence before caption export and derive captions, local alignment, comparisons, channel merges, and reviewed text or speaker maps without repeating provider inference. `extract --provider` and `resume` use the same STT provider selectors, and a stored STT run cannot resume as OCR.

This applies to:

- STT execution, retries, response handling, normalized output, and Step 2 artifact writes.
- Timing provenance, caption exports, local alignment and comparison, channel merging, offline transcript review, reviewed speaker-label reconciliation, and per-model diarization capability labels.

It does not apply to:

- Source identity, classification, and normalization ([ADR-001](ADR-001-source-ingestion-and-normalization.md)).
- Canonical pipeline state, resume authority, and price dry runs ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).
- Local STT toolchain and model-asset provisioning ([ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md)).
- STT segment work units, `--step-concurrency stt-segment`, `--step-concurrency stt-preflight`, and shared hosted admission ([ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md)).
- OCR execution, pooling, and chapter artifacts ([ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md)).
- Hosted model identity, lifecycle, capability validation, and pricing provenance ([ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)).
- The STT generic option flags, their registry-derived help, defaults, and per-engine validation ([ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md)).

### Timing evidence and captions

`result.json` preserves the available word ranges, text, confidence, speakers, source offsets, and provider evidence before caption export. Timing labels distinguish native, derived, aligned, generated, repaired, caption-span, interpolated, and mixed evidence. Fractional offsets stay fractional and are applied once. Speaker IDs are scoped to their chunk or channel; matching IDs alone do not establish the same person.

Caption export checks finite, nonnegative, positive-duration intervals, duplicate spans, and full transcript coverage, and keeps valid overlaps and original provider boundaries. It fills an uncovered or invalid word only when a usable segment bound exists, counts that inference, and fails when uncovered text has no usable timing. `captions.json` records cue timing, quality, invalid and inferred counts, format limits, and warnings; it is derived output and not resume authority.

Canonical results and successful provider state are saved before caption export, outside the transcription retry loop, so an export failure preserves the transcription. Export from a saved result is local and needs neither the audio nor a video renderer. Optional native subtitle files reuse the same inference or completed job; split files keep provider-relative time, while a combined local export uses the recording timeline. Resume keeps completed targets and rejects transcription setting changes that would reuse incompatible evidence.

Diarization support is resolved for the concrete model and labeled documented, provisional, or live-tested. Together diarization defaults off. Mistral `voxtral-mini-2602` returns native word timing only with diarization off and segments with it. A generated Gemini timestamp or speaker hypothesis, a retrieved caption, and a channel label are not a native acoustic measurement or a verified identity.

### Local alignment, channels, and speakers

Local forced alignment needs supplied text with complete, positive, non-overlapping segment ranges of at most 30 seconds, an explicit installed model path, and the separately installed alignment runtime. New timing is marked aligned and `manuallyVerified: false`. Any word below the configured confidence threshold blocks the aligned `result.json`; diagnostics, working files, and the original transcript remain available. Comparison measures ordered lexical matches, coverage, boundary error, speaker-label agreement, and drift, and rejects invalid intervals. Calibration does not change transcription defaults.

Channel extraction preserves the original sample rate. Merge checks full text coverage, applies offsets once, preserves overlaps, and rejects already merged results. Speaker reconciliation requires an explicit map tied to the source SHA-256 and a review reason; it does not infer identity from audio. Offline transcript review similarly binds edits to the source hash, expected words, and a reason, then writes a separate reviewed result without overwriting its source. Local workflows preserve existing files and report zero provider cost under `--price`; flags and examples belong in the command guides under References.

## Rationale

- Full text coverage and explicit timing labels stop a dropped word or an inferred interval from being presented as native word evidence.
- Saving a successful transcription before caption export allows a later local export without a second provider charge.
- Diarization capability resolved per concrete model keeps documented, provisional, and live-tested support from being read as the same claim.
- Automatic references and live endpoint checks do not establish general acoustic accuracy or verified speaker identity.

## Consequences

Positive outcomes:

- A saved STT result can produce captions and local timing analysis while the source evidence and the successful transcription stay intact.
- Caption exports keep every word, report invalid and inferred timing counts, and fail only when uncovered text has no usable timing.
- Native subtitle exports reuse the completed inference and are not recreated on resume for a target that already succeeded.

Negative outcomes:

- Some exports or measurements fail when the evidence cannot support them, instead of producing a best-effort caption file.
- Alignment and model-capability evidence have to state confidence, language, overlap, and sample size; timestamp precision alone does not establish accuracy.
- Per-model diarization and timestamp request shapes need maintenance as hosted APIs change.

## Trade-offs

**Trade-off 1**

- **Gain:** Complete caption text, auditable timing changes, and local recovery from saved STT evidence
- **Sacrifice:** More provenance and validation artifacts

**Trade-off 2**

- **Gain:** Per-model diarization and timestamp behavior that matches what each endpoint returns
- **Sacrifice:** Model-specific capability labels to maintain

**Trade-off 3**

- **Gain:** Local alignment, comparison, and calibration without a provider charge
- **Sacrifice:** Separate model and runtime installation, rejection of low-confidence alignment, and results marked aligned or repaired rather than verified

## Implementation Note

`extract` implements this contract through `src/cli/commands/stt/stt-utils/stt-result-artifacts.ts` and the caption, timing, and transcript-review workflows under `src/cli/commands/stt/workflows/`.

### STT Caption and Timing Archive

The September 2026 audit used automatic English references marked `manuallyVerified: false`, not acoustic ground truth. Alignment cannot recover omitted speech, decide wording, separate overlapping voices, or verify speakers. Its confidence is an emission score rather than a calibrated probability; those samples do not establish provider rankings or accuracy for other languages or overlapping speech.

A Together `nvidia/parakeet-tdt-0.6b-v3` diarization sample returned zero-duration words that caption export repaired without changing native evidence. Its `live-tested` capability label establishes endpoint compatibility only, and the sample remains excluded from timing comparisons.

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/stt/
bun test test/test-cases/validation/providers/openai-rest-contracts/audio-stt-contracts.test.ts
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

1. STT contracts keep all text, numeric boundaries, source offsets, overlaps, and provenance, and local captions and alignment report invalid or inferred timing without changing provider evidence.
2. Mocked request contracts cover per-model diarization and timestamp fields and safe retries.
3. Extract and resume accept the same STT provider names, and option resolution keeps the STT flag surface stable.

## References

- Related ADR: [ADR-001](ADR-001-source-ingestion-and-normalization.md) — source classification, normalization, and URL routes
- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — canonical pipeline manifest, resume, and price planning
- Related ADR: [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md) — local STT toolchain and model-asset provisioning
- Related ADR: [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md) — STT segment and preflight work units and hosted lanes
- Related ADR: [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md) — OCR execution and artifacts
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — model identity, capability validation, and pricing provenance
- Related ADR: [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md) — STT generic option flags and registry-derived help
- STT command guide: [`docs/commands/02-extract/stt/overview.md`](../commands/02-extract/stt/overview.md)
- Local STT timing and speaker workflows: [STT timing guide](../commands/02-extract/stt/workflows/timing/overview.md#local-timing-and-speaker-workflows)
- Offline transcript review: [Transcript review guide](../commands/02-extract/stt/workflows/transcript-review/overview.md)
- Extract command guide: [`docs/commands/02-extract/overview.md`](../commands/02-extract/overview.md)
