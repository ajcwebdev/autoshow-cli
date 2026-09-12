# 2026 Hosted-Model Refresh Report: Image

## Status

- **Report Status:** Current
- **Date Created:** 2026-08-03
- **Date Updated:** 2026-09-10

This report is one of eight per-modality records split on 2026-08-19 from the former consolidated 2026 hosted-model refresh ledger (retired as an ADR; the remaining ADRs were renumbered to close the gap). Sibling reports: [STT](model-refresh-stt.md), [OCR](model-refresh-ocr.md), [URL scraping](model-refresh-url.md), [LLMs](model-refresh-write.md), [TTS](model-refresh-tts.md), [Music](model-refresh-music.md), [Video](model-refresh-video.md).

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

The 2026-08-16 text-catalog gap audit (recorded in the [LLM report](model-refresh-write.md)) also excluded `gemini-2.5-flash-image` and `imagen-4.0-*` as superseded image generations; Nano Banana 2 / Pro are already registered.

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
- Image provider adapters: `src/cli/commands/visuals/image/`
- Historical cost reconstruction: `src/cli/commands/pricing-orchestration/compute-actual-costs.ts`
- 2026-08-16 xAI Imagine snapshot: `bun autoshow links --grok image` (`https://docs.x.ai/developers/model-capabilities/imagine.md`)

## P1 addition: GPT Image 2.5 Flare and Sunburst (2026-09-10)

Added `gpt-image-2.5-flare` and `gpt-image-2.5-sunburst` alongside `gpt-image-2`, bringing the active image registry to 25 selectors across seven providers. Flare becomes the bare OpenAI provider default under the cheapest-model policy. Comic retains its existing explicit default and accepts either new model through `--image-model`. The September 8 snapshots are `gpt-image-2.5-flare-2026-09-08` and `gpt-image-2.5-sunburst-2026-09-08`; the CLI exposes the two requested undated selectors, recording the serving snapshot when OpenAI returns it. [Flare](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare), [Sunburst](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst).

Both use the existing JSON generation and multipart editing transports with up to 16 references, optional masks, custom sizes, and PNG/JPEG/WebP output. Added `xhigh` and `max` quality and transparent PNG/WebP support, with local rejection of incompatible options in selection, price planning, and transport. Examples emphasize Flare for iteration, Sunburst for focused edits, and explicit instructions about the requested change and details to preserve. [Image API guide](https://developers.openai.com/api/docs/guides/image-generation).

Pricing uses the guide's GPT Image 2.5 calculator, checked September 10, including its ties-to-even grid rounding. The 1024×1024 medium default is 439 output tokens ($0.01317), not Image 2's $0.053 estimate. Explicit sizes and all five quality levels receive their own output estimates. Omitted/auto settings assume 1024-square medium for planning while requests retain auto. Image inputs use the existing provisional 1,000-token-per-reference-per-output heuristic and are included in aggregate totals at $8/M tokens; prompt inputs and caching discounts remain excluded. Complete returned usage is priced at $5/M text input, $8/M image input, and $30/M image output; text output is unbilled. Cached rates ($1.25/M text, $2/M image) are recorded but not applied because the documented Images usage schema does not attribute cached tokens by modality. Missing or incomplete usage retains the output estimate fallback. [Calculator](https://developers.openai.com/api/docs/guides/image-generation#cost-and-latency), [rates](https://developers.openai.com/api/docs/pricing#image-generation-models), [usage schema](https://developers.openai.com/api/reference/resources/images/methods/generate).

Latency inherits the existing 21,594 ms/image baseline provisionally. Published speed improvements are not treated as local measurements. Verification uses mocked generation/edit responses, pricing and selector contracts, CLI help/usage/option checks, `bun run check`, and `bun t --price`; no paid calibration or provider execution is required.

## P1 addition: Grok Imagine Image 2.0 (2026-09-08)

Added `grok-imagine-image-2.0` alongside `grok-imagine-image-quality`, bringing the active image registry to 23 selectors across seven providers. The bare Grok default remains Quality. Image 2.0 uses JSON generation/edit endpoints, up to five PNG/JPEG references, and adds `21:9` and `5:2` aspect ratios. Existing file, public URL and data URL input handling is retained; provider Files API IDs are not exposed. [Generation contract](https://docs.x.ai/developers/model-capabilities/images/generation), [editing contract](https://docs.x.ai/developers/model-capabilities/images/editing), [multiple references](https://docs.x.ai/developers/model-capabilities/images/multi-image-editing).

The CLI pins omitted/auto quality to low for generation and medium for editing, and resolution to 1K. Explicit low/medium at 1K/2K is supported; high quality and other sizes fail locally. Output costs are 4/6 cents for low 1K/2K and 6/8 cents for medium 1K/2K, plus one cent per input image per request. The estimate includes input charges and output count. Returned model, revised prompt, moderation and usage cost are retained with generated artifacts. The 6,080 ms/image latency baseline is inherited provisionally; no paid calibration ran. [Model pricing](https://docs.x.ai/developers/models/grok-imagine-image-2.0).

On November 2, 2026, xAI plans to serve the Quality slug through Image 2.0 at low quality. Local code preserves the older selector, controls and estimate; callers wanting the new model's exact pricing matrix should select Image 2.0 explicitly. Returned model identity records provider redirects without rewriting the requested selector. [Migration notice](https://docs.x.ai/developers/migration/imagine-image-quality-nov-2).
