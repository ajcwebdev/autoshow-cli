# metadata

Collect and display metadata for media, documents, articles, or X Spaces without downloading.

## Outline

- [Supported Inputs](#supported-inputs)
- [Flags](#flags)
- [Output](#output)
- [Examples](#examples)
- [Setup and Environment](#setup-and-environment)

```bash
bun autoshow metadata <input> [flags]
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
| URL list file (`.md` / `.txt`)                                        | Batch the selected listed inputs                                 |
| Directory                                                             | Batch metadata for each supported local input                    |

**Supported document formats:** PDF, EPUB, MOBI, AZW3, AZW, PRC, FB2, LIT, DOCX, PPTX, XLSX, ODT, ODS, ODP, RTF, CSV, CBZ

**Supported image formats:** PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, GIF

Convertible ebooks (MOBI, AZW/AZW3, PRC, FB2, and LIT) require Calibre.

URL lists, RSS or podcast feeds, and YouTube channels or playlists honor `--batch-limit` and `--batch-order`. A directory includes every supported file.

## Flags

```text
--password           Password for encrypted PDFs
--markdown           Print metadata as Markdown frontmatter YAML
--save               With --markdown, write metadata.md and print a confirmation
--url-provider       Article or HTML backend: defuddle|firecrawl|glm-reader|spider|supadata|zyte (default defuddle; local .html/.htm always use defuddle)
--batch-limit        Number of items to process, or "all" (default 5)
--batch-order        Item order: newest|oldest (default newest)
--batch-concurrency  Number of items to process at once (default 7)
--price              Show the cost estimate and exit
```

`--json` is a global flag (see [`usage.md`](../../00-setup-and-utilities/usage.md)). Do not combine `--json` with `--markdown`; each one writes the metadata to stdout.

Shared globals such as `--output-root`, `--output-dir`, and logging flags are documented in [`usage.md`](../../00-setup-and-utilities/usage.md).

## Output

Each item prints one compact summary and writes `manifest.json` under a timestamped run directory. Batch items prefix that summary with `[index/count]`. `--markdown` prints Markdown frontmatter YAML on stdout instead of the summary. For a batch, each item's metadata is in that item's `manifest.json`.

**Terminal output (default)**

```text
[13:14:55.161] ✓ Metadata: title=My Video Title, slug=2025-07-22-my-video-title, duration=12:34
```

Media metadata may also include chapters and description when the source provides them.

**Document metadata fields**

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

**Run directory**

A single metadata run writes:

```text
output/YYYY-MM-DD_HH-MM-SS-mmm_title/
  manifest.json
```

A batch run writes a parent directory and one child directory per item:

```text
output/YYYY-MM-DD_HH-MM-SS-mmm_batch-label/
  manifest.json
  YYYY-MM-DD-slug/   # when the item has a content date
  slug/              # otherwise
    manifest.json
```

`--save --markdown` also writes `metadata.md` in the single-run directory or in each batch child directory. `manifest.json` is written even without `--save`.

## Examples

```bash
bun autoshow metadata "https://www.youtube.com/watch?v=u1-WHqATSQU"

bun autoshow metadata "https://www.youtube.com/watch?v=u1-WHqATSQU" --markdown

bun autoshow metadata "https://www.youtube.com/watch?v=u1-WHqATSQU" --save --markdown

bun autoshow metadata input/examples/audio/1-audio.mp3

bun autoshow metadata input/examples/document/1-document.pdf

bun autoshow metadata https://x.com/i/spaces/1DXxyRYNejbKM

bun autoshow metadata input/examples/document/protected.pdf --password secret

bun autoshow metadata https://example.com/feed --batch-limit 3

bun autoshow metadata https://www.youtube.com/@channelname --batch-limit 5

bun autoshow metadata input/examples/batch/2-urls.md --batch-limit all --save --markdown
```
## Setup and Environment

Setup details are in [`setup.md`](../../00-setup-and-utilities/setup.md).

YouTube inputs may be rate-limited or challenged. Follow the [YouTube cookies guide](../../00-setup-and-utilities/cookies.md), then rerun `metadata`.

X Space URLs, raw Space IDs, and X post URLs require `X_BEARER_TOKEN`.

Hosted article backends selected with `--url-provider` need the matching API key (`FIRECRAWL_API_KEY`, `GLM_API_KEY`, `SPIDER_API_KEY`, `SUPADATA_API_KEY`, or `ZYTE_API_KEY`). Local `defuddle` does not.
