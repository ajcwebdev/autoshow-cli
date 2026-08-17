# download

Download media or documents and collect metadata without running transcription, extraction, or LLM steps.

## Outline

- [Supported Inputs](#supported-inputs)
- [Flags](#flags)
- [Advanced yt-dlp / FFmpeg Passthrough](#advanced-yt-dlp--ffmpeg-passthrough)
- [Output](#output)
- [Examples](#examples)
- [Setup and Environment](#setup-and-environment)

```bash
bun autoshow download <input>
```

## Supported Inputs

| Input                                                         | Behavior                                                                                                               |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| YouTube / Twitch / TikTok URL                                 | `yt-dlp` download, normalize to compressed audio-only media, collect media metadata                                    |
| Direct media URL (`.mp3`, `.mp4`, etc.)                       | HTTP fetch, normalize to compressed audio-only media, collect media metadata                                           |
| Direct document URL (`.pdf`, `.epub`, `.docx`, etc.)          | HTTP fetch to a temp file, detect format, collect document metadata                                                    |
| Direct document URL without an extension                      | HEAD probe plus download + magic-byte detection                                                                        |
| Remote article / HTML URL                                     | Article extraction through `defuddle`, `firecrawl`, `glm-reader`, `spider`, `supadata`, or `zyte` via `--url-provider` |
| X/Twitter Space URL or raw Space ID                           | `yt-dlp` download of Space audio, normalize to compressed audio-only media, collect media metadata                     |
| X/Twitter post URL                                            | X API lookup of linked Space, then `yt-dlp` download of Space audio                                                    |
| Local `.html` / `.htm` file                                   | Article extraction with local `defuddle`                                                                               |
| Local media file                                              | normalize to compressed audio-only media, collect media metadata                                                       |
| Local document file                                           | detect format by magic bytes first, then extension                                                                     |
| YouTube channel URL                                           | batch the latest videos                                                                                                |
| RSS / podcast feed URL                                        | batch the latest episodes                                                                                              |
| URL list file (`.md` / `.txt`)                                | batch each listed input                                                                                                |
| Directory                                                     | batch each supported local input                                                                                       |

Use `--best-quality` for streaming sources when you want the best available video stream plus the best available audio stream instead of the default audio-only artifact. For direct media URLs and local media files, `--best-quality` keeps the source file as-is because there is no alternate quality ladder to select.

**Supported document formats:** PDF, EPUB, MOBI, AZW3, AZW, PRC, FB2, LIT, DOCX, PPTX, XLSX, ODT, ODS, ODP, RTF, CSV, CBZ

**Supported image formats:** PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, GIF

Convertible ebook inputs (MOBI, AZW/AZW3, PRC, FB2, and LIT) are normalized to EPUB through Calibre during step 1. The source format and conversion chain are recorded under `items[].metadata.step1` in `manifest.json`.

`.acsm` inputs follow ordinary unsupported-input behavior. Obtain a lawful readable EPUB or PDF outside AutoShow before using `download`.

Step-1 item metadata in `manifest.json` also includes `slug`, which is derived from the original filename without its final extension when available.

## Flags

```text
--password           Password for encrypted PDFs
--keep-original-media  Keep downloaded media in its original/downloaded format instead of creating the normalized compressed audio artifact
--best-quality       Download the best available video+audio media and skip audio-only normalization
--flat-batch         Batch download: place primary media files directly in the batch output directory
--url-provider       Article/HTML extraction backend: defuddle|firecrawl|glm-reader|spider|supadata|zyte (default defuddle; local .html/.htm always use defuddle)
--batch-limit        Batch: number of items to process or "all" (default 5)
--batch-order        Batch: item order newest|oldest (default newest)
--batch-concurrency  Batch: number of items to process concurrently (default 7)
--price              Show aggregated cost estimate for all active pipeline steps and exit
```

## Advanced yt-dlp / FFmpeg Passthrough

Use `--` after the AutoShow input and flags to pass exact argv tokens to the per-item yt-dlp download call:

```bash
# Override yt-dlp format selection inside AutoShow's normal download workflow
bun autoshow download https://youtube.com/watch?v=abc -- --format bestvideo+bestaudio

# Pass FFmpeg args through yt-dlp's native postprocessor mechanism
bun autoshow download https://youtube.com/watch?v=abc -- --postprocessor-args "ffmpeg:-vf scale=1280:720"

# Compose passthrough with AutoShow batch flags
bun autoshow download input/examples/batch/2-urls.md --batch-limit 3 -- --format bestaudio
bun autoshow download https://example.com/feed --batch-limit all --keep-original-media --flat-batch -- --format bestaudio
```

Passthrough is supported only for media URL downloads. For direct media URLs, podcast feed items, and X Space downloads that would normally use another resolver first, AutoShow uses yt-dlp for the final media download so the extra args are honored. Local files, documents, and articles reject passthrough with a usage error.

Without a positional AutoShow input, `download --` runs yt-dlp directly and skips AutoShow manifests, normalization, output directory management, pricing, and batch handling:

```bash
bun autoshow download -- --list-extractors
bun autoshow download -- --flat-playlist --dump-json https://youtube.com/@channelname
bun autoshow download -- --format bestaudio -o "%(title)s.%(ext)s" https://youtube.com/watch?v=abc
```

## Output

**Media inputs**

```text
output/YYYY-MM-DD_HH-MM-SS-mmm_title/
  <audio>.mp3|.m4a|.ogg|.flac
  manifest.json
```

With `--best-quality`, streaming outputs may be merged as `.mkv`, `.mp4`, or `.webm`, depending on the source streams selected by `yt-dlp`. Direct media URLs and local media files keep their source extension. The `items[].metadata.step1` payload keeps `audioFileName` and `audioFileSize` and also includes `mediaFileName`, `mediaFileSize`, and `mediaKind`.

**Document inputs**

```text
output/YYYY-MM-DD_HH-MM-SS-mmm_title/
  manifest.json
```

**Batch inputs**

```text
output/YYYY-MM-DD_HH-MM-SS-mmm_batch-label/
  manifest.json      # canonical batch source, items, metadata, and provider states
  YYYY-MM-DD-item/   # when the item has a content date
  item-slug/         # otherwise
    <artifacts for that item>
```

**Batch inputs with `--flat-batch` on media downloads**

```text
output/YYYY-MM-DD_HH-MM-SS-mmm_batch-label/
  manifest.json
  <episode-1>.mp3|.m4a|.ogg|.flac
  <episode-2>.mp3|.m4a|.ogg|.flac
```

With `--keep-original-media --flat-batch`, downloaded media files keep their original extensions (e.g. `.mp3`) instead of normalizing to compressed audio. Batch source inventory is stored in the manifest's top-level `source` object.

## Examples

```bash
# Download a YouTube video
bun autoshow download https://www.youtube.com/watch?v=u1-WHqATSQU

# Download the best available video+audio media from a YouTube video
bun autoshow download https://www.youtube.com/watch?v=u1-WHqATSQU --best-quality

# Download a direct media URL
bun autoshow download https://ajc.pics/autoshow/examples/1-audio.mp3

# Download document metadata from a local PDF
bun autoshow download input/examples/document/1-document.pdf

# Download X Space audio
bun autoshow download https://x.com/i/spaces/1DXxyRYNejbKM

# Download 3 latest episodes from an RSS feed
bun autoshow download https://example.com/feed --batch-limit 3

# Download every podcast episode MP3 into one batch directory
bun autoshow download https://example.com/feed --batch-limit all --keep-original-media --flat-batch

# Download 2 latest videos from a YouTube channel
bun autoshow download https://www.youtube.com/@channelname --batch-limit 2

# Download all items from a URL list
bun autoshow download input/examples/batch/2-urls.md --batch-limit all

# Download one item with extra yt-dlp flags
bun autoshow download https://youtube.com/watch?v=abc -- --write-thumbnail

# Run yt-dlp directly
bun autoshow download -- --version
```

## Setup and Environment

Setup details are centralized in [`setup.md`](../../setup-and-utilities/setup/setup.md).

For YouTube inputs, anonymous `yt-dlp` requests may be rate-limited or challenged. When that happens, persist cookies once with `bun autoshow config --cookies <file>` or `bun autoshow config --cookies-from-browser <browser>`, then rerun `download` / `extract`.

For X post URL inputs, set `X_BEARER_TOKEN` so AutoShow can resolve the linked Space before downloading. X Space playback itself is handled by yt-dlp and may require the same cookie setup as other authenticated media sources.

Download test coverage is documented in [Step 1 Tests: Download](download-tests.md).
