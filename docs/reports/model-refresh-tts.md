# 2026 Hosted-Model Refresh Report: TTS

## Status

- **Report Status:** Current
- **Date Created:** 2026-08-03
- **Date Updated:** 2026-09-14

The canonical 14 September 2026 catalog refresh and capability record is [model-refresh-tts-2026-09-14.md](model-refresh-tts-2026-09-14.md). This file remains the living sibling pointer used by ADR indexes and other modality reports.

This report is one of eight per-modality records split on 2026-08-19 from the former consolidated 2026 hosted-model refresh ledger (retired as an ADR; the remaining ADRs were renumbered to close the gap). Sibling reports: [STT](model-refresh-stt.md), [OCR](model-refresh-ocr.md), [URL scraping](model-refresh-url.md), [LLMs](model-refresh-write.md), [Music](model-refresh-music.md), [Image](model-refresh-image.md), [Video](model-refresh-video.md).

Durable registry, lifecycle, and capability policy belongs to [ADR-010](../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md); paid approvals, calibration results, artifact repair evidence, and generated-report contracts belong to [ADR-012](../adr/ADR-012-benchmark-evidence-and-generated-report-architecture.md).

## Current TTS surface

Nine selectors across eight hosted providers: ElevenLabs `eleven_v3`, Grok `grok-tts`, Mistral `voxtral-mini-tts-2603`, OpenAI `gpt-4o-mini-tts-2025-12-15`, Speechify `simba-3.2`, Hume `octave-1` and `octave-2`, Cartesia `sonic-3.6-2026-08-27`, and Inworld `realtime-tts-2`.

The 14 September refresh added no new active selector. It preserved historical rates and replacement guidance for already-narrowed `cartesia/sonic-3.5-2026-05-04` and `inworld/realtime-tts-2-flash`. Gemini, Deepgram, Replicate, fal, Fish, DeepInfra TTS, and MiniMax TTS remain removed from the active TTS surface.

## Follow-up Actions

- [ ] Watch Cartesia for a newer dated Sonic 3.6 snapshot; do not register `sonic-3.6` or `sonic-preview`.
- [ ] Treat Speechify `simba-3.0`, `simba-dialogue-1.0`, and Eleven `eleven_v3_conversational` as deferred siblings or separate architecture work.

## Test Plan

- Validate registry integrity using `bun run check`, `bun t --price`, CLI help/usage contracts, selector/default/expansion contracts, provider request/response mocks, pricing contracts, and resume identity tests.
- Verify the active TTS selector count and refused-selector rejection with replacement guidance.
- Verify that documentation checks do not invoke paid or network-dependent provider endpoints.

## References

- Canonical combined record: [2026-09-14 TTS model refresh and capability record](model-refresh-tts-2026-09-14.md)
- Related ADR: [ADR-010](../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- Related ADR: [ADR-012](../adr/ADR-012-benchmark-evidence-and-generated-report-architecture.md)
- Related ADR: [ADR-013](../adr/ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md)
- Hosted model registries: `src/cli/commands/setup-and-utilities/models/`
- TTS provider adapters: `src/cli/commands/audio/tts/`
