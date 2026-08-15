# extract OCR

Documents and images route through local OCR, hosted OCR, or native text extraction depending on the input format.

## Outline

- [OCR Setup](#ocr-setup)
- [OCR Environment](#ocr-environment)
- [OCR Routing](#ocr-routing)
- [Shared OCR Options](#shared-ocr-options)
- [Multi-Provider Execution Modes](#multi-provider-execution-modes)
- [ACSM Fulfillment](#acsm-fulfillment)
- [EPUB Options](#epub-options)
  - [Inspect Modes](#inspect-modes)
  - [Native EPUB Export](#native-epub-export)
- [PDF Chapter Detection](#pdf-chapter-detection)
- [OCR Services](#ocr-services)
  - [Tesseract](#tesseract)
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

See the [`extract` overview](./01-extract.md) for input routing across STT, OCR, article HTML, and X/Twitter inputs. Remote article URLs and local HTML are documented separately in [URL and X extraction](./04-extract-url.md).

The standalone `extract` command uses route-aware `--provider provider[=model]` selectors for document/OCR inputs. The `write` and `config` commands use the step selector `--ocr provider[=model]`; `resume` uses target-aware `--provider provider[=model]`.

## OCR Setup

```bash
# full setup
bun autoshow setup

# document foundations: mutool + qpdf + Calibre ebook-convert + ACSM fulfillment
bun autoshow setup --step calibre

# ACSM fulfillment only
bun autoshow setup --step acsm

# ACSM authorization
bun autoshow setup --step acsm-authorize
```

Tesseract is the only local OCR engine and is installed as part of `bun autoshow setup`. All other OCR engines are hosted services selected by provider.

ACSM support is installed by `bun autoshow setup --step calibre` and can be repaired independently with `bun autoshow setup --step acsm`. Setup downloads the pinned Calibre ACSM Input plugin release, creates a managed Python environment for the standalone plugin scripts, and writes `calibre-acsm-fulfill` plus `calibre-acsm-authorize` into `runtime/bin`. Run `bun autoshow setup --step acsm-authorize` once to create the local activation files used by fulfillment.

## OCR Environment

| Provider | Required env |
|----------|--------------|
| Mistral | `MISTRAL_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Grok | `XAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| Gemini | `GEMINI_API_KEY` |
| GLM | `GLM_API_KEY` |
| Kimi | `KIMI_API_KEY` |
| DeepInfra | `DEEPINFRA_API_KEY` |
| Replicate | `REPLICATE_API_KEY` |
| fal.ai | `FAL_KEY` |

## OCR Routing

| Input family | Default path | Other available paths |
|--------------|--------------|-----------------------|
| PDF | `mutool+tesseract` | `--provider tesseract`, hosted OCR engines |
| EPUB | cleaned native extraction (`epub-text`) | `--provider tesseract`, hosted OCR engines, `--epub-bun` |
| ACSM | fulfill locally to EPUB/PDF, then follow the fulfilled EPUB/PDF path | same as the fulfilled output |
| Convertible ebooks (MOBI, AZW/AZW3, PRC, FB2, LIT) | normalize to EPUB, then follow the EPUB path | same |
| DOCX / PPTX / XLSX / ODF | native ZIP/XML text extraction | OCR flags are ignored with a warning |
| RTF | native RTF text extraction | OCR flags are ignored with a warning |
| CBZ | per-image OCR | local or hosted engines |
| CSV | raw text | OCR flags are ignored with a warning |
| PNG / JPG / JPEG / TIF / TIFF | local OCR by default | hosted OCR engines |
| WebP / BMP | normalize locally when possible, then OCR | hosted OCR engines |
| GIF | local OCR by default | hosted OCR engines |

Hosted direct-image inputs retain native uploads when supported by the provider. Otherwise, providers accepting `PNG` normalize `WEBP`, `GIF`, and `BMP` to `PNG` via Bun.Image, and normalize `TIF`/`TIFF` to `PNG` when ImageMagick (`magick` or `convert`) is available.

## Shared OCR Options

| Flag | Description |
|------|-------------|
| `--format <format>` | Output format: `text`, `json`, `tsv`, or `hocr` |
| `--password <value>` | Password for encrypted PDFs |
| `--all-providers` | Enable every supported hosted OCR provider/model for this route |
| `--all-local` | Enable every local OCR engine for this route (`tesseract`) |
| `--ocr-provider-mode <mode>` | Multi-provider execution: `fanout` or `pool`; default `fanout` |
| `--primary-ocr <service[/model]>` | In fan-out multi-provider OCR, choose which requested complete provider result writes top-level extraction artifacts; invalid in pool mode |
| `--provider-concurrency <n>` | Hosted providers/models to run concurrently per item; default `7` |
| `--local-concurrency <n>` | Local providers to run concurrently per item; default `7` |
| `--ocr-concurrency <n>` | Page-level OCR concurrency cap. Local OCR defaults to `10`; hosted OCR defaults to `auto`. Explicit values are hosted hard caps. |
| `--concurrency-mode <ramp\|immediate>` | Approach each hosted provider/account page cap from one request at one added slot every five seconds (`ramp`, default), or start at the resolved cap (`immediate`) |
| `--ocr-dpi <n>` | Render DPI for OCR pages |
| `--chapters`, `--no-chapters` | EPUB native text runs and long PDF chapter autodetection: write chapter files under `chapters/`; use `--no-chapters` for a single extracted file |
| `--length <n>` | Hard export limit in thousands of characters; splits oversized EPUB or PDF chapter files |
| `--pdf-chapter-mode <mode>` | PDF chapter detection mode: `local`, `auto`, or `llm` |
| `--price` | Show the aggregated OCR estimate and exit |

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

For token-priced hosted OCR providers, `--price` uses model-specific input/output token heuristics from observed usage profiles. Actual runs record token usage in `manifest.json`, and post-run cost diagnostics use those actual counts.

The price summary shows `step`, `provider`, `model`, `cost`, `input`, and `estimatedTime`. Run with `--json` for detailed structured fields including page counts, prompt/completion tokens, input/output rates, and `estimateType`.

For `.acsm` inputs, `--price` does not run fulfillment because that step can contact Adobe or distributor servers. The estimate prints an ACSM note and omits page-priced OCR costs until a fulfilled EPUB or PDF exists.

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

`--provider-concurrency` bounds active hosted targets and `--local-concurrency` bounds active local targets. Independent provider/account lanes each reach the applicable OCR page cap, while targets sharing an account lane share that cap. An explicit `--ocr-concurrency 10` is a fixed ceiling per applicable lane; omitting the flag keeps hosted `auto` cap selection. That choice determines the ceiling, while `--concurrency-mode` determines how hosted page work approaches it. Local OCR remains immediate.

Pool mode is accepted for PDFs, CBZ archives, and supported images where selected targets can normalize into compatible page units. `--price` labels the per-target page allocation heuristic and charges the page set once; `resume --price` estimates only unfinished pages.

## ACSM Fulfillment

AutoShow treats `.acsm` files as local preprocessing inputs. The raw ACSM file is never sent to OCR providers. Step 1 invokes:

```bash
calibre-acsm-fulfill <input.acsm> <output-dir>
```

The wrapper writes exactly one `.epub` or `.pdf` into `<output-dir>` and exits `0`. AutoShow resolves `calibre-acsm-fulfill` from `--bin-dir` first, then the setup-managed `runtime/bin` wrapper, then `PATH`.

After setup, run `bun autoshow setup --step acsm-authorize` once to create local activation files. You can press Enter at the Adobe ID prompt for anonymous authorization, or copy existing `activation.xml`, `device.xml`, and `devicesalt` files into `runtime/tools/acsm-calibre-plugin/account`.

On success, AutoShow records metadata and continues through normal EPUB/PDF extraction. On failure, wrapper stdout/stderr is omitted from user-facing errors and manifests to protect sensitive activation data.

Limitations:

- Lawful access, authorization, and DRM/key handling remain user responsibilities.
- Fulfillment may contact Adobe or distributor servers.
- AutoShow does not upload ACSM files to third-party online converters.

## EPUB Options

### Inspect Modes

| Flag | Result |
|------|--------|
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

### Tesseract

| Option | Value |
|--------|-------|
| Selector | default PDF/image path, or `--provider tesseract` |
| Language | `--ocr-language <codes>` (e.g. `eng` or `eng+fra`) |
| DPI | `--ocr-dpi <n>` (default `300`) |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider tesseract
bun autoshow extract input/examples/document/1-document.pdf --provider tesseract --ocr-language eng+fra --ocr-dpi 300
```

### Mistral OCR

| Option | Value |
|--------|-------|
| Selector | `--provider mistral[=<model>]` |
| Models | `mistral-ocr-2512`, `mistral-ocr-4-0` |
| Direct input support | PDF, `PNG`, `JPG`, `TIF` |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider mistral=mistral-ocr-2512
bun autoshow extract input/examples/document/1-document.pdf --provider mistral=mistral-ocr-4-0
```

Bare `--provider mistral` defaults to `mistral-ocr-2512`.

### GLM OCR

| Option | Value |
|--------|-------|
| Selector | `--provider glm[=<model>]` |
| Models | `glm-ocr` |
| Direct input support | PDF, `PNG`, `JPG` |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider glm=glm-ocr
```

Caps: images up to 10 MB, PDFs up to 50 MB and 100 pages.

### Kimi OCR

| Option | Value |
|--------|-------|
| Selector | `--provider kimi[=<model>]` |
| Models | `kimi-k2.6`, `kimi-k3` |
| Direct input support | `PNG`, `JPG`, `WEBP`, `GIF`; rendered PDF/EPUB pages |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider kimi=kimi-k2.6
bun autoshow extract input/examples/document/1-document.pdf --provider kimi=kimi-k3
```

Bare `--provider kimi` defaults to `kimi-k2.6`. Direct or rendered image uploads are capped at 100 MB.

### OpenAI OCR

| Option | Value |
|--------|-------|
| Selector | `--provider openai[=<model>]` |
| Models | `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-5.5`, `gpt-5.4-mini`, `gpt-5.4-nano` |
| Direct input support | PDF, `PNG`, `JPG`, `WEBP`, `GIF` |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider openai=gpt-5.6-sol
bun autoshow extract input/examples/document/1-document.pdf --provider openai=gpt-5.5
bun autoshow extract input/examples/document/1-document.pdf --provider openai=gpt-5.4-nano
```

Bare `--provider openai` defaults to the cheapest registered OpenAI OCR model. Maximum PDF size is 50 MB.

### Grok OCR

| Option | Value |
|--------|-------|
| Selector | `--provider grok[=<model>]` |
| Models | `grok-4.3`, `grok-4.20-0309-non-reasoning`, `grok-4.5` |
| Direct input support | `PNG`, `JPG`; rendered PDF/EPUB pages |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider grok=grok-4.3
bun autoshow extract input/examples/document/1-document.pdf --provider grok=grok-4.5
```

Bare `--provider grok` defaults to `grok-4.3`. Direct images and rendered pages are capped at 20 MiB each.

### Anthropic OCR

| Option | Value |
|--------|-------|
| Selector | `--provider anthropic[=<model>]` |
| Models | `claude-fable-5`, `claude-opus-4-8`, `claude-sonnet-5`, `claude-haiku-4-5`, `claude-opus-5` |
| Direct input support | Unencrypted PDFs, `PNG`, `JPG`, `WEBP`, `GIF` |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider anthropic=claude-haiku-4-5
bun autoshow extract input/examples/document/1-document.pdf --provider anthropic=claude-sonnet-5
```

Bare `--provider anthropic` defaults to `claude-haiku-4-5`. Direct images are capped at 5 MB each.

### Gemini OCR

| Option | Value |
|--------|-------|
| Selector | `--provider gemini[=<model>]` |
| Models | `gemini-3.1-pro-preview`, `gemini-3.5-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite` |
| Direct input support | PDF, `PNG`, `JPG`, `WEBP`, `BMP` |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider gemini=gemini-3.5-flash-lite
bun autoshow extract input/examples/document/1-document.pdf --provider gemini=gemini-3.6-flash
```

Bare `--provider gemini` defaults to `gemini-3.5-flash-lite`. Caps include inline PDFs up to 50 MB, Files API uploads up to 2 GB, and PDFs up to 1,000 pages.

### DeepInfra OCR

| Option | Value |
|--------|-------|
| Selector | `--provider deepinfra[=<model>]` |
| Models | `google/gemma-3-27b-it`, `meta-llama/Llama-4-Scout-17B-16E-Instruct`, `mistralai/Mistral-Small-3.2-24B-Instruct-2506`, `Qwen/Qwen3-VL-235B-A22B-Instruct`, `Qwen/Qwen3-VL-30B-A3B-Instruct` |
| Direct input support | `PNG`, `JPG`, `WEBP`; rendered PDF/EPUB pages |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider deepinfra=Qwen/Qwen3-VL-30B-A3B-Instruct
bun autoshow extract input/examples/document/1-document.pdf --provider deepinfra=Qwen/Qwen3-VL-235B-A22B-Instruct
```

Bare `--provider deepinfra` defaults to `Qwen/Qwen3-VL-30B-A3B-Instruct`. Uploads are capped at 20 MB per image.

### Replicate OCR

| Option | Value |
|--------|-------|
| Selector | `--provider replicate[=<model>]` |
| Models | `datalab-to/ocr`, `datalab-to/marker`, `lucataco/deepseek-ocr` |
| Direct input support | PDF, `PNG`, `JPG`, `WEBP`; rendered PDF/EPUB pages |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider replicate=datalab-to/ocr
bun autoshow extract input/examples/document/1-document.pdf --provider replicate=datalab-to/marker
bun autoshow extract input/examples/document/1-document.pdf --provider replicate=lucataco/deepseek-ocr
```

### fal.ai OCR

| Option | Value |
|--------|-------|
| Selector | `--provider fal[=<model>]` |
| Models | `fal-ai/got-ocr/v2`, `fal-ai/florence-2-large/ocr` |
| Direct input support | `PNG`, `JPG`, `WEBP`; rendered PDF/EPUB pages |

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
