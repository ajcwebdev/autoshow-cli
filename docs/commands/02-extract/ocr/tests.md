# OCR Tests

Local Tesseract and EPUB coverage, plus hosted PDF and image tests for Gemini and Mistral and image-only tests for Anthropic, Grok, and OpenAI.

The hosted suite makes provider calls and may incur charges; the local suite does not.

## Quick Start

```bash
bun t test/test-cases/e2e/local/text/ocr/

bun t test/test-cases/e2e/service/text/ocr/
```

## Price Preflight

`--price` estimates without running provider tests. `--budget 2500` runs eligible tests using a 25¢ estimate threshold per test key, not a total spending cap.

```bash
bun t test/test-cases/e2e/service/text/ocr/ --price
bun t test/test-cases/e2e/service/text/ocr/ --budget 2500
```

## Related Docs

- [Testing Overview](../../testing.md)
- [extract OCR](overview.md)
