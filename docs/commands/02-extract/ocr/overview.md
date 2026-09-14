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
  - [GLM OCR](#glm-ocr)
  - [Kimi OCR](#kimi-ocr)
  - [OpenAI OCR](#openai-ocr)
  - [Grok OCR](#grok-ocr)
  - [Anthropic OCR](#anthropic-ocr)
  - [Gemini OCR](#gemini-ocr)
  - [DeepInfra OCR](#deepinfra-ocr)
- [OCR Notes](#ocr-notes)
- [Incomplete Runs and Blocked Providers](#incomplete-runs-and-blocked-providers)
- [Provider Capabilities](#provider-capabilities)

See the [`extract` overview](../overview.md) for input routing and default document/image OCR. Remote article URLs are documented separately in [URL and X extraction](../url/overview.md).

Standalone `extract` and `resume` use `--provider provider[=model]` for document/OCR inputs. `config` uses `--ocr provider[=model]`.

## Local OCR

PDF, image, and CBZ inputs default to Tesseract. EPUB uses native text; `--provider tesseract` is also available. Convertible ebooks (MOBI, AZW/AZW3, PRC, FB2, LIT) convert to EPUB first. `--ocr-concurrency` defaults to `10` for local OCR.

See [OCR Routing](#ocr-routing) for the full input-family matrix.

### Tesseract

| Option   | Value                                              |
| -------- | -------------------------------------------------- |
| Selector | default PDF/image path, or `--provider tesseract`  |
| Language | `--ocr-language <codes>` (e.g. `eng` or `eng+fra`) |
| DPI      | `--ocr-dpi <n>` (default `300`)                    |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider tesseract --ocr-language eng+fra --ocr-dpi 300
```

Tesseract is the only engine that consumes `--ocr-language`. It decrypts password PDFs locally and has no upload or page cap.

## OCR Setup

```bash
# Convertible ebooks: MOBI, AZW/AZW3, PRC, FB2, LIT
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
| GLM       | `GLM_API_KEY`       |
| Kimi      | `KIMI_API_KEY`      |
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
| `--all-providers`                      | Enable every supported hosted OCR provider/model for this route                                                                                                    |
| `--ocr-provider-mode <mode>`           | Multi-provider execution: `fanout` or `pool`; default `fanout`                                                                                                     |
| `--primary-ocr <service[/model]>`      | In fan-out multi-provider OCR, choose which requested complete provider result writes top-level extraction artifacts; invalid in pool mode                         |
| `--provider-concurrency <n>`           | Hosted providers/models to run concurrently per item; default `10`                                                                                                 |
| `--ocr-concurrency <n>`                | Page-level OCR concurrency. Hosted OCR defaults to `auto`. Pass a number to set a fixed cap.                                                                       |
| `--concurrency-mode <ramp\|immediate>` | Approach each hosted provider/account page cap from one request at one added slot every five seconds (`ramp`, default), or start at the resolved cap (`immediate`) |
| `--ocr-dpi <n>`                        | Render DPI for OCR pages                                                                                                                                           |
| `--chapters`, `--no-chapters`          | EPUB native text runs and long PDF chapter autodetection: write chapter files under `chapters/`; use `--no-chapters` for a single extracted file                   |
| `--length <n>`                         | Hard export limit in thousands of characters; splits oversized EPUB or PDF chapter files                                                                           |
| `--pdf-chapter-mode <mode>`            | PDF chapter detection mode: `local`, `auto`, or `llm`                                                                                                              |
| `--price`                              | Show the aggregated OCR estimate and exit                                                                                                                          |
| `--max-model-cents <n>`                | Exclude each provider/model whose estimated total across the invocation exceeds the per-model ceiling in cents; works with or without `--price`                    |

```bash
# Default PDF extraction
bun autoshow extract input/examples/document/1-document.pdf

# JSON output
bun autoshow extract input/examples/document/1-document.pdf --format json

# Fan out across every OCR provider in price mode
bun autoshow extract input/examples/document/1-document.pdf --all-providers --price

# Keep only OCR provider/model targets estimated at 10 cents or less
bun autoshow extract input/examples/document/1-document.pdf --all-providers --max-model-cents 10 --price
```

See [Provider Capabilities](#provider-capabilities) for the per-model native PDF, image, limit, structured-output, and price matrix.

## Multi-Provider Execution Modes

`fanout` is the default: every selected OCR target receives the full document and writes a complete independent result below `providers/<service>-<model>/`. No top-level extraction is written unless `--primary-ocr` selects one of those complete results.

`pool` creates one composite extraction. Faster targets can process more pages, and remaining pages can continue on another target after a failure. The assembled document is written as the top-level extraction in original page order. Provider directories hold per-page attempts, not complete independent documents, and `--primary-ocr` is rejected.

```bash
bun autoshow extract document.pdf \
  --provider grok=grok-4.5 \
  --provider mistral=mistral-ocr-4-0 \
  --provider kimi=kimi-k3 \
  --ocr-provider-mode pool \
  --ocr-concurrency 10
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
bun autoshow extract book.pdf
bun autoshow extract input/examples/document/3-document.pdf --chapters
bun autoshow extract input/examples/document/3-document.pdf --chapters --pdf-chapter-mode auto
bun autoshow extract book.pdf --no-chapters
```

PDFs with at least 40 extracted pages automatically attempt local chapter detection and write `chapters/<ordinal>-<pdf-start-page>-<slug>.txt`. `--chapters` forces autodetection at any page count; `--no-chapters` writes a single extracted file.

Local detection uses PDF bookmarks, TOC pages, and headings. `--pdf-chapter-mode local` stays fully local. `auto` allows model-assisted resolution when local detection is weak and an LLM is configured. `llm` always attempts model-assisted resolution.

## OCR Services

### Mistral OCR

| Option   | Value                                |
| -------- | ------------------------------------ |
| Selector | `--provider mistral[=<model>]`       |
| Models   | `mistral-ocr-4-0`, `mistral-ocr-4-1` |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider mistral=mistral-ocr-4-0
```

Bare `--provider mistral` defaults to `mistral-ocr-4-0`.

### GLM OCR

| Option   | Value                      |
| -------- | -------------------------- |
| Selector | `--provider glm[=<model>]` |
| Models   | `glm-5.3-flash`            |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider glm=glm-5.3-flash
```

Images are limited to 10 MB each. `glm-5.3-flash` requires reasoning (`--reasoning-effort low|high|max`; `disabled` is rejected). [pricing](https://docs.z.ai/guides/overview/pricing)

### Kimi OCR

| Option   | Value                       |
| -------- | --------------------------- |
| Selector | `--provider kimi[=<model>]` |
| Models   | `kimi-k2.6`, `kimi-k3`      |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider kimi=kimi-k2.6
bun autoshow extract input/examples/document/1-document.pdf --provider kimi=kimi-k3
```

Bare `--provider kimi` defaults to `kimi-k2.6`. Image uploads are capped at 100 MB.

### OpenAI OCR

| Option   | Value                         |
| -------- | ----------------------------- |
| Selector | `--provider openai[=<model>]` |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider openai=gpt-5.6-sol
bun autoshow extract input/examples/document/1-document.pdf --provider openai=gpt-5.6-luna
```

Bare `--provider openai` defaults to the cheapest OpenAI OCR model. Maximum PDF size is 50 MB. `gpt-6-astra` requires reasoning (`low`, `medium`, `high`, `xhigh`, `max`; disabled and minimal are rejected) and estimates use $10/$50 per 1M tokens, then $20/$75 for the entire request above 272K input tokens.

### Grok OCR

| Option   | Value                       |
| -------- | --------------------------- |
| Selector | `--provider grok[=<model>]` |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider grok=grok-4.5
```

Bare `--provider grok` defaults to `grok-4.5`. Direct images and rendered pages are capped at 20 MiB each.

### Anthropic OCR

| Option   | Value                            |
| -------- | -------------------------------- |
| Selector | `--provider anthropic[=<model>]` |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider anthropic=claude-sonnet-5
```

Bare `--provider anthropic` defaults to `claude-sonnet-5`. Direct images are capped at 5 MB each. Encrypted PDFs are rejected. `claude-fable-5` requires 30-day data retention and is unavailable under ZDR. `claude-fable-5-1` requires reasoning (`low`, `medium`, `high`, `max`; disabled and minimal are rejected).

### Gemini OCR

| Option   | Value                         |
| -------- | ----------------------------- |
| Selector | `--provider gemini[=<model>]` |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider gemini=gemini-3.5-flash-lite
bun autoshow extract input/examples/document/1-document.pdf --provider gemini=gemini-3.6-flash
```

Bare `--provider gemini` defaults to `gemini-3.5-flash-lite`. Caps include inline PDFs up to 50 MB, uploads up to 2 GB, and PDFs up to 1,000 pages. `gemini-3.8-flash` accepts `--reasoning-effort low|medium|high`; `minimal` and `disabled` are rejected. `--price` for `gemini-3.8-flash` uses the standard `$1.50 / $7.50` per 1M token rates, including during the introductory `$0.75 / $3.75` window through 2026-12-31. [pricing](https://ai.google.dev/gemini-api/docs/pricing)

### DeepInfra OCR

| Option   | Value                            |
| -------- | -------------------------------- |
| Selector | `--provider deepinfra[=<model>]` |
| Models   | `google/gemma-4-31B-it`          |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider deepinfra=google/gemma-4-31B-it
```

Bare `--provider deepinfra` defaults to `google/gemma-4-31B-it`. Gemma 4 31B accepts one image per request, at most 20 MB. Reasoning defaults to disabled; optional `low|medium|high` effort is supported.

## OCR Notes

- Standalone `extract` document runs write `extraction.txt` or `result.json` plus `manifest.json`.
- Backfill existing OCR outputs with [`resume`](../../00-setup-and-utilities/resume.md).

See the [testing guide](tests.md) for verification coverage.

## Incomplete Runs and Blocked Providers

Hosted OCR failures are either retryable or blocked. Timeouts, network errors, temporary `5xx` responses, and genuine rate limits stay retryable. Insufficient balance, billing required, account suspension, quota exhaustion, content-policy blocks, auth failures, and provider no-retry responses are blocked: that provider stops new page work while other requested providers continue.

If at least one selected provider succeeds and another does not, the item stays `status: "incomplete"` and successful outputs remain under `providers/<service>-<model>/`. Each failed provider writes a redacted `error.json`. Automatic `resume` skips blocked providers. `resume <dir> --provider provider=model` retries a specific provider after you fix the cause.

## Provider Capabilities

Marks: ✅ supported, ⚠️ partial or qualified, ❌ not supported. Pricing is the AutoShow estimate. Pricing: ✅ cheapest third, ⚠️ middle third, ❌ most expensive third. Token-priced models show an approximate cost per 1,000 pages.

Password PDFs are decrypted before upload except Anthropic, which rejects encrypted PDFs. Mistral returns per-page markdown with layout preserved in the markup. DeepInfra accepts one image per request; PDF and EPUB pages are sent as images.

| Provider                          | Native PDF                    | Images              | Image cap       | PDF cap          | Pages          | Structured pages  | Reasoning                  | Pricing                                             |
| --------------------------------- | ----------------------------- | ------------------- | --------------- | ---------------- | -------------- | ----------------- | -------------------------- | --------------------------------------------------- |
| Mistral `mistral-ocr-4-1`         | ✅ Native PDF upload          | ✅ PNG JPG TIF      | ⚠️ Unpublished  | ⚠️ Unpublished   | ⚠️ Unpublished | ⚠️ Markdown pages | ❌ No                      | ✅ $4.00/1k pages                                   |
| Mistral `mistral-ocr-4-0`         | ✅ Native PDF upload          | ✅ PNG JPG TIF      | ⚠️ Unpublished  | ⚠️ Unpublished   | ⚠️ Unpublished | ⚠️ Markdown pages | ❌ No                      | ✅ $4.00/1k pages                                   |
| GLM `glm-5.3-flash`               | ⚠️ Rendered PNG pages         | ✅ PNG JPG          | ❌ 10 MB        | ⚠️ N/A           | ⚠️ N/A         | ❌ Plain text     | ✅ Required                | ✅ $0.15 / $0.50 per 1M tokens (≈$2.66/1k pages)    |
| Gemini `gemini-3.8-flash`         | ✅ 50 MB inline / 2 GB upload | ✅ PNG JPG WEBP BMP | ✅ 2 GB         | ✅ 2 GB          | ✅ 1000 pages  | ✅ JSON pages     | ✅ Optional                | ⚠️ $1.50 / $7.50 per 1M tokens (≈$13.93/1k pages)   |
| OpenAI `gpt-6-astra`              | ✅ Native PDF                 | ✅ PNG JPG WEBP GIF | ⚠️ Request size | ⚠️ 50 MB         | ⚠️ Unpublished | ✅ JSON pages     | ✅ Required                | ❌ $10.00 / $50.00 per 1M tokens (≈$63.25/1k pages) |
| Anthropic `claude-fable-5-1`      | ✅ Unencrypted PDF upload     | ✅ PNG JPG WEBP GIF | ❌ 5 MB         | ⚠️ 500 MB upload | ⚠️ Unpublished | ✅ JSON pages     | ✅ Required                | ❌ $10.00 / $50.00 per 1M tokens (≈$63.69/1k pages) |
| OpenAI `gpt-5.6-terra`            | ✅ Native PDF                 | ✅ PNG JPG WEBP GIF | ⚠️ Request size | ⚠️ 50 MB         | ⚠️ Unpublished | ✅ JSON pages     | ✅ Optional                | ⚠️ $2.00 / $12.00 per 1M tokens (≈$12.17/1k pages)  |
| OpenAI `gpt-5.6-luna`             | ✅ Native PDF                 | ✅ PNG JPG WEBP GIF | ⚠️ Request size | ⚠️ 50 MB         | ⚠️ Unpublished | ✅ JSON pages     | ✅ Optional                | ✅ $0.20 / $1.20 per 1M tokens (≈$1.35/1k pages)    |
| Gemini `gemini-3.7-flash`         | ✅ 50 MB inline / 2 GB upload | ✅ PNG JPG WEBP BMP | ✅ 2 GB         | ✅ 2 GB          | ✅ 1000 pages  | ✅ JSON pages     | ✅ Optional                | ⚠️ $1.50 / $7.50 per 1M tokens (≈$13.93/1k pages)   |
| Gemini `gemini-3.5-flash-lite`    | ✅ 50 MB inline / 2 GB upload | ✅ PNG JPG WEBP BMP | ✅ 2 GB         | ✅ 2 GB          | ✅ 1000 pages  | ✅ JSON pages     | ✅ Optional                | ✅ $0.30 / $2.50 per 1M tokens (≈$4.41/1k pages)    |
| Grok `grok-4.6`                   | ⚠️ Rendered PNG pages         | ✅ PNG JPG          | ❌ 20 MiB       | ⚠️ N/A           | ⚠️ N/A         | ❌ Plain text     | ✅ Required                | ⚠️ $2.00 / $6.00 per 1M tokens (≈$14.00/1k pages)   |
| OpenAI `gpt-5.6-sol`              | ✅ Native PDF                 | ✅ PNG JPG WEBP GIF | ⚠️ Request size | ⚠️ 50 MB         | ⚠️ Unpublished | ✅ JSON pages     | ✅ Optional                | ❌ $5.00 / $30.00 per 1M tokens (≈$36.33/1k pages)  |
| Anthropic `claude-sonnet-5`       | ✅ Unencrypted PDF upload     | ✅ PNG JPG WEBP GIF | ❌ 5 MB         | ⚠️ 500 MB upload | ⚠️ Unpublished | ✅ JSON pages     | ✅ Optional                | ⚠️ $2.00 / $10.00 per 1M tokens (≈$8.06/1k pages)   |
| Anthropic `claude-opus-5`         | ✅ Unencrypted PDF upload     | ✅ PNG JPG WEBP GIF | ❌ 5 MB         | ⚠️ 500 MB upload | ⚠️ Unpublished | ✅ JSON pages     | ✅ Optional, on by default | ❌ $5.00 / $25.00 per 1M tokens (≈$20.15/1k pages)  |
| Gemini `gemini-3.6-flash`         | ✅ 50 MB inline / 2 GB upload | ✅ PNG JPG WEBP BMP | ✅ 2 GB         | ✅ 2 GB          | ✅ 1000 pages  | ✅ JSON pages     | ✅ Optional                | ⚠️ $1.50 / $7.50 per 1M tokens (≈$13.93/1k pages)   |
| Grok `grok-4.5`                   | ⚠️ Rendered PNG pages         | ✅ PNG JPG          | ❌ 20 MiB       | ⚠️ N/A           | ⚠️ N/A         | ❌ Plain text     | ✅ Required                | ⚠️ $2.00 / $6.00 per 1M tokens (≈$14.00/1k pages)   |
| Kimi `kimi-k3`                    | ⚠️ Rendered PNG pages         | ✅ PNG JPG WEBP GIF | ⚠️ 100 MB       | ⚠️ N/A           | ⚠️ N/A         | ❌ Plain text     | ✅ Required                | ❌ $3.00 / $15.00 per 1M tokens (≈$20.54/1k pages)  |
| Anthropic `claude-fable-5`        | ✅ Unencrypted PDF upload     | ✅ PNG JPG WEBP GIF | ❌ 5 MB         | ⚠️ 500 MB upload | ⚠️ Unpublished | ✅ JSON pages     | ✅ Required                | ❌ $10.00 / $50.00 per 1M tokens (≈$63.69/1k pages) |
| Gemini `gemini-3.5-flash`         | ✅ 50 MB inline / 2 GB upload | ✅ PNG JPG WEBP BMP | ✅ 2 GB         | ✅ 2 GB          | ✅ 1000 pages  | ✅ JSON pages     | ✅ Optional                | ⚠️ $1.50 / $9.00 per 1M tokens (≈$7.31/1k pages)    |
| Kimi `kimi-k2.6`                  | ⚠️ Rendered PNG pages         | ✅ PNG JPG WEBP GIF | ⚠️ 100 MB       | ⚠️ N/A           | ⚠️ N/A         | ❌ Plain text     | ⚠️ Optional                | ✅ $0.95 / $4.00 per 1M tokens (≈$6.12/1k pages)    |
| DeepInfra `google/gemma-4-31B-it` | ⚠️ Rendered PNG pages         | ✅ PNG JPG WEBP     | ❌ 20 MB        | ⚠️ N/A           | ⚠️ N/A         | ❌ Plain text     | ⚠️ Optional                | ✅ $0.13 / $0.38 per 1M tokens (≈$0.92/1k pages)    |
