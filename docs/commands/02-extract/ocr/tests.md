# OCR Tests

Local Tesseract and EPUB coverage plus hosted OCR coverage for `extract`.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Quick Start

```bash
# local OCR coverage
bun t test/test-cases/e2e/local/text/ocr/

# hosted OCR service coverage
bun t test/test-cases/e2e/service/text/ocr/
```

## Local Coverage

- `test/test-cases/e2e/local/text/ocr/` covers local Tesseract OCR for PDF and image input, EPUB text extraction, `--chapters` / `--no-chapters` / `--length`, and `--format json`.
- Zero-cost validation lives in `test/test-cases/validation/text/ocr/`.

## Service Coverage

Hosted OCR tests under `test/test-cases/e2e/service/text/ocr/` cover PDF and image extraction for Anthropic, DeepInfra, Gemini, GLM, Grok, Kimi, Mistral, and OpenAI.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/text/ocr/ --price
bun t test/test-cases/e2e/service/text/ocr/ --budget 2500
```

## Related Docs

- [Testing Overview](../../testing.md)
- [extract OCR](overview.md)
