# extract

Routes each input to the right step-2 extractor: media to STT, documents/images to OCR, article HTML to URL extraction, and X/Twitter links to the X API.

## Outline

- [Usage](#usage)
- [Input Routing](#input-routing)
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

| Input | Route |
|-------|-------|
| YouTube, Twitch, or TikTok URLs | [STT](./02-extract-stt.md) |
| Direct media URLs (`.mp3`, `.mp4`, `.wav`, `.webm`, and other audio/video extensions) | [STT](./02-extract-stt.md) |
| Local media files | [STT](./02-extract-stt.md) |
| RSS or podcast feed batches | [STT](./02-extract-stt.md) |
| YouTube channel batches | [STT](./02-extract-stt.md) |
| PDF, EPUB, ACSM, convertible ebooks (MOBI, AZW/AZW3, PRC, FB2, LIT), DOCX, PPTX, XLSX, ODF, RTF, CSV, CBZ | [OCR](./03-extract-ocr.md) |
| PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, GIF | [OCR](./03-extract-ocr.md) |
| Remote article URLs (`text/html`) | [URL / HTML extraction](./04-extract-url.md) |
| Local `.html` / `.htm` files | [URL / HTML extraction](./04-extract-url.md) |
| X/Twitter Space URLs (`x.com/i/spaces/<id>`) | [X Space metadata](./04-extract-url.md#x-space-path) |
| X/Twitter post URLs (`x.com/<handle>/status/<id>`) | [X Space metadata](./04-extract-url.md#x-space-path) |
| Raw Space IDs (1-13 alphanumeric characters) | [X Space metadata](./04-extract-url.md#x-space-path) |
| Directory batches | Mixed routing per discovered item |
| URL-list batches (`.md` / `.txt`) | Mixed routing per listed URL |

Media inputs are downloaded, normalized when needed, and transcribed with local or hosted speech-to-text engines (defaulting to local Whisper `tiny`).

Document and image inputs route through OCR or native text extraction based on file type, supporting local or hosted OCR engines, native ebook/office extraction, and raw text handling.

Remote article URLs and local HTML files use article extraction rather than OCR engines. Remote URLs default to `defuddle` (configurable via `--url-provider <backend>` or `--all-providers`), while local HTML files always use `defuddle`.

X/Twitter Space URLs, post URLs, and raw Space IDs are auto-detected and processed through the X v2 API, producing metadata artifacts rather than an STT transcript.

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

- [STT extraction](./02-extract-stt.md): setup, engines, provider flags, examples, pricing, and STT output notes.
- [OCR extraction](./03-extract-ocr.md): document/image routing, local and hosted OCR engines, EPUB/PDF behavior, pricing, and OCR output notes.
- [URL and X extraction](./04-extract-url.md): remote article URLs, local HTML, single and all-backend article extraction, X/Twitter Space inputs, and X output notes.
