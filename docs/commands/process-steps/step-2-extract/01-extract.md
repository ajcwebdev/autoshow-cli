# extract

Routes each input to the right step-2 extractor: media to STT, documents/images to OCR, article HTML to URL extraction, and X/Twitter links to the X API.

## Outline

- [Usage](#usage)
- [Input Routing](#input-routing)
- [Local Engines](#local-engines)
  - [Local STT](#local-stt)
  - [Local OCR](#local-ocr)
  - [Local URL](#local-url)
- [Batch Inputs](#batch-inputs)
- [Detailed Extract Docs](#detailed-extract-docs)

## Usage

```bash
bun autoshow extract [input] [flags]
```

Batch inputs use the same shared controls as other processing commands. The default batch limit is `5`; use `--batch-all` to process every discovered item.

Hosted extraction defaults to `--concurrency-mode ramp`: each provider/account lane starts one logical request immediately and adds one slot every five seconds while demand is queued, without exceeding the existing provider, segment, or OCR page cap. Use `--concurrency-mode immediate` to begin at those caps. Local engines, document rendering, batch preparation, and preflight probes remain immediate.

For backfilling missing provider outputs from an existing run or batch, see [`resume`](../../setup-and-utilities/resume/resume.md).

## Input Routing

| Input                                                                                                     | Route                                                |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| YouTube, Twitch, or TikTok URLs                                                                           | [STT](./02-extract-stt.md)                           |
| Direct media URLs (`.mp3`, `.mp4`, `.wav`, `.webm`, and other audio/video extensions)                     | [STT](./02-extract-stt.md)                           |
| Local media files                                                                                         | [STT](./02-extract-stt.md)                           |
| RSS or podcast feed batches                                                                               | [STT](./02-extract-stt.md)                           |
| YouTube channel batches                                                                                   | [STT](./02-extract-stt.md)                           |
| PDF, EPUB, ACSM, convertible ebooks (MOBI, AZW/AZW3, PRC, FB2, LIT), DOCX, PPTX, XLSX, ODF, RTF, CSV, CBZ | [OCR](./03-extract-ocr.md)                           |
| PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, GIF                                                                 | [OCR](./03-extract-ocr.md)                           |
| Remote article URLs (`text/html`)                                                                         | [URL / HTML extraction](./04-extract-url.md)         |
| Local `.html` / `.htm` files                                                                              | [URL / HTML extraction](./04-extract-url.md)         |
| X/Twitter Space URLs (`x.com/i/spaces/<id>`)                                                              | [X Space metadata](./04-extract-url.md#x-space-path) |
| X/Twitter post URLs (`x.com/<handle>/status/<id>`)                                                        | [X Space metadata](./04-extract-url.md#x-space-path) |
| Raw Space IDs (1-13 alphanumeric characters)                                                              | [X Space metadata](./04-extract-url.md#x-space-path) |
| Directory batches                                                                                         | Mixed routing per discovered item                    |
| URL-list batches (`.md` / `.txt`)                                                                         | Mixed routing per listed URL                         |

Media inputs are downloaded, normalized when needed, and transcribed. With no engine flag, media defaults to local Whisper.cpp `tiny`. Hosted STT engines are documented in [STT extraction](./02-extract-stt.md).

Document and image inputs route through OCR or native text extraction based on file type. PDFs and images default to local Tesseract. Hosted OCR engines are documented in [OCR extraction](./03-extract-ocr.md).

Remote article URLs default to local `defuddle` and can also use hosted backends via `--url-provider` or `--all-providers`. Local HTML files always use `defuddle`. Hosted URL backends are documented in [URL and X extraction](./04-extract-url.md).

X/Twitter Space URLs, post URLs, and raw Space IDs are auto-detected and processed through the X v2 API, producing metadata artifacts rather than an STT transcript.

## Local Engines

| Flag                      | Description                                                     |
| ------------------------- | --------------------------------------------------------------- |
| `--all-local`             | Enable every local engine for the current extract route         |
| `--local-concurrency <n>` | Max local engines running in parallel for one item; default `7` |
| `--ocr-language <codes>`  | Tesseract language codes, for example `eng` or `eng+fra`        |

### Local STT

```bash
# full setup
bun autoshow setup

# build whisper.cpp binary only
bun autoshow setup --step whisper-binary

# download the default whisper model only
bun autoshow setup --step whisper-model

# download large-v3-turbo
bun autoshow setup --step transcription
```

Whisperfile needs no setup step. The first `--provider whisperfile=<model>` run downloads the matching prebuilt `whisper-<model>.llamafile` from `huggingface.co/Mozilla/whisperfile` into `runtime/bin/whisperfile/` and reuses it afterward. To pre-download it instead, run `bun autoshow setup --step whisperfile` (default `tiny`) or `bun autoshow setup --models whisperfile:<model>` for a specific model.

If no engine flag is provided, `extract` defaults to local Whisper.cpp with the `tiny` model for media inputs.

#### Whisper.cpp

| Option   | Value                                               |
| -------- | --------------------------------------------------- |
| Selector | default, or `--provider whisper[=<model>]`          |
| Models   | `tiny`, `base`, `small`, `medium`, `large-v3-turbo` |
| Runtime  | Local `whisper.cpp` (free)                          |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider whisper=large-v3-turbo
bun autoshow extract https://ajc.pics/autoshow/examples/2-video.mp4 --provider whisper=large-v3-turbo --split
```

#### Whisperfile

| Option   | Value                                                                                 |
| -------- | ------------------------------------------------------------------------------------- |
| Selector | `--provider whisperfile=<model>`                                                      |
| Models   | `tiny`, `tiny.en`, `small`, `small.en`, `medium`, `medium.en`, `large-v2`, `large-v3` |
| Runtime  | Local prebuilt `whisper-<model>.llamafile` (free)                                     |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider whisperfile=tiny
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider whisperfile=large-v3
```

Prebuilt binaries with embedded weights and native word timings. Downloads automatically to `runtime/bin/whisperfile/` on first use. Requires an explicit model selector. Included by `--all-local`.

Local STT engines are free.

| Provider                                                                                                 | Released      | Input    | Diarization | Speaker count | Word timestamps | Transcript cleanup                   | Duration             | File size            |
| -------------------------------------------------------------------------------------------------------- | ------------- | -------- | ----------- | ------------- | --------------- | ------------------------------------ | -------------------- | -------------------- |
| Whisper.cpp `tiny` / `base` / `small` / `medium` / `large-v3-turbo`                                      | ❌ 2024-09    | ✅ Local | ❌ No       | ❌ No         | ✅ Native words | ⚠️ AutoShow punctuation cleanup only | ✅ No documented cap | ✅ No documented cap |
| Whisperfile `tiny` / `tiny.en` / `small` / `small.en` / `medium` / `medium.en` / `large-v2` / `large-v3` | ❌ 2023-11    | ✅ Local | ❌ No       | ❌ No         | ✅ Native words | ⚠️ AutoShow punctuation cleanup only | ✅ No documented cap | ✅ No documented cap |

Whisper.cpp recency follows `large-v3-turbo` (September 2024). The original `tiny` / `base` / `small` / `medium` series is from September 2022. Whisperfile recency follows bundled `large-v3` (November 2023).

### Local OCR

Tesseract is the only local OCR engine and is installed as part of `bun autoshow setup`.

| Input family                                       | Default path                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| PDF                                                | `mutool+tesseract`                                                   |
| EPUB                                               | cleaned native extraction (`epub-text`); `--provider tesseract` also available |
| ACSM                                               | fulfill locally to EPUB/PDF, then follow the fulfilled EPUB/PDF path |
| Convertible ebooks (MOBI, AZW/AZW3, PRC, FB2, LIT) | normalize to EPUB, then follow the EPUB path                         |
| CBZ                                                | per-image OCR, Tesseract by default                                  |
| PNG / JPG / JPEG / TIF / TIFF / GIF                | local OCR by default                                                 |
| WebP / BMP                                         | normalize locally when possible, then OCR                            |

`--all-local` enables Tesseract for this route. `--ocr-concurrency` defaults to `10` for local OCR. Local OCR remains immediate under `--concurrency-mode ramp`.

#### Tesseract

| Option   | Value                                              |
| -------- | -------------------------------------------------- |
| Selector | default PDF/image path, or `--provider tesseract`  |
| Language | `--ocr-language <codes>` (e.g. `eng` or `eng+fra`) |
| DPI      | `--ocr-dpi <n>` (default `300`)                    |

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider tesseract
bun autoshow extract input/examples/document/1-document.pdf --provider tesseract --ocr-language eng+fra --ocr-dpi 300
```

Tesseract is the only engine that consumes `--ocr-language`.

| Provider              | Released      | Kind                   | Native PDF                       | Images                      | Image cap        | PDF cap          | Pages          | Markdown      | Tables / formulas / layout   | BBoxes           | Password PDFs    | Pool   |
| --------------------- | ------------- | ---------------------- | -------------------------------- | --------------------------- | ---------------- | ---------------- | -------------- | ------------- | ---------------------------- | ---------------- | ---------------- | ------ |
| Tesseract `tesseract` | ❌ 2021-11-30 | ✅ Local dedicated OCR | ⚠️ Render plus hybrid text layer | ✅ PNG JPG TIF WEBP BMP GIF | ✅ No upload cap | ✅ No upload cap | ✅ No page cap | ❌ Plain text | ⚠️ Confidence TSV internally | ❌ Not persisted | ✅ Local decrypt | ✅ Yes |

### Local URL

```bash
# full setup
bun autoshow setup

# local URL article extraction only
bun autoshow setup --step defuddle
```

Remote article URLs default to `defuddle`. Local `.html` / `.htm` files always use `defuddle` and skip hosted backends. `--all-local` runs `defuddle`. Do not combine `--url-provider` with `--all-providers` or `--all-local`.

In single-backend mode, `defuddle` falls back to `firecrawl` if extraction fails. `--all-providers` includes `defuddle` first, then the hosted backends, and disables that automatic fallback. `defuddle` runs in a single-slot lane.

#### Defuddle

| Option   | Value                                                |
| -------- | ---------------------------------------------------- |
| Selector | default, or `--url-provider defuddle`                |
| Inputs   | Remote article URLs and local `.html` / `.htm` files |
| Runtime  | Local HTML/article extraction via Defuddle CLI       |

```bash
bun autoshow extract https://ajcwebdev.com
bun autoshow extract input/article.html --format json
```

Use `--bin-dir <dir>` to supply a custom `defuddle` binary path.

| Provider            | Released   | Inputs                                   | Markdown        | Local HTML | Remote URLs |
| ------------------- | ---------- | ---------------------------------------- | --------------- | ---------- | ----------- |
| Defuddle `defuddle` | ❌ 2024-10 | Remote article URLs and local HTML files | ✅ Article text | ✅ Always  | ✅ Default  |

## Batch Inputs

Directory batches and URL-list batches classify each item independently. A single batch can include media URLs, article URLs, document URLs, X/Twitter links, and local files.

```bash
# Process every item in a URL list
bun autoshow extract input/examples/batch/2-urls.md --batch-all

# Compare every URL article backend for one remote article
bun autoshow extract https://example.com/article --all-providers

# Process a whole YouTube channel batch with caption-first STT routing
bun autoshow extract https://www.youtube.com/@channelname --youtube-captions --batch-all
```

## Detailed Extract Docs

- [STT extraction](./02-extract-stt.md): hosted engines, provider flags, examples, pricing, and STT output notes.
- [OCR extraction](./03-extract-ocr.md): document/image routing, hosted OCR engines, EPUB/PDF behavior, pricing, and OCR output notes.
- [URL and X extraction](./04-extract-url.md): remote article URLs, hosted article backends, X/Twitter Space inputs, and X output notes.
