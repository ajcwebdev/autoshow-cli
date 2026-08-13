# Step 2 Service Tests: OCR

Hosted OCR and article-extraction coverage for the `extract` document/OCR route.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Outline

- [Quick Start](#quick-start)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
bun t test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/
```

## Current Coverage

- Model-level files under `test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/` cover PDF and image extraction with `--provider mistral=mistral-ocr-2512`, `--provider glm=glm-ocr`, `--provider kimi=kimi-k2.6`, `--provider openai=gpt-5.4-nano`, `--provider gemini=gemini-3.5-flash-lite`, and `--provider deepinfra=Qwen/Qwen3-VL-30B-A3B-Instruct`.
- Dedicated image-only OCR files cover `--provider openai=gpt-5.5`, `--provider grok=grok-4.3`, `--provider gemini=gemini-3.1-pro-preview`, and `--provider anthropic=claude-opus-4-8` / `--provider anthropic=claude-sonnet-5`. These are live provider tests and should not be run without explicit paid-provider approval.
- Kimi and DeepInfra OCR tests are gated on `KIMI_API_KEY` / `DEEPINFRA_API_KEY` and assert provider/model metadata and token usage when returned.
- Dedicated URL extraction files (`ocr-firecrawl.test.ts`, `ocr-glm-reader.test.ts`, `ocr-supadata.test.ts`) cover remote article extraction with `--url-provider` (firecrawl, glm-reader, supadata), write `extraction.txt`, and record canonical provider metadata.
- Hosted article and local HTML input validation also lives in `test/test-cases/validation/ingest/input-contracts.test.ts`. Mocked URL backend contracts for Firecrawl v2, Spider, Supadata, Zyte, GLM Reader, Defuddle, and route-aware `--all-providers` provider artifacts live in `test/test-cases/validation/ingest/html-url-backends-contracts/`.
- `test/test-cases/validation/cli/option-resolution-contracts/` covers all-backend expansion, URL concurrency defaults, conflict handling with `--url-provider`, and expected provider artifact paths without live API calls.
- Native EPUB cleanup and export validation lives in `test/test-cases/validation/extract-ocr/epub-contracts/`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ --price
bun t test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ --budget 2500
```

The mapped OCR price preflight covers the model-level service files plus Supadata, Firecrawl, and GLM Reader URL extraction.

`extract <url> --all-providers --price` is covered by the local validation suite. Do not run live all-provider URL e2e coverage unless hosted URL provider API usage has been explicitly approved.

## Related Docs

- [Service Tests](service-tests.md)
- [Local Tests](local-tests.md)
- [extract OCR](../commands/process-steps/step-2-extract/03-extract-ocr.md)
- [extract URL and X](../commands/process-steps/step-2-extract/04-extract-url.md)
