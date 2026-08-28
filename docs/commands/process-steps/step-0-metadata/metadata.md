# metadata

Collect and display metadata for media, documents, articles, or X Spaces without downloading files, running transcription, extraction, or LLM steps.

## Outline

- [Supported Inputs](#supported-inputs)
- [Flags](#flags)
- [Output](#output)
- [Examples](#examples)
- [Setup and Environment](#setup-and-environment)

```bash
bun autoshow metadata <input>
```

## Supported Inputs

| Input                                                         | Behavior                                                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| YouTube / Twitch / TikTok URL                                 | Collect video metadata without downloading the media                                  |
| Direct media URL (`.mp3`, `.mp4`, etc.)                       | Collect media metadata without downloading the file                                   |
| Direct document URL (`.pdf`, `.epub`, `.docx`, etc.)          | Collect document metadata without saving the file                                     |
| Remote article / HTML URL                                     | Collect article metadata; choose a backend with `--url-provider`                      |
| X/Twitter Space URL, raw Space ID, or X/Twitter post URL      | Collect Space metadata, including linked posts and users                              |
| Local `.html` / `.htm` file                                   | Collect article metadata with local `defuddle`                                        |
| Local media file                                              | Collect duration, title, and related media fields                                     |
| Local document file                                           | Collect title, author, page count, format, and file size                              |
| YouTube channel or playlist URL                               | Batch metadata for latest videos                                                      |
| RSS / podcast feed URL                                        | Batch metadata for latest episodes                                                    |
| URL list file (`.md` / `.txt`)                                | Batch metadata for each listed input                                                  |
| Directory                                                     | Batch metadata for each supported local input                                         |

**Supported document formats:** PDF, EPUB, MOBI, AZW3, AZW, PRC, FB2, LIT, DOCX, PPTX, XLSX, ODT, ODS, ODP, RTF, CSV, CBZ

**Supported image formats:** PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, GIF

## Flags

```text
--markdown           Output metadata as Markdown frontmatter YAML
--save               Save manifest.json to disk (and metadata.md with --markdown)
--password           Password for encrypted PDFs
--url-provider       Article/HTML extraction backend: defuddle|firecrawl|glm-reader|spider|supadata|zyte (default defuddle; local .html/.htm always use defuddle)
--batch-limit        Batch: number of items to process or "all" (default 5)
--batch-order        Batch: item order newest|oldest (default newest)
--batch-concurrency  Batch: number of items to process concurrently (default 7)
--price              Show aggregated cost estimate for all active pipeline steps and exit
```

## Output

By default, metadata is printed to the terminal as a labeled key/value report. Use the global `--json` flag for JSON, or `--markdown` for Markdown frontmatter YAML. JSON and Markdown use camelCase field names such as `publishDate` and `channelURL`.

The `slug` comes from the original filename when one exists. Otherwise it is derived from the title, and media slugs include the publish date.

**Terminal output (default)**

```text
[13:14:55.161] • Metadata
  title: My Video Title
  slug: 2025-07-22-my-video-title
  duration: 12:34
  channel: Channel Name
  url: https://www.youtube.com/watch?v=...
  publish date: 2025-07-22
  thumbnail: https://i.ytimg.com/vi/.../maxresdefault.jpg
  channel url: https://www.youtube.com/channel/...
```

Media metadata may also include chapters and description when the source provides them.

**Document metadata example**

```json
{
  "title": "Document Title",
  "slug": "1-document",
  "author": "Author Name",
  "pageCount": 42,
  "format": "pdf",
  "fileSize": 1234567
}
```

**With `--save`**

Nothing is written to disk without `--save`. With `--save`, artifacts go to a timestamped output directory:

```text
output/YYYY-MM-DD_HH-MM-SS-mmm_title/
  manifest.json
```

`--save --markdown` also writes `metadata.md` in that directory.

## Examples

```bash
# Display metadata for a YouTube video
bun autoshow metadata "https://www.youtube.com/watch?v=u1-WHqATSQU"

# Display and save metadata to disk
bun autoshow metadata "https://www.youtube.com/watch?v=u1-WHqATSQU" --save

# Display metadata as Markdown frontmatter YAML
bun autoshow metadata "https://www.youtube.com/watch?v=u1-WHqATSQU" --markdown

# Local media file metadata
bun autoshow metadata input/examples/audio/1-audio.mp3

# Document metadata from a local PDF
bun autoshow metadata input/examples/document/1-document.pdf

# X Space metadata
bun autoshow metadata https://x.com/i/spaces/1DXxyRYNejbKM

# Encrypted PDF metadata
bun autoshow metadata input/examples/document/protected.pdf --password secret

# Batch metadata for latest 3 episodes from an RSS feed
bun autoshow metadata https://example.com/feed --batch-limit 3

# Batch metadata for a YouTube channel
bun autoshow metadata https://www.youtube.com/@channelname --batch-limit 5

# Batch metadata from a URL list, save all to disk
bun autoshow metadata input/examples/batch/2-urls.md --batch-limit all --save
```

## Setup and Environment

Setup details are in [`setup.md`](../../setup-and-utilities/setup/setup.md).

For YouTube inputs, anonymous `yt-dlp` requests may be rate-limited or challenged. Persist cookies once with `bun autoshow config --cookies <file>` or `bun autoshow config --cookies-from-browser <browser>`, then rerun `metadata`.

For X Space URLs, raw Space IDs, and X post URLs, set `X_BEARER_TOKEN`.
