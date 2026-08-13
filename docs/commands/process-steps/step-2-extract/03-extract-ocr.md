# extract OCR

Documents and images route through local OCR, hosted OCR, or native text extraction depending on the input format.

## Outline

- [OCR Setup](#ocr-setup)
- [OCR Environment](#ocr-environment)
- [OCR Routing](#ocr-routing)
- [Shared OCR Options](#shared-ocr-options)
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

Use these only when you select the matching hosted OCR engine:

```bash
MISTRAL_API_KEY=...
OPENAI_API_KEY=...
XAI_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
GLM_API_KEY=...
KIMI_API_KEY=...
DEEPINFRA_API_KEY=...
```

## OCR Routing

| Input family | Default path | Other available paths |
|--------------|--------------|-----------------------|
| PDF | `mutool+tesseract` | `--provider tesseract`, `--provider mistral`, `--provider glm`, `--provider kimi`, `--provider openai`, `--provider grok`, `--provider anthropic`, `--provider gemini`, `--provider deepinfra` |
| EPUB | cleaned native extraction (`epub-text`) | `--provider tesseract`, hosted OCR engines, `--epub-bun` |
| ACSM | fulfill locally to EPUB/PDF, then follow the fulfilled EPUB/PDF path | same as the fulfilled output |
| Convertible ebooks (MOBI, AZW/AZW3, PRC, FB2, LIT) | normalize to EPUB, then follow the EPUB path | same |
| DOCX / PPTX / XLSX / ODF | native ZIP/XML text extraction | OCR flags are ignored with a warning |
| RTF | native RTF text extraction | OCR flags are ignored with a warning |
| CBZ | per-image OCR | local or hosted engines |
| CSV | raw text | OCR flags are ignored with a warning |
| PNG / JPG / JPEG / TIF / TIFF | local OCR by default | hosted OCR also supported; some providers normalize `TIF`/`TIFF` to `PNG` when ImageMagick is available |
| WebP / BMP | normalize locally when possible, then OCR | hosted support varies by provider |
| GIF | local OCR by default | hosted support varies by provider |

Hosted OCR service tables list provider-native direct input formats. For hosted direct-image inputs, AutoShow keeps native uploads when the provider supports the source format; otherwise, providers that accept `PNG` can normalize `WEBP`, `GIF`, and `BMP` to `PNG` locally with Bun.Image, and can normalize `TIF/TIFF` to `PNG` when ImageMagick (`magick` or `convert`) is available.

## Shared OCR Options

| Flag | Description |
|------|-------------|
| `--format <format>` | Output format: `text`, `json`, `tsv`, or `hocr` |
| `--password <value>` | Password for encrypted PDFs |
| `--all-providers` | Enable every supported OCR provider/model for this route |
| `--primary-ocr <service[/model]>` | In multi-provider OCR, choose which requested provider writes top-level extraction artifacts |
| `--provider-concurrency <n>` | Hosted providers/models to run concurrently per item; default `10` |
| `--local-concurrency <n>` | Local providers to run concurrently per item; default `10` |
| `--ocr-concurrency <n>` | Page-level OCR concurrency cap. Local OCR defaults to `10`; hosted OCR defaults to `auto`. Explicit values are hosted hard caps. |
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
```

For token-priced hosted OCR providers, `--price` uses model-specific input/output token heuristics from recent benchmark usage. Actual runs write usage to the provider entry in `manifest.json` when available, and post-run cost diagnostics use those actual token counts.

The human price table shows `step`, `provider`, `model`, and `cost`, plus `input` and `estimatedTime` columns when those values are available. Run with `--json` when you need the structured estimate fields behind the total, including page counts, prompt/completion tokens, input/output rates, and `estimateType`.

For `.acsm` inputs, `--price` does not run fulfillment because that step can contact Adobe or distributor servers. The estimate prints an ACSM note and omits page-priced OCR costs until a fulfilled EPUB or PDF exists.

## ACSM Fulfillment

AutoShow treats `.acsm` files as local preprocessing inputs. The raw ACSM file is never sent to OCR providers. Step 1 invokes:

```bash
calibre-acsm-fulfill <input.acsm> <output-dir>
```

The wrapper must write exactly one `.epub` or `.pdf` into `<output-dir>` and exit `0`. AutoShow resolves `calibre-acsm-fulfill` from `--bin-dir` first, then the setup-managed `runtime/bin` wrapper, then `PATH`; there is no config key and no command-template flag.

After setup, run `bun autoshow setup --step acsm-authorize` once to create the local activation files used by the standalone plugin scripts. You can press Enter at the Adobe ID prompt for anonymous authorization, or copy an existing `activation.xml`, `device.xml`, and `devicesalt` into `runtime/tools/acsm-calibre-plugin/account`.

On success, AutoShow records `sourceFormat: "acsm"`, `normalizedFormat: "epub"` or `"pdf"`, and `conversionChain: ["calibre-acsm-plugin"]` in the manifest item's metadata, then continues through the normal EPUB/PDF extraction path. On failure, wrapper stdout/stderr is not copied into user-facing errors or manifests because plugin activation data, account paths, and backup details may be sensitive.

Limitations:

- You are responsible for lawful access, authorization state, and any DRM/key handling needed for the fulfilled book to be readable.
- Fulfillment may contact Adobe or distributor servers even though it is not an AutoShow paid-provider run.
- AutoShow does not integrate online ACSM converters and does not upload ACSM files for conversion.

## EPUB Options

### Inspect Modes

| Flag | Result |
|------|--------|
| `--epub-bun` | Inspect EPUB structure with the Bun ZIP/XML parser and write structured EPUB data into the canonical item's metadata |

```bash
bun autoshow extract input/examples/document/1-epub.epub --epub-bun --format json
```

- Inspect mode is metadata-only for EPUB inputs.
- If `--format` is set in inspect mode, it must be `json`.
- `--chapters`, `--no-chapters`, and `--length` are ignored in inspect mode.

### Native EPUB Export

The default EPUB path writes cleaned native text instead of synthetic `Page N` output.

```bash
bun autoshow extract input/examples/document/1-epub.epub
bun autoshow extract input/examples/document/1-epub.epub --length 50
bun autoshow extract input/examples/document/1-epub.epub --no-chapters
```

- EPUB native extraction writes one cleaned file per kept section under `chapters/` by default.
- Chapter artifact names use `chapters/<ordinal>-<source-index>-<slug>.txt`; for example, `chapters/01-003-introduction.txt`.
- The ordinal sorts by logical chapter order. The source index is the original EPUB source/spine section index, padded to at least 3 digits and never truncated.
- `--length <n>` splits oversized section files using the same base name with `-part-NN` suffixes, widened to `-part-NNN` at 100 or more generated files.
- `--no-chapters` disables EPUB chapter files and leaves only the top-level extracted text unless another export flag such as `--length` is present.
- `--no-chapters --length <n>` keeps the legacy `chunks/` side artifacts for EPUB native text.
- `--chapters`, `--no-chapters`, and `--length` are ignored for non-EPUB/non-PDF inputs and for EPUB runs that use a hosted OCR engine or image/PDF OCR path.

## PDF Chapter Detection

```bash
bun autoshow extract input/examples/document/book.pdf
bun autoshow extract input/examples/document/3-document.pdf --chapters
bun autoshow extract input/examples/document/3-document.pdf --chapters --pdf-chapter-mode auto
bun autoshow extract input/examples/document/book.pdf --no-chapters
```

- PDFs with at least 40 extracted pages automatically attempt local chapter detection and write best-effort chapter files under `chapters/` when chapters are found.
- `--chapters` on any PDF runs chapter autodetection regardless of length.
- `--no-chapters` disables PDF chapter detection and leaves a single extracted file.
- Detection is local-first by default and uses PDF bookmarks, TOC-like pages, printed-page-to-PDF-page mapping, and heading fallback.
- PDF chapter artifact names use `chapters/<ordinal>-<pdf-start-page>-<slug>.txt`; for example, `chapters/01-011-introduction.txt`.
- The ordinal sorts by logical chapter order. The PDF start page is padded to at least 3 digits and never truncated.
- `--pdf-chapter-mode local` keeps detection fully heuristic and local.
- Automatic long-PDF detection uses local mode; pass explicit `--chapters --pdf-chapter-mode auto` to allow model assistance when the local result is weak and a default LLM is configured.
- `--chapters --pdf-chapter-mode llm` always attempts the model-assisted resolver after building the local evidence dossier.
- `--length <n>` hard-splits oversized PDF chapter files using the same base name with `-part-NN` suffixes, widened to `-part-NNN` at 100 or more generated files.
- Detection diagnostics are written under `items[].metadata.step2.pdfChapterDetection`, and the export summary is written under `items[].metadata.step2.chapterExport`.

## OCR Services

### Tesseract

| Option | Value |
|--------|-------|
| Selector | default PDF/image path, or `--provider tesseract` |
| Language | `--ocr-language <codes>` such as `eng` or `eng+fra` |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider tesseract
bun autoshow extract input/examples/document/1-document.pdf --provider tesseract --ocr-language eng+fra --ocr-dpi 300
```

Tesseract language and DPI controls work on the `extract` document/OCR route and on [`write`](../step-3-write/write-text.md). Non-Tesseract engines may ignore local OCR controls and report a warning when they do.

### Mistral OCR

| Option | Value |
|--------|-------|
| Selector | `--provider mistral[=<model>]` |
| Models | `mistral-ocr-2512`, `mistral-ocr-4-0` |
| Direct input support | PDF and standard images (`PNG`, `JPG`, `TIF`) |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider mistral=mistral-ocr-2512
bun autoshow extract input/examples/document/1-document.pdf --provider mistral=mistral-ocr-4-0
```

Passing `--provider mistral` keeps the cheapest Mistral OCR default, `mistral-ocr-2512`. `mistral-ocr-4-0` uses the OCR 4 page rate; AutoShow does not bill annotated-page mode because it does not request document or bbox annotations. The `mistral-ocr-latest` alias is not accepted — AutoShow registers concrete model IDs only, so name `mistral-ocr-4-0` directly.

No numeric Mistral OCR file-size/page-count caps were found in `project/links/mistral-general-ocr-links.md`, so this CLI does not enforce any new numeric limits for that provider from that source.

Mistral OCR normalizes `WEBP`, `GIF`, and `BMP` direct-image inputs to `PNG` locally before upload.

### GLM OCR

| Option | Value |
|--------|-------|
| Selector | `--provider glm[=<model>]` |
| Models | cheapest supported model, or `glm-ocr` |
| Direct input support | PDF plus `PNG` and `JPG` |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider glm=glm-ocr
```

GLM OCR currently enforces the bundled docs caps from `project/links/glm-all-links.md`: images up to 10 MB, PDFs up to 50 MB, and PDFs up to 100 pages.

GLM OCR normalizes `WEBP`, `GIF`, and `BMP` direct-image inputs to `PNG` locally before upload. `TIF/TIFF` inputs are normalized to `PNG` when ImageMagick is available; otherwise they are rejected with a usage error.

### Kimi OCR

| Option | Value |
|--------|-------|
| Selector | `--provider kimi[=<model>]` |
| Models | `kimi-k2.6`, `kimi-k3` |
| Direct input support | `PNG`, `JPG/JPEG`, `WEBP`, and `GIF`; rendered PDF/EPUB pages as `PNG` |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider kimi=kimi-k2.6
bun autoshow extract input/examples/document/1-document.pdf --provider kimi=kimi-k3
bun autoshow extract input/examples/document/1-document.pdf --provider kimi=kimi-k2.6 --price
```

Kimi OCR normalizes `BMP` inputs to `PNG` locally before upload. `TIF/TIFF` inputs are normalized to `PNG` when ImageMagick is available; otherwise they are rejected with a usage error. Direct or rendered image uploads are capped at 100 MB.

Kimi OCR uses token pricing estimates and recorded usage when available.

| Kimi OCR model | Input | Output | Price-mode page heuristic | Initial speed estimate |
|----------------|-------|--------|---------------------------|------------------------|
| `kimi-k2.6` | $0.95 / 1M cache-miss tokens | $4.00 / 1M tokens | 4,265 input + 516 output tokens, about $0.0061/page after calibration or $6.12/1K pages | 16,355 ms/page |
| `kimi-k3` | $3.00 / 1M cache-miss tokens | $15.00 / 1M tokens | 4,265 input + 516 output tokens reused from K2.6, about $0.0205/page or $20.54/1K pages | 16,355 ms/page (provisional) |

- Passing `--provider kimi` keeps the cheapest/general Kimi OCR default, `kimi-k2.6`.
- Kimi OCR price mode uses cache-miss input/output pricing from `project/links/kimi-general-ocr-text-links.md`. Cached input pricing is not used because OCR image requests are not cache-stable.
- Kimi OCR disables thinking for `kimi-k2.6`. Kimi K3 thinking is always on and rejects the `thinking` field, so AutoShow omits it for `kimi-k3`; its page heuristics are reused from K2.6 and are provisional until calibrated.
- Actual Kimi OCR runs write `promptTokens` and `completionTokens` into the canonical provider metadata when the API returns usage.

### OpenAI OCR

| Option | Value |
|--------|-------|
| Selector | `--provider openai[=<model>]` |
| Models | `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-5.5`, `gpt-5.4-mini`, `gpt-5.4-nano` |
| Direct input support | PDF plus `PNG`, `JPG`, `WEBP`, and `GIF` |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider openai=gpt-5.6-sol
bun autoshow extract input/examples/document/1-document.pdf --provider openai=gpt-5.5
bun autoshow extract input/examples/document/1-document.pdf --provider openai=gpt-5.4-nano
```

OpenAI OCR normalizes `BMP` inputs to `PNG` locally before upload. `TIF/TIFF` inputs are normalized to `PNG` when ImageMagick is available; otherwise they are rejected with a usage error. OpenAI OCR currently enforces the bundled PDF size cap from `project/links/openai-general-ocr-text-links.md`: PDFs up to 50 MB.

Passing `--provider openai` on an OCR-routed `extract` run keeps the existing cheapest OpenAI OCR default. The concrete GPT-5.6 tier IDs above are available when selected explicitly or through `--all-providers`; the `gpt-5.6` alias is not registered separately.

GPT-5.6 OCR price mode uses post-run calibrated page heuristics from the 2026-07-13 OCR resume calibration run:

| OpenAI OCR model | Price-mode page heuristic | Initial speed estimate |
|------------------|---------------------------|------------------------|
| `gpt-5.6-sol` | 1,625 input + 940 output tokens, about $0.0363/page or $36.33/1K pages | 9,497 ms/page |
| `gpt-5.6-terra` | 1,625 input + 743 output tokens, about $0.0122/page or $12.17/1K pages | 5,349 ms/page |
| `gpt-5.6-luna` | 1,625 input + 858 output tokens, about $0.0014/page or $1.35/1K pages | 3,919 ms/page |

### Grok OCR

| Option | Value |
|--------|-------|
| Selector | `--provider grok[=<model>]` |
| Models | `grok-4.3`, `grok-4.20-0309-non-reasoning`, `grok-4.5` |
| Direct input support | `PNG` and `JPG/JPEG`; rendered PDF/EPUB pages as `PNG` |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider grok=grok-4.3
bun autoshow extract input/examples/document/1-document.pdf --provider grok=grok-4.20-0309-non-reasoning
bun autoshow extract input/examples/document/1-document.pdf --provider grok=grok-4.5
bun autoshow extract input/examples/document/1-document.jpg --provider grok=grok-4.3 --price
```

Grok OCR uses xAI's OpenAI-compatible chat endpoint with image input. Passing `--provider grok` keeps the stable Grok OCR default, `grok-4.3`. Direct images and rendered PDF pages are capped at 20 MiB each. `--price` uses a provisional estimate of 4,000 input tokens and 1,000 output tokens per page for `grok-4.3` and `grok-4.5` until calibrated usage data is available; actual runs record returned token usage when xAI includes it. Grok 4.5 uses `$2 / $0.30 / $6` per 1M input/cached/output tokens through 200K input tokens and `$4 / $0.60 / $12` above 200K.

Grok OCR normalizes `WEBP`, `GIF`, and `BMP` direct-image inputs to `PNG` locally before upload. `TIF/TIFF` inputs are normalized to `PNG` when ImageMagick is available; otherwise they are rejected with a usage error.

### Anthropic OCR

| Option | Value |
|--------|-------|
| Selector | `--provider anthropic[=<model>]` |
| Models | `claude-fable-5`, `claude-opus-4-8`, `claude-sonnet-5`, `claude-haiku-4-5`, `claude-opus-5` |
| Direct input support | Standard unencrypted PDFs plus `PNG`, `JPG`, `WEBP`, and `GIF` |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider anthropic=claude-fable-5
bun autoshow extract input/examples/document/1-document.pdf --provider anthropic=claude-opus-4-8
bun autoshow extract input/examples/document/1-document.pdf --provider anthropic=claude-sonnet-5
bun autoshow extract input/examples/document/1-document.pdf --provider anthropic=claude-haiku-4-5
bun autoshow extract input/examples/document/1-document.pdf --provider anthropic=claude-opus-5
```

Anthropic OCR normalizes `BMP` inputs to `PNG` locally before upload. `TIF/TIFF` inputs are normalized to `PNG` when ImageMagick is available; otherwise they are rejected with a usage error. It currently enforces conservative first-party Claude limits from `project/links/claude-general-ocr-text-links.md`: direct images up to 5 MB each, PDF uploads through the Files API, and only standard unencrypted PDFs. Eligible PDFs are sent through the Files API; larger or failing documents fall back to per-page PDF chunk OCR through the Files API. Uploaded files are deleted best-effort after each run. Passing `--provider anthropic` without a model on an OCR-routed `extract` run keeps the cheapest Anthropic OCR default, `claude-haiku-4-5`; Fable, Opus, and Sonnet run only when selected explicitly or through `--all-providers`. Limited-availability `claude-mythos-5` is intentionally not registered.

Claude Fable 5 OCR price mode uses the post-run calibrated page heuristic from the 2026-07-13 OCR resume calibration run:

| Anthropic OCR model | Price-mode page heuristic | Initial speed estimate |
|---------------------|---------------------------|------------------------|
| `claude-fable-5` | 2,024 input + 869 output tokens, about $0.0637/page or $63.69/1K pages | 11,827 ms/page |
| `claude-opus-5` | 1,657.5 input + 474.5 output tokens reused from Claude Opus 4.8, about $0.0201/page or $20.15/1K pages | 7,914 ms/page (provisional) |

### Gemini OCR

| Option | Value |
|--------|-------|
| Selector | `--provider gemini[=<model>]` |
| Models | `gemini-3.1-pro-preview`, `gemini-3.5-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite` |
| Bare default | `gemini-3.5-flash-lite` |
| Retired selector | `gemini-3.1-flash-lite` is rejected with guidance to use `gemini-3.5-flash-lite`; historical pricing and manifest identity remain readable |
| Direct input support | PDF plus `PNG`, `JPG`, `WEBP`, and `BMP` |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider gemini=gemini-3.5-flash-lite
bun autoshow extract input/examples/document/1-document.pdf --provider gemini=gemini-3.5-flash
bun autoshow extract input/examples/document/1-document.pdf --provider gemini=gemini-3.6-flash
```

Gemini OCR normalizes `GIF` inputs to `PNG` locally before upload. `TIF/TIFF` inputs are normalized to `PNG` when ImageMagick is available; otherwise they are rejected with a usage error. It currently enforces the bundled docs caps from `project/links/gemini-general-ocr-text-links.md`: inline PDFs up to 50 MB, inline non-PDF inputs up to 100 MB, Files API uploads up to 2 GB per file, and PDFs up to 1000 pages. Passing `--provider gemini` resolves to `gemini-3.5-flash-lite`. The retired `gemini-3.1-flash-lite` selector is absent from active validation and `--all-providers`; direct selection names `gemini-3.5-flash-lite` as the replacement, and an unfinished historical resume requires that replacement to be added explicitly as a distinct target. Gemini 3.6 Flash (`$1.50 / 1M input`, `$7.50 / 1M output`) and Gemini 3.5 Flash-Lite (`$0.30 / 1M input`, `$2.50 / 1M output`) use flat Standard rates with no published context tiers, and both reuse Gemini 3.1 Flash-Lite's page heuristic of 1,157 input and 1,626 output tokens at 2,921 ms/page until calibrated. Google still listed 2027-05-07 as the earliest shutdown date and `gemini-3.5-flash-lite` as the replacement when AutoShow retired the old selector on 2026-08-13.

### DeepInfra OCR

| Option | Value |
|--------|-------|
| Selector | `--provider deepinfra[=<model>]` |
| Models | `Qwen/Qwen3-VL-235B-A22B-Instruct`, `Qwen/Qwen3-VL-30B-A3B-Instruct` |
| Direct input support | `PNG`, `JPG/JPEG`, and `WEBP`; rendered PDF/EPUB pages as `PNG` |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider deepinfra=Qwen/Qwen3-VL-30B-A3B-Instruct
bun autoshow extract input/examples/document/1-document.jpg --provider deepinfra=Qwen/Qwen3-VL-235B-A22B-Instruct
bun autoshow extract input/examples/document/1-document.pdf --provider deepinfra=Qwen/Qwen3-VL-235B-A22B-Instruct --price
```

DeepInfra OCR normalizes `GIF` and `BMP` inputs to `PNG` locally before upload. `TIF/TIFF` inputs are normalized to `PNG` when ImageMagick is available; otherwise they are rejected with a usage error. Uploads are capped at 20 MB per direct or rendered image and omit OpenAI's `detail` parameter.

DeepInfra OCR uses token pricing estimates and recorded usage when available.

| DeepInfra OCR model | Input | Output | Price-mode page heuristic | Initial speed estimate |
|---------------------|-------|--------|---------------------------|------------------------|
| `Qwen/Qwen3-VL-235B-A22B-Instruct` | $0.20 / 1M tokens | $0.88 / 1M tokens | 4,081 input + 526 output tokens, about $0.0013/page or $1.28/1K pages | 20,000 ms/page |
| `Qwen/Qwen3-VL-30B-A3B-Instruct` | $0.15 / 1M tokens | $0.60 / 1M tokens | 7,981 input + 472 output tokens, about $0.0015/page or $1.48/1K pages | 12,618 ms/page |

- DeepInfra OCR price mode uses model-specific token heuristics. Actual runs write `promptTokens` and `completionTokens` into the canonical provider metadata when DeepInfra returns usage.
- Cached-token pricing is not used for OCR estimates because AutoShow sends direct or rendered page images and those image requests are not cache-stable.
- DeepInfra implementation details are based on DeepInfra's [Vision & OCR](https://docs.deepinfra.com/chat/vision), [OpenAI-compatible Chat Completions](https://docs.deepinfra.com/api-reference/chat-completions/openai-chat-completions), and [OCR catalog](https://deepinfra.com/models/ocr) docs.

## OCR Notes

- Standalone `extract` document runs write the root extraction artifact (`extraction.txt` or a raw domain `result.json`) plus the canonical `manifest.json`.
- EPUB export and PDF chapter autodetection write additive `chapters/` or `chunks/` side artifacts inside the same output directory.
- Supported document formats include PDF, EPUB, ACSM, MOBI, AZW/AZW3, PRC, FB2, LIT, DOCX, PPTX, XLSX, ODT, ODS, ODP, RTF, CSV, and CBZ.
- Supported image formats include PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, and GIF.
- Office inputs always use native extraction; OCR flags are ignored with a warning.
- Config defaults can persist chapter export settings under `defaults.extract.ocr.chapters`, `defaults.extract.ocr.length`, and `defaults.extract.ocr.pdfChapterMode`.
- Backfill existing OCR outputs with top-level [`resume`](../../setup-and-utilities/resume/resume.md).
- Grok OCR refers to xAI `grok-4.3`. Groq `openai/gpt-oss-20b` and `openai/gpt-oss-120b` are LLM text models in this project and are not OCR benchmark targets.
- MiniMax `MiniMax-M3` and GLM `glm-5.1` are LLM text models here. Use `glm-ocr` for GLM OCR coverage.

## Incomplete Runs and Blocked Providers

Hosted OCR provider failures are classified as retryable or blocked before any retry is scheduled. Transient failures (timeouts, network errors, temporary `5xx`, genuine rate limits) stay retryable; provider-declared blockers (insufficient balance, billing required, account suspension, quota exhaustion, content-policy blocks, auth failures, and provider no-retry responses) are marked `retryable: false` and stop new page work for that provider while other requested providers continue.

- A multi-provider run where at least one selected provider succeeds and another does not keeps item `status: "incomplete"`, and successful provider outputs remain usable under `providers/<service>-<model>/`.
- The incomplete-run summary prints a Run Status table (requested/succeeded/failed/missing/retryable/blocked counts) and a Provider Failures table with the failure class, retryability, retry attempts spent, and page fallback counts (`ok / failed / canceled`) when PDF page fallback ran.
- Each failed provider writes a redacted `error.json` (plus optional raw-response artifacts); PDF page fallback writes an auditable `fallback-state.json` recording the fallback reason, per-page cached/resumed/succeeded/failed/canceled status, chunk preparation strategy, and split-tool failures. Split-tool warnings are prefixed with the provider label.
- Automatic `resume` skips provider entries whose canonical error state is non-retryable or blocked; explicit `resume <dir> --provider provider=model` re-opts into that provider after you fix the balance, billing, credentials, policy, or model cause.
