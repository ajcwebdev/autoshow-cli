# Step 2 Tests: OCR

Local OCR validation plus hosted OCR and article-extraction coverage for `extract`.

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

- `test/test-cases/e2e/local/step-2-ocr-e2e/ocr-local/` covers local Tesseract OCR for PDF and image input, EPUB text extraction, `--chapters` / `--no-chapters` / `--length`, `--format json`, and local `--url-provider defuddle` article extraction.

## Service Coverage

- Hosted OCR tests under `test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/` cover PDF and image extraction for Anthropic, DeepInfra, fal.ai, Gemini, GLM, Grok, Kimi, Mistral, OpenAI, and Replicate.
- The same directory covers remote article extraction with `--url-provider` for Firecrawl, GLM Reader, and Supadata.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ --price
bun t test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ --budget 2500
```

## Related Docs

- [Testing Overview](../../testing.md)
- [extract OCR](03-extract-ocr.md)
- [extract URL and X](04-extract-url.md)
