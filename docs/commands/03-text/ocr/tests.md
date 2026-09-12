# OCR Tests

The no-cost `test/test-cases/validation/text/ocr/` directory contains the six migrated DOCX formatter contracts plus CLI tests for zero-cost/no-write preflight, Markdown artifact registration, unchanged ordinary extraction, invalid ZIP/XML, missing document entries, remote-input rejection, and provider-option rejection.

Local OCR validation plus hosted OCR coverage for `extract`.

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
bun t test/test-cases/e2e/local/text/ocr/

# hosted OCR service coverage
bun t test/test-cases/e2e/service/text/ocr/
```

## Local Coverage

- `test/test-cases/e2e/local/text/ocr/` covers local Tesseract OCR for PDF and image input, EPUB text extraction, `--chapters` / `--no-chapters` / `--length`, `--format json`.

## Service Coverage

- Hosted OCR tests under `test/test-cases/e2e/service/text/ocr/` cover PDF and image extraction for Anthropic, DeepInfra, fal.ai, Gemini, GLM, Grok, Kimi, Mistral, OpenAI, and Replicate.
- [URL tests](../url/tests.md) cover Defuddle and hosted article extraction.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/text/ocr/ --price
bun t test/test-cases/e2e/service/text/ocr/ --budget 2500
```

## Related Docs

- [Testing Overview](../../testing.md)
- [extract OCR](overview.md)
- [extract URL and X](../url/overview.md)
