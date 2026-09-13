# URL Tests

Local Defuddle coverage plus hosted article extraction coverage for `extract`.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Quick Start

```bash
# local URL coverage
bun t test/test-cases/e2e/local/text/url/

# hosted URL service coverage
bun t test/test-cases/e2e/service/text/url/
```

## Local Coverage

- `test/test-cases/e2e/local/text/url/` covers Defuddle extraction of a public article.
- Zero-cost validation lives in `test/test-cases/validation/text/url/`.

## Service Coverage

Hosted URL tests under `test/test-cases/e2e/service/text/url/` cover Firecrawl, GLM Reader, and Supadata.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/text/url/ --price
```

## Related Docs

- [Testing Overview](../../testing.md)
- [extract URL and X](overview.md)
