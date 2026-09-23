# OCR Tests

Local Tesseract and EPUB coverage, plus hosted PDF and image OCR for Anthropic, DeepInfra, Gemini, GLM, Kimi, Mistral, and OpenAI. Grok coverage is image extraction.

These `bun t` commands may call paid or quota-limited providers.

## Quick Start

```bash
bun t test/test-cases/e2e/local/text/ocr/

bun t test/test-cases/e2e/service/text/ocr/
```

## Price Preflight

```bash
bun t test/test-cases/e2e/service/text/ocr/ --price
bun t test/test-cases/e2e/service/text/ocr/ --budget 2500
```

## Related Docs

- [Testing Overview](../../testing.md)
- [extract OCR](overview.md)
