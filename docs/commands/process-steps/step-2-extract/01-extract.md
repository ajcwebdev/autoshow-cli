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

Batch inputs use the same shared controls as other processing commands. The default batch limit is `5`; use `--batch-limit all` to process every discovered item.

Hosted extraction defaults to `--concurrency-mode ramp`. Use `--concurrency-mode immediate` to start at the configured caps. Local engines stay immediate.

For backfilling missing provider outputs from an existing run or batch, see [`resume`](../../setup-and-utilities/resume/resume.md).

## Input Routing

| Input                                                                                                     | Route                                                |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| YouTube, Twitch, or TikTok URLs                                                                           | [STT](./02-extract-stt.md)                           |
| Direct media URLs (`.mp3`, `.mp4`, `.wav`, `.webm`, and other audio/video extensions)                     | [STT](./02-extract-stt.md)                           |
| Local media files                                                                                         | [STT](./02-extract-stt.md)                           |
| RSS or podcast feed batches                                                                               | [STT](./02-extract-stt.md)                           |
| YouTube channel or playlist batches                                                                       | [STT](./02-extract-stt.md)                           |
| PDF, EPUB, convertible ebooks (MOBI, AZW/AZW3, PRC, FB2, LIT), DOCX, PPTX, XLSX, ODF, RTF, CSV, CBZ       | [OCR](./03-extract-ocr.md)                           |
| PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, GIF                                                                 | [OCR](./03-extract-ocr.md)                           |
| Remote article URLs (`text/html`)                                                                         | [URL / HTML extraction](./04-extract-url.md)         |
| Local `.html` / `.htm` files                                                                              | [URL / HTML extraction](./04-extract-url.md)         |
| X/Twitter Space URLs (`x.com/i/spaces/<id>`)                                                              | [X Space metadata](./04-extract-url.md#x-space-path) |
| X/Twitter post URLs (`x.com/<handle>/status/<id>`)                                                        | [X Space metadata](./04-extract-url.md#x-space-path) |
| Raw Space IDs (1-13 alphanumeric characters)                                                              | [X Space metadata](./04-extract-url.md#x-space-path) |
| Directory batches                                                                                         | Mixed routing per discovered item                    |
| URL-list batches (`.md` / `.txt`)                                                                         | Mixed routing per listed URL                         |

With no engine flag, media uses local Whisper.cpp `tiny`, PDFs and images use local Tesseract, and remote articles use local `defuddle`. Local HTML files always use `defuddle`. X/Twitter Space URLs, post URLs, and raw Space IDs produce metadata rather than a transcript.

## Local Engines

Local STT, OCR, and URL engines are free. Install them with [`bun autoshow setup`](../../setup-and-utilities/setup/setup.md).

| Flag                      | Description                                                     |
| ------------------------- | --------------------------------------------------------------- |
| `--all-local`             | Enable every local engine for the current extract route         |
| `--local-concurrency <n>` | Max local engines running in parallel for one item; default `7` |
| `--ocr-language <codes>`  | Tesseract language codes, for example `eng` or `eng+fra`        |

### Local STT

Whisperfile downloads its selected model on first use; to pre-download, run `bun autoshow setup --step whisperfile` (default `tiny`) or `bun autoshow setup --models whisperfile:<model>`.

Neither local engine does diarization or speaker-count hints. Both emit native word timestamps and get AutoShow punctuation cleanup.

#### Whisper.cpp

| Option   | Value                                               |
| -------- | --------------------------------------------------- |
| Selector | default, or `--provider whisper[=<model>]`          |
| Models   | `tiny`, `base`, `small`, `medium`, `large-v3-turbo` |
| Runtime  | Local `whisper.cpp`                                 |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider whisper=large-v3-turbo
```

#### Whisperfile

| Option   | Value                                                                                 |
| -------- | ------------------------------------------------------------------------------------- |
| Selector | `--provider whisperfile=<model>`                                                      |
| Models   | `tiny`, `tiny.en`, `small`, `small.en`, `medium`, `medium.en`, `large-v2`, `large-v3` |
| Runtime  | Local Whisperfile                                                                     |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider whisperfile=tiny
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider whisperfile=large-v3
```

Whisperfile requires an explicit model selector. It is included by `--all-local`.

### Local OCR

Tesseract is the only local OCR engine.

| Input family                                       | Default path                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| PDF                                                | Tesseract                                                            |
| EPUB                                               | cleaned native text; `--provider tesseract` also available           |
| Convertible ebooks (MOBI, AZW/AZW3, PRC, FB2, LIT) | convert to EPUB, then follow the EPUB path                           |
| CBZ                                                | per-image OCR, Tesseract by default                                  |
| PNG / JPG / JPEG / TIF / TIFF / GIF                | Tesseract                                                            |
| WebP / BMP                                         | convert locally, then OCR                                            |

`--all-local` enables Tesseract for this route. `--ocr-concurrency` defaults to `10` for local OCR.

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

Tesseract is the only engine that consumes `--ocr-language`. It writes plain text, decrypts password PDFs locally, and has no upload or page cap.

### Local URL

`--all-local` runs `defuddle`. Do not combine `--url-provider` with `--all-providers` or `--all-local`.

In single-backend mode, `defuddle` falls back to `firecrawl` if extraction fails. Combining `--all-local` with `--all-providers` runs `defuddle` first, and either group run disables that automatic fallback.

#### Defuddle

| Option   | Value                                                |
| -------- | ---------------------------------------------------- |
| Selector | default, or `--url-provider defuddle`                |
| Inputs   | Remote article URLs and local `.html` / `.htm` files |
| Runtime  | Local HTML/article extraction                        |

```bash
bun autoshow extract https://ajcwebdev.com
bun autoshow extract input/article.html --format json
```

Use `--bin-dir <dir>` to supply a custom `defuddle` binary path.

## Batch Inputs

Directory batches and URL-list batches classify each item independently. A single batch can include media URLs, article URLs, document URLs, X/Twitter links, and local files.

```bash
# Process every item in a URL list
bun autoshow extract input/examples/batch/2-urls.md --batch-limit all

# Process a whole YouTube channel batch with caption-first STT routing
bun autoshow extract https://www.youtube.com/@channelname --youtube-captions --batch-limit all
```

## Detailed Extract Docs

- [STT extraction](./02-extract-stt.md): hosted engines, provider flags, examples, pricing, and STT output notes.
- [OCR extraction](./03-extract-ocr.md): document/image routing, hosted OCR engines, EPUB/PDF behavior, pricing, and OCR output notes.
- [URL and X extraction](./04-extract-url.md): remote article URLs, hosted article backends, X/Twitter Space inputs, and X output notes.
