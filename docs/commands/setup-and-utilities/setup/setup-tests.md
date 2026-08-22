# Setup Tests

Local no-cost coverage for the `setup` command, `--doctor`, progress output, and managed downloads.

Safety: this suite is local and no-cost. Downloads are mocked, so nothing here calls a paid or quota-limited provider.

## Outline

- [Quick Start](#quick-start)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
bun test test/test-cases/validation/setup/
```

## Current Coverage

- `test/test-cases/validation/setup/` covers setup command flags and steps, `--doctor` reporting, progress output, mocked managed downloads, and runtime artifacts.

## Price Preflight

Setup does not add mapped price commands; `--price` and `--budget` do not provide step-specific setup preflight coverage.

## Related Docs

- [Testing Overview](../../testing.md)
- [Setup](setup.md)
