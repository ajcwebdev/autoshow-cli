# Setup Tests

Setup coverage for managed downloads, doctor checks, progress output, and runtime bootstrap artifacts.

Safety: this suite is local and no-cost. Downloads are mocked against fixture URLs, so nothing here calls a paid or quota-limited provider.

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

- No-cost setup validation coverage lives in `test/test-cases/validation/setup/` (`setup-command-contracts.test.ts`, `setup-doctor-contracts.test.ts`, `setup-progress-contracts.test.ts`, `native-setup-download-contracts.test.ts`, `managed-artifact-contracts.test.ts`, `retired-toolchain-contracts.test.ts`, `env-example-drift-contracts.test.ts`, and `setup-performance-contracts.test.ts`).

## Price Preflight

Setup does not add mapped price commands; `--price` and `--budget` do not provide step-specific setup preflight coverage.

## Related Docs

- [Testing Overview](../../testing.md)
- [Setup](setup.md)
