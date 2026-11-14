# ADR-009: STT Timing, Captions, and Alignment

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-11
- **Date Updated:** 2026-11-14
- **Verification Status:** Passed

## Context

Native word timing, inferred intervals, retrieved captions, and speaker hypotheses provide different evidence. Export and local repair must preserve that distinction, full transcript coverage, and successful paid transcription.

## Decision

Save canonical STT evidence before deriving captions, alignment, comparisons, channel merges, or reviewed transcripts. Execution and resume share STT selectors; stored STT runs cannot resume as OCR. [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) owns canonical progress and compatibility checks.

### Timing and captions

`result.json` preserves available words, ranges, confidence, speakers, source offsets, and provider evidence. Distinguish native, derived, aligned, generated, repaired, caption-span, interpolated, and mixed timing. Preserve fractional offsets and apply them once. Speaker IDs are scoped to their chunk/channel and do not establish identity across them.

Caption export validates finite, nonnegative, positive-duration intervals, duplicate spans, and full text coverage while preserving valid overlaps and provider boundaries. Fill missing/invalid word timing only within a usable segment, count the inference, and fail if uncovered text lacks timing. Derived `captions.json` records quality, invalid/inferred counts, format limits, and warnings. Support SRT, VTT, ASS, TTML, and LRC locally.

Save canonical results and successful provider state before export, outside the transcription retry loop. Export failures must not trigger inference again. Saved results support local export without source audio or video rendering. Native subtitles reuse the completed inference/job; split files retain provider-relative time, combined exports use recording time, and resume preserves completed targets.

Resolve diarization per concrete model with documented, provisional, or live-tested labels. Together defaults off. Mistral `voxtral-mini-2602` provides native words without diarization and segments with it. Current Gemini 3.5 Transcribe stores native word annotations; older generative timing, retrieved captions, and channel labels retain their separate provenance. No timing or diarization label establishes accuracy or verified speaker identity.

### Local alignment and review

Forced alignment requires supplied text with complete positive non-overlapping segments of at most 30 seconds, an explicit installed model, and the separate alignment runtime. Mark output aligned and `manuallyVerified: false`; any word below the configured confidence threshold blocks the aligned result while preserving diagnostics and source evidence. Confidence is an emission score, not calibrated probability. Alignment cannot recover omitted speech, decide wording, separate overlapping voices, or verify speakers.

Comparisons measure ordered lexical matches, coverage, boundary error, speaker agreement, and drift, rejecting invalid intervals. Calibration does not change transcription defaults. Channel extraction preserves sample rate; merge checks coverage, offsets, overlaps, and rejects already merged results.

Reviewed text and explicit speaker maps bind changes to source SHA-256, expected source content, and a review reason. Write separate reviewed results without overwriting sources or inferring identities. Local workflows preserve existing files and report zero provider cost under `--price`.

## Trade-offs

Explicit provenance and strict coverage add validation and artifacts, but permit local recovery without repurchasing inference or disguising invented timing as native evidence. Model-specific capability maintenance and separately installed alignment tools are preferable to unsupported accuracy or identity claims.

## Verification

```bash
bun test test/test-cases/validation/stt/
bun test test/test-cases/validation/providers/openai-rest-contracts/audio-stt-contracts.test.ts
```

Local/mocked contracts cover timing, coverage, provenance, model-specific requests, and recovery. Real transcript-video tests require FFmpeg `ass` support or ImageMagick/Pango plus fonts; the managed macOS FFmpeg lacks `ass`. Rendering and transport checks do not establish transcription accuracy or speaker identity.

## References

- [STT guide](../commands/02-extract/stt/overview.md), [local timing/speaker workflows](../commands/02-extract/stt/workflows/timing/overview.md#local-timing-and-speaker-workflows), [transcript review](../commands/02-extract/stt/workflows/transcript-review/overview.md)
- Artifacts: `src/cli/commands/stt/stt-utils/stt-result-artifacts.ts`; local workflows: `src/cli/commands/stt/workflows/`
- [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md): segmented work/admission; [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md): capability policy; [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md): public controls
