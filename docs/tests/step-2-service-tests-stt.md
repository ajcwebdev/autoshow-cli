# Step 2 Service Tests: STT

Hosted speech-to-text and URL transcript coverage for the extract STT route.

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
- Service STT coverage is split into model and scenario files per provider target under `test/test-cases/e2e/service/step-2-stt-e2e/stt-services/`, covering AssemblyAI, Deepgram, DeepInfra, Gemini, Gladia, Grok, Groq, Mistral, Rev, ScrapeCreators, Soniox, Speechmatics, Supadata, and Together, including URL transcript scenarios.
- Zero-cost routing, YouTube caption-first fallback, transcript parsing, and media acquisition validation live in `test/test-cases/validation/extract-stt/` and shared option/provider validation suites (`input-contracts.test.ts`, `option-resolution-contracts/`, `provider-selection-contracts/`, `price-mode-contracts/`, and `resume-setup-contracts.test.ts`).

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-2-stt-e2e/stt-services/ --price
bun t test/test-cases/e2e/service/step-2-stt-e2e/stt-services/ --budget 2500
```

## Related Docs

- [Service Tests](service-tests.md)
- [Local Tests](local-tests.md)
- [extract STT](../commands/process-steps/step-2-extract/02-extract-stt.md)
