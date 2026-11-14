# URL Tests

Use local/mocked contracts for article adapters, retries, orchestration, transcript retrieval, and X reports:

```bash
bun test test/test-cases/validation/text/url/
```

The local end-to-end suite fetches a public article; it requires network access but no hosted-provider call:

```bash
bun t test/test-cases/e2e/local/text/url/
```

Hosted tests call Spider, Zyte, or ScrapeCreators and may incur charges. Preflight the selected suite before authorized execution:

```bash
bun t test/test-cases/e2e/service/text/url/ --price
```

Estimates do not establish extraction accuracy, caption availability, or account access. Follow the [testing guide](../../testing.md) and [spending rules](../../../../AGENTS.md).

[URL and X usage](overview.md)
