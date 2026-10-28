# URL Tests

Local e2e fetches a public article; hosted e2e may call paid or quota-limited providers.

## Quick Start

```bash
bun t test/test-cases/e2e/local/text/url/

bun t test/test-cases/e2e/service/text/url/
```

## Coverage

- Local e2e covers Defuddle article extraction.
- Hosted e2e covers Spider and Zyte article extraction and ScrapeCreators YouTube transcript retrieval.
- Local and mocked validation is in `test/test-cases/validation/text/url/` and makes no live provider calls.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/text/url/ --price
```

Preflight estimates charges; it does not verify extraction or transcript accuracy.

## Related Docs

- [Testing Overview](../../testing.md)
- [extract URL and X](overview.md)
