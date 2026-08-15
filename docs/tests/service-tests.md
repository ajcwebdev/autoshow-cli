# Service Tests

Service-backed, networked, and setup-adjacent test coverage for provider integrations, remote-input download paths, and cross-provider e2e flows.

Shared `bun t` runner behavior, artifacts, cleanup, and path-based selection are documented in [Local Tests](local-tests.md).

These commands are documented for humans. Service, e2e, and full-runner commands may call paid or quota-limited providers and must not be used as agent verification without explicit approval for that exact run. Agents should use `bun run check` plus the targeted no-cost smoke tests listed in [Local Tests](local-tests.md).

## Outline

- [Service Quick Start](#service-quick-start)
- [Step Pages](#step-pages)
- [Cross-Cutting Coverage](#cross-cutting-coverage)

## Service Quick Start

```bash
# setup bootstrap coverage
bun t test/test-cases/setup/tts-models/tts-setup.test.ts

# network-backed download coverage
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-direct-url.test.ts
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-streaming.test.ts
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-feed-or-channel.test.ts

# service command suites
bun t test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/
bun t test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ --price

bun t test/test-cases/e2e/service/step-2-stt-e2e/stt-services/
bun t test/test-cases/e2e/service/step-2-stt-e2e/stt-services/ --price

bun t test/test-cases/e2e/service/step-3-write-e2e/write-services/
bun t test/test-cases/e2e/service/step-3-write-e2e/write-services/ --price

bun t test/test-cases/e2e/service/step-4-tts-e2e/tts-services/
bun t test/test-cases/e2e/service/step-4-tts-e2e/tts-services/ --price

bun t test/test-cases/e2e/service/step-5-image-gen-e2e/
bun t test/test-cases/e2e/service/step-5-image-gen-e2e/ --price

bun t test/test-cases/e2e/service/step-6-video-gen-e2e/
bun t test/test-cases/e2e/service/step-6-video-gen-e2e/ --price

bun t test/test-cases/e2e/service/step-7-music-gen-e2e/
bun t test/test-cases/e2e/service/step-7-music-gen-e2e/ --price
```

## Step Pages

- [Setup Service Tests](step-0-service-tests-setup.md)
- [Step 1 Download Service Tests](step-1-service-tests-download.md)
- [Step 2 OCR Service Tests](step-2-service-tests-ocr.md)
- [Step 2 STT Service Tests](step-2-service-tests-stt.md)
- [Step 3 Write Service Tests](step-3-service-tests-write.md)
- [Step 4 TTS Service Tests](step-4-service-tests-tts.md)
- [Step 5 Image Service Tests](step-5-service-tests-image.md)
- [Step 6 Video Service Tests](step-6-service-tests-video.md)
- [Step 7 Music Service Tests](step-7-service-tests-music.md)

## Cross-Cutting Coverage

- `test/test-cases/validation/cli/option-resolution-contracts/`, `test/test-cases/validation/providers/provider-selection-contracts/`, and `test/test-cases/validation/reports-pricing/price-mode-contracts/` cover model-option resolution, provider selection, and price-mode behavior without live service calls.
- `test/test-cases/validation/providers/` and `test/test-cases/validation/resume-manifests/` cover mocked REST request/response payloads and manifest serialization across generation command families without live network requests.
- `test/test-cases/price-flag/` contains focused `--price` coverage for STT, OCR, write, TTS, image, video, and music command families.
