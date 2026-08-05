# Step 2 Service Tests: STT

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Outline

- [Quick Start](#quick-start)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
bun t test/test-cases/e2e/service/step-2-stt-e2e/stt-services/
```

## Current Coverage

- The shared `defineSTTServiceTest` helper covers invalid model rejection and real transcription when the required API key is configured. `--price` output coverage lives separately in `test/test-cases/price-flag/stt-price.test.ts` via the `defineSTTServicePriceTests` helper.
- YouTube caption-first mode and other zero-cost routing coverage live in validation suites such as `test/test-cases/validation/ingest/input-contracts.test.ts`, `test/test-cases/validation/cli/option-resolution-contracts/`, `test/test-cases/validation/providers/provider-selection-contracts/`, `test/test-cases/validation/reports-pricing/price-mode-contracts/`, `test/test-cases/validation/resume-manifests/resume-setup-contracts.test.ts`, and `test/test-cases/validation/extract-stt/stt-media-acquisition-contracts.test.ts`.
- Service STT coverage is split into one model or scenario file per provider target under `test/test-cases/e2e/service/step-2-stt-e2e/stt-services/`, including URL transcript scenarios.
- Gemini STT has a dedicated service file for `gemini-3.6-flash`; Gladia service coverage exercises `solaria-1` and `solaria-3`; Together coverage exercises `openai/whisper-large-v3` and `nvidia/parakeet-tdt-0.6b-v3`.
- `happyscribe` has dedicated mocked validation coverage in `test/test-cases/validation/extract-stt/happyscribe-transcript-parser-contracts.test.ts`. `scrapecreators` has dedicated mocked validation coverage in `test/test-cases/validation/extract-stt/scrapecreators-stt-contracts.test.ts`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-2-stt-e2e/stt-services/ --price
bun t test/test-cases/e2e/service/step-2-stt-e2e/stt-services/ --budget 2500
```

## Related Docs

- [Service Tests](service-tests.md)
- [Local Tests](local-tests.md)
- [extract STT](../commands/process-steps/step-2-extract/02-extract-stt.md)
