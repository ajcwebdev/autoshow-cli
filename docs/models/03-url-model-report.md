# 2026 Hosted-Model Refresh Report: URL Scraping

## Status

- **Report Status:** Current
- **Date Created:** 2026-08-03
- **Date Updated:** 2026-08-19

This report is one of eight per-modality records split on 2026-08-19 from the former consolidated 2026 hosted-model refresh ledger (retired as an ADR; the remaining ADRs were renumbered to close the gap). Sibling reports: [STT](01-stt-model-report.md), [OCR](02-ocr-model-report.md), [LLMs](04-llm-model-report.md), [TTS](05-tts-model-report.md), [Music](06-music-model-report.md), [Image](07-image-model-report.md), [Video](08-video-model-report.md).

Durable registry, lifecycle, and capability policy belongs to [ADR-010](../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md); paid approvals, calibration results, artifact repair evidence, and generated-report contracts belong to [ADR-012](../adr/ADR-012-benchmark-evidence-and-generated-report-architecture.md).

## URL scraping refresh

The 2026 hosted-model refresh recorded no URL-scraping provider or model changes. The active step-2 URL extraction services — Firecrawl, GLM Reader, Spider, Supadata, X-Spaces, and Zyte — kept their existing provider surfaces, request shapes, and pricing throughout the refresh window.

This report exists so the per-modality refresh report set covers every hosted extract surface. Record future URL-scraping provider or model additions, replacements, removals, and exclusions here.

## Test Plan

- Validate URL service integrity using `bun run check`, `bun t --price`, CLI help/usage contracts, and option-resolution contracts.
- Verify that documentation checks do not invoke paid or network-dependent provider endpoints.

## References

- Related ADR: [ADR-009](../adr/ADR-009-extract-execution-and-artifact-contracts.md) — URL execution and artifact contracts
- Related ADR: [ADR-010](../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — Durable registry/lifecycle/capability policy
- URL service adapters: `src/cli/commands/process-steps/step-2-extract/step-2-url/url-services/`
