# Step 2 Service Tests: OCR

Hosted OCR and article-extraction coverage for the `extract` document/OCR route.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Outline

- [Quick Start](#quick-start)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
bun t test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/
```

## Current Coverage

- Model-level service files under `test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/` cover PDF and image extraction for Anthropic, DeepInfra, FAL, Gemini, GLM, Grok, Kimi, Mistral, OpenAI, and Replicate using `defineOCRServiceTest`.
- Dedicated URL extraction files (`ocr-firecrawl.test.ts`, `ocr-glm-reader.test.ts`, `ocr-supadata.test.ts`) cover remote article extraction with `--url-provider` (Firecrawl, GLM Reader, Supadata), writing `extraction.txt` and canonical provider metadata.
- Zero-cost validation and contract coverage lives in `test/test-cases/validation/extract-ocr/` (EPUB and page pool contracts) and `test/test-cases/validation/ingest/` (input and HTML/URL backend contracts).

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ --price
bun t test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ --budget 2500
```

The mapped OCR price preflight covers model-level OCR service files plus Supadata, Firecrawl, and GLM Reader URL extraction.

## Related Docs

- [Service Tests](service-tests.md)
- [Local Tests](local-tests.md)
- [extract OCR](../commands/process-steps/step-2-extract/03-extract-ocr.md)
- [extract URL and X](../commands/process-steps/step-2-extract/04-extract-url.md)
