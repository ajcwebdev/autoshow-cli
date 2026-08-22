# extract OCR

Documents and images route through hosted OCR or native text extraction depending on the input format.

## Outline

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
  - [Replicate OCR](#replicate-ocr)
  - [fal.ai OCR](#falai-ocr)
- [OCR Notes](#ocr-notes)
- [Incomplete Runs and Blocked Providers](#incomplete-runs-and-blocked-providers)
- [Provider Capabilities](#provider-capabilities)

See the [`extract` overview](./01-extract.md) for input routing and default document/image OCR. Remote article URLs are documented separately in [URL and X extraction](./04-extract-url.md).

Standalone `extract` uses `--provider provider[=model]` for document/OCR inputs. `write` and `config` use `--ocr provider[=model]`. `resume` uses `--provider provider[=model]`.

## OCR Setup

```bash
# full setup
bun autoshow setup

# document foundations: mutool + qpdf + Calibre ebook-convert
bun autoshow setup --step calibre
```

Hosted OCR engines are selected with `--provider`. Calibre `ebook-convert` converts supported ebook formats to EPUB.

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
| Replicate | `REPLICATE_API_TOKEN` |
| fal.ai    | `FAL_API_KEY`         |

## OCR Routing

| Input family                                       | Default path                                                         | Hosted paths                                             |
| -------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------- |
| PDF                                                | See the [`extract` overview](./01-extract.md#local-ocr)              | hosted OCR engines                                       |
| EPUB                                               | cleaned native extraction (`epub-text`)                              | hosted OCR engines                                       |
| Convertible ebooks (MOBI, AZW/AZW3, PRC, FB2, LIT) | normalize to EPUB, then follow the EPUB path                         | same                                                     |
| DOCX / PPTX / XLSX / ODF                           | native text extraction                                               | OCR flags are ignored with a warning                     |
| RTF                                                | native RTF text extraction                                           | OCR flags are ignored with a warning                     |
| CBZ                                                | per-image OCR                                                        | hosted OCR engines                                       |
| CSV                                                | raw text                                                             | OCR flags are ignored with a warning                     |
| PNG / JPG / JPEG / TIF / TIFF                      | See the [`extract` overview](./01-extract.md#local-ocr)              | hosted OCR engines                                       |
| WebP / BMP                                         | normalize when possible, then OCR                                    | hosted OCR engines                                       |
| GIF                                                | See the [`extract` overview](./01-extract.md#local-ocr)              | hosted OCR engines                                       |

When a provider does not accept an image format natively, AutoShow converts `WEBP`, `GIF`, and `BMP` to `PNG`. `TIF`/`TIFF` convert to `PNG` when ImageMagick (`magick` or `convert`) is installed.

## Shared OCR Options

| Flag                                   | Description                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--format <format>`                    | Output format: `text` or `json`                                                                                                                                    |
| `--password <value>`                   | Password for encrypted PDFs                                                                                                                                        |
| `--all-providers`                      | Enable every supported hosted OCR provider/model for this route                                                                                                    |
| `--ocr-provider-mode <mode>`           | Multi-provider execution: `fanout` or `pool`; default `fanout`                                                                                                     |
| `--primary-ocr <service[/model]>`      | In fan-out multi-provider OCR, choose which requested complete provider result writes top-level extraction artifacts; invalid in pool mode                         |
| `--provider-concurrency <n>`           | Hosted providers/models to run concurrently per item; default `7`                                                                                                  |
| `--ocr-concurrency <n>`                | Page-level OCR concurrency cap. Hosted OCR defaults to `auto`. Explicit values are hosted fixed caps.                                                              |
| `--concurrency-mode <ramp\|immediate>` | Approach each hosted provider/account page cap from one request at one added slot every five seconds (`ramp`, default), or start at the resolved cap (`immediate`) |
| `--ocr-dpi <n>`                        | Render DPI for OCR pages                                                                                                                                           |
| `--chapters`, `--no-chapters`          | EPUB native text runs and long PDF chapter autodetection: write chapter files under `chapters/`; use `--no-chapters` for a single extracted file                   |
| `--length <n>`                         | Hard export limit in thousands of characters; splits oversized EPUB or PDF chapter files                                                                           |
| `--pdf-chapter-mode <mode>`            | PDF chapter detection mode: `local`, `auto`, or `llm`                                                                                                              |
| `--price`                              | Show the aggregated OCR estimate and exit                                                                                                                          |

```bash
# Default PDF extraction
bun autoshow extract input/examples/document/1-document.pdf

# JSON output
bun autoshow extract input/examples/document/1-document.pdf --format json

# Fan out across every OCR provider in price mode
bun autoshow extract input/examples/document/1-document.pdf --all-providers --price

# Estimate one pooled composite extraction across three targets
bun autoshow extract input/examples/document/1-document.pdf --provider grok=grok-4.5 --provider mistral=mistral-ocr-4-0 --provider kimi=kimi-k3 --ocr-provider-mode pool --ocr-concurrency 10 --price
```

See [Provider Capabilities](#provider-capabilities) for the per-model release date, dedicated-OCR vs VLM, native PDF, image, limit, structured-output, and pool matrix.

`--price` estimates token-priced OCR from typical per-page token use. Completed runs record actual token counts in `manifest.json`. The price summary shows `step`, `provider`, `model`, `cost`, `input`, and `estimatedTime`. Run with `--json` for page counts and token/rate fields.

## Multi-Provider Execution Modes

`fanout` is the default: every selected OCR target receives the full document and writes a complete independent result below `providers/<service>-<model>/`. No top-level extraction is written unless `--primary-ocr` selects one of those complete results.

`pool` creates one composite extraction. Eligible targets draw pages from one shared queue, so faster targets can process a larger share and transient failures hand off pages to another target. Accepted pages are assembled in original page order and written as the top-level extraction. Provider directories hold per-page attempts, not complete independent documents, and `--primary-ocr` is rejected.

```bash
bun autoshow extract document.pdf \
  --provider grok=grok-4.5 \
  --provider mistral=mistral-ocr-4-0 \
  --provider kimi=kimi-k3 \
  --ocr-provider-mode pool \
  --ocr-concurrency 10
```

`--provider-concurrency` limits how many hosted providers/models run at once. Models from the same provider share one page-concurrency cap; different providers each get their own. `--ocr-concurrency` sets that page cap (`auto` by default for hosted OCR, or a fixed ceiling when you pass a number). `--concurrency-mode` controls whether work ramps up to that cap or starts there.

Pool mode works for PDFs, CBZ archives, and supported images. `--price` estimates the full page set once rather than charging each provider for every page; `resume --price` estimates only unfinished pages.

## EPUB Options

EPUB inputs default to cleaned native text instead of OCR page rendering.

```bash
bun autoshow extract input/examples/document/1-epub.epub
bun autoshow extract input/examples/document/1-epub.epub --format json
bun autoshow extract input/examples/document/1-epub.epub --length 50
bun autoshow extract input/examples/document/1-epub.epub --no-chapters
```

- Native extraction writes one cleaned file per kept section under `chapters/` by default (`chapters/<ordinal>-<source-index>-<slug>.txt`).
- `--length <n>` splits oversized section files with `-part-NN` suffixes.
- `--no-chapters` disables chapter splitting and outputs a single extracted text file.

## PDF Chapter Detection

```bash
bun autoshow extract book.pdf
bun autoshow extract input/examples/document/3-document.pdf --chapters
bun autoshow extract input/examples/document/3-document.pdf --chapters --pdf-chapter-mode auto
bun autoshow extract book.pdf --no-chapters
```

- PDFs with at least 40 extracted pages automatically attempt local chapter detection and write chapter files under `chapters/`.
- `--chapters` forces chapter autodetection regardless of PDF page count.
- `--no-chapters` disables PDF chapter detection and produces a single extracted file.
- Detection is local-first by default, using PDF bookmarks, TOC pages, and heading heuristics (`chapters/<ordinal>-<pdf-start-page>-<slug>.txt`).
- `--pdf-chapter-mode local` keeps detection fully local and heuristic.
- `--pdf-chapter-mode auto` allows model-assisted resolution when local heuristics are weak and an LLM is configured.
- `--pdf-chapter-mode llm` always attempts model-assisted resolution.
- `--length <n>` splits oversized chapter files with `-part-NN` suffixes.

## OCR Services

### Mistral OCR

| Option               | Value                                 |
| -------------------- | ------------------------------------- |
| Selector             | `--provider mistral[=<model>]`        |
| Models               | `mistral-ocr-2512`, `mistral-ocr-4-0` |
| Direct input support | PDF, `PNG`, `JPG`, `TIF`              |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider mistral=mistral-ocr-2512
bun autoshow extract input/examples/document/1-document.pdf --provider mistral=mistral-ocr-4-0
```

Bare `--provider mistral` defaults to `mistral-ocr-2512`.

### GLM OCR

| Option               | Value                      |
| -------------------- | -------------------------- |
| Selector             | `--provider glm[=<model>]` |
| Models               | `glm-ocr`                  |
| Direct input support | PDF, `PNG`, `JPG`          |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider glm=glm-ocr
```

Caps: images up to 10 MB, PDFs up to 50 MB and 100 pages.

### Kimi OCR

| Option               | Value                                                |
| -------------------- | ---------------------------------------------------- |
| Selector             | `--provider kimi[=<model>]`                          |
| Models               | `kimi-k2.6`, `kimi-k3`                               |
| Direct input support | `PNG`, `JPG`, `WEBP`, `GIF`; rendered PDF/EPUB pages |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider kimi=kimi-k2.6
bun autoshow extract input/examples/document/1-document.pdf --provider kimi=kimi-k3
```

Bare `--provider kimi` defaults to `kimi-k2.6`. Direct or rendered image uploads are capped at 100 MB.

### OpenAI OCR

| Option               | Value                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------- |
| Selector             | `--provider openai[=<model>]`                                                             |
| Models               | `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-5.5`, `gpt-5.4-mini`, `gpt-5.4-nano` |
| Direct input support | PDF, `PNG`, `JPG`, `WEBP`, `GIF`                                                          |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider openai=gpt-5.6-sol
bun autoshow extract input/examples/document/1-document.pdf --provider openai=gpt-5.5
bun autoshow extract input/examples/document/1-document.pdf --provider openai=gpt-5.4-nano
```

Bare `--provider openai` defaults to the cheapest OpenAI OCR model. Maximum PDF size is 50 MB.

### Grok OCR

| Option               | Value                                                  |
| -------------------- | ------------------------------------------------------ |
| Selector             | `--provider grok[=<model>]`                            |
| Models               | `grok-4.3`, `grok-4.20-0309-non-reasoning`, `grok-4.5` |
| Direct input support | `PNG`, `JPG`; rendered PDF/EPUB pages                  |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider grok=grok-4.3
bun autoshow extract input/examples/document/1-document.pdf --provider grok=grok-4.5
```

Bare `--provider grok` defaults to `grok-4.3`. Direct images and rendered pages are capped at 20 MiB each.

### Anthropic OCR

| Option               | Value                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------- |
| Selector             | `--provider anthropic[=<model>]`                                                            |
| Models               | `claude-fable-5`, `claude-opus-4-8`, `claude-sonnet-5`, `claude-haiku-4-5`, `claude-opus-5` |
| Direct input support | Unencrypted PDFs, `PNG`, `JPG`, `WEBP`, `GIF`                                               |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider anthropic=claude-haiku-4-5
bun autoshow extract input/examples/document/1-document.pdf --provider anthropic=claude-sonnet-5
```

Bare `--provider anthropic` defaults to `claude-haiku-4-5`. Direct images are capped at 5 MB each. `claude-fable-5` requires 30-day data retention and is unavailable under ZDR.

### Gemini OCR

| Option               | Value                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------- |
| Selector             | `--provider gemini[=<model>]`                                                             |
| Models               | `gemini-3.1-pro-preview`, `gemini-3.5-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite` |
| Direct input support | PDF, `PNG`, `JPG`, `WEBP`, `BMP`                                                          |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider gemini=gemini-3.5-flash-lite
bun autoshow extract input/examples/document/1-document.pdf --provider gemini=gemini-3.6-flash
```

Bare `--provider gemini` defaults to `gemini-3.5-flash-lite`. Caps include inline PDFs up to 50 MB, uploads up to 2 GB, and PDFs up to 1,000 pages.

### DeepInfra OCR

| Option               | Value                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selector             | `--provider deepinfra[=<model>]`                                                                                                                                                            |
| Models               | `google/gemma-3-27b-it`, `meta-llama/Llama-4-Scout-17B-16E-Instruct`, `mistralai/Mistral-Small-3.2-24B-Instruct-2506`, `Qwen/Qwen3-VL-235B-A22B-Instruct`, `Qwen/Qwen3-VL-30B-A3B-Instruct` |
| Direct input support | `PNG`, `JPG`, `WEBP`; rendered PDF/EPUB pages                                                                                                                                               |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider deepinfra=Qwen/Qwen3-VL-30B-A3B-Instruct
bun autoshow extract input/examples/document/1-document.pdf --provider deepinfra=Qwen/Qwen3-VL-235B-A22B-Instruct
```

Bare `--provider deepinfra` defaults to `Qwen/Qwen3-VL-30B-A3B-Instruct`. Uploads are capped at 20 MB per image.

### Replicate OCR

| Option               | Value                                                          |
| -------------------- | -------------------------------------------------------------- |
| Selector             | `--provider replicate[=<model>]`                               |
| Models               | `datalab-to/ocr`, `datalab-to/marker`, `lucataco/deepseek-ocr` |
| Direct input support | PDF, `PNG`, `JPG`, `WEBP`; rendered PDF/EPUB pages             |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider replicate=datalab-to/ocr
bun autoshow extract input/examples/document/1-document.pdf --provider replicate=datalab-to/marker
bun autoshow extract input/examples/document/1-document.pdf --provider replicate=lucataco/deepseek-ocr
```

### fal.ai OCR

| Option               | Value                                              |
| -------------------- | -------------------------------------------------- |
| Selector             | `--provider fal[=<model>]`                         |
| Models               | `fal-ai/got-ocr/v2`, `fal-ai/florence-2-large/ocr` |
| Direct input support | `PNG`, `JPG`, `WEBP`; rendered PDF/EPUB pages      |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider fal=fal-ai/got-ocr/v2
bun autoshow extract input/examples/document/1-document.pdf --provider fal=fal-ai/florence-2-large/ocr
```

Specialty models for formatted documents, tables, charts, mathematical/chemical formulas, geometric shapes, and dense structured layouts.

## OCR Notes

- Standalone `extract` document runs write `extraction.txt` or `result.json` plus `manifest.json`.
- EPUB export and PDF chapter autodetection write `chapters/` inside the output directory.
- Config defaults can persist chapter export settings under `defaults.extract.ocr.chapters`, `defaults.extract.ocr.length`, and `defaults.extract.ocr.pdfChapterMode`.
- Backfill existing OCR outputs with top-level [`resume`](../../setup-and-utilities/resume/resume.md).

## Incomplete Runs and Blocked Providers

Hosted OCR failures are either retryable or blocked. Timeouts, network errors, temporary `5xx` responses, and genuine rate limits stay retryable. Insufficient balance, billing required, account suspension, quota exhaustion, content-policy blocks, auth failures, and provider no-retry responses are blocked: that provider stops new page work while other requested providers continue.

- If at least one selected provider succeeds and another does not, the item stays `status: "incomplete"` and successful outputs remain under `providers/<service>-<model>/`.
- The run summary prints a Run Status table and a Provider Failures table with the failure class, whether it is retryable, retry attempts spent, and any page fallback counts.
- Each failed provider writes a redacted `error.json`.
- Automatic `resume` skips blocked or non-retryable providers. `resume <dir> --provider provider=model` retries a specific provider after you fix the cause.

## Provider Capabilities

Marks match the [TTS capability tables](../step-4-tts/text-to-speech-and-voice.md#provider-capabilities): ✅ supported in AutoShow, ⚠️ partial or qualified, ❌ not exposed. Released dates are provider announcement or snapshot dates. Recency marks follow the TTS convention: current-year GA is ✅, older still-current snapshots are ⚠️, and pre-2026 engines are ❌. Rows are newest first.

Pricing is the AutoShow registry rate. Cost rank orders models cheapest-first within each table (1 = cheapest) and ties share a rank; token-priced models rank on the registry-estimated cost per 1,000 pages (per-page token estimates times token rates), shown as the ≈ figure.

`--format text|json` is available for every engine. Password PDFs are decrypted before upload or render except Anthropic, which rejects encrypted PDFs.

### Dedicated OCR

| Provider                             | Released      | Kind            | Native PDF            | Images                      | Image cap      | PDF cap        | Pages          | Markdown                         | Tables / formulas / layout                  | Password PDFs          | Pool   | Pricing                                              | Cost rank |
| ------------------------------------ | ------------- | --------------- | --------------------- | --------------------------- | -------------- | -------------- | -------------- | -------------------------------- | ------------------------------------------- | ---------------------- | ------ | ---------------------------------------------------- | --------- |
| Mistral `mistral-ocr-4-0`            | ✅ 2026-06-23 | ✅ Dedicated OCR | ✅ Native PDF upload  | ✅ PNG JPG TIF              | ⚠️ Unpublished | ⚠️ Unpublished | ⚠️ Unpublished | ✅ Per-page markdown             | ⚠️ Layout in markdown                       | ✅ Decrypt then upload | ✅ Yes | $4.00/1k pages                                       | 5/8       |
| GLM `glm-ocr`                        | ✅ 2026-02    | ✅ Layout OCR    | ✅ Native PDF upload  | ✅ PNG JPG                  | ❌ 10 MB       | ⚠️ 50 MB       | ❌ 100 pages   | ✅ Markdown                      | ✅ Tables, formulas, seals, handwriting     | ✅ Decrypt then upload | ✅ Yes | $0.03 in / $0.03 out per 1M tokens (≈$0.09/1k pages) | 1/8       |
| Mistral `mistral-ocr-2512`           | ⚠️ 2025-12    | ✅ Dedicated OCR | ✅ Native PDF upload  | ✅ PNG JPG TIF              | ⚠️ Unpublished | ⚠️ Unpublished | ⚠️ Unpublished | ✅ Per-page markdown             | ⚠️ Layout in markdown                       | ✅ Decrypt then upload | ✅ Yes | $2.00/1k pages                                       | 2/8       |
| Replicate `lucataco/deepseek-ocr`    | ⚠️ 2025-10-21 | ✅ Dedicated OCR | ⚠️ Rendered PNG pages | ✅ One image per prediction | ⚠️ Unpublished | ⚠️ N/A         | ⚠️ N/A         | ✅ Convert to Markdown           | ⚠️ Markdown structure                       | ✅ Render then upload  | ❌ No  | $3.30/1k pages                                       | 4/8       |
| Replicate `datalab-to/ocr`           | ⚠️ 2025-10    | ✅ Dedicated OCR | ✅ Native PDF upload  | ✅ PNG JPG WEBP             | ⚠️ Unpublished | ⚠️ Unpublished | ⚠️ Unpublished | ⚠️ When the API returns markdown | ⚠️ Document OCR                             | ✅ Decrypt then upload | ❌ No  | $2.00/1k pages                                       | 2/8       |
| Replicate `datalab-to/marker`        | ❌ 2024-11    | ✅ Dedicated OCR | ✅ Native PDF upload  | ✅ PNG JPG WEBP             | ⚠️ Unpublished | ⚠️ Unpublished | ⚠️ Unpublished | ⚠️ When the API returns markdown | ⚠️ Fast document conversion                 | ✅ Decrypt then upload | ❌ No  | $4.00/1k pages                                       | 5/8       |
| fal.ai `fal-ai/got-ocr/v2`           | ❌ 2024-09    | ✅ Specialty OCR | ⚠️ Rendered PNG pages | ✅ PNG JPG WEBP             | ⚠️ Unpublished | ⚠️ N/A         | ⚠️ N/A         | ⚠️ Formatted output              | ✅ Tables, charts, formulas, dense layout   | ✅ Render then upload  | ❌ No  | $50.00/1k pages                                      | 8/8       |
| fal.ai `fal-ai/florence-2-large/ocr` | ❌ 2024-06-17 | ✅ General OCR   | ⚠️ Rendered PNG pages | ✅ PNG JPG WEBP             | ⚠️ Unpublished | ⚠️ N/A         | ⚠️ N/A         | ❌ Plain text                    | ❌ General OCR only                         | ✅ Render then upload  | ❌ No  | $7.55/1k pages                                       | 7/8       |

### Frontier VLMs

| Provider                            | Released      | Native PDF                   | Images              | Image cap          | PDF cap          | Pages          | Structured pages           | Reasoning                  | Password PDFs              | Pool   | Pricing                                          | Cost rank |
| ----------------------------------- | ------------- | ---------------------------- | ------------------- | ------------------ | ---------------- | -------------- | -------------------------- | -------------------------- | -------------------------- | ------ | ------------------------------------------------ | --------- |
| OpenAI `gpt-5.6-terra`              | ✅ 2026-08    | ✅ Native PDF                | ✅ PNG JPG WEBP GIF | ⚠️ Request size    | ⚠️ 50 MB         | ⚠️ Unpublished | ✅ JSON pages              | ✅ Optional                | ✅ Decrypt then upload     | ✅ Yes | $2.00 / $12.00 per 1M tokens (≈$12.17/1k pages)  | 12/20     |
| OpenAI `gpt-5.6-luna`               | ✅ 2026-08    | ✅ Native PDF                | ✅ PNG JPG WEBP GIF | ⚠️ Request size    | ⚠️ 50 MB         | ⚠️ Unpublished | ✅ JSON pages              | ✅ Optional                | ✅ Decrypt then upload     | ✅ Yes | $0.20 / $1.20 per 1M tokens (≈$1.35/1k pages)    | 1/20      |
| Gemini `gemini-3.5-flash-lite`      | ✅ 2026-08    | ✅ 50 MB inline / 2 GB upload | ✅ PNG JPG WEBP BMP | ✅ 2 GB            | ✅ 2 GB          | ✅ 1000 pages  | ✅ JSON pages              | ✅ Optional                | ✅ Decrypt then upload     | ✅ Yes | $0.30 / $2.50 per 1M tokens (≈$4.41/1k pages)    | 5/20      |
| OpenAI `gpt-5.6-sol`                | ✅ 2026-07    | ✅ Native PDF                | ✅ PNG JPG WEBP GIF | ⚠️ Request size    | ⚠️ 50 MB         | ⚠️ Unpublished | ✅ JSON pages              | ✅ Optional                | ✅ Decrypt then upload     | ✅ Yes | $5.00 / $30.00 per 1M tokens (≈$36.33/1k pages)  | 18/20     |
| Anthropic `claude-sonnet-5`         | ✅ 2026-07    | ✅ Unencrypted PDF upload    | ✅ PNG JPG WEBP GIF | ❌ 5 MB            | ⚠️ 500 MB upload | ⚠️ Unpublished | ✅ JSON pages              | ✅ Optional                | ❌ Encrypted PDFs rejected | ✅ Yes | $2.00 / $10.00 per 1M tokens (≈$8.06/1k pages)   | 9/20      |
| Anthropic `claude-opus-5`           | ✅ 2026-07    | ✅ Unencrypted PDF upload    | ✅ PNG JPG WEBP GIF | ❌ 5 MB            | ⚠️ 500 MB upload | ⚠️ Unpublished | ✅ JSON pages              | ✅ Optional, on by default | ❌ Encrypted PDFs rejected | ✅ Yes | $5.00 / $25.00 per 1M tokens (≈$20.15/1k pages)  | 15/20     |
| Gemini `gemini-3.6-flash`           | ✅ 2026-07    | ✅ 50 MB inline / 2 GB upload | ✅ PNG JPG WEBP BMP | ✅ 2 GB            | ✅ 2 GB          | ✅ 1000 pages  | ✅ JSON pages              | ✅ Optional                | ✅ Decrypt then upload     | ✅ Yes | $1.50 / $7.50 per 1M tokens (≈$13.93/1k pages)   | 13/20     |
| Grok `grok-4.5`                     | ✅ 2026-07    | ⚠️ Rendered PNG pages        | ✅ PNG JPG          | ❌ 20 MiB          | ⚠️ N/A           | ⚠️ N/A         | ❌ Plain text              | ✅ Required                | ✅ Render then upload      | ✅ Yes | $2.00 / $6.00 per 1M tokens (≈$14.00/1k pages)   | 14/20     |
| Kimi `kimi-k3`                      | ✅ 2026-07    | ⚠️ Rendered PNG pages        | ✅ PNG JPG WEBP GIF | ⚠️ 100 MB          | ⚠️ N/A           | ⚠️ N/A         | ❌ Plain text              | ✅ Required                | ✅ Render then upload      | ✅ Yes | $3.00 / $15.00 per 1M tokens (≈$20.54/1k pages)  | 17/20     |
| Anthropic `claude-fable-5`          | ✅ 2026-06-09 | ✅ Unencrypted PDF upload    | ✅ PNG JPG WEBP GIF | ❌ 5 MB            | ⚠️ 500 MB upload | ⚠️ Unpublished | ✅ JSON pages              | ✅ Required                | ❌ Encrypted PDFs rejected | ✅ Yes | $10.00 / $50.00 per 1M tokens (≈$63.69/1k pages) | 19/20     |
| Gemini `gemini-3.5-flash`           | ✅ 2026-06    | ✅ 50 MB inline / 2 GB upload | ✅ PNG JPG WEBP BMP | ✅ 2 GB            | ✅ 2 GB          | ✅ 1000 pages  | ✅ JSON pages              | ✅ Optional                | ✅ Decrypt then upload     | ✅ Yes | $1.50 / $9.00 per 1M tokens (≈$7.31/1k pages)    | 7/20      |
| Anthropic `claude-opus-4-8`         | ✅ 2026-05    | ✅ Unencrypted PDF upload    | ✅ PNG JPG WEBP GIF | ❌ 5 MB            | ⚠️ 500 MB upload | ⚠️ Unpublished | ✅ JSON pages              | ✅ Optional                | ❌ Encrypted PDFs rejected | ✅ Yes | $5.00 / $25.00 per 1M tokens (≈$20.15/1k pages)  | 15/20     |
| Grok `grok-4.3`                     | ✅ 2026-05    | ⚠️ Rendered PNG pages        | ✅ PNG JPG          | ❌ 20 MiB          | ⚠️ N/A           | ⚠️ N/A         | ❌ Plain text              | ❌ Unsupported             | ✅ Render then upload      | ✅ Yes | $1.25 / $2.50 per 1M tokens (≈$7.50/1k pages)    | 8/20      |
| OpenAI `gpt-5.5`                    | ✅ 2026-04-23 | ✅ Native PDF                | ✅ PNG JPG WEBP GIF | ⚠️ Request size    | ⚠️ 50 MB         | ⚠️ Unpublished | ✅ JSON pages              | ✅ Optional                | ✅ Decrypt then upload     | ✅ Yes | $5.00 / $30.00 per 1M tokens (≈$72.02/1k pages)  | 20/20     |
| OpenAI `gpt-5.4-mini`               | ✅ 2026-03-17 | ✅ Native PDF                | ✅ PNG JPG WEBP GIF | ⚠️ Request size    | ⚠️ 50 MB         | ⚠️ Unpublished | ✅ JSON pages              | ✅ Optional                | ✅ Decrypt then upload     | ✅ Yes | $0.75 / $4.50 per 1M tokens (≈$10.54/1k pages)   | 11/20     |
| OpenAI `gpt-5.4-nano`               | ✅ 2026-03-17 | ✅ Native PDF                | ✅ PNG JPG WEBP GIF | ⚠️ Request size    | ⚠️ 50 MB         | ⚠️ Unpublished | ✅ JSON pages              | ✅ Optional                | ✅ Decrypt then upload     | ✅ Yes | $0.20 / $1.25 per 1M tokens (≈$2.90/1k pages)    | 2/20      |
| Grok `grok-4.20-0309-non-reasoning` | ✅ 2026-03-09 | ⚠️ Rendered PNG pages        | ✅ PNG JPG          | ❌ 20 MiB          | ⚠️ N/A           | ⚠️ N/A         | ❌ Plain text              | ❌ Unsupported             | ✅ Render then upload      | ✅ Yes | $1.25 / $2.50 per 1M tokens (≈$4.16/1k pages)    | 4/20      |
| Kimi `kimi-k2.6`                    | ⚠️ 2026-01    | ⚠️ Rendered PNG pages        | ✅ PNG JPG WEBP GIF | ⚠️ 100 MB          | ⚠️ N/A           | ⚠️ N/A         | ❌ Plain text              | ⚠️ Optional                | ✅ Render then upload      | ✅ Yes | $0.95 / $4.00 per 1M tokens (≈$6.12/1k pages)    | 6/20      |
| Gemini `gemini-3.1-pro-preview`     | ⚠️ 2025-12    | ✅ 50 MB inline / 2 GB upload | ✅ PNG JPG WEBP BMP | ✅ 2 GB            | ✅ 2 GB          | ✅ 1000 pages  | ✅ JSON pages              | ✅ Optional                | ✅ Decrypt then upload     | ✅ Yes | $2.00 / $12.00 per 1M tokens (≈$9.52/1k pages)   | 10/20     |
| Anthropic `claude-haiku-4-5`        | ⚠️ 2025-10-01 | ✅ Unencrypted PDF upload    | ✅ PNG JPG WEBP GIF | ❌ 5 MB            | ⚠️ 500 MB upload | ⚠️ Unpublished | ✅ JSON pages              | ❌ Unsupported             | ❌ Encrypted PDFs rejected | ✅ Yes | $1.00 / $5.00 per 1M tokens (≈$4.03/1k pages)    | 3/20      |

### Hosted open VLMs

| Provider                                                  | Released      | Native PDF            | Images          | Image cap | PDF cap | Pages  | Structured pages | Reasoning      | Password PDFs         | Pool   | Pricing                                        | Cost rank |
| --------------------------------------------------------- | ------------- | --------------------- | --------------- | --------- | ------- | ------ | ---------------- | -------------- | --------------------- | ------ | ---------------------------------------------- | --------- |
| DeepInfra `Qwen/Qwen3-VL-235B-A22B-Instruct`              | ⚠️ 2025-09-23 | ⚠️ Rendered PNG pages | ✅ PNG JPG WEBP | ❌ 20 MB  | ⚠️ N/A  | ⚠️ N/A | ❌ Plain text    | ❌ Unsupported | ✅ Render then upload | ✅ Yes | $0.20 / $0.88 per 1M tokens (≈$1.28/1k pages)  | 4/5       |
| DeepInfra `Qwen/Qwen3-VL-30B-A3B-Instruct`                | ⚠️ 2025-09-23 | ⚠️ Rendered PNG pages | ✅ PNG JPG WEBP | ❌ 20 MB  | ⚠️ N/A  | ⚠️ N/A | ❌ Plain text    | ❌ Unsupported | ✅ Render then upload | ✅ Yes | $0.15 / $0.60 per 1M tokens (≈$1.48/1k pages)  | 5/5       |
| DeepInfra `mistralai/Mistral-Small-3.2-24B-Instruct-2506` | ⚠️ 2025-06-20 | ⚠️ Rendered PNG pages | ✅ PNG JPG WEBP | ❌ 20 MB  | ⚠️ N/A  | ⚠️ N/A | ❌ Plain text    | ❌ Unsupported | ✅ Render then upload | ✅ Yes | $0.075 / $0.20 per 1M tokens (≈$0.69/1k pages) | 1/5       |
| DeepInfra `meta-llama/Llama-4-Scout-17B-16E-Instruct`     | ❌ 2025-04-05 | ⚠️ Rendered PNG pages | ✅ PNG JPG WEBP | ❌ 20 MB  | ⚠️ N/A  | ⚠️ N/A | ❌ Plain text    | ❌ Unsupported | ✅ Render then upload | ✅ Yes | $0.10 / $0.30 per 1M tokens (≈$0.94/1k pages)  | 3/5       |
| DeepInfra `google/gemma-3-27b-it`                         | ❌ 2025-03-12 | ⚠️ Rendered PNG pages | ✅ PNG JPG WEBP | ❌ 20 MB  | ⚠️ N/A  | ⚠️ N/A | ❌ Plain text    | ❌ Unsupported | ✅ Render then upload | ✅ Yes | $0.08 / $0.16 per 1M tokens (≈$0.71/1k pages)  | 2/5       |

OCR test coverage is documented in [Step 2 Tests: OCR](06-extract-ocr-tests.md).
