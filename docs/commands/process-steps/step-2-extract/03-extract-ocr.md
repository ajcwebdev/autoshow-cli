# extract OCR

Documents and images route through hosted OCR or native text extraction depending on the input format.

## Outline

- [OCR Setup](#ocr-setup)
- [OCR Environment](#ocr-environment)
- [OCR Routing](#ocr-routing)
- [Shared OCR Options](#shared-ocr-options)
- [Multi-Provider Execution Modes](#multi-provider-execution-modes)
- [EPUB Options](#epub-options)
  - [Inspect Modes](#inspect-modes)
  - [Native EPUB Export](#native-epub-export)
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

The standalone `extract` command uses route-aware `--provider provider[=model]` selectors for document/OCR inputs. The `write` and `config` commands use the step selector `--ocr provider[=model]`; `resume` uses target-aware `--provider provider[=model]`.

## OCR Setup

```bash
# full setup
bun autoshow setup

# document foundations: mutool + qpdf + Calibre ebook-convert
bun autoshow setup --step calibre
```

Hosted OCR engines are selected by provider. Calibre `ebook-convert` remains available for supported convertible ebook inputs.

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
| Replicate | `REPLICATE_API_KEY` |
| fal.ai    | `FAL_KEY`           |

## OCR Routing

| Input family                                       | Default path                                                         | Hosted paths                                             |
| -------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------- |
| PDF                                                | See the [`extract` overview](./01-extract.md#local-ocr)              | hosted OCR engines                                       |
| EPUB                                               | cleaned native extraction (`epub-text`)                              | hosted OCR engines, `--epub-bun`                         |
| Convertible ebooks (MOBI, AZW/AZW3, PRC, FB2, LIT) | normalize to EPUB, then follow the EPUB path                         | same                                                     |
| DOCX / PPTX / XLSX / ODF                           | native ZIP/XML text extraction                                       | OCR flags are ignored with a warning                     |
| RTF                                                | native RTF text extraction                                           | OCR flags are ignored with a warning                     |
| CBZ                                                | per-image OCR                                                        | hosted OCR engines                                       |
| CSV                                                | raw text                                                             | OCR flags are ignored with a warning                     |
| PNG / JPG / JPEG / TIF / TIFF                      | See the [`extract` overview](./01-extract.md#local-ocr)              | hosted OCR engines                                       |
| WebP / BMP                                         | normalize when possible, then OCR                                    | hosted OCR engines                                       |
| GIF                                                | See the [`extract` overview](./01-extract.md#local-ocr)              | hosted OCR engines                                       |

Hosted direct-image inputs retain native uploads when supported by the provider. Otherwise, providers accepting `PNG` normalize `WEBP`, `GIF`, and `BMP` to `PNG` via Bun.Image, and normalize `TIF`/`TIFF` to `PNG` when ImageMagick (`magick` or `convert`) is available.

## Shared OCR Options

| Flag                                   | Description                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--format <format>`                    | Output format: `text`, `json`, `tsv`, or `hocr`                                                                                                                    |
| `--password <value>`                   | Password for encrypted PDFs                                                                                                                                        |
| `--all-providers`                      | Enable every supported hosted OCR provider/model for this route                                                                                                    |
| `--ocr-provider-mode <mode>`           | Multi-provider execution: `fanout` or `pool`; default `fanout`                                                                                                     |
| `--primary-ocr <service[/model]>`      | In fan-out multi-provider OCR, choose which requested complete provider result writes top-level extraction artifacts; invalid in pool mode                         |
| `--provider-concurrency <n>`           | Hosted providers/models to run concurrently per item; default `7`                                                                                                  |
| `--ocr-concurrency <n>`                | Page-level OCR concurrency cap. Hosted OCR defaults to `auto`. Explicit values are hosted hard caps.                                                               |
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

For token-priced hosted OCR providers, `--price` uses model-specific input/output token heuristics from observed usage profiles. Actual runs record token usage in `manifest.json`, and post-run cost diagnostics use those actual counts.

The price summary shows `step`, `provider`, `model`, `cost`, `input`, and `estimatedTime`. Run with `--json` for detailed structured fields including page counts, prompt/completion tokens, input/output rates, and `estimateType`.

## Multi-Provider Execution Modes

`fanout` is the default: every selected OCR target receives the full document and writes a complete independent result below `providers/<service>-<model>/`. No top-level extraction is written unless `--primary-ocr` selects one of those complete results.

`pool` creates one composite extraction. Eligible targets draw pages dynamically from one shared queue, so faster targets can process a larger share and transient failures hand off pages to another target. Accepted pages are assembled in original page order and written as the top-level extraction. Provider directories contain isolated page attempts and usage evidence rather than complete independent documents, and `--primary-ocr` is rejected.

```bash
bun autoshow extract document.pdf \
  --provider grok=grok-4.5 \
  --provider mistral=mistral-ocr-4-0 \
  --provider kimi=kimi-k3 \
  --ocr-provider-mode pool \
  --ocr-concurrency 10
```

`--provider-concurrency` bounds active hosted targets. Independent provider/account lanes each reach the applicable OCR page cap, while targets sharing an account lane share that cap. An explicit `--ocr-concurrency 10` is a fixed ceiling per applicable lane; omitting the flag keeps hosted `auto` cap selection. That choice determines the ceiling, while `--concurrency-mode` determines how hosted page work approaches it.

Pool mode is accepted for PDFs, CBZ archives, and supported images where selected targets can normalize into compatible page units. `--price` labels the per-target page allocation heuristic and charges the page set once; `resume --price` estimates only unfinished pages.

## EPUB Options

### Inspect Modes

| Flag         | Result                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| `--epub-bun` | Inspect EPUB structure with the Bun ZIP/XML parser and write structured EPUB data into item metadata |

```bash
bun autoshow extract input/examples/document/1-epub.epub --epub-bun --format json
```

- Inspect mode is metadata-only for EPUB inputs.
- When `--format` is set in inspect mode, it must be `json`.
- Chapter flags (`--chapters`, `--no-chapters`, `--length`) are ignored in inspect mode.

### Native EPUB Export

The default EPUB path extracts cleaned native text instead of OCR page rendering.

```bash
bun autoshow extract input/examples/document/1-epub.epub
bun autoshow extract input/examples/document/1-epub.epub --length 50
bun autoshow extract input/examples/document/1-epub.epub --no-chapters
```

- EPUB native extraction writes one cleaned file per kept section under `chapters/` by default (`chapters/<ordinal>-<source-index>-<slug>.txt`).
- `--length <n>` splits oversized section files with `-part-NN` suffixes.
- `--no-chapters` disables chapter splitting and outputs a single extracted text file.

## PDF Chapter Detection

```bash
bun autoshow extract input/examples/document/book.pdf
bun autoshow extract input/examples/document/3-document.pdf --chapters
bun autoshow extract input/examples/document/3-document.pdf --chapters --pdf-chapter-mode auto
bun autoshow extract input/examples/document/book.pdf --no-chapters
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

Bare `--provider openai` defaults to the cheapest registered OpenAI OCR model. Maximum PDF size is 50 MB.

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

Bare `--provider anthropic` defaults to `claude-haiku-4-5`. Direct images are capped at 5 MB each.

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

Bare `--provider gemini` defaults to `gemini-3.5-flash-lite`. Caps include inline PDFs up to 50 MB, Files API uploads up to 2 GB, and PDFs up to 1,000 pages.

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

- Standalone `extract` document runs write the root extraction artifact (`extraction.txt` or a raw domain `result.json`) plus canonical `manifest.json`.
- EPUB export and PDF chapter autodetection write additive `chapters/` side artifacts inside the output directory.
- Office inputs always use native text/XML extraction; OCR flags are ignored with a warning.
- Config defaults can persist chapter export settings under `defaults.extract.ocr.chapters`, `defaults.extract.ocr.length`, and `defaults.extract.ocr.pdfChapterMode`.
- Backfill existing OCR outputs with top-level [`resume`](../../setup-and-utilities/resume/resume.md).

## Incomplete Runs and Blocked Providers

Hosted OCR provider failures are classified as retryable or blocked before any retry is scheduled. Transient failures (timeouts, network errors, temporary `5xx`, genuine rate limits) stay retryable; provider-declared blockers (insufficient balance, billing required, account suspension, quota exhaustion, content-policy blocks, auth failures, and provider no-retry responses) are marked `retryable: false` and stop new page work for that provider while other requested providers continue.

- A multi-provider run where at least one selected provider succeeds and another does not keeps item `status: "incomplete"`, and successful provider outputs remain usable under `providers/<service>-<model>/`.
- The incomplete-run summary prints a Run Status table and a Provider Failures table with the failure class, retryability, retry attempts spent, and page fallback counts.
- Each failed provider writes a redacted `error.json` (plus optional raw-response artifacts); PDF page fallback writes an auditable `fallback-state.json`.
- Automatic `resume` skips provider entries whose canonical error state is non-retryable or blocked; explicit `resume <dir> --provider provider=model` re-opts into that provider after fixing the underlying cause.

## Provider Capabilities

Marks match the [TTS capability tables](../step-4-tts/text-to-speech-and-voice.md#provider-capabilities): ✅ supported in AutoShow, ⚠️ partial or qualified, ❌ not exposed. Released dates are provider announcement or snapshot dates. Recency marks follow the TTS convention: current-year GA is ✅, older still-current snapshots are ⚠️, and pre-2026 engines are ❌. Rows are newest first.

Pricing is the AutoShow registry rate. Cost rank orders models cheapest-first within each table (1 = cheapest) and ties share a rank; token-priced models rank on the registry-estimated cost per 1,000 pages (per-page token estimates times token rates), shown as the ≈ figure.

`--format text|json|tsv|hocr` is available for every engine. Written TSV and hOCR artifacts are synthesized from page text for all providers. Password PDFs are decrypted before upload or render except Anthropic, which rejects encrypted PDFs.

### Dedicated OCR

| Provider                             | Released      | Kind                    | Native PDF            | Images                      | Image cap      | PDF cap        | Pages          | Markdown                         | Tables / formulas / layout                                            | BBoxes                               | Password PDFs          | Pool   | Pricing                                              | Cost rank |
| ------------------------------------ | ------------- | ----------------------- | --------------------- | --------------------------- | -------------- | -------------- | -------------- | -------------------------------- | --------------------------------------------------------------------- | ------------------------------------ | ---------------------- | ------ | ---------------------------------------------------- | --------- |
| Mistral `mistral-ocr-4-0`            | ✅ 2026-06-23 | ✅ Hosted dedicated OCR | ✅ Native PDF upload  | ✅ PNG JPG TIF              | ⚠️ Unpublished | ⚠️ Unpublished | ⚠️ Unpublished | ✅ Per-page markdown             | ⚠️ BBox and block labels exist; AutoShow does not request annotations | ❌ Not requested                     | ✅ Decrypt then upload | ✅ Yes | $4.00/1k pages                                       | 5/8       |
| GLM `glm-ocr`                        | ✅ 2026-02    | ✅ Hosted layout OCR    | ✅ Native PDF upload  | ✅ PNG JPG                  | ❌ 10 MB       | ⚠️ 50 MB       | ❌ 100 pages   | ✅ `md_results`                  | ✅ Tables, formulas, seals, handwriting claimed                       | ⚠️ `bbox_2d` returned, not persisted | ✅ Decrypt then upload | ✅ Yes | $0.03 in / $0.03 out per 1M tokens (≈$0.09/1k pages) | 1/8       |
| Mistral `mistral-ocr-2512`           | ⚠️ 2025-12    | ✅ Hosted dedicated OCR | ✅ Native PDF upload  | ✅ PNG JPG TIF              | ⚠️ Unpublished | ⚠️ Unpublished | ⚠️ Unpublished | ✅ Per-page markdown             | ⚠️ Layout in markdown; annotations unused                             | ❌ Not requested                     | ✅ Decrypt then upload | ✅ Yes | $2.00/1k pages                                       | 2/8       |
| Replicate `lucataco/deepseek-ocr`    | ⚠️ 2025-10-21 | ✅ Hosted dedicated OCR | ⚠️ Rendered PNG pages | ✅ One image per prediction | ⚠️ Unpublished | ⚠️ N/A         | ⚠️ N/A         | ✅ Convert to Markdown           | ⚠️ Markdown structure                                                 | ❌ No                                | ✅ Render then upload  | ❌ No  | $3.30/1k pages                                       | 4/8       |
| Replicate `datalab-to/ocr`           | ⚠️ 2025-10    | ✅ Hosted dedicated OCR | ✅ Native PDF upload  | ✅ PNG JPG WEBP             | ⚠️ Unpublished | ⚠️ Unpublished | ⚠️ Unpublished | ⚠️ When the API returns markdown | ⚠️ Document OCR                                                       | ❌ Not requested                     | ✅ Decrypt then upload | ❌ No  | $2.00/1k pages                                       | 2/8       |
| Replicate `datalab-to/marker`        | ❌ 2024-11    | ✅ Hosted dedicated OCR | ✅ Native PDF upload  | ✅ PNG JPG WEBP             | ⚠️ Unpublished | ⚠️ Unpublished | ⚠️ Unpublished | ⚠️ When the API returns markdown | ⚠️ Fast mode only; accurate/`page_schema` unused                      | ❌ Not exposed                       | ✅ Decrypt then upload | ❌ No  | $4.00/1k pages                                       | 5/8       |
| fal.ai `fal-ai/got-ocr/v2`           | ❌ 2024-09    | ✅ Hosted specialty OCR | ⚠️ Rendered PNG pages | ✅ PNG JPG WEBP             | ⚠️ Unpublished | ⚠️ N/A         | ⚠️ N/A         | ⚠️ `do_format=true`              | ✅ Tables, charts, formulas, dense layout                             | ❌ No                                | ✅ Render then upload  | ❌ No  | $50.00/1k pages                                      | 8/8       |
| fal.ai `fal-ai/florence-2-large/ocr` | ❌ 2024-06-17 | ✅ Hosted general OCR   | ⚠️ Rendered PNG pages | ✅ PNG JPG WEBP             | ⚠️ Unpublished | ⚠️ N/A         | ⚠️ N/A         | ❌ Plain `results`               | ❌ General OCR only                                                   | ❌ No                                | ✅ Render then upload  | ❌ No  | $7.55/1k pages                                       | 7/8       |

### Frontier VLMs

| Provider                            | Released      | Kind                   | Native PDF                   | Images              | Image cap          | PDF cap          | Pages          | Structured pages           | Reasoning                     | Password PDFs              | Pool   | Pricing                                          | Cost rank |
| ----------------------------------- | ------------- | ---------------------- | ---------------------------- | ------------------- | ------------------ | ---------------- | -------------- | -------------------------- | ----------------------------- | -------------------------- | ------ | ------------------------------------------------ | --------- |
| OpenAI `gpt-5.6-terra`              | ✅ 2026-08    | ⚠️ VLM Responses       | ✅ Native PDF                | ✅ PNG JPG WEBP GIF | ⚠️ Request payload | ⚠️ 50 MB         | ⚠️ Unpublished | ✅ JSON page schema        | ✅ Optional through max       | ✅ Decrypt then upload     | ✅ Yes | $2.00 / $12.00 per 1M tokens (≈$12.17/1k pages)  | 12/20     |
| OpenAI `gpt-5.6-luna`               | ✅ 2026-08    | ⚠️ VLM Responses       | ✅ Native PDF                | ✅ PNG JPG WEBP GIF | ⚠️ Request payload | ⚠️ 50 MB         | ⚠️ Unpublished | ✅ JSON page schema        | ✅ Optional through max       | ✅ Decrypt then upload     | ✅ Yes | $0.20 / $1.20 per 1M tokens (≈$1.35/1k pages)    | 1/20      |
| Gemini `gemini-3.5-flash-lite`      | ✅ 2026-08    | ⚠️ VLM GenerateContent | ✅ Inline 50 MB / Files 2 GB | ✅ PNG JPG WEBP BMP | ✅ 2 GB            | ✅ 2 GB          | ✅ 1000 pages  | ✅ Native JSON schema      | ✅ Optional including minimal | ✅ Decrypt then upload     | ✅ Yes | $0.30 / $2.50 per 1M tokens (≈$4.41/1k pages)    | 5/20      |
| OpenAI `gpt-5.6-sol`                | ✅ 2026-07    | ⚠️ VLM Responses       | ✅ Native PDF                | ✅ PNG JPG WEBP GIF | ⚠️ Request payload | ⚠️ 50 MB         | ⚠️ Unpublished | ✅ JSON page schema        | ✅ Optional through max       | ✅ Decrypt then upload     | ✅ Yes | $5.00 / $30.00 per 1M tokens (≈$36.33/1k pages)  | 18/20     |
| Anthropic `claude-sonnet-5`         | ✅ 2026-07    | ⚠️ VLM Messages        | ✅ Unencrypted Files API     | ✅ PNG JPG WEBP GIF | ❌ 5 MB            | ⚠️ 500 MB upload | ⚠️ Unpublished | ✅ Prompted JSON pages     | ✅ Optional through max       | ❌ Encrypted PDFs rejected | ✅ Yes | $2.00 / $10.00 per 1M tokens (≈$8.06/1k pages)   | 9/20      |
| Anthropic `claude-opus-5`           | ✅ 2026-07    | ⚠️ VLM Messages        | ✅ Unencrypted Files API     | ✅ PNG JPG WEBP GIF | ❌ 5 MB            | ⚠️ 500 MB upload | ⚠️ Unpublished | ✅ Prompted JSON pages     | ✅ Optional, on by default    | ❌ Encrypted PDFs rejected | ✅ Yes | $5.00 / $25.00 per 1M tokens (≈$20.15/1k pages)  | 15/20     |
| Gemini `gemini-3.6-flash`           | ✅ 2026-07    | ⚠️ VLM GenerateContent | ✅ Inline 50 MB / Files 2 GB | ✅ PNG JPG WEBP BMP | ✅ 2 GB            | ✅ 2 GB          | ✅ 1000 pages  | ✅ Native JSON schema      | ✅ Optional including minimal | ✅ Decrypt then upload     | ✅ Yes | $1.50 / $7.50 per 1M tokens (≈$13.93/1k pages)   | 13/20     |
| Grok `grok-4.5`                     | ✅ 2026-07    | ⚠️ VLM chat            | ⚠️ Rendered PNG pages        | ✅ PNG JPG          | ❌ 20 MiB          | ⚠️ N/A           | ⚠️ N/A         | ❌ Plain text prompt       | ✅ Required                   | ✅ Render then upload      | ✅ Yes | $2.00 / $6.00 per 1M tokens (≈$14.00/1k pages)   | 14/20     |
| Kimi `kimi-k3`                      | ✅ 2026-07    | ⚠️ VLM chat            | ⚠️ Rendered PNG pages        | ✅ PNG JPG WEBP GIF | ⚠️ 100 MB          | ⚠️ N/A           | ⚠️ N/A         | ❌ Prompt forbids markdown | ✅ Required effort            | ✅ Render then upload      | ✅ Yes | $3.00 / $15.00 per 1M tokens (≈$20.54/1k pages)  | 17/20     |
| Anthropic `claude-fable-5`          | ✅ 2026-06-09 | ⚠️ VLM Messages        | ✅ Unencrypted Files API     | ✅ PNG JPG WEBP GIF | ❌ 5 MB            | ⚠️ 500 MB upload | ⚠️ Unpublished | ✅ Prompted JSON pages     | ✅ Required adaptive thinking | ❌ Encrypted PDFs rejected | ✅ Yes | $10.00 / $50.00 per 1M tokens (≈$63.69/1k pages) | 19/20     |
| Gemini `gemini-3.5-flash`           | ✅ 2026-06    | ⚠️ VLM GenerateContent | ✅ Inline 50 MB / Files 2 GB | ✅ PNG JPG WEBP BMP | ✅ 2 GB            | ✅ 2 GB          | ✅ 1000 pages  | ✅ Native JSON schema      | ✅ Optional including minimal | ✅ Decrypt then upload     | ✅ Yes | $1.50 / $9.00 per 1M tokens (≈$7.31/1k pages)    | 7/20      |
| Anthropic `claude-opus-4-8`         | ✅ 2026-05    | ⚠️ VLM Messages        | ✅ Unencrypted Files API     | ✅ PNG JPG WEBP GIF | ❌ 5 MB            | ⚠️ 500 MB upload | ⚠️ Unpublished | ✅ Prompted JSON pages     | ✅ Optional through max       | ❌ Encrypted PDFs rejected | ✅ Yes | $5.00 / $25.00 per 1M tokens (≈$20.15/1k pages)  | 15/20     |
| Grok `grok-4.3`                     | ✅ 2026-05    | ⚠️ VLM chat            | ⚠️ Rendered PNG pages        | ✅ PNG JPG          | ❌ 20 MiB          | ⚠️ N/A           | ⚠️ N/A         | ❌ Plain text prompt       | ❌ Unsupported                | ✅ Render then upload      | ✅ Yes | $1.25 / $2.50 per 1M tokens (≈$7.50/1k pages)    | 8/20      |
| OpenAI `gpt-5.5`                    | ✅ 2026-04-23 | ⚠️ VLM Responses       | ✅ Native PDF                | ✅ PNG JPG WEBP GIF | ⚠️ Request payload | ⚠️ 50 MB         | ⚠️ Unpublished | ✅ JSON page schema        | ✅ Optional through high      | ✅ Decrypt then upload     | ✅ Yes | $5.00 / $30.00 per 1M tokens (≈$72.02/1k pages)  | 20/20     |
| OpenAI `gpt-5.4-mini`               | ✅ 2026-03-17 | ⚠️ VLM Responses       | ✅ Native PDF                | ✅ PNG JPG WEBP GIF | ⚠️ Request payload | ⚠️ 50 MB         | ⚠️ Unpublished | ✅ JSON page schema        | ✅ Optional through high      | ✅ Decrypt then upload     | ✅ Yes | $0.75 / $4.50 per 1M tokens (≈$10.54/1k pages)   | 11/20     |
| OpenAI `gpt-5.4-nano`               | ✅ 2026-03-17 | ⚠️ VLM Responses       | ✅ Native PDF                | ✅ PNG JPG WEBP GIF | ⚠️ Request payload | ⚠️ 50 MB         | ⚠️ Unpublished | ✅ JSON page schema        | ✅ Optional through high      | ✅ Decrypt then upload     | ✅ Yes | $0.20 / $1.25 per 1M tokens (≈$2.90/1k pages)    | 2/20      |
| Grok `grok-4.20-0309-non-reasoning` | ✅ 2026-03-09 | ⚠️ VLM chat            | ⚠️ Rendered PNG pages        | ✅ PNG JPG          | ❌ 20 MiB          | ⚠️ N/A           | ⚠️ N/A         | ❌ Plain text prompt       | ❌ Unsupported                | ✅ Render then upload      | ✅ Yes | $1.25 / $2.50 per 1M tokens (≈$4.16/1k pages)    | 4/20      |
| Kimi `kimi-k2.6`                    | ⚠️ 2026-01    | ⚠️ VLM chat            | ⚠️ Rendered PNG pages        | ✅ PNG JPG WEBP GIF | ⚠️ 100 MB          | ⚠️ N/A           | ⚠️ N/A         | ❌ Prompt forbids markdown | ⚠️ Optional thinking          | ✅ Render then upload      | ✅ Yes | $0.95 / $4.00 per 1M tokens (≈$6.12/1k pages)    | 6/20      |
| Gemini `gemini-3.1-pro-preview`     | ⚠️ 2025-12    | ⚠️ VLM GenerateContent | ✅ Inline 50 MB / Files 2 GB | ✅ PNG JPG WEBP BMP | ✅ 2 GB            | ✅ 2 GB          | ✅ 1000 pages  | ✅ Native JSON schema      | ✅ Optional through high      | ✅ Decrypt then upload     | ✅ Yes | $2.00 / $12.00 per 1M tokens (≈$9.52/1k pages)   | 10/20     |
| Anthropic `claude-haiku-4-5`        | ⚠️ 2025-10-01 | ⚠️ VLM Messages        | ✅ Unencrypted Files API     | ✅ PNG JPG WEBP GIF | ❌ 5 MB            | ⚠️ 500 MB upload | ⚠️ Unpublished | ✅ Prompted JSON pages     | ❌ Unsupported                | ❌ Encrypted PDFs rejected | ✅ Yes | $1.00 / $5.00 per 1M tokens (≈$4.03/1k pages)    | 3/20      |

### Hosted open VLMs

| Provider                                                  | Released      | Kind        | Native PDF            | Images          | Image cap | PDF cap | Pages  | Structured pages     | Reasoning      | Password PDFs         | Pool   | Pricing                                        | Cost rank |
| --------------------------------------------------------- | ------------- | ----------- | --------------------- | --------------- | --------- | ------- | ------ | -------------------- | -------------- | --------------------- | ------ | ---------------------------------------------- | --------- |
| DeepInfra `Qwen/Qwen3-VL-235B-A22B-Instruct`              | ⚠️ 2025-09-23 | ⚠️ VLM chat | ⚠️ Rendered PNG pages | ✅ PNG JPG WEBP | ❌ 20 MB  | ⚠️ N/A  | ⚠️ N/A | ❌ Plain text prompt | ❌ Unsupported | ✅ Render then upload | ✅ Yes | $0.20 / $0.88 per 1M tokens (≈$1.28/1k pages)  | 4/5       |
| DeepInfra `Qwen/Qwen3-VL-30B-A3B-Instruct`                | ⚠️ 2025-09-23 | ⚠️ VLM chat | ⚠️ Rendered PNG pages | ✅ PNG JPG WEBP | ❌ 20 MB  | ⚠️ N/A  | ⚠️ N/A | ❌ Plain text prompt | ❌ Unsupported | ✅ Render then upload | ✅ Yes | $0.15 / $0.60 per 1M tokens (≈$1.48/1k pages)  | 5/5       |
| DeepInfra `mistralai/Mistral-Small-3.2-24B-Instruct-2506` | ⚠️ 2025-06-20 | ⚠️ VLM chat | ⚠️ Rendered PNG pages | ✅ PNG JPG WEBP | ❌ 20 MB  | ⚠️ N/A  | ⚠️ N/A | ❌ Plain text prompt | ❌ Unsupported | ✅ Render then upload | ✅ Yes | $0.075 / $0.20 per 1M tokens (≈$0.69/1k pages) | 1/5       |
| DeepInfra `meta-llama/Llama-4-Scout-17B-16E-Instruct`     | ❌ 2025-04-05 | ⚠️ VLM chat | ⚠️ Rendered PNG pages | ✅ PNG JPG WEBP | ❌ 20 MB  | ⚠️ N/A  | ⚠️ N/A | ❌ Plain text prompt | ❌ Unsupported | ✅ Render then upload | ✅ Yes | $0.10 / $0.30 per 1M tokens (≈$0.94/1k pages)  | 3/5       |
| DeepInfra `google/gemma-3-27b-it`                         | ❌ 2025-03-12 | ⚠️ VLM chat | ⚠️ Rendered PNG pages | ✅ PNG JPG WEBP | ❌ 20 MB  | ⚠️ N/A  | ⚠️ N/A | ❌ Plain text prompt | ❌ Unsupported | ✅ Render then upload | ✅ Yes | $0.08 / $0.16 per 1M tokens (≈$0.71/1k pages)  | 2/5       |

Mistral OCR 4 can return bounding boxes, block types, and confidence when annotations are requested; AutoShow uses non-annotated markdown extraction. GLM returns layout labels and `bbox_2d` but AutoShow joins text only. Claude Fable 5 requires 30-day data retention and is unavailable under ZDR. Replicate and fal.ai targets are not pool-eligible. WEBP, GIF, and BMP normalize to PNG when a provider accepts PNG; TIF/TIFF normalize through ImageMagick when available.

OCR test coverage is documented in [Step 2 Tests: OCR](06-extract-ocr-tests.md).
