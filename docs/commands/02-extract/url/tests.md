# URL Tests

The hosted command may call paid or quota-limited providers.

## Quick Start

```bash
bun t test/test-cases/e2e/local/text/url/

bun t test/test-cases/e2e/service/text/url/
```

## Coverage

- Local e2e covers Defuddle article extraction.
- Hosted e2e covers Firecrawl, GLM Reader, and Supadata article extraction, plus public-URL transcript retrieval for Supadata and ScrapeCreators.
- Zero-cost validation is in `test/test-cases/validation/text/url/`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/text/url/ --price
```

## Related Docs

- [Testing Overview](../../testing.md)
- [extract URL and X](overview.md)
