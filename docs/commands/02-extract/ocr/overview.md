# extract OCR

Documents and images route through hosted OCR or native text extraction depending on the input format.

## Outline

- [Local OCR](#local-ocr)
- [OCR Setup](#ocr-setup)
- [OCR Environment](#ocr-environment)
- [OCR Routing](#ocr-routing)
- [Shared OCR Options](#shared-ocr-options)
- [Multi-Provider Execution Modes](#multi-provider-execution-modes)
- [EPUB Options](#epub-options)
- [PDF Chapter Detection](#pdf-chapter-detection)
- [OCR Services](#ocr-services)
  - [Mistral OCR](#mistral-ocr)
  - [OpenAI OCR](#openai-ocr)
  - [Grok OCR](#grok-ocr)
  - [Anthropic OCR](#anthropic-ocr)
  - [Gemini OCR](#gemini-ocr)
  - [DeepInfra OCR](#deepinfra-ocr)
- [OCR Notes](#ocr-notes)
- [Incomplete Runs and Blocked Providers](#incomplete-runs-and-blocked-providers)
- [Provider Capabilities](#provider-capabilities)

See the [`extract` overview](../overview.md) for input routing and default document/image OCR. Remote article URLs are documented separately in [URL and X extraction](../url/overview.md).

Standalone `extract` and `resume` use `--provider provider[=model]` for document/OCR inputs. `setup` persists defaults with `--ocr provider[=model]`.

## Local OCR

PDF, image, and CBZ inputs default to Tesseract. EPUB uses native text; `--provider tesseract` is also available. Convertible ebooks (MOBI, AZW/AZW3, PRC, FB2, LIT) convert to EPUB first. `--step-concurrency ocr-page=<n>` defaults to `10` for local OCR.

See [OCR Routing](#ocr-routing) for the full input-family matrix.

### Tesseract

| Option   | Value                                              |
| -------- | -------------------------------------------------- |
| Selector | default PDF/image path, or `--provider tesseract`  |
| Language | `--ocr-language <codes>` (e.g. `eng` or `eng+fra`) |
| DPI      | `--ocr-dpi <n>` (default `300`)                    |

```bash
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider tesseract --ocr-language eng --ocr-dpi 300
```
Tesseract is the only engine that consumes `--ocr-language`. It decrypts password PDFs locally and has no upload or page cap.

## OCR Setup

```bash
bun autoshow setup --step calibre
```
Calibre `ebook-convert` converts those formats to EPUB before extraction.

## OCR Environment

| Provider  | Required env        |
| --------- | ------------------- |
| Mistral   | `MISTRAL_API_KEY`   |
| OpenAI    | `OPENAI_API_KEY`    |
| Grok      | `XAI_API_KEY`       |
| Anthropic | `ANTHROPIC_API_KEY` |
| Gemini    | `GEMINI_API_KEY`    |
| DeepInfra | `DEEPINFRA_API_KEY` |

## OCR Routing

| Input family                                       | Default path                               | Hosted paths                         |
| -------------------------------------------------- | ------------------------------------------ | ------------------------------------ |
| PDF                                                | Tesseract                                  | hosted OCR engines                   |
| EPUB                                               | cleaned native extraction                  | hosted OCR engines                   |
| Convertible ebooks (MOBI, AZW/AZW3, PRC, FB2, LIT) | convert to EPUB, then follow the EPUB path | same as EPUB                         |
| DOCX / PPTX / XLSX / ODF                           | native text extraction                     | OCR flags are ignored with a warning |
| RTF                                                | native RTF text extraction                 | OCR flags are ignored with a warning |
| CBZ                                                | per-image OCR                              | hosted OCR engines                   |
| CSV                                                | raw text                                   | OCR flags are ignored with a warning |
| PNG / JPG / JPEG / TIF / TIFF / GIF                | Tesseract                                  | hosted OCR engines                   |
| WebP / BMP                                         | convert to PNG, then OCR                   | hosted OCR engines                   |

WebP, GIF, and BMP convert to PNG when a provider does not accept them natively. TIFF converts to PNG when ImageMagick is installed.

## Shared OCR Options

| Flag                                   | Description                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--format <format>`                    | Output format: `text` or `json`                                                                                                                                    |
| `--password <value>`                   | Password for encrypted PDFs                                                                                                                                        |
| `--docx-markdown`                      | Write `extraction.md` from a local DOCX while preserving formatting (no providers)                                                                                 |
| `--all-providers`                      | Enable every supported hosted OCR provider/model for this route                                                                                                    |
| `--ocr-provider-mode <mode>`           | Multi-provider execution: `fanout` or `pool`; default `fanout`                                                                                                     |
| `--primary-ocr <service[/model]>`      | In fan-out multi-provider OCR, choose which requested complete provider result writes top-level extraction artifacts; invalid in pool mode                         |
| `--provider-concurrency <n>`           | Hosted providers/models to run concurrently per item; default `7`                                                                                                  |
| `--step-concurrency ocr-page=<n>`      | Page-level OCR concurrency. Hosted OCR defaults to `auto`. Pass a number to set a fixed cap.                                                                       |
| `--concurrency-mode <ramp\|immediate>` | Approach each hosted provider/account page cap from one request at one added slot every five seconds (`ramp`, default), or start at the resolved cap (`immediate`) |
| `--ocr-dpi <n>`                        | Render DPI for OCR pages                                                                                                                                           |
| `--chapters`, `--no-chapters`          | EPUB native text runs and long PDF chapter autodetection: write chapter files under `chapters/`; use `--no-chapters` for a single extracted file                   |
| `--length <n>`                         | Hard export limit in thousands of characters; splits oversized EPUB or PDF chapter files                                                                           |
| `--pdf-chapter-mode <mode>`            | PDF chapter detection mode: `local`, `auto`, or `llm`                                                                                                              |
| `--price`                              | Show the aggregated OCR estimate and exit                                                                                                                          |
| `--max-model-cents <n>`                | Exclude each provider/model whose estimated total across the invocation exceeds the per-model ceiling in cents; works with or without `--price`                    |

```bash
bun autoshow extract input/examples/document/harborlight-field-notes.pdf

bun autoshow extract input/examples/document/harborlight-field-notes.pdf --format json

bun autoshow extract input/examples/document/harborlight-field-notes.pdf --all-providers --price

bun autoshow extract input/examples/document/harborlight-field-notes.pdf --all-providers --max-model-cents 10 --price
```
See [Provider Capabilities](#provider-capabilities) for the per-model native PDF, image, limit, structured-output, and input/output price matrix.

OCR estimates can use bundled, reasoning-specific token profiles for single-page prose images when no learned local profile is available. These report `tokenEstimateSource: calibrated-registry`; PDF, CBZ, other page bands and unmeasured policies retain existing estimates. Published prices are separate from token estimates. See the [September 23 calibration record](../../../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md#reasoning-calibration-and-provider-vocabulary-review-2026-09-23) for qualified contexts and limits.

## Multi-Provider Execution Modes

`fanout` is the default. One selected target, including implicit Tesseract, writes the top-level extraction and does not create `providers/`. When more than one OCR target is selected, each receives the full document and writes a complete independent result below `providers/<service>-<model>/`, and no top-level extraction is written unless `--primary-ocr` selects one of those complete results.

`pool` creates one composite extraction. Faster targets can process more pages, and remaining pages can continue on another target after a failure. The assembled document is written as the top-level extraction in original page order. Provider directories hold per-page attempts, not complete independent documents, and `--primary-ocr` is rejected.

```bash
bun autoshow extract input/examples/document/harborlight-field-notes.pdf \
  --provider grok=grok-4.5 \
  --provider mistral=mistral-ocr-4-0 \
  --ocr-provider-mode pool \
  --step-concurrency ocr-page=10
```
Pool mode works for PDFs, CBZ archives, and supported images. `--price` estimates the full page set once rather than charging each provider for every page; `resume --price` estimates only unfinished pages.

## EPUB Options

EPUB inputs default to cleaned native text instead of OCR page rendering.

```bash
bun autoshow extract input/examples/document/1-epub.epub
bun autoshow extract input/examples/document/1-epub.epub --format json
bun autoshow extract input/examples/document/1-epub.epub --length 50
bun autoshow extract input/examples/document/1-epub.epub --no-chapters
```
Native extraction writes one cleaned file per kept section under `chapters/` (`chapters/<ordinal>-<source-index>-<slug>.txt`). `--length <n>` splits oversized section files with `-part-NN` suffixes. `--no-chapters` writes a single extracted file.

## PDF Chapter Detection

```bash
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --chapters --pdf-chapter-mode local
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --chapters --pdf-chapter-mode auto
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --no-chapters
```
The original Harborlight PDF has four text-bearing pages and two chapter starts/bookmarks. The first example forces local detection below the automatic threshold; the final example keeps one combined extraction.

PDFs with at least 40 extracted pages automatically attempt local chapter detection and write `chapters/<ordinal>-<pdf-start-page>-<slug>.txt`. `--chapters` forces autodetection at any page count; `--no-chapters` writes a single extracted file.

Local detection uses PDF bookmarks, TOC pages, and headings. Automatic detection always stays on `local`, including when `--pdf-chapter-mode` is set without `--chapters`. With `--chapters`, `local` stays fully local, `auto` allows model-assisted resolution when local detection is weak and an LLM is configured, and `llm` always attempts model-assisted resolution.

## OCR Services

### Mistral OCR

| Option   | Value                                |
| -------- | ------------------------------------ |
| Selector | `--provider mistral[=<model>]`       |
| Models   | `mistral-ocr-4-0`, `mistral-ocr-4-1` |

```bash
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider mistral=mistral-ocr-4-0
```
Bare `--provider mistral` defaults to `mistral-ocr-4-0`.

### OpenAI OCR

| Option   | Value                         |
| -------- | ----------------------------- |
| Selector | `--provider openai[=<model>]` |

```bash
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider openai=gpt-6.1-sol --reasoning-effort high
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider openai=gpt-6-luna --reasoning-effort disabled
```
Bare `--provider openai` defaults to `gpt-6-luna`. GPT-6.1 Sol and GPT-6 Luna use Responses with native JSON pages, 1,050,000 context tokens and 128,000 maximum output tokens. PDFs are limited to 50 MB per file and per request; images use PNG/JPEG/WEBP/non-animated GIF. Both accept `low`, `medium`, `high`, `xhigh`, and `max`; omitted effort or `default` delegates to native `medium`. Sol requires reasoning; Luna also accepts `disabled`. Both reject `minimal`. [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna).

Their standard input/output rates are `$2 / $10` and `$0.10 / $0.50` per 1M tokens respectively. Above 272,000 input tokens the full request uses `$4 / $15` for Sol or `$0.20 / $0.75` for Luna. Retained `gpt-6-astra` requires reasoning and uses `$10 / $50`, rising to `$20 / $75` above the same boundary.

### Grok OCR

| Option   | Value                       |
| -------- | --------------------------- |
| Selector | `--provider grok[=<model>]` |

```bash
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider grok=grok-4.7 --reasoning-effort high
```
Bare `--provider grok` defaults to retained `grok-4.5`. Grok 4.7 renders PDFs to PNG, accepts PNG/JPEG images up to 20 MiB, and uses a 500,000-token context. AutoShow caps visible OCR text at 4,096 tokens per page; this application cap is separate from reasoning and the provider's uncapped model text output. Its `low`, `medium`, `high`, and `xhigh` efforts default natively to `high` when omitted or reset to `default`; `disabled`, `minimal`, and `max` are rejected. Grok 4.5 rejects `xhigh`. [Model](https://docs.x.ai/developers/models/grok-4.7).

Grok 4.7 input/output costs are `$2 / $6` per 1M tokens below 200,000 input tokens, then `$4 / $12` for the entire request at 200,000 or more. Reasoning tokens are billable output. [Pricing](https://docs.x.ai/developers/pricing).

### Anthropic OCR

| Option   | Value                            |
| -------- | -------------------------------- |
| Selector | `--provider anthropic[=<model>]` |

```bash
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider anthropic=claude-opus-5-5 --reasoning-effort medium
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider anthropic=claude-sonnet-5-5 --reasoning-effort high
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider anthropic=claude-haiku-5-5 --reasoning-effort disabled
```
Bare `--provider anthropic` defaults to `claude-haiku-5-5`. The 5.5 tiers use native JSON pages, 1M context and 128K ordinary provider output; AutoShow OCR requests cap thinking plus text at 64,000 tokens. Images use PNG/JPEG/GIF/WEBP with a conservative 5 MiB raw-image cap; PDF Files uploads allow 500 MB, subject to context limits. Encrypted PDFs are rejected. Opus requires adaptive thinking. Sonnet's `between_tools` mode does not mean disabled and is not exposed here; both Opus and Sonnet reject `disabled`. Haiku accepts it. All three accept `low`, `medium`, `high`, `xhigh`, and `max`, reject `minimal`, and delegate omitted/reset effort to native defaults: Opus/Haiku `medium`, Sonnet `high`. [Opus](https://platform.claude.com/docs/en/models/opus-5-5/overview), [Sonnet](https://platform.claude.com/docs/en/models/sonnet-5-5/overview), [Haiku](https://platform.claude.com/docs/en/models/haiku-5-5/overview).

Haiku uses `$0.10 / $0.50` per 1M input/output tokens through 100,000 prompt tokens; above that threshold the whole request, including output, costs `$0.50 / $2.50`. Opus uses `$4 / $20` and Sonnet `$2 / $10`. New page estimates are uncalibrated planning heuristics. Retained Fable 5 requires 30-day retention and is unavailable under ZDR; Fable 5.1 requires reasoning. [Pricing](https://platform.claude.com/docs/en/about-claude/pricing).

### Gemini OCR

| Option   | Value                         |
| -------- | ----------------------------- |
| Selector | `--provider gemini[=<model>]` |

```bash
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider gemini=gemini-3.5-flash-lite
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider gemini=gemini-3.6-flash
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider gemini=gemini-4-argon --reasoning-effort medium
```
Bare `--provider gemini` defaults to `gemini-3.5-flash-lite`. PNG/JPEG/WEBP images are sent directly; GIF/BMP images are normalized to PNG. Flash caps include 50 MB inline PDFs, 2 GB uploads and 1,000 PDF pages. Flash 3.8 accepts `low`, `medium`, and `high`, rejecting `minimal` and `disabled`; its standard `$1.50 / $7.50` rates overstate the introductory `$0.75 / $3.75` prices through 2026-12-31. [Pricing](https://ai.google.dev/gemini-api/docs/pricing).

Gemini 4 Argon uses synchronous GenerateContent and native JSON pages. PDFs are capped at 50 MiB and 1,000 pages, including uploads; the image transport permits 100 MiB inline or 2 GiB uploaded, subject to model context capacity. Input, thinking and output share 1,048,576 tokens. OCR requests budget at least 32,768 and at most 65,536 thinking/output tokens. `low`, `medium`, and `high` are accepted; omitted effort or `default` delegates to native `medium`. `minimal` and `disabled` are rejected. Long decode/background/continuation are outside this implementation. [Model](https://ai.google.dev/gemini-api/docs/models/gemini-4-argon), [PDF limits](https://ai.google.dev/gemini-api/docs/document-processing).

Argon estimates conservatively use standard `$4 / $20` per 1M input/output tokens, overstating introductory `$2 / $10` pricing through 2026-11-30. Standard prices start 2026-12-01; explicit caching is unsupported. Output usage includes thought tokens once. [Pricing](https://ai.google.dev/gemini-api/docs/pricing).

### DeepInfra OCR

| Option   | Value                                                                          |
| -------- | ------------------------------------------------------------------------------ |
| Selector | `--provider deepinfra[=<model>]`                                               |
| Models   | `google/gemma-4-31B-it`, `Qwen/Qwen3.8-27B`, `deepseek-ai/DeepSeek-V4.1-Flash` |

```bash
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider deepinfra=google/gemma-4-31B-it
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider deepinfra=Qwen/Qwen3.8-27B
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider deepinfra=deepseek-ai/DeepSeek-V4.1-Flash
```
Bare `--provider deepinfra` defaults to `google/gemma-4-31B-it`. All three models accept one image per request, at most 20 MB. Reasoning defaults to disabled; optional `low|medium|high` effort is supported on each.

## OCR Notes

- A single-target `extract` document run writes top-level `extraction.txt` or `result.json` plus `manifest.json`.
- Each provider entry in `manifest.json` carries `settings`: DPI, language, reasoning effort, output format, provider mode, and chapter options. PDF passwords are never recorded.
- Backfill existing OCR outputs with [`resume`](../../00-setup-and-utilities/resume.md).

## Incomplete Runs and Blocked Providers

Hosted OCR failures are either retryable or blocked. Timeouts, network errors, temporary `5xx` responses, and genuine rate limits stay retryable. Insufficient balance, billing required, account suspension, quota exhaustion, content-policy blocks, auth failures, and provider no-retry responses are blocked: that provider stops new page work while other requested providers continue.

If at least one selected provider succeeds and another does not, the item stays `status: "incomplete"` and successful outputs remain under `providers/<service>-<model>/`. Each failed provider writes a redacted `error.json`. Automatic `resume` skips blocked providers. `resume <dir> --provider provider=model` retries a specific provider after you fix the cause.

## Provider Capabilities

Marks: ✅ supported, ⚠️ partial or qualified, ❌ not supported. All 21 active hosted OCR models are listed; local Tesseract is documented above. Rows are newest first. Released dates are provider announcement or model-origin dates. Recency marks: ✅ 2026-04-01 or later, ⚠️ 2026-01-01 through 2026-03-31, ❌ before 2026-01-01. Token-priced models show input and output per 1M tokens plus an approximate cost per 1,000 pages. These page estimates use registry token heuristics and the lower prompt-price band, and are not provider page tariffs or measured model quality. Mistral bills per page; Inputs is `Included`. Input pricing: ✅ cheapest third of token-priced models, ⚠️ middle third, ❌ most expensive third. Cost rank is cheapest first on the per-1k-page estimate (1 = cheapest); ties share a rank.

Tesseract and rendered-page providers apply `--password` locally. Anthropic rejects encrypted PDFs. Mistral, OpenAI, and Gemini upload the PDF as provided; if the upload falls back to per-page OCR, those pages are rendered locally with the password. Mistral returns per-page markdown and keeps layout in the markup.

| Provider                                    | Released   | Native PDF                    | Images              | Image cap       | PDF cap          | Pages          | Structured pages  | Reasoning                 | Inputs           | Outputs                          | Cost rank |
| ------------------------------------------- | ---------- | ----------------------------- | ------------------- | --------------- | ---------------- | -------------- | ----------------- | ------------------------- | ---------------- | -------------------------------- | --------- |
| Gemini `gemini-4-argon`                     | ✅ 2026-10 | ✅ Native PDF                 | ✅ PNG JPG WEBP     | ✅ 2 GiB upload | ⚠️ 50 MiB        | ✅ 1000 pages  | ✅ JSON pages     | ✅ Required through high  | ❌ $4.00 per 1M  | $20.00 per 1M (≈$37.15/1k pages) | 17/21     |
| Anthropic `claude-haiku-5-5`                | ✅ 2026-10 | ✅ Unencrypted PDF upload     | ✅ PNG JPG WEBP GIF | ❌ 5 MiB        | ⚠️ 500 MB upload | ⚠️ Unpublished | ✅ JSON pages     | ✅ Optional through max   | ✅ $0.10 per 1M  | $0.50 per 1M (≈$1.10/1k pages)   | 4/21      |
| OpenAI `gpt-6.1-sol`                        | ✅ 2026-09 | ✅ Native PDF                 | ✅ PNG JPG WEBP GIF | ⚠️ Request size | ⚠️ 50 MB         | ⚠️ Unpublished | ✅ JSON pages     | ✅ Required through max   | ⚠️ $2.00 per 1M  | $10.00 per 1M (≈$12.65/1k pages) | 11/21     |
| Anthropic `claude-sonnet-5-5`               | ✅ 2026-09 | ✅ Unencrypted PDF upload     | ✅ PNG JPG WEBP GIF | ❌ 5 MiB        | ⚠️ 500 MB upload | ⚠️ Unpublished | ✅ JSON pages     | ✅ Optional through max   | ⚠️ $2.00 per 1M  | $10.00 per 1M (≈$22.00/1k pages) | 16/21     |
| OpenAI `gpt-6-luna`                         | ✅ 2026-09 | ✅ Native PDF                 | ✅ PNG JPG WEBP GIF | ⚠️ Request size | ⚠️ 50 MB         | ⚠️ Unpublished | ✅ JSON pages     | ✅ Optional through max   | ✅ $0.10 per 1M  | $0.50 per 1M (≈$0.59/1k pages)   | 2/21      |
| Anthropic `claude-opus-5-5`                 | ✅ 2026-09 | ✅ Unencrypted PDF upload     | ✅ PNG JPG WEBP GIF | ❌ 5 MiB        | ⚠️ 500 MB upload | ⚠️ Unpublished | ✅ JSON pages     | ✅ Required through max   | ❌ $4.00 per 1M  | $20.00 per 1M (≈$44.00/1k pages) | 18/21     |
| Grok `grok-4.7`                             | ✅ 2026-09 | ⚠️ Rendered PNG pages         | ✅ PNG JPG          | ❌ 20 MiB       | ⚠️ N/A           | ⚠️ N/A         | ❌ Plain text     | ✅ Required through xhigh | ⚠️ $2.00 per 1M  | $6.00 per 1M (≈$14.00/1k pages)  | 14/21     |
| Mistral `mistral-ocr-4-1`                   | ✅ 2026-09 | ✅ Native PDF upload          | ✅ PNG JPG TIF      | ⚠️ Unpublished  | ⚠️ Unpublished   | ⚠️ Unpublished | ⚠️ Markdown pages | ❌ No                     | Included         | ✅ $4.00/1k pages                | 6/21      |
| Gemini `gemini-3.8-flash`                   | ✅ 2026-09 | ✅ 50 MB inline / 2 GB upload | ✅ PNG JPG WEBP     | ✅ 2 GB         | ✅ 2 GB          | ✅ 1000 pages  | ✅ JSON pages     | ✅ Optional               | ⚠️ $1.50 per 1M  | $7.50 per 1M (≈$13.93/1k pages)  | 12/21     |
| OpenAI `gpt-6-astra`                        | ✅ 2026-09 | ✅ Native PDF                 | ✅ PNG JPG WEBP GIF | ⚠️ Request size | ⚠️ 50 MB         | ⚠️ Unpublished | ✅ JSON pages     | ✅ Required               | ❌ $10.00 per 1M | $50.00 per 1M (≈$63.25/1k pages) | 19/21     |
| Anthropic `claude-fable-5-1`                | ✅ 2026-09 | ✅ Unencrypted PDF upload     | ✅ PNG JPG WEBP GIF | ❌ 5 MB         | ⚠️ 500 MB upload | ⚠️ Unpublished | ✅ JSON pages     | ✅ Required               | ❌ $10.00 per 1M | $50.00 per 1M (≈$63.69/1k pages) | 20/21     |
| DeepInfra `deepseek-ai/DeepSeek-V4.1-Flash` | ✅ 2026-09 | ⚠️ Rendered PNG pages         | ✅ PNG JPG WEBP     | ❌ 20 MB        | ⚠️ N/A           | ⚠️ N/A         | ❌ Plain text     | ⚠️ Optional               | ✅ $0.20 per 1M  | $0.60 per 1M (≈$0.54/1k pages)   | 1/21      |
| OpenAI `gpt-5.6-terra`                      | ✅ 2026-08 | ✅ Native PDF                 | ✅ PNG JPG WEBP GIF | ⚠️ Request size | ⚠️ 50 MB         | ⚠️ Unpublished | ✅ JSON pages     | ✅ Optional               | ⚠️ $2.00 per 1M  | $12.00 per 1M (≈$12.17/1k pages) | 10/21     |
| DeepInfra `Qwen/Qwen3.8-27B`                | ✅ 2026-08 | ⚠️ Rendered PNG pages         | ✅ PNG JPG WEBP     | ❌ 20 MB        | ⚠️ N/A           | ⚠️ N/A         | ❌ Plain text     | ⚠️ Optional               | ✅ $0.20 per 1M  | $2.50 per 1M (≈$2.94/1k pages)   | 5/21      |
| Gemini `gemini-3.6-flash`                   | ✅ 2026-07 | ✅ 50 MB inline / 2 GB upload | ✅ PNG JPG WEBP     | ✅ 2 GB         | ✅ 2 GB          | ✅ 1000 pages  | ✅ JSON pages     | ✅ Optional               | ⚠️ $1.50 per 1M  | $7.50 per 1M (≈$13.93/1k pages)  | 12/21     |
| Grok `grok-4.5`                             | ✅ 2026-07 | ⚠️ Rendered PNG pages         | ✅ PNG JPG          | ❌ 20 MiB       | ⚠️ N/A           | ⚠️ N/A         | ❌ Plain text     | ✅ Required               | ⚠️ $2.00 per 1M  | $6.00 per 1M (≈$14.00/1k pages)  | 14/21     |
| Anthropic `claude-fable-5`                  | ✅ 2026-07 | ✅ Unencrypted PDF upload     | ✅ PNG JPG WEBP GIF | ❌ 5 MB         | ⚠️ 500 MB upload | ⚠️ Unpublished | ✅ JSON pages     | ✅ Required               | ❌ $10.00 per 1M | $50.00 per 1M (≈$63.69/1k pages) | 20/21     |
| Mistral `mistral-ocr-4-0`                   | ✅ 2026-06 | ✅ Native PDF upload          | ✅ PNG JPG TIF      | ⚠️ Unpublished  | ⚠️ Unpublished   | ⚠️ Unpublished | ⚠️ Markdown pages | ❌ No                     | Included         | ✅ $4.00/1k pages                | 6/21      |
| Gemini `gemini-3.5-flash-lite`              | ✅ 2026-06 | ✅ 50 MB inline / 2 GB upload | ✅ PNG JPG WEBP     | ✅ 2 GB         | ✅ 2 GB          | ✅ 1000 pages  | ✅ JSON pages     | ✅ Optional               | ✅ $0.30 per 1M  | $2.50 per 1M (≈$4.41/1k pages)   | 8/21      |
| Gemini `gemini-3.5-flash`                   | ✅ 2026-06 | ✅ 50 MB inline / 2 GB upload | ✅ PNG JPG WEBP     | ✅ 2 GB         | ✅ 2 GB          | ✅ 1000 pages  | ✅ JSON pages     | ✅ Optional               | ⚠️ $1.50 per 1M  | $9.00 per 1M (≈$7.31/1k pages)   | 9/21      |
| DeepInfra `google/gemma-4-31B-it`           | ✅ 2026-04 | ⚠️ Rendered PNG pages         | ✅ PNG JPG WEBP     | ❌ 20 MB        | ⚠️ N/A           | ⚠️ N/A         | ❌ Plain text     | ⚠️ Optional               | ✅ $0.13 per 1M  | $0.38 per 1M (≈$0.92/1k pages)   | 3/21      |
