# metadata

Collect and display metadata for media, documents, articles, or X Spaces without downloading files.

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

| Input                                                                 | Behavior                                                         |
| --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| YouTube / Twitch / TikTok URL                                         | Collect video metadata                                           |
| Direct media URL (`.mp3`, `.mp4`, etc.)                               | Collect media metadata                                           |
| Direct document or image URL (`.pdf`, `.epub`, `.docx`, `.png`, etc.) | Collect document metadata                                        |
| Remote article / HTML URL                                             | Collect article metadata; choose a backend with `--url-provider` |
| X/Twitter Space URL, raw Space ID, or X/Twitter post URL              | Collect Space metadata, including linked posts and users         |
| Local `.html` / `.htm` file                                           | Collect article metadata with local `defuddle`                   |
| Local media file                                                      | Collect duration, title, and related media fields                |
| Local document or image file                                          | Collect title, author, page count, format, and file size         |
| YouTube channel or playlist URL                                       | Batch metadata for latest videos                                 |
| RSS / podcast feed URL                                                | Batch metadata for latest episodes                               |
| URL list file (`.md` / `.txt`)                                        | Batch metadata for each listed input                             |
| Directory                                                             | Batch metadata for each supported local input                    |

**Supported document formats:** PDF, EPUB, MOBI, AZW3, AZW, PRC, FB2, LIT, DOCX, PPTX, XLSX, ODT, ODS, ODP, RTF, CSV, CBZ

**Supported image formats:** PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, GIF

Convertible ebooks (MOBI, AZW/AZW3, PRC, FB2, and LIT) require Calibre.

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

By default, metadata prints one compact terminal summary. Use `--json` for the complete metadata object, or `--markdown` for Markdown frontmatter YAML. Do not combine `--json` with `--markdown`.

**Terminal output (default)**

```text
[13:14:55.161] ✓ Metadata: title=My Video Title, slug=2025-07-22-my-video-title, duration=12:34
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

`--save` writes artifacts to a timestamped output directory:

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

Setup details are in [`setup.md`](../../00-setup-and-utilities/setup.md).

YouTube inputs may be rate-limited or challenged. Follow the [YouTube cookies guide](../../00-setup-and-utilities/cookies.md), then rerun `metadata`.

X Space URLs, raw Space IDs, and X post URLs require `X_BEARER_TOKEN`.
