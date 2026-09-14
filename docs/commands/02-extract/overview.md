# extract

Routes each input to the appropriate extractor: media to STT, documents/images to OCR, article HTML to URL extraction, and X/Twitter links to X Space metadata.

## Outline

- [Usage](#usage)
- [Input Routing](#input-routing)
- [Common Options](#common-options)
- [Local Engines](#local-engines)
- [Batch Inputs](#batch-inputs)
- [Detailed Extract Docs](#detailed-extract-docs)

## Usage

```bash
bun autoshow extract [input] [flags]
```

For backfilling missing provider outputs from an existing run or batch, see [`resume`](../00-setup-and-utilities/resume.md).

## Input Routing

| Input                                                                                               | Route                                                                                                                                  |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| YouTube, Twitch, or TikTok URLs                                                                     | [STT](./stt/overview.md) by default; [URL transcripts](./url/overview.md#public-media-url-transcripts) for Supadata and ScrapeCreators |
| Direct media URLs (`.mp3`, `.mp4`, `.wav`, `.webm`, and other audio/video extensions)               | [STT](./stt/overview.md) by default; [URL transcripts](./url/overview.md#public-media-url-transcripts) for supported public URLs       |
| Local media files                                                                                   | [STT](./stt/overview.md)                                                                                                               |
| RSS or podcast feed batches                                                                         | [STT](./stt/overview.md)                                                                                                               |
| YouTube channel or playlist batches                                                                 | [STT](./stt/overview.md)                                                                                                               |
| PDF, EPUB, convertible ebooks (MOBI, AZW/AZW3, PRC, FB2, LIT), DOCX, PPTX, XLSX, ODF, RTF, CSV, CBZ | [OCR](./ocr/overview.md)                                                                                                               |
| PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, GIF                                                           | [OCR](./ocr/overview.md)                                                                                                               |
| Remote article URLs                                                                                 | [URL / HTML extraction](./url/overview.md)                                                                                             |
| Local `.html` / `.htm` files                                                                        | [URL / HTML extraction](./url/overview.md)                                                                                             |
| X/Twitter Space URLs, post URLs, and raw Space IDs                                                  | [X Space metadata](./url/overview.md#x-space-path)                                                                                     |
| Directory batches                                                                                   | Mixed routing per discovered item                                                                                                      |
| URL-list batches (`.md` / `.txt`)                                                                   | Mixed routing per listed URL                                                                                                           |

With no `--provider` selection, media uses local whisperfile `tiny`, PDFs and images use local Tesseract, and remote articles use local `defuddle`. Local HTML files always use `defuddle`. X/Twitter inputs produce metadata rather than a transcript.

`.acsm` files are unsupported. Obtain a readable EPUB or PDF before extraction.

## Common Options

| Flag                             | Behavior                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `--provider provider[=model]`    | Select a provider for the detected route; repeat to select multiple targets. |
| `--all-providers`                | Select the hosted provider targets supported by the input route.             |
| `--price`                        | Print the estimate and exit before provider execution.                       |
| `--output-dir <path>`            | Pin the run directory instead of a timestamped output path.                  |
| `--batch-limit <n\|all>`         | Limit discovered batch items; defaults to `5`.                               |
| `--batch-order <newest\|oldest>` | Choose batch ordering.                                                       |
| `--batch-concurrency <n>`        | Limit the number of batch items processed concurrently.                      |
| `--provider-concurrency <n>`     | Limit hosted provider/model targets processed concurrently for an item.      |

Do not combine explicit `--provider` selections with `--all-providers` or `--all-local`.

## Local Engines

Local STT, OCR, and URL engines are free. Install them with [`bun autoshow setup`](../00-setup-and-utilities/setup.md).

| Flag                      | Description                                                     |
| ------------------------- | --------------------------------------------------------------- |
| `--all-local`             | Enable every local engine for the current extract route         |
| `--local-concurrency <n>` | Max local engines running in parallel for one item; default `7` |

| Capability                         | Local engines                            |
| ---------------------------------- | ---------------------------------------- |
| [STT](./stt/local/overview.md)     | Whisperfile                              |
| [OCR](./ocr/overview.md#local-ocr) | Tesseract and native document extraction |
| [URL](./url/overview.md#local-url) | Defuddle for article HTML                |

## Batch Inputs

The default batch limit is `5`; use `--batch-limit all` to process every discovered item. A single batch can include media URLs, article URLs, document URLs, X/Twitter links, and local files.

```bash
bun autoshow extract input/examples/batch/2-urls.md --batch-limit all
bun autoshow extract input/examples/document --batch-limit all
bun autoshow extract https://www.youtube.com/@channelname --batch-limit all
```

Mixed batches write a parent run directory with `media/`, `document/`, `article/`, and `x-space/` child directories for the routes used.

## Detailed Extract Docs

- [STT extraction](./stt/overview.md): hosted engines, captions, local workflows, and pricing.
- [OCR extraction](./ocr/overview.md): document and image routing, hosted engines, EPUB/PDF behavior, and pricing.
- [URL and X extraction](./url/overview.md): remote articles, public media URL transcripts, hosted backends, and X/Twitter Space metadata.
