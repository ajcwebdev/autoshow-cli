# OCR Tests

Default to local contracts for routing, chapters, provider requests, pooling, pricing, and resume:

```bash
bun test test/test-cases/validation/text/ocr/
```

Local end-to-end coverage uses installed Tesseract, ebook, and document tools:

```bash
bun t test/test-cases/e2e/local/text/ocr/
```

Hosted tests make billable requests. Review their exact selection and estimate before execution:

```bash
bun t test/test-cases/e2e/service/text/ocr/ --price
```

The hosted suite covers the current OCR adapters with PDF/image cases where defined. `--budget 2500` filters each test key at an estimated 25¢; it is not a cumulative spending cap or authorization for the resulting batch. Follow the [testing guide](../../testing.md) and [spending rules](../../../../AGENTS.md) before running paid coverage. Mocks and decoded artifacts do not establish text accuracy or perceptual quality.

[OCR usage](overview.md)
