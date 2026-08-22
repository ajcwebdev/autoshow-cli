# Step 2 Tests: OCR

Local OCR validation plus hosted OCR and article-extraction coverage for the `extract` document/OCR route.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Outline

- [Quick Start](#quick-start)
- [Local Coverage](#local-coverage)
- [Service Coverage](#service-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
# local OCR coverage
bun t test/test-cases/e2e/local/step-2-ocr-e2e/ocr-local/

# hosted OCR service coverage
bun t test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/
```

## Local Coverage

- `test/test-cases/e2e/local/step-2-ocr-e2e/ocr-local/ocr-options.test.ts` covers local Tesseract OCR for PDF and image input, EPUB text extraction, chapter and chunk export flags, `--format json` output, local `--url-provider defuddle` article extraction, and the manifest/metadata routing those runs write.

## Service Coverage

- Model-level service files under `test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/` cover PDF and image extraction for Anthropic, DeepInfra, FAL, Gemini, GLM, Grok, Kimi, Mistral, OpenAI, and Replicate using `defineOCRServiceTest`.
- Dedicated URL extraction files (`ocr-firecrawl.test.ts`, `ocr-glm-reader.test.ts`, `ocr-supadata.test.ts`) cover remote article extraction with `--url-provider` (Firecrawl, GLM Reader, Supadata), writing `extraction.txt` and canonical provider metadata.
- Zero-cost validation and contract coverage lives in `test/test-cases/validation/extract-ocr/` (EPUB contracts, page pool and hosted OCR resilience contracts, resume contracts, input adapter and image normalization contracts, and batch diagnostics) and `test/test-cases/validation/ingest/` (input and HTML/URL backend contracts).

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ --price
bun t test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ --budget 2500
```

The mapped OCR price preflight covers model-level OCR service files plus Supadata, Firecrawl, and GLM Reader URL extraction.

## Related Docs

- [Testing Overview](../../testing.md)
- [extract OCR](03-extract-ocr.md)
- [extract URL and X](04-extract-url.md)
