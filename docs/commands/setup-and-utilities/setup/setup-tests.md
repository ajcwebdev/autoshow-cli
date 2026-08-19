# Setup Service Tests

Setup coverage for model downloads and service-adjacent runtime bootstrap checks.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Outline

- [Quick Start](#quick-start)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
bun t test/test-cases/validation/setup/
```

## Current Coverage

- No-cost setup validation coverage lives in `test/test-cases/validation/setup/` (`setup-command-contracts.test.ts`, `setup-doctor-contracts.test.ts`, `setup-progress-contracts.test.ts`, `native-setup-download-contracts.test.ts`, `managed-artifact-contracts.test.ts`, `retired-toolchain-contracts.test.ts`, and `setup-performance-contracts.test.ts`).

## Price Preflight

Setup does not add mapped price commands; `--price` and `--budget` do not provide step-specific setup preflight coverage.

## Related Docs

- [Testing Overview](../../testing.md)
- [Setup](setup.md)
