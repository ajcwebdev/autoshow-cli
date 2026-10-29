# extract OCR

Documents and images use local OCR, hosted OCR, or native text extraction depending on the input format and provider selection.

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
- [OCR Notes](#ocr-notes)
- [Incomplete Runs and Blocked Providers](#incomplete-runs-and-blocked-providers)
- [Provider Capabilities](#provider-capabilities)

See the [`extract` overview](../overview.md) for input routing and default document/image OCR. Remote article URLs are documented separately in [URL and X extraction](../url/overview.md).

Standalone `extract` and `resume` use `--provider provider[=model]` for document/OCR inputs. `setup` persists defaults with `--ocr provider[=model]`.

## Local OCR

Without a saved provider override, PDF, image, and CBZ inputs default to Tesseract. EPUB uses native text; `--provider tesseract` forces OCR. Convertible ebooks (MOBI, AZW/AZW3, PRC, FB2, LIT) convert to EPUB first. `--step-concurrency ocr-page=<n>` defaults to `10` for local OCR.

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

Run `bun autoshow setup` to install the local toolchain, including Tesseract. For ebook conversion tools alone:

```bash
bun autoshow setup --step calibre
```

Calibre converts non-EPUB ebooks to EPUB before extraction.

## OCR Environment

| Provider  | Required env        |
| --------- | ------------------- |
| Mistral   | `MISTRAL_API_KEY`   |
| OpenAI    | `OPENAI_API_KEY`    |
| Grok      | `XAI_API_KEY`       |
| Anthropic | `ANTHROPIC_API_KEY` |
| Gemini    | `GEMINI_API_KEY`    |

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

WebP, GIF, and BMP convert to PNG when a provider does not accept them natively. Hosted TIFF inputs require ImageMagick unless the provider accepts TIFF directly, as Mistral does.

## Shared OCR Options

| Flag                                   | Description                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--format <format>`                    | Output format: `text` or `json`                                                                                                                                    |
| `--password <value>`                   | Password for encrypted PDFs                                                                                                                                        |
| `--docx-markdown`                      | Write `extraction.md` from a local DOCX while preserving formatting (no providers)                                                                                 |
| `--all-providers`                      | Enable every supported hosted OCR provider/model for this route                                                                                                    |
| `--ocr-provider-mode <mode>`           | Multi-provider execution: `fanout` or `pool`; default `fanout`                                                                                                     |
| `--primary-ocr <service[/model]>`      | In fan-out multi-provider OCR, choose which requested complete provider result writes top-level extraction artifacts; invalid in pool mode                         |
| `--provider-concurrency <n>`           | Hosted providers/models to run concurrently per item; default `10`                                                                                                 |
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

OCR page estimates depend on document format and reasoning effort. Measured single-page prose-image profiles apply only to their qualified model and effort; other contexts use provisional estimates. Published rates are separate from estimated token usage.

## Multi-Provider Execution Modes

`fanout` is the default. One selected target, including implicit Tesseract, writes the top-level extraction and does not create `providers/`. When more than one OCR target is selected, each receives the full document and writes a complete independent result below `providers/<service>-<model>/`, and no top-level extraction is written unless `--primary-ocr` selects one of those complete results.

`pool` creates one composite extraction. Faster targets can process more pages, and remaining pages can continue on another target after a failure. The assembled document is written as the top-level extraction in original page order. Provider directories hold per-page attempts, not complete independent documents, and `--primary-ocr` is rejected.

```bash
bun autoshow extract input/examples/document/harborlight-field-notes.pdf \
  --provider grok=grok-4.7 \
  --provider mistral=mistral-ocr-4-1 \
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
PDFs with at least 40 extracted pages automatically attempt local chapter detection and write `chapters/<ordinal>-<pdf-start-page>-<slug>.txt`. `--chapters` forces autodetection at any page count; `--no-chapters` writes a single extracted file.

Local detection uses PDF bookmarks, TOC pages, and headings. Without `--chapters`, automatic detection stays local even when `--pdf-chapter-mode` is set. With `--chapters`, `local` stays fully local, `auto` allows model-assisted resolution when local detection is weak and an LLM is configured, and `llm` always attempts model-assisted resolution. Model-assisted detection can incur additional writing charges.

## OCR Services

### Mistral OCR

```bash
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider mistral=mistral-ocr-4-1
```
Bare `--provider mistral` defaults to `mistral-ocr-4-1`.

### OpenAI OCR

```bash
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider openai=gpt-6.1-sol --reasoning-effort high
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider openai=gpt-6-luna --reasoning-effort disabled
```
Bare `--provider openai` defaults to `gpt-6-luna`. GPT-6.1 Sol and GPT-6 Luna accept native PDFs and PNG/JPEG/WEBP/non-animated GIF images, with 1,050,000 context tokens and 128,000 maximum output tokens. The CLI caps PDFs at 50 MiB per file and request. Single-page requests return text; multi-page requests use structured JSON pages, independently of the selected output file format. Both models accept `low`, `medium`, `high`, `xhigh`, and `max`; omitted effort or `default` delegates to native `medium`. Sol requires reasoning; Luna also accepts `disabled`. Both reject `minimal`. [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna).

Above 272,000 input tokens the full request uses `$4 / $15` per 1M input/output tokens for Sol or `$0.20 / $0.75` for Luna. Standard rates appear in [Provider Capabilities](#provider-capabilities).

### Grok OCR

```bash
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider grok=grok-4.7 --reasoning-effort high
```
Bare `--provider grok` defaults to `grok-4.7`. It renders PDFs to PNG, accepts PNG/JPEG images up to 20 MiB, and uses a 500,000-token context. AutoShow caps visible OCR text at 4,096 tokens per page. It accepts `low`, `medium`, `high`, and `xhigh`; omitted effort or `default` delegates to native `high`. `disabled`, `minimal`, and `max` are rejected. [Model](https://docs.x.ai/developers/models/grok-4.7).

At 200,000 or more input tokens, the entire request costs `$4 / $12` per 1M input/output tokens. Reasoning tokens are billable output. [Pricing](https://docs.x.ai/developers/pricing).

### Anthropic OCR

```bash
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider anthropic=claude-opus-5-5 --reasoning-effort medium
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider anthropic=claude-sonnet-5-5 --reasoning-effort high
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider anthropic=claude-haiku-5-5 --reasoning-effort disabled
```
Bare `--provider anthropic` defaults to `claude-haiku-5-5`. The 5.5 tiers have a 1M-token context; AutoShow caps OCR thinking plus text at 64,000 tokens. PNG/JPEG/GIF/WEBP images have a 5 MiB raw-image cap; PDF uploads allow 500 MiB, subject to context limits. Encrypted PDFs are rejected. Opus and Sonnet reject `disabled`; Haiku accepts it. All three accept `low`, `medium`, `high`, `xhigh`, and `max`, reject `minimal`, and delegate omitted effort or `default` to native defaults: Opus/Haiku `medium`, Sonnet `high`. [Opus](https://platform.claude.com/docs/en/models/opus-5-5/overview), [Sonnet](https://platform.claude.com/docs/en/models/sonnet-5-5/overview), [Haiku](https://platform.claude.com/docs/en/models/haiku-5-5/overview).

Above 100,000 input tokens, Haiku's whole request costs `$0.50 / $2.50` per 1M input/output tokens. The 5.5 page estimates are provisional. Fable 5 requires 30-day retention and is unavailable under zero data retention arrangements. [Pricing](https://platform.claude.com/docs/en/about-claude/pricing).

### Gemini OCR

```bash
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider gemini=gemini-3.8-flash --reasoning-effort medium
```
Bare `--provider gemini` defaults to `gemini-3.8-flash`. PNG/JPEG/WEBP images are sent directly; GIF/BMP images are normalized to PNG. The CLI uses inline input up to 50 MiB for PDFs or 100 MiB for images, then uploads files up to 2 GiB; PDFs are limited to 1,000 pages. It accepts `low`, `medium`, and `high`, rejecting `minimal` and `disabled`. Omitted effort uses `low`; `--reasoning-effort default` delegates to the provider. Estimates use standard `$1.50 / $7.50` per 1M input/output tokens, which overstate the introductory `$0.75 / $3.75` prices through 2026-12-31. [Pricing](https://ai.google.dev/gemini-api/docs/pricing).

## OCR Notes

- A single-target `extract` document run writes top-level `extraction.txt` or `result.json` plus `manifest.json`.
- `manifest.json` records effective OCR options for inspection. PDF passwords are never recorded.
- Continue incomplete runs or add provider results with [`resume`](../../00-setup-and-utilities/resume.md).

## Incomplete Runs and Blocked Providers

Hosted OCR failures are either retryable or blocked. Timeouts, network errors, temporary `5xx` responses, and genuine rate limits stay retryable. Insufficient balance, billing required, account suspension, quota exhaustion, content-policy blocks, auth failures, and provider no-retry responses are blocked: that provider stops new page work while other requested providers continue.

In fan-out mode, if one selected provider succeeds and another does not, the item stays incomplete and successful outputs remain under `providers/<service>-<model>/`. In pool mode, accepted pages remain available and resume processes unfinished pages. Failed attempts write a redacted `error.json`. Automatic `resume` skips blocked providers; `resume <dir> --provider provider=model` retries an explicitly selected provider after you fix the cause. An incomplete target whose model has been retired requires an explicit active replacement; resume never substitutes one silently.

## Provider Capabilities

All 9 active hosted OCR models are listed below. Token prices are per 1M tokens; approximate per-1,000-page costs use registry token heuristics and the lower input-price band. These estimates do not measure extraction quality. Mistral bills per page. Limits describe the CLI's accepted input paths; `Unspecified` means no numeric limit is recorded in the local registry.

Tesseract and rendered-page providers apply `--password` locally. Anthropic rejects encrypted PDFs. Mistral, OpenAI, and Gemini upload the PDF as provided; if the upload falls back to per-page OCR, those pages are rendered locally with the password. Mistral returns per-page markdown and keeps layout in the markup.

| Provider                      | PDF input          | Direct images    | Image cap    | PDF cap        | Pages       | Provider output             | Reasoning              | Input tokens  | Output tokens / estimated page cost |
| ----------------------------- | ------------------ | ---------------- | ------------ | -------------- | ----------- | --------------------------- | ---------------------- | ------------- | ----------------------------------- |
| Anthropic `claude-haiku-5-5`  | Unencrypted upload | PNG JPG WEBP GIF | 5 MiB        | 500 MiB/upload | Unspecified | JSON pages                  | Optional through max   | $0.10 per 1M  | $0.50 per 1M (≈$1.10/1k pages)      |
| OpenAI `gpt-6.1-sol`          | Native PDF         | PNG JPG WEBP GIF | Unspecified  | 50 MiB/request | Unspecified | Text (1 page); JSON (multi) | Required through max   | $2.00 per 1M  | $10.00 per 1M (≈$12.65/1k pages)    |
| Anthropic `claude-sonnet-5-5` | Unencrypted upload | PNG JPG WEBP GIF | 5 MiB        | 500 MiB/upload | Unspecified | JSON pages                  | Optional through max   | $2.00 per 1M  | $10.00 per 1M (≈$22.00/1k pages)    |
| OpenAI `gpt-6-luna`           | Native PDF         | PNG JPG WEBP GIF | Unspecified  | 50 MiB/request | Unspecified | Text (1 page); JSON (multi) | Optional through max   | $0.10 per 1M  | $0.50 per 1M (≈$0.59/1k pages)      |
| Anthropic `claude-opus-5-5`   | Unencrypted upload | PNG JPG WEBP GIF | 5 MiB        | 500 MiB/upload | Unspecified | JSON pages                  | Required through max   | $4.00 per 1M  | $20.00 per 1M (≈$44.00/1k pages)    |
| Grok `grok-4.7`               | Rendered PNG pages | PNG JPG          | 20 MiB       | N/A            | N/A         | Plain text                  | Required through xhigh | $2.00 per 1M  | $6.00 per 1M (≈$14.00/1k pages)     |
| Mistral `mistral-ocr-4-1`     | Native PDF upload  | PNG JPG TIF      | Unspecified  | Unspecified    | Unspecified | Markdown pages              | No                     | Included      | $4.00/1k pages                      |
| Gemini `gemini-3.8-flash`     | Inline or upload   | PNG JPG WEBP     | 2 GiB/upload | 2 GiB/upload   | 1000        | JSON pages                  | Optional               | $1.50 per 1M  | $7.50 per 1M (≈$13.93/1k pages)     |
| Anthropic `claude-fable-5`    | Unencrypted upload | PNG JPG WEBP GIF | 5 MiB        | 500 MiB/upload | Unspecified | JSON pages                  | Required through max   | $10.00 per 1M | $50.00 per 1M (≈$63.69/1k pages)    |
