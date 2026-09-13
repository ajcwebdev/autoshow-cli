# download

Download media, documents, articles, or X Space audio and collect metadata only.

Media and X Space inputs write a compressed audio file, or original/best-quality media when requested. Document and article inputs write metadata only. This command does not transcribe, extract text, or run LLM steps.

## Outline

- [Supported Inputs](#supported-inputs)
- [Flags](#flags)
- [yt-dlp Passthrough](#yt-dlp-passthrough)
- [Output](#output)
- [Examples](#examples)
- [Setup and Environment](#setup-and-environment)

```bash
bun autoshow download [input]
```

## Supported Inputs

| Input | Behavior |
| --- | --- |
| YouTube / Twitch / TikTok URL | Download as compressed audio |
| Direct media URL (`.mp3`, `.mp4`, etc.) | Download as compressed audio |
| Direct document or image URL (`.pdf`, `.epub`, `.docx`, `.png`, etc.) | Collect document metadata |
| Remote article / HTML URL | Collect article metadata; choose a backend with `--url-provider` |
| X/Twitter Space URL or raw Space ID | Download Space audio as compressed audio |
| X/Twitter post URL | Download the linked Space audio |
| Local `.html` / `.htm` file | Collect article metadata (`defuddle`) |
| Local media file | Convert to compressed audio |
| Local document or image file | Collect document metadata |
| YouTube channel or playlist URL | Batch the latest videos |
| RSS / podcast feed URL | Batch the latest episodes |
| URL list file (`.md` / `.txt`) | Batch each listed input |
| Directory | Batch each supported local input |

**Supported document formats:** PDF, EPUB, MOBI, AZW3, AZW, PRC, FB2, LIT, DOCX, PPTX, XLSX, ODT, ODS, ODP, RTF, CSV, CBZ

**Supported image formats:** PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, GIF

Convertible ebooks (MOBI, AZW/AZW3, PRC, FB2, and LIT) require Calibre.

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

## yt-dlp Passthrough

Use `--` after the AutoShow input and flags to pass extra arguments to yt-dlp:

```bash
bun autoshow download "https://youtube.com/watch?v=abc" -- --write-thumbnail
bun autoshow download input/examples/batch/2-urls.md --batch-limit 3 -- --format bestaudio
```

Passthrough works for media URL downloads, including direct media URLs, podcast feed items, and X Space downloads. Local files, documents, and articles reject it.

Without an input, `download --` runs yt-dlp directly:

```bash
bun autoshow download -- --format bestaudio -o "%(title)s.%(ext)s" "https://youtube.com/watch?v=abc"
```

## Output

**Media inputs**

```text
output/YYYY-MM-DD_HH-MM-SS-mmm_title/
  <audio>.mp3|.m4a|.ogg|.flac
  manifest.json
```

With `--best-quality`, YouTube, Twitch, TikTok, and similar URLs keep video+audio instead of compressed audio. Those files may be `.mkv`, `.mp4`, or `.webm`. Direct media URLs and local media files keep the source file as-is.

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

With `--keep-original-media --flat-batch`, downloaded media files keep their original extensions.

## Examples

```bash
# Download a YouTube video
bun autoshow download "https://www.youtube.com/watch?v=u1-WHqATSQU"

# Download the best available video+audio from a YouTube video
bun autoshow download "https://www.youtube.com/watch?v=u1-WHqATSQU" --best-quality

# Download a direct media URL
bun autoshow download https://ajc.pics/autoshow/examples/1-audio.mp3

# Collect document metadata from a local PDF
bun autoshow download input/examples/document/1-document.pdf

# Download X Space audio
bun autoshow download https://x.com/i/spaces/1DXxyRYNejbKM

# Download 3 latest episodes from an RSS feed
bun autoshow download https://example.com/feed --batch-limit 3

# Download every podcast episode into one batch directory
bun autoshow download https://example.com/feed --batch-limit all --keep-original-media --flat-batch

# Download 2 latest videos from a YouTube channel
bun autoshow download https://www.youtube.com/@channelname --batch-limit 2

# Download all items from a URL list
bun autoshow download input/examples/batch/2-urls.md --batch-limit all
```

## Setup and Environment

Setup details are in [`setup.md`](../../00-setup-and-utilities/setup.md).

For YouTube inputs, anonymous `yt-dlp` requests may be rate-limited or challenged. Follow the [YouTube cookies guide](../../00-setup-and-utilities/cookies.md) to save authentication with `setup`, then rerun `download`.

X post URLs require `X_BEARER_TOKEN`. X Space downloads may need the same cookie setup as other authenticated media sources.
