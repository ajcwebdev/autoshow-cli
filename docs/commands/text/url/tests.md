# URL Tests

URL extraction coverage is separate from OCR. Local Defuddle coverage lives in `test/test-cases/e2e/local/text/url/`; Firecrawl, GLM Reader, and Supadata service cases live in `test/test-cases/e2e/service/text/url/`.

## Local Contracts

The mocked backend contracts are local and no-cost:

```bash
bun test test/test-cases/validation/text/url/
```

The Defuddle e2e case fetches a public article. Hosted e2e cases call their selected providers and are subject to the repository's paid-provider execution rules.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/text/url/ --price
```

## Related Docs

- [Testing overview](../../testing.md)
- [URL extraction](overview.md)
- [OCR tests](../ocr/tests.md)
