# Setup Tests

Coverage for the `setup` command, `--doctor`, progress output, and managed downloads.

Safety: this suite is local and no-cost. Downloads are mocked, so nothing here calls a paid or quota-limited provider.

## Quick Start

```bash
bun test test/test-cases/validation/setup/
```

## Price Preflight

Setup has no provider-priced commands, so `--price` and `--budget` do not estimate anything for this suite.

## Related Docs

- [Testing Overview](../../testing.md)
- [Setup](setup.md)
