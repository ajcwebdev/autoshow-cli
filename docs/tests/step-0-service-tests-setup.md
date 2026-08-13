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
bun t test/test-cases/setup/tts-models/tts-setup.test.ts
```

## Current Coverage

- `test/test-cases/setup/tts-models/tts-setup.test.ts` validates the Kitten TTS setup module and runtime virtualenv checks.
- No-cost setup validation coverage lives in `test/test-cases/validation/setup/` (`setup-command-contracts.test.ts`, `native-setup-download-contracts.test.ts`, `managed-artifact-contracts.test.ts`, `prebuilt-artifact-contracts.test.ts`, `prebuilt-producer-contracts.test.ts`, and `setup-performance-contracts.test.ts`). No standalone step 0 price-only suite currently exists.

## Price Preflight

Setup does not currently add any mapped price commands. `--price` and `--budget` do not provide step-specific setup preflight coverage today.

## Related Docs

- [Service Tests](service-tests.md)
- [Setup](../commands/setup-and-utilities/setup/setup.md)
