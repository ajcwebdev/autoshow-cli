# 2026 Hosted-Model Refresh Report: Video

## Status

- **Report Status:** Current
- **Date Created:** 2026-08-03
- **Date Updated:** 2026-08-19

This report is one of eight per-modality records split on 2026-08-19 from the former consolidated 2026 hosted-model refresh ledger (retired as an ADR; the remaining ADRs were renumbered to close the gap). Sibling reports: [STT](01-stt-model-report.md), [OCR](02-ocr-model-report.md), [URL scraping](03-url-model-report.md), [LLMs](04-llm-model-report.md), [TTS](05-tts-model-report.md), [Music](06-music-model-report.md), [Image](07-image-model-report.md).

Durable registry, lifecycle, and capability policy belongs to [ADR-010](../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md); paid approvals, calibration results, artifact repair evidence, and generated-report contracts belong to [ADR-012](../adr/ADR-012-benchmark-evidence-and-generated-report-architecture.md). Latency and token heuristics for new or replacement selectors reuse the closest prior per-provider baseline and stay provisional until an approved ADR-012 calibration promotes them.

## Video refresh

Standardized hosted video generation on 32 selectors across 7 providers.

- Replicate: replaced `alibaba/happyhorse-1.0` with 1.1; added Kling v3 Video, Kling v3 Omni, PixVerse V6, and Runway Aleph 2.
- xAI: added `grok-imagine-video-1.5` with per-second/resolution pricing; retained `grok-imagine-video` for edit/extend operations.
- fal.ai: added `minimax/h3` and `fal-ai/pixverse/c1` with explicit mode routing (text/image/reference), native audio, and duration/aspect validation.
- Retained: LTX 2.3 Fast/Pro, Seedance 2.0/2.0 Fast, Wan 2.7 T2V, Veo 3.1 Lite, Ray 3.2. Excluded unreleased Meta Muse, unavailable SkyReels V4, realtime Helios, and interactive stream tools.
- MiniMax: retained direct 01-series selectors (`T2V-01` 19¢ bare default).
- Veo: standardized on raw REST response boundary (`response.generateVideoResponse.generatedSamples[0].video`, `encodedVideo`), removing deprecated SDK wrapper types.

## 2026-08-16 video refresh

Compared the active video catalog plus the xAI Imagine snapshot from `bun autoshow links --grok video` (`https://docs.x.ai/developers/model-capabilities/video/generation.md`). Implemented 2026-08-16. Removed 16 selectors and retired standalone GLM video and Runway (`glm-video`, `runway-video`). Direct `MiniMax-H3` was not added and remains unavailable; fal.ai `minimax/h3` remains a separate active path. Active count: 32 − 16 = 16. Removed selectors stay parseable in historical manifests and pricing readers and fail direct selection with replacement guidance where the provider surface remains.

**Provider 1: Replicate `runwayml/aleph-2`**

- **Provider:** Replicate `runwayml/aleph-2`
- **Released:** ✅ 2026-05-21
- **text-to-video:** ❌
- **image-to-video:** ❌
- **reference-to-video:** ❌
- **interpolate:** ❌
- **edit:** ✅
- **extend:** ❌
- **Duration:** ✅ Clip 2–30s
- **Max resolution:** ⚠️ Source
- **Aspect ratio:** ❌ No
- **Native audio:** ❌ No
- **References:** ❌ No

**Provider 2: Replicate `wan-video/wan-2.7-t2v`**

- **Provider:** Replicate `wan-video/wan-2.7-t2v`
- **Released:** ✅ 2026-04-01
- **text-to-video:** ✅
- **image-to-video:** ❌
- **reference-to-video:** ❌
- **interpolate:** ❌
- **edit:** ❌
- **extend:** ❌
- **Duration:** ✅ 2–15s
- **Max resolution:** ⚠️ 1080p
- **Aspect ratio:** ✅ 5 ratios
- **Native audio:** ❌ No
- **References:** ❌ No

**Provider 3: Runway `gen4.5`**

- **Provider:** Runway `gen4.5`
- **Released:** ⚠️ 2025-12-01
- **text-to-video:** ✅
- **image-to-video:** ❌
- **reference-to-video:** ❌
- **interpolate:** ❌
- **edit:** ❌
- **extend:** ❌
- **Duration:** ⚠️ 2–10s
- **Max resolution:** ❌ 720p
- **Aspect ratio:** ✅ 16:9 or 9:16
- **Native audio:** ❌ No
- **References:** ❌ No

**Provider 4: MiniMax `MiniMax-Hailuo-2.3`**

- **Provider:** MiniMax `MiniMax-Hailuo-2.3`
- **Released:** ⚠️ 2025-10-28
- **text-to-video:** ✅
- **image-to-video:** ✅
- **reference-to-video:** ❌
- **interpolate:** ❌
- **edit:** ❌
- **extend:** ❌
- **Duration:** ⚠️ 6–10s
- **Max resolution:** ⚠️ 1080p
- **Aspect ratio:** ❌ No
- **Native audio:** ❌ No
- **References:** ❌ No

**Provider 5: MiniMax `MiniMax-Hailuo-2.3-Fast`**

- **Provider:** MiniMax `MiniMax-Hailuo-2.3-Fast`
- **Released:** ⚠️ 2025-10-28
- **text-to-video:** ❌
- **image-to-video:** ✅
- **reference-to-video:** ❌
- **interpolate:** ❌
- **edit:** ❌
- **extend:** ❌
- **Duration:** ⚠️ 6–10s
- **Max resolution:** ⚠️ 1080p
- **Aspect ratio:** ❌ No
- **Native audio:** ❌ No
- **References:** ❌ No

**Provider 6: GLM `cogvideox-3`**

- **Provider:** GLM `cogvideox-3`
- **Released:** ⚠️ 2025
- **text-to-video:** ✅
- **image-to-video:** ✅
- **reference-to-video:** ❌
- **interpolate:** ✅
- **edit:** ❌
- **extend:** ❌
- **Duration:** ⚠️ 5–10s
- **Max resolution:** ✅ 4K
- **Aspect ratio:** ✅ 5 ratios
- **Native audio:** ❌ Off
- **References:** ❌ No

**Provider 7: GLM `viduq1-text`**

- **Provider:** GLM `viduq1-text`
- **Released:** ⚠️ 2025
- **text-to-video:** ✅
- **image-to-video:** ❌
- **reference-to-video:** ❌
- **interpolate:** ❌
- **edit:** ❌
- **extend:** ❌
- **Duration:** ❌ 5s
- **Max resolution:** ⚠️ 1080p
- **Aspect ratio:** ✅ 5 ratios
- **Native audio:** ❌ No
- **References:** ❌ No

**Provider 8: MiniMax `T2V-01` / `T2V-01-Director`**

- **Provider:** MiniMax `T2V-01` / `T2V-01-Director`
- **Released:** ⚠️ 2025-01
- **text-to-video:** ✅
- **image-to-video:** ❌
- **reference-to-video:** ❌
- **interpolate:** ❌
- **edit:** ❌
- **extend:** ❌
- **Duration:** ❌ 6s
- **Max resolution:** ❌ 720p
- **Aspect ratio:** ❌ No
- **Native audio:** ❌ No
- **References:** ❌ No

**Provider 9: MiniMax `I2V-01` / `I2V-01-Director` / `I2V-01-live`**

- **Provider:** MiniMax `I2V-01` / `I2V-01-Director` / `I2V-01-live`
- **Released:** ⚠️ 2025-01
- **text-to-video:** ❌
- **image-to-video:** ✅
- **reference-to-video:** ❌
- **interpolate:** ❌
- **edit:** ❌
- **extend:** ❌
- **Duration:** ❌ 6s
- **Max resolution:** ❌ 720p
- **Aspect ratio:** ❌ No
- **Native audio:** ❌ No
- **References:** ❌ No

**Provider 10: MiniMax `S2V-01`**

- **Provider:** MiniMax `S2V-01`
- **Released:** ⚠️ 2025-01
- **text-to-video:** ❌
- **image-to-video:** ❌
- **reference-to-video:** ✅
- **interpolate:** ❌
- **edit:** ❌
- **extend:** ❌
- **Duration:** ❌ 6s
- **Max resolution:** ❌ 720p
- **Aspect ratio:** ❌ No
- **Native audio:** ❌ No
- **References:** ⚠️ 1

**Provider 11: GLM `vidu2-image`**

- **Provider:** GLM `vidu2-image`
- **Released:** ❌ 2024-11
- **text-to-video:** ❌
- **image-to-video:** ✅
- **reference-to-video:** ❌
- **interpolate:** ❌
- **edit:** ❌
- **extend:** ❌
- **Duration:** ❌ 4s
- **Max resolution:** ❌ 720p
- **Aspect ratio:** ✅ 5 ratios
- **Native audio:** ❌ No
- **References:** ❌ No

**Provider 12: GLM `vidu2-start-end`**

- **Provider:** GLM `vidu2-start-end`
- **Released:** ❌ 2024-11
- **text-to-video:** ❌
- **image-to-video:** ❌
- **reference-to-video:** ❌
- **interpolate:** ✅
- **edit:** ❌
- **extend:** ❌
- **Duration:** ❌ 4s
- **Max resolution:** ❌ 720p
- **Aspect ratio:** ✅ 5 ratios
- **Native audio:** ❌ No
- **References:** ❌ No

**Provider 13: GLM `vidu2-reference`**

- **Provider:** GLM `vidu2-reference`
- **Released:** ❌ 2024-11
- **text-to-video:** ❌
- **image-to-video:** ❌
- **reference-to-video:** ✅
- **interpolate:** ❌
- **edit:** ❌
- **extend:** ❌
- **Duration:** ❌ 4s
- **Max resolution:** ❌ 720p
- **Aspect ratio:** ✅ 5 ratios
- **Native audio:** ❌ Off
- **References:** ⚠️ Up to 3

**Remove 1: `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-2.3-Fast`, `T2V-01`, `T2V-01-Director`, `I2V-01`, `I2V-01-Director`, `I2V-01-live`, `S2V-01`**

- **Remove:** `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-2.3-Fast`, `T2V-01`, `T2V-01-Director`, `I2V-01`, `I2V-01-Director`, `I2V-01-live`, `S2V-01`
- **Successor:** `MiniMax-H3`

**Remove 2: `cogvideox-3`, `viduq1-text`, `vidu2-image`, `vidu2-start-end`, `vidu2-reference`**

- **Remove:** `cogvideox-3`, `viduq1-text`, `vidu2-image`, `vidu2-start-end`, `vidu2-reference`
- **Successor:** `ltx-2-3-fast`

**Remove 3: `gen4.5`**

- **Remove:** `gen4.5`
- **Successor:** `ray-3.2`

**Remove 4: `runwayml/aleph-2`**

- **Remove:** `runwayml/aleph-2`
- **Successor:** `grok-imagine-video` edit

**Remove 5: `wan-video/wan-2.7-t2v`**

- **Remove:** `wan-video/wan-2.7-t2v`
- **Successor:** `bytedance/seedance-2.0-fast`

`MiniMax-H3` is a new V2 adapter, not a rename of `/v1/video_generation`. Create on `POST /v2/video_generation` with required `model`, `content[]`, `resolution` (`768P`/`2K`), and `duration` (4–15). Poll `GET /v2/query/video_generation/{task_id}` for `task.content.url`; do not use the V1 file_id retrieve path. Mode mapping: text uses a single `text` item and requires a concrete `ratio` (not `adaptive`); image-to-video uses `role=first_frame` and ignores `ratio`; interpolate uses first plus last frame; reference-to-video accepts up to 9 images, 3 videos, and 3 audios with a mixed cap of 12. Defer H3-Context-IR and 768P→2K regeneration.

Also add Grok `grok-imagine-video-1.5` `reference_audios` (up to 3 TTS `voice_id`s; audio-only R2V allowed). Keep current Grok limits: edit/extend on `grok-imagine-video` only, 1080p on 1.5 text/image-to-video, reference-to-video capped at 720p. Ignore 1.5 aliases.

The 2026-08-16 text-catalog gap audit (recorded in the [LLM report](04-llm-model-report.md)) also recorded the P3 video recommendation `gemini-omni-flash`, pending confirmation that the existing Veo adapter can host it.

## API / Type Impact

- The active hosted video surface is 16 selectors.
- Removed selectors are excluded from active CLI help, configuration defaults, and expansion lists, while remaining parseable in historical manifests and pricing readers.

## Follow-up Actions

- [ ] Recheck deferred SkyReels V4, realtime Helios, and interactive stream products via separate architecture ADRs — Deferred

## Test Plan

- Validate registry integrity using `bun run check`, `bun t --price`, CLI help/usage contracts, selector/default/expansion contracts, provider request/response mocks, pricing contracts, and resume identity tests.
- Verify the active video selector count and removed-selector rejection with replacement guidance.
- Verify that documentation checks do not invoke paid or network-dependent provider endpoints.

## References

- Related ADR: [ADR-002](../adr/ADR-002-pipeline-state-resume-and-dry-run-planning.md) — Pipeline state and resume identity
- Related ADR: [ADR-010](../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — Durable registry/lifecycle/capability policy
- Related ADR: [ADR-012](../adr/ADR-012-benchmark-evidence-and-generated-report-architecture.md) — Benchmark evidence and generated reports
- Hosted model registries: `src/cli/commands/setup-and-utilities/models/`
- Video provider adapters: `src/cli/commands/process-steps/step-6-video/`
- Historical cost reconstruction: `src/cli/commands/pricing-orchestration/compute-actual-costs.ts`
- 2026-08-16 xAI Imagine snapshot: `bun autoshow links --grok video` (`https://docs.x.ai/developers/model-capabilities/video/generation.md`)
- MiniMax H3: https://platform.minimax.io/docs/guides/video-generation.md, https://platform.minimax.io/docs/api-reference/video-generation-v2-create.md
