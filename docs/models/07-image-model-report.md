# 2026 Hosted-Model Refresh Report: Image

## Status

- **Report Status:** Current
- **Date Created:** 2026-08-03
- **Date Updated:** 2026-08-19

This report is one of eight per-modality records split on 2026-08-19 from the former consolidated 2026 hosted-model refresh ledger (retired as an ADR; the remaining ADRs were renumbered to close the gap). Sibling reports: [STT](01-stt-model-report.md), [OCR](02-ocr-model-report.md), [URL scraping](03-url-model-report.md), [LLMs](04-llm-model-report.md), [TTS](05-tts-model-report.md), [Music](06-music-model-report.md), [Video](08-video-model-report.md).

Durable registry, lifecycle, and capability policy belongs to [ADR-010](../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md); paid approvals, calibration results, artifact repair evidence, and generated-report contracts belong to [ADR-012](../adr/ADR-012-benchmark-evidence-and-generated-report-architecture.md). Latency and token heuristics for new or replacement selectors reuse the closest prior per-provider baseline and stay provisional until an approved ADR-012 calibration promotes them.

## Image refresh

Standardized hosted raster image generation on 34 selectors across 6 providers, removing 7 outdated selectors.

**Provider 1: Gemini**

- **Provider:** Gemini
- **2026 decision and implementation:** Replaced `gemini-3.1-flash-image-preview` with `gemini-3.1-flash-lite-image` (default), `gemini-3.1-flash-image`, and `gemini-3-pro-image`. Added model-specific pricing, dimensions, and historical reader.

**Provider 2: Reve**

- **Provider:** Reve
- **2026 decision and implementation:** Removed direct Reve provider and `latest`/`reve-create@20250915` selectors ahead of the 2026-08-14 API sunset; historical results retain direct-Reve identities.

**Provider 3: Recraft**

- **Provider:** Recraft
- **2026 decision and implementation:** Removed four SVG/vector selectors; hosted generation standardized on raster-only output.

**Provider 4: BFL**

- **Provider:** BFL
- **2026 decision and implementation:** Added fixed `flux-2-klein-4b` and `flux-2-klein-9b` endpoints; excluded moving previews.

**Provider 5: Replicate**

- **Provider:** Replicate
- **2026 decision and implementation:** Added `bytedance/seedream-5-pro`, Ideogram v4 (Turbo/Balanced/Quality), and Pruna ERNIE Image (Standard/Turbo with version pinning).

**Provider 6: fal.ai**

- **Provider:** fal.ai
- **2026 decision and implementation:** Added `fal-ai/hidream-o1-image`, `microsoft/mai-image-2.5`, `microsoft/mai-image-2.5-pro`, `alibaba/qwen-image-3`, and `reve/2.1` with queue/poll lifecycle and mode routing.

## 2026-08-16 image refresh

Compared the active image catalog plus the xAI Imagine snapshot from `bun autoshow links --grok image` (`https://docs.x.ai/developers/model-capabilities/imagine.md`). Implemented 2026-08-16. Removed 12 selectors, kept `grok-imagine-image-quality`, and retired the Recraft provider and `recraft-image` flag. Active count: 34 − 12 = 22. The recorded `grok-imagine-image-2.0` successor is unavailable and was not added; the refresh was removal-only. Removed selectors stay parseable in historical manifests and pricing readers and fail direct selection with replacement guidance where the provider surface remains.

**Provider 1: fal.ai `microsoft/mai-image-2.5-pro`**

- **Provider:** fal.ai `microsoft/mai-image-2.5-pro`
- **Released:** ✅ 2026-07-28
- **Max resolution:** ❌ Unpublished
- **Aspect ratio:** ✅ 8 ratios
- **Count:** ✅ 1–4
- **Formats:** ✅ png/jpeg/webp

**Provider 2: Replicate `ideogram-ai/ideogram-v4-turbo` / `ideogram-v4-balanced` / `ideogram-v4-quality`**

- **Provider:** Replicate `ideogram-ai/ideogram-v4-turbo` / `ideogram-v4-balanced` / `ideogram-v4-quality`
- **Released:** ✅ 2026-06-03
- **Max resolution:** ⚠️ Presets to 3328
- **Aspect ratio:** ❌ No
- **Count:** ❌ 1
- **Formats:** ❌ PNG

**Provider 3: fal.ai `microsoft/mai-image-2.5`**

- **Provider:** fal.ai `microsoft/mai-image-2.5`
- **Released:** ✅ 2026-06-02
- **Max resolution:** ❌ Unpublished
- **Aspect ratio:** ✅ 8 ratios
- **Count:** ✅ 1–4
- **Formats:** ✅ png/jpeg/webp

**Provider 4: Recraft `recraftv4_1` / `recraftv4_1_utility`**

- **Provider:** Recraft `recraftv4_1` / `recraftv4_1_utility`
- **Released:** ✅ 2026-05-14
- **Max resolution:** ❌ 1MP presets
- **Aspect ratio:** ✅ Size or ratio, not both
- **Count:** ✅ 1–6
- **Formats:** ❌ PNG

**Provider 5: Recraft `recraftv4_1_pro` / `recraftv4_1_utility_pro`**

- **Provider:** Recraft `recraftv4_1_pro` / `recraftv4_1_utility_pro`
- **Released:** ✅ 2026-05-14
- **Max resolution:** ✅ 4MP presets
- **Aspect ratio:** ✅ Size or ratio, not both
- **Count:** ✅ 1–6
- **Formats:** ❌ PNG

**Provider 6: Replicate `prunaai/ernie-image` / `ernie-image-turbo`**

- **Provider:** Replicate `prunaai/ernie-image` / `ernie-image-turbo`
- **Released:** ✅ 2026-04-14
- **Max resolution:** ⚠️ Custom 64–2048
- **Aspect ratio:** ❌ No
- **Count:** ✅ 1–4
- **Formats:** ⚠️ png/jpeg

**Provider 7: Grok `grok-imagine-image`**

- **Provider:** Grok `grok-imagine-image`
- **Released:** ✅ 2026-01-28
- **Max resolution:** ⚠️ 2K
- **Aspect ratio:** ✅ 14 ratios
- **Count:** ✅ 1–10
- **Formats:** ❌ JPEG

**Remove 1: `grok-imagine-image`**

- **Remove:** `grok-imagine-image`
- **Successor:** `grok-imagine-image-2.0`

**Remove 2: `microsoft/mai-image-2.5`, `microsoft/mai-image-2.5-pro`**

- **Remove:** `microsoft/mai-image-2.5`, `microsoft/mai-image-2.5-pro`
- **Successor:** `alibaba/qwen-image-3`

**Remove 3: `ideogram-ai/ideogram-v4-turbo`, `ideogram-ai/ideogram-v4-balanced`, `ideogram-ai/ideogram-v4-quality`**

- **Remove:** `ideogram-ai/ideogram-v4-turbo`, `ideogram-ai/ideogram-v4-balanced`, `ideogram-ai/ideogram-v4-quality`
- **Successor:** `bytedance/seedream-5-lite`

**Remove 4: `recraftv4_1`, `recraftv4_1_pro`, `recraftv4_1_utility`, `recraftv4_1_utility_pro`**

- **Remove:** `recraftv4_1`, `recraftv4_1_pro`, `recraftv4_1_utility`, `recraftv4_1_utility_pro`
- **Successor:** `flux-2-klein-4b`

**Remove 5: `prunaai/ernie-image`, `prunaai/ernie-image-turbo`**

- **Remove:** `prunaai/ernie-image`, `prunaai/ernie-image-turbo`
- **Successor:** `qwen/qwen-image-2`

`grok-imagine-image-2.0` does not exist and was not added. The existing `grok-imagine-image-quality` selector remains active with its current generation and edit/reference behavior.

The 2026-08-16 text-catalog gap audit (recorded in the [LLM report](04-llm-model-report.md)) also excluded `gemini-2.5-flash-image` and `imagen-4.0-*` as superseded image generations; Nano Banana 2 / Pro are already registered.

## API / Type Impact

- The active hosted raster image surface is 22 selectors.
- Removed selectors are excluded from active CLI help, configuration defaults, and expansion lists, while remaining parseable in historical manifests and pricing readers.

## Test Plan

- Validate registry integrity using `bun run check`, `bun t --price`, CLI help/usage contracts, selector/default/expansion contracts, provider request/response mocks, pricing contracts, and resume identity tests.
- Verify the active image selector count and removed-selector rejection with replacement guidance.
- Verify that documentation checks do not invoke paid or network-dependent provider endpoints.

## References

- Related ADR: [ADR-002](../adr/ADR-002-pipeline-state-resume-and-dry-run-planning.md) — Pipeline state and resume identity
- Related ADR: [ADR-007](../adr/ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md) — Shared model consumers
- Related ADR: [ADR-010](../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — Durable registry/lifecycle/capability policy
- Related ADR: [ADR-012](../adr/ADR-012-benchmark-evidence-and-generated-report-architecture.md) — Benchmark evidence and generated reports
- Hosted model registries: `src/cli/commands/setup-and-utilities/models/`
- Image provider adapters: `src/cli/commands/process-steps/step-5-image/`
- Historical cost reconstruction: `src/cli/commands/pricing-orchestration/compute-actual-costs.ts`
- 2026-08-16 xAI Imagine snapshot: `bun autoshow links --grok image` (`https://docs.x.ai/developers/model-capabilities/imagine.md`)
