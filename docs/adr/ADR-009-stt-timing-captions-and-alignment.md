# ADR-009: STT Timing, Captions, and Alignment

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-11
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed
- **Supersession:** Absorbs the STT execution, timing provenance, caption export, local alignment, channel merge, and speaker-reconciliation authority of "Extract Execution and Artifact Contracts", including its September 2026 STT caption and timing archive. OCR execution moved to [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md) and URL execution to [ADR-001](ADR-001-source-ingestion-and-normalization.md). This record is the accepted authority for Step 2 STT execution and the public STT artifacts.

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
- **Quantitative Notes:** Rejected

**Option 3**

- **Option:** Replace missing or invalid provider boundaries with uniformly spaced words and treat automatic alignment as verified timing
- **Pros:** Superficially consistent word cues
- **Cons:** Hides source defects and confuses interpolation with acoustic evidence
- **Quantitative Notes:** Rejected; a live sample had 12 zero-duration words out of 24

## Decision

STT owns its adapters, retries, response handling, normalized output, and artifacts, above the provider identity shared with URL and OCR extraction. Canonical timing evidence is saved before any caption file is written, and captions, local alignment, comparison, channel merges, and reviewed speaker maps are derived from it without repeating provider inference. `extract --provider` and `resume` use the same route-qualified STT names, and a stored STT run cannot resume as OCR.

This applies to:

- STT execution, retries, response handling, normalized output, and Step 2 artifact writes.
- Timing provenance, caption exports, local alignment and comparison, channel merging, reviewed speaker-label reconciliation, and per-model diarization capability labels.

It does not apply to:

- Source identity, classification, and normalization ([ADR-001](ADR-001-source-ingestion-and-normalization.md)).
- Canonical pipeline state, resume authority, and price dry runs ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).
- Local STT toolchain and model-asset provisioning ([ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md)).
- STT segment work units, `--step-concurrency stt-segment`, `--step-concurrency stt-preflight`, and shared hosted admission ([ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md)).
- OCR execution, pooling, and chapter artifacts ([ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md)).
- Hosted model identity, lifecycle, capability validation, and pricing provenance ([ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)).
- The STT generic option flags, their registry-derived help, defaults, and per-engine validation ([ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md)).

### Timing evidence and captions

`result.json` stores numeric word ranges, text, confidence, speakers, raw and chunk evidence, and applied source offsets before any caption file is written. Timing is labeled native, token-derived, aligned, generated, repaired, caption-span, interpolated, or mixed. A retained `rawResponse` is evidence, not a promise that every wire field was kept. Fractional offsets stay fractional, each source offset is applied once, and a local speaker ID is scoped to its chunk or channel, so matching IDs do not by themselves mean the same person.

Caption export checks finite, nonnegative, positive-duration intervals, duplicate spans, and full transcript coverage, and keeps valid overlaps and original provider boundaries. It fills an uncovered or invalid word only when a usable segment bound exists, counts that inference, and fails when uncovered text has no usable timing. `captions.json` records cue timing, quality, invalid and inferred counts, format limits, and warnings; it is derived output and not resume authority.

Fresh media is transcribed once per selected model. Canonical results and successful provider state are saved first, and captions are exported outside the transcription retry loop, so an export failure keeps the transcription and writes diagnostics. Export from a saved result is local and needs neither the audio nor a video renderer. An optional native subtitle file reuses the same inference or completed job; a native split-chunk file stays on provider-relative time, while a combined export uses the recording timeline. Requesting native exports on resume does not create export jobs for a target that already succeeded, and resume rejects a transcription setting change that would reuse incompatible evidence.

Diarization support is resolved for the concrete model and labeled documented, provisional, or live-tested. Together diarization defaults off. Mistral `voxtral-mini-2602` returns native word timing only with diarization off and segments with it. A generated Gemini timestamp or speaker hypothesis, a retrieved caption, and a channel label are not a native acoustic measurement or a verified identity.

### Local alignment, channels, and speakers

Local forced alignment needs supplied text whose segments are complete, positive, and non-overlapping, plus explicit paths to an installed model and runtime. Original evidence and hashes are preserved, new timing is marked aligned and `manuallyVerified: false`, and a word below the configured confidence threshold is withheld from publication and kept in diagnostics. Comparison scores ordered lexical matches, coverage, boundary error, tolerance bands, speaker-label agreement, and signed drift, and rejects an invalid interval. Calibration does not change transcription defaults.

Channel extraction keeps every stream at its original sample rate. Merge checks full text coverage, applies offsets once, preserves overlaps, and rejects a result that is already merged. Speaker reconciliation requires an explicit map tied to the source SHA-256 and a review reason; it does not infer identity from the audio. These local workflows write separate derived files, leave the source files in place, and show zero provider cost under `--price`. Flags, setup, and examples are in the [STT command guide](../commands/02-extract/stt/overview.md) and [local timing and speaker workflows](../commands/02-extract/stt/workflows/timing/overview.md#local-timing-and-speaker-workflows).

## Rationale

- Full text coverage and explicit timing labels stop a dropped word or an inferred interval from being presented as native word evidence.
- Saving a successful transcription before caption export allows a later local export without a second provider charge.
- Diarization capability resolved per concrete model keeps documented, provisional, and live-tested support from being read as the same claim.
- Automatic-reference measurements and one live model sample support only the claims those samples can carry, not general acoustic accuracy or speaker identity.

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
- **Sacrifice:** Explicit model and runtime paths, withheld low-confidence words, and results marked aligned or repaired rather than verified

## Implementation Note

`extract` ships this contract for STT, with `result.json`, `captions.json`, the five caption formats, optional native subtitle exports, and the local alignment, comparison, channel, and speaker-map workflows. The command guides under References are the operator surface for flags, artifact names, and examples.

### STT Caption and Timing Archive

The September 2026 caption and timing follow-ups closed on 2026-09-10, and the limits below still bound what a passing STT run may claim. Automatic English references were built from existing local files and are marked `manuallyVerified: false`; they are not acoustic ground truth. Alignment cannot recover omitted speech, decide wording, separate overlapping voices, or verify speakers, its confidence is an emission score rather than a calibrated probability, and two English excerpts do not establish a hosted-provider ranking, multilingual or overlapping-speaker accuracy, number handling, or verified speaker identity.

One approved six-second Together `nvidia/parakeet-tdt-0.6b-v3` run with diarization returned 24 words, 12 of them zero-duration; SRT and VTT export kept all 24 words, reported 12 invalid and 12 inferred timings, and left the native intervals unchanged. That sample sets `diarizationValidation: live-tested` for endpoint compatibility only. It is not verified speaker identity, not uniformly valid native word timing, and not a timing ranking, and it stays out of timing comparisons.

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
- Extract command guide: [`docs/commands/02-extract/overview.md`](../commands/02-extract/overview.md)
