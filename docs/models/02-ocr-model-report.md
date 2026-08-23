# 2026 Hosted-Model Refresh Report: OCR / Documents / Ebooks

## Status

- **Report Status:** Current
- **Date Created:** 2026-08-03
- **Date Updated:** 2026-08-22

This report is one of eight per-modality records split on 2026-08-19 from the former consolidated 2026 hosted-model refresh ledger (retired as an ADR; the remaining ADRs were renumbered to close the gap). Sibling reports: [STT](01-stt-model-report.md), [URL scraping](03-url-model-report.md), [LLMs](04-llm-model-report.md), [TTS](05-tts-model-report.md), [Music](06-music-model-report.md), [Image](07-image-model-report.md), [Video](08-video-model-report.md).

Durable registry, lifecycle, and capability policy belongs to [ADR-010](../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md); paid approvals, calibration results, artifact repair evidence, and generated-report contracts belong to [ADR-012](../adr/ADR-012-benchmark-evidence-and-generated-report-architecture.md). Latency and token heuristics for new or replacement selectors reuse the closest prior per-provider baseline and stay provisional until an approved ADR-012 calibration promotes them.

The 2026 additions of hosted LLM selectors to the shared write and OCR registries (OpenAI GPT-5.6 tiers, Anthropic Claude 5 family, xAI Grok, Google Gemini, and Moonshot Kimi) are recorded in the [LLM report](04-llm-model-report.md) because those selectors share one registry across both commands. This report records OCR-specific catalog audits and the OCR provider-surface expansion.

## Additional OCR audits

- Removed duplicate `mistral-ocr-latest` (identical to `mistral-ocr-4-0`); `mistral-ocr-2512` remains the cheapest Mistral default.

## 2026-08-14 OCR provider-surface expansion

The prioritized OCR expansion implemented P1–P8 entries across Replicate, fal.ai, and DeepInfra. DeepInfra additions were registry-only (`ocr-config/ocr-deepinfra.json`, `ocr-models.ts` validation) using the OpenAI-compatible vision API. Replicate and fal.ai introduced new step-2 OCR services (`ocr-services/replicate-ocr/`, `ocr-services/fal-ocr/`). Token-billed page costs reuse DeepInfra heuristics (~7,981 prompt and ~472 completion tokens per page) provisionally until calibrated.

**Priority 1: P1**

- **Priority:** P1
- **Selector:** `datalab-to/ocr`
- **Provider:** Replicate (official)
- **Pricing basis:** $2 per 1,000 pages, flat page billing
- **Est. cost per 1k pages:** $2.00
- **Rationale:** Official page-billed model matching Mistral OCR price point; layout analysis, text detection, and tables in 90 languages.

**Priority 2: P2**

- **Priority:** P2
- **Selector:** `datalab-to/marker`
- **Provider:** Replicate (official)
- **Pricing basis:** $4 per 1,000 pages, pinned `fast` mode
- **Est. cost per 1k pages:** $4.00
- **Rationale:** Marker pipeline with markdown/JSON output (~0.18 s/page batched). Pinned `mode=fast` for deterministic pricing.

**Priority 3: P3**

- **Priority:** P3
- **Selector:** `google/gemma-3-27b-it`
- **Provider:** DeepInfra
- **Pricing basis:** $0.08/1M input, $0.16/1M output tokens
- **Est. cost per 1k pages:** ~$0.72
- **Rationale:** Low-cost multimodal addition with registry-only implementation.

**Priority 4: P4**

- **Priority:** P4
- **Selector:** `mistralai/Mistral-Small-3.2-24B-Instruct-2506`
- **Provider:** DeepInfra
- **Pricing basis:** $0.075/1M input, $0.20/1M output tokens
- **Est. cost per 1k pages:** ~$0.69
- **Rationale:** Solid OCR quality with improved instruction following; registry-only change.

**Priority 5: P5**

- **Priority:** P5
- **Selector:** `lucataco/deepseek-ocr`
- **Provider:** Replicate (community)
- **Pricing basis:** L40S hardware-billed, ~$0.0033 per ~4 s prediction
- **Est. cost per 1k pages:** ~$3.30 (variable)
- **Rationale:** Document parsing (markdown, tables, LaTeX) with version pinning at dispatch.

**Priority 6: P6**

- **Priority:** P6
- **Selector:** `meta-llama/Llama-4-Scout-17B-16E-Instruct`
- **Provider:** DeepInfra
- **Pricing basis:** $0.10/1M input, $0.30/1M output tokens
- **Est. cost per 1k pages:** ~$0.94
- **Rationale:** Multimodal breadth for comparison runs; ranks on cost and model diversity.

**Priority 7: P7**

- **Priority:** P7
- **Selector:** `fal-ai/got-ocr/v2`
- **Provider:** fal.ai
- **Pricing basis:** $0.05 per image
- **Est. cost per 1k pages:** $50.00
- **Rationale:** Specialty coverage (formulas, geometry, molecular structures, sheet music); reserved for specialized content.

**Priority 8: P8**

- **Priority:** P8
- **Selector:** `fal-ai/florence-2-large/ocr`
- **Provider:** fal.ai
- **Pricing basis:** $0.00125 per GPU compute second
- **Est. cost per 1k pages:** ~$7.55 (estimated)
- **Rationale:** Compute-second billing calibrated from 2026-08-14 run (~6.04 s/page estimate); billed duration varies by input.

Excluded from expansion:

- Replicate `abiruyt/text-extract-ocr`: covered by free local `tesseract` engine.
- Replicate `lucataco/glm-ocr`: duplicates direct GLM `glm-ocr`.
- Replicate `cuuupid/marker`: superseded by official `datalab-to/marker`.
- Replicate `bytedance/dolphin`, `mickeybeurskens/latex-ocr`, `willywongi/donut`, `cjwbw/docentr`, `awilliamson10/meta-nougat`, `cudanexus/ocr-surya`, `pbevan1/llama-3.1-8b-ocr-correction`: low-usage community deployments or single-purpose pre/post-processing tools.
- fal.ai `openrouter/router/vision`: moving router violating fixed-ID policy.
- fal.ai `moondream3-preview/*`: preview endpoints deferred until fixed IDs exist.
- fal.ai `docres`, `docres/dewarp`: image enhancement tools, not OCR.
- DeepInfra partner-hosted Claude/Gemini selectors: duplicates direct providers without price advantages.
- DeepInfra `google/gemma-3-12b-it`, `google/gemma-3-4b-it`: marginal savings with weaker OCR quality than 27B.

## 2026-08-22 Replicate and fal OCR retirement

Implemented 2026-08-22 from the then-current combined report under [docs/benchmarks/ocr](../benchmarks/ocr/combined-comparison-report.md). Removed 5 selectors and the Replicate and fal OCR services. Keep Mistral (`mistral-ocr-4-0`, `mistral-ocr-2512`) and GLM (`glm-ocr`) as dedicated OCR, plus the remaining vision LLMs. Active hosted count: 33 − 5 = 28. Direct `extract --provider replicate` and `extract --provider fal` are unknown OCR providers. Replicate and fal remain active for image, video, TTS, and comic sound effects. Historical-manifest and pricing readers retain the retired per-1k-page rates. The retired provider run artifacts were removed after this decision; the aggregate quality, cost, and speed metrics below are the retained historical benchmark record from 12 runs / 19 pages.

**Provider 1: Replicate `datalab-to/ocr`**

- **Provider:** Replicate `datalab-to/ocr`
- **Mean quality / WER / CER:** 63.03 / 42.99% / 35.69%
- **Mean cost / speed:** $0.200 per 100 pages / 6.0 pages/minute
- **Why retired:** Only Replicate or fal OCR model in any combined top 10 (cost rank 10). Quality rank 29 of 33.

**Provider 2: Replicate `datalab-to/marker`**

- **Provider:** Replicate `datalab-to/marker`
- **Mean quality / WER / CER:** 82.25 / 17.18% / 14.57%
- **Mean cost / speed:** $0.400 per 100 pages / 9.1 pages/minute
- **Why retired:** Best of the five on quality and the closest miss (speed rank 11). Still outside every top 10.

**Provider 3: Replicate `lucataco/deepseek-ocr`**

- **Provider:** Replicate `lucataco/deepseek-ocr`
- **Mean quality / WER / CER:** 27.88 / 122.87% / 134.22%
- **Mean cost / speed:** $0.330 per 100 pages / 1.0 pages/minute
- **Why retired:** Lowest quality in the cohort, slowest-but-one, weighted WER over 100%.

**Provider 4: fal.ai `fal-ai/florence-2-large/ocr`**

- **Provider:** fal.ai `fal-ai/florence-2-large/ocr`
- **Mean quality / WER / CER:** 45.92 / 63.77% / 53.96%
- **Mean cost / speed:** $0.755 per 100 pages / 4.8 pages/minute
- **Why retired:** Bottom-three quality, no cost or speed advantage.

**Provider 5: fal.ai `fal-ai/got-ocr/v2`**

- **Provider:** fal.ai `fal-ai/got-ocr/v2`
- **Mean quality / WER / CER:** 37.23 / 98.85% / 90.26%
- **Mean cost / speed:** $5.000 per 100 pages / 1.1 pages/minute
- **Why retired:** Second-lowest quality and the costliest model in the cohort.

**Remove 1: `datalab-to/ocr`**

- **Remove:** `datalab-to/ocr`
- **Successor:** none; the Replicate OCR service is retired

**Remove 2: `datalab-to/marker`**

- **Remove:** `datalab-to/marker`
- **Successor:** none; the Replicate OCR service is retired

**Remove 3: `lucataco/deepseek-ocr`**

- **Remove:** `lucataco/deepseek-ocr`
- **Successor:** none; the Replicate OCR service is retired

**Remove 4: `fal-ai/florence-2-large/ocr`**

- **Remove:** `fal-ai/florence-2-large/ocr`
- **Successor:** none; the fal OCR service is retired

**Remove 5: `fal-ai/got-ocr/v2`**

- **Remove:** `fal-ai/got-ocr/v2`
- **Successor:** none; the fal OCR service is retired

## 2026-08-22 Gemini 3.7 Flash, Grok 4.6, and Claude Sonnet 4.6 OCR additions

Implements the 2026-08-16 P1 extract registrations for `gemini-3.7-flash` and `grok-4.6`, plus write-only sibling `claude-sonnet-4-6`. Bare defaults are unchanged: `--provider gemini` stays `gemini-3.5-flash-lite`, `--provider grok` stays `grok-4.3`, and `--provider anthropic` stays `claude-haiku-4-5`. Active hosted count: 28 + 3 = 31.

**Add 1: Gemini `gemini-3.7-flash`**

- **Selector:** `gemini-3.7-flash`
- **Provider:** Gemini
- **Pricing basis:** Conservative Standard `$1.50/$7.50` per 1M input/output tokens effective 2027-01-01; introductory `$0.75/$3.75` through 2026-12-31 is ignored so estimates overstate cost during that window
- **Est. cost per 1k pages:** ≈$13.93 using Gemini 3.6 Flash page heuristics
- **Rationale:** Google lists text, image, video, audio, and PDF inputs. Expansion places it after `gemini-3.1-pro-preview`. Reasoning is optional with low/medium/high only; `minimal` is not supported.

**Add 2: Grok `grok-4.6`**

- **Selector:** `grok-4.6`
- **Provider:** Grok
- **Pricing basis:** `$2.00/$0.50/$6.00` per 1M input/cached-input/output tokens <=200K input, `$4.00/$1.00/$12.00` above 200K. Estimates use uncached rates.
- **Est. cost per 1k pages:** ≈$14.00 using Grok 4.5 page heuristics
- **Rationale:** xAI image-understanding docs use `grok-4.6` as the example. Expansion places it after `grok-4.5`. Reasoning is required with low/medium/high.

**Add 3: Anthropic `claude-sonnet-4-6`**

- **Selector:** `claude-sonnet-4-6`
- **Provider:** Anthropic
- **Pricing basis:** `$3.00/$15.00` per 1M input/output tokens
- **Est. cost per 1k pages:** ≈$12.09 using Claude Sonnet 5 page heuristics
- **Rationale:** Anthropic positions Sonnet 4.6 for PDFs, charts, and tables; sibling Claude models already run OCR. Expansion places it after `claude-sonnet-5`. Reasoning is optional through max.

Page heuristics stay provisional until an approved ADR-012 calibration promotes them.

## API / Type Impact

- The active hosted OCR surface is 31 selectors. OCR unions still accept concrete 2026 OpenAI, Anthropic, Grok, Gemini, Kimi, Mistral, GLM, and DeepInfra identifiers.
- Replicate and fal OCR selectors are excluded from active CLI help, configuration defaults, and `--all-ocr` expansion. Stored `replicate` / `fal` OCR identities remain readable in historical manifests and pricing readers.
- The Replicate and fal provider flags remain on image, video, TTS, and comic commands.

## Follow-up Actions

- [x] Implement the 2026-08-16 P1 extract (OCR) registrations for `gemini-3.7-flash` and `grok-4.6`, plus write-only sibling `claude-sonnet-4-6`
- [x] Florence compute-second estimates — Historical only after the 2026-08-22 fal OCR retirement; no further calibration

## Test Plan

- Validate registry integrity using `bun run check`, `bun t --price`, CLI help/usage contracts, selector/default/expansion contracts, provider request/response mocks, pricing contracts, and resume identity tests.
- Verify the active OCR selector count and removed-selector rejection for Replicate and fal OCR.
- Verify that documentation checks do not invoke paid or network-dependent provider endpoints.

## References

- Related ADR: [ADR-008](../adr/ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) — Provider-lane scheduling
- Related ADR: [ADR-009](../adr/ADR-009-extract-execution-and-artifact-contracts.md) — OCR execution and artifact contracts
- Related ADR: [ADR-010](../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — Durable registry/lifecycle/capability policy
- Related ADR: [ADR-012](../adr/ADR-012-benchmark-evidence-and-generated-report-architecture.md) — Benchmark evidence and generated reports
- Related ADR: [ADR-015](../adr/ADR-015-distribute-ocr-pages-across-a-multi-provider-work-pool.md) — Multi-provider OCR page pool architecture
- Hosted model registries: `src/cli/commands/setup-and-utilities/models/`
- OCR provider adapters: `src/cli/commands/process-steps/step-2-extract/`
- Historical cost reconstruction: `src/cli/commands/pricing-orchestration/compute-actual-costs.ts`
