# download

Download media or X Space audio, or collect document and article metadata.

Media inputs default to `--media-quality audio`, producing an audio-only file. Select `original` to preserve the selected source audio or media without normalization, or `best` to select the best available video and audio. Document and article inputs write metadata only.

## Outline

- [Supported Inputs](#supported-inputs)
- [Flags](#flags)
- [yt-dlp Passthrough](#yt-dlp-passthrough)
- [Output](#output)
- [Examples](#examples)
- [Setup and Environment](#setup-and-environment)

```bash
bun autoshow download [input] [flags]
```

## Supported Inputs

| Input                                                                 | Behavior                                                         |
| --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| YouTube / Twitch / TikTok URL                                         | Download audio by default                                        |
| Direct media URL (`.mp3`, `.mp4`, etc.)                               | Download audio by default                                        |
| Direct document or image URL (`.pdf`, `.epub`, `.docx`, `.png`, etc.) | Collect document metadata                                        |
| Remote article / HTML URL                                             | Collect article metadata; choose a backend with `--url-provider` |
| X/Twitter Space URL or raw Space ID                                   | Download Space audio                                             |
| X/Twitter post URL                                                    | Download the linked Space audio                                  |
| Local `.html` / `.htm` file                                           | Collect article metadata (`defuddle`)                            |
| Local media file                                                      | Prepare audio by default                                         |
| Local document or image file                                          | Collect document metadata                                        |
| YouTube channel or playlist URL                                       | Batch the latest videos                                          |
| RSS / podcast feed URL                                                | Batch the latest episodes                                        |
| URL list file (`.md` / `.txt`)                                        | Batch each listed input                                          |
| Directory                                                             | Batch each supported local input                                 |

**Supported document formats:** PDF, EPUB, MOBI, AZW3, AZW, PRC, FB2, LIT, DOCX, PPTX, XLSX, ODT, ODS, ODP, RTF, CSV, CBZ

**Supported image formats:** PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, GIF

Convertible ebooks (MOBI, AZW/AZW3, PRC, FB2, and LIT) require Calibre.

## Flags

```text
--password             Password for encrypted PDFs
--media-quality        Media preparation: audio|original|best (default audio)
--flat-batch           Place each item's media file directly in the batch output directory
--url-provider         Article or HTML metadata backend: defuddle|spider|zyte (default defuddle; local .html/.htm always use defuddle)
--batch-limit          Number of items to process, or "all" (default 5)
--batch-order          Item order: newest|oldest (default newest)
--batch-concurrency    Number of items to process at once (default 7)
--price                Show the cost estimate and exit
```

Shared globals such as `--output-root`, `--output-dir`, `--json`, and logging flags are documented in [`usage.md`](../../00-setup-and-utilities/usage.md).

## yt-dlp Passthrough

Use `--` after the input and flags to pass extra arguments to yt-dlp:

```bash
bun autoshow download "https://www.youtube.com/watch?v=u1-WHqATSQU" -- --write-thumbnail
bun autoshow download input/examples/batch/2-urls.md --batch-limit 3 -- --format bestaudio
```

Passthrough works for media URL downloads, including direct media URLs, podcast feed items, and X Space downloads. Local files, documents, and articles reject it.

Each input must produce exactly one primary media file. Use raw mode for workflows that produce no media or multiple media files.

Without an input, `download --` runs yt-dlp directly:

```bash
bun autoshow download -- --format bestaudio -o "%(title)s.%(ext)s" "https://www.youtube.com/watch?v=u1-WHqATSQU"
```

## Output

**Media inputs**

```text
output/YYYY-MM-DD_HH-MM-SS-mmm_title/
  <audio>.mp3|.m4a|.ogg|.flac
  manifest.json
```

With `--media-quality best`, YouTube, Twitch, TikTok, and similar URLs keep video+audio instead of compressed audio. Those files may be `.mkv`, `.mp4`, or `.webm`. Direct media URLs and local media files keep the source file as-is.

**Document and article inputs**

```text
output/YYYY-MM-DD_HH-MM-SS-mmm_title/
  manifest.json
```

The source file is not copied into the run directory.

**Batch inputs**

```text
output/YYYY-MM-DD_HH-MM-SS-mmm_batch-label/
  manifest.json
  YYYY-MM-DD-slug/   # when the item has a content date
  slug/              # otherwise
    <artifacts for that item>
```

**Batch inputs with `--flat-batch` on media downloads**

```text
output/YYYY-MM-DD_HH-MM-SS-mmm_batch-label/
  manifest.json
  <episode-1>.mp3|.m4a|.ogg|.flac
  <episode-2>.mp3|.m4a|.ogg|.flac
```

With `--media-quality original --flat-batch`, downloaded media files keep their original extensions.

## Examples

```bash
bun autoshow download "https://www.youtube.com/watch?v=u1-WHqATSQU"

bun autoshow download "https://www.youtube.com/watch?v=u1-WHqATSQU" --media-quality best

bun autoshow download input/examples/document/1-document.pdf

bun autoshow download https://x.com/i/spaces/1DXxyRYNejbKM

bun autoshow download https://example.com/feed --batch-limit 3

bun autoshow download https://example.com/feed --batch-limit all --media-quality original --flat-batch

bun autoshow download input/examples/batch/2-urls.md --batch-limit all
```

## Setup and Environment

Setup details are in [`setup.md`](../../00-setup-and-utilities/setup.md).

YouTube inputs may be rate-limited or challenged. Follow the [YouTube cookies guide](../../00-setup-and-utilities/cookies.md), then rerun `download`.

X post URLs require `X_BEARER_TOKEN` to resolve the linked Space. Direct Space URLs and raw Space IDs may need the same cookie setup as other authenticated media sources.

Hosted article backends selected with `--url-provider` need the matching API key (`SPIDER_API_KEY` or `ZYTE_API_KEY`). Local `defuddle` does not.
