# extract

Opt into `extract local.docx --docx-markdown` to retain Word formatting in `extraction.md` alongside the normal text and manifest. The exact command plus `--price` validates the local ZIP/XML without output writes and costs zero. Provider flags and configured OCR providers are incompatible; ordinary extraction stays unchanged. Review and promotion remain separate. See [Docker invocation and DOCX details](../docker.md#local-docx-markdown).

Routes each input to the appropriate extractor: media to STT, documents/images to OCR, article HTML to URL extraction, and X/Twitter links to the X API.

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

The default batch limit is `5`; use `--batch-limit all` to process every discovered item.

For backfilling missing provider outputs from an existing run or batch, see [`resume`](00-setup-and-utilities/resume.md).

## Input Routing

| Input                                                                                                     | Route                                                |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| YouTube, Twitch, or TikTok URLs                                                                           | [STT](./02-stt/overview.md)                           |
| Direct media URLs (`.mp3`, `.mp4`, `.wav`, `.webm`, and other audio/video extensions)                     | [STT](./02-stt/overview.md)                           |
| Local media files                                                                                         | [STT](./02-stt/overview.md)                           |
| RSS or podcast feed batches                                                                               | [STT](./02-stt/overview.md)                           |
| YouTube channel or playlist batches                                                                       | [STT](./02-stt/overview.md)                           |
| PDF, EPUB, convertible ebooks (MOBI, AZW/AZW3, PRC, FB2, LIT), DOCX, PPTX, XLSX, ODF, RTF, CSV, CBZ       | [OCR](./03-text/ocr/overview.md)                           |
| PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, GIF                                                                 | [OCR](./03-text/ocr/overview.md)                           |
| Remote article URLs                                                                                       | [URL / HTML extraction](./03-text/url/overview.md)         |
| Local `.html` / `.htm` files                                                                              | [URL / HTML extraction](./03-text/url/overview.md)         |
| X/Twitter Space URLs, post URLs, and raw Space IDs                                                        | [X Space metadata](./03-text/url/overview.md#x-space-path) |
| Directory batches                                                                                         | Mixed routing per discovered item                    |
| URL-list batches (`.md` / `.txt`)                                                                         | Mixed routing per listed URL                         |

With no engine flag, media uses local whisperfile `tiny`, PDFs and images use local Tesseract, and remote articles use local `defuddle`. Local HTML files always use `defuddle`. X/Twitter inputs produce metadata rather than a transcript.

## Common Options

| Flag | Behavior |
| --- | --- |
| `--provider provider[=model]` | Select a provider for the detected route; repeat to select multiple targets. |
| `--all-providers` | Select the hosted provider targets supported by the input route. |
| `--price` | Print the estimate and exit before provider execution. |
| `--output-dir <path>` | Choose the output directory. |
| `--batch-limit <n\|all>` | Limit discovered batch items; defaults to `5`. |
| `--batch-order <newest\|oldest>` | Choose batch ordering. |
| `--batch-concurrency <n>` | Limit the number of batch items processed concurrently. |
| `--provider-concurrency <n>` | Limit hosted provider/model targets processed concurrently for an item. |

Do not combine explicit `--provider` selections with `--all-providers` or `--all-local`. Provider models, tuning flags, and output details are documented in the STT, OCR, and URL guides below.

## Local Engines

Local STT, OCR, and URL engines are free. Install them with [`bun autoshow setup`](00-setup-and-utilities/setup.md).

| Flag                      | Description                                                     |
| ------------------------- | --------------------------------------------------------------- |
| `--all-local`             | Enable every local engine for the current extract route         |
| `--local-concurrency <n>` | Max local engines running in parallel for one item; default `7` |

| Capability | Local engines |
| --- | --- |
| [STT](02-stt/local/overview.md) | Whisperfile, with word timestamps and no diarization |
| [OCR](03-text/ocr/overview.md#local-ocr) | Tesseract, native document extraction, and ebook conversion |
| [URL](03-text/url/overview.md#local-url) | Defuddle for article HTML |

## Batch Inputs

Directory batches and URL-list batches classify each item independently. A single batch can include media URLs, article URLs, document URLs, X/Twitter links, and local files.

```bash
bun autoshow extract input/examples/batch/2-urls.md --batch-limit all
bun autoshow extract https://www.youtube.com/@channelname --batch-limit all
```

## Detailed Extract Docs

- [STT extraction](./02-stt/overview.md): hosted engines, provider flags, captions, local timing/alignment/channel workflows, examples, pricing, and STT output notes.
- [OCR extraction](./03-text/ocr/overview.md): document/image routing, hosted OCR engines, EPUB/PDF behavior, pricing, and OCR output notes.
- [URL and X extraction](./03-text/url/overview.md): remote article URLs, hosted article backends, X/Twitter Space inputs, and X output notes.
