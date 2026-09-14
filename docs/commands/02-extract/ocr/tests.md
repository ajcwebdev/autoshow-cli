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

## Coverage

- Local e2e covers Tesseract PDF and image OCR, EPUB extraction, `--chapters` / `--no-chapters` / `--length`, and `--format json`.
- Hosted e2e covers PDF and image extraction for Anthropic, DeepInfra, Gemini, GLM, Kimi, Mistral, and OpenAI, plus image extraction for Grok.
- Zero-cost validation is in `test/test-cases/validation/text/ocr/`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/text/ocr/ --price
bun t test/test-cases/e2e/service/text/ocr/ --budget 2500
```

## Related Docs

- [Testing Overview](../../testing.md)
- [extract OCR](overview.md)
