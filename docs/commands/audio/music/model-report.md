# 2026 Hosted-Model Refresh Report: Music

## Status

- **Report Status:** Current
- **Date Created:** 2026-08-03
- **Date Updated:** 2026-09-08

This report is one of eight per-modality records split on 2026-08-19 from the former consolidated 2026 hosted-model refresh ledger (retired as an ADR; the remaining ADRs were renumbered to close the gap). Sibling reports: [STT](../../stt/model-report.md), [OCR](../../text/ocr/model-report.md), [URL scraping](../../text/url/model-report.md), [LLMs](../../text/write/model-report.md), [TTS](../tts/model-report.md), [Image](../../visuals/image/model-report.md), [Video](../../visuals/video/model-report.md).

Durable registry, lifecycle, and capability policy belongs to [ADR-010](../../../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md); paid approvals, calibration results, artifact repair evidence, and generated-report contracts belong to [ADR-012](../../../adr/ADR-012-benchmark-evidence-and-generated-report-architecture.md). Latency and token heuristics for new or replacement selectors reuse the closest prior per-provider baseline and stay provisional until an approved ADR-012 calibration promotes them.

## Music refresh

Active music generation now has 4 selectors across 3 hosted providers; the September addition is recorded below.

- Added ElevenLabs `music_v2` and later retired transitional `music_v1`. Active output format is `mp3_48000_192`. Historical readers preserve the v1 per-minute rate and `mp3_44100_128` identity.
- Replaced MiniMax `music-2.6` with `music-3.0` on prompt/lyrics/instrumental lifecycle. Historical readers preserve 2.6 rate ($0.15/track + $0.01 for lyrics).
- Retained Gemini `lyria-3-pro-preview` and retired `lyria-3-clip-preview`. Historical readers preserve the clip per-track rate.
- Excluded streaming Lyria RealTime, cover generation, and reference-audio products.
- Music resume promotes outputs to provider/model filenames before merging metadata to avoid artifact collisions.

## 2026-08-16 music refresh

Implemented 2026-08-16 as part of the combined image, video, and music catalog comparison. Removed 2 selectors. Keep `music-3.0`. Active count: 5 − 2 = 3 (`music_v2`, `music-3.0`, `lyria-3-pro-preview`). Direct selection of the removed IDs fails with replacement guidance; historical manifests and pricing readers retain the retired rates.

**Provider 1: Gemini `lyria-3-clip-preview`**

- **Provider:** Gemini `lyria-3-clip-preview`
- **Released:** ✅ 2026-03-25
- **Duration:** ❌ 30s fixed
- **Duration control:** ❌ Fixed 30s
- **Instrumental:** ✅ `--instrumental`
- **Lyrics:** ⚠️ File appended to prompt
- **Output:** ❌ MP3, rate unpublished

**Provider 2: ElevenLabs `music_v1`**

- **Provider:** ElevenLabs `music_v1`
- **Released:** ⚠️ 2025-08-05
- **Duration:** ✅ 3–600s
- **Duration control:** ✅ `--duration`
- **Instrumental:** ✅ `--instrumental`
- **Lyrics:** ❌ Prompt vocals only
- **Output:** ⚠️ 44.1 kHz / 128 kbps MP3

**Remove 1: `music_v1`**

- **Remove:** `music_v1`
- **Successor:** `music_v2`

**Remove 2: `lyria-3-clip-preview`**

- **Remove:** `lyria-3-clip-preview`
- **Successor:** `lyria-3-pro-preview`

## API / Type Impact

- The active music surface is 4 selectors.
- Removed selectors are excluded from active CLI help, configuration defaults, and expansion lists, while remaining parseable in historical manifests and pricing readers.

## Follow-up Actions

- [ ] Recheck deferred streaming, realtime, cover, and reference-audio music products via separate architecture ADRs — Deferred

## Test Plan

- Validate registry integrity using `bun run check`, `bun t --price`, CLI help/usage contracts, selector/default/expansion contracts, provider request/response mocks, pricing contracts, and resume identity tests.
- Verify the active music selector count and removed-selector rejection with replacement guidance.
- Verify that documentation checks do not invoke paid or network-dependent provider endpoints.

## References

- Related ADR: [ADR-002](../../../adr/ADR-002-pipeline-state-resume-and-dry-run-planning.md) — Pipeline state and resume identity
- Related ADR: [ADR-010](../../../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — Durable registry/lifecycle/capability policy
- Related ADR: [ADR-012](../../../adr/ADR-012-benchmark-evidence-and-generated-report-architecture.md) — Benchmark evidence and generated reports
- Hosted model registries: `src/cli/commands/setup-and-utilities/models/`
- Music provider adapters: `src/cli/commands/audio/music/`
- Historical cost reconstruction: `src/cli/commands/pricing-orchestration/compute-actual-costs.ts`
- Music benchmark artifacts: `docs/benchmarks/music/`

## 2026-09-08 P1 addition: Lyria 3.5

Added exact `lyria-3.5`, explicitly a public preview despite its unsuffixed ID. The existing Pro selector and bare Gemini default remain intact. Lyria 3.5 uses a synchronous `POST /v1beta/interactions` text request; Pro retains GenerateContent. Catalog, validation, expansion and model-source links include the new selector. Pricing is 8 cents per song request, including lyrics and independent of prompted duration; no automatic retry is added. The inherited 906 ms per requested audio second is an uncalibrated latency estimate.

The adapter reads all `model_output` steps and their content blocks, saves each MP3 separately and preserves all lyric/JSON structure text in metadata and a text sidecar. The artifact map includes additional audio and text, with model-specific sidecar filenames that survive promotion and additive resume. Missing/invalid audio, unsupported returned formats, failed/incomplete interactions and provider HTTP errors fail explicitly. The default output is 44.1 kHz stereo MP3; WAV selection remains unexposed.

The host supports text and up to ten images. AutoShow currently exposes only text prompts, supplied lyrics and instrumental instructions; it rejects non-text adapter inputs. Duration is a positive finite prompt hint, with a provisional 120-second default estimate, not a guaranteed or measured duration. Image input, reference audio, multi-turn editing, structured song editing and verified lyric timestamps remain outside the exposed CLI. No paid generation or calibration was performed; account access and real output quality remain unverified.

Sources: [model specification](https://ai.google.dev/gemini-api/docs/models/lyria-3.5), [music guide](https://ai.google.dev/gemini-api/docs/music-generation), [Interactions reference](https://ai.google.dev/api/interactions-api), [per-song pricing](https://ai.google.dev/gemini-api/docs/pricing).
