# 2026 Hosted-Model Refresh Report: OCR / Documents / Ebooks

## Status

- **Report Status:** Current
- **Date Created:** 2026-08-03
- **Date Updated:** 2026-08-19

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

## API / Type Impact

- OCR unions accept concrete 2026 OpenAI, Anthropic, Grok, Gemini, and Kimi identifiers alongside the expanded Replicate, fal.ai, and DeepInfra OCR services.
- Removed selectors are excluded from active CLI help, configuration defaults, and expansion lists, while remaining parseable in historical manifests and pricing readers.

## Follow-up Actions

- [ ] Implement the 2026-08-16 P1 extract (OCR) registrations for `gemini-3.7-flash` and `grok-4.6` — Pending
- [ ] Promote provisional OCR token-billed heuristics and Florence compute-second estimates through approved ADR-012 calibration — Deferred pending paid calibration approval

## Test Plan

- Validate registry integrity using `bun run check`, `bun t --price`, CLI help/usage contracts, selector/default/expansion contracts, provider request/response mocks, pricing contracts, and resume identity tests.
- Verify the active OCR selector surface and removed-selector rejection.
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
