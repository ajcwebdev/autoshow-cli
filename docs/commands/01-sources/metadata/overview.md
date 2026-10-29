# metadata

Collect and display metadata for media, documents, articles, or X Spaces. Remote documents are fetched temporarily for inspection.

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
| Direct document or image URL (`.pdf`, `.epub`, `.docx`, `.png`, etc.) | Fetch temporarily and collect document metadata                  |
| Remote article / HTML URL                                             | Collect article metadata; choose a backend with `--url-provider` |
| X/Twitter Space URL, raw Space ID, or X/Twitter post URL              | Collect Space metadata, including linked posts and users         |
| Local `.html` / `.htm` file                                           | Collect article metadata with local `defuddle`                   |
| Local media file                                                      | Collect duration, title, and related media fields                |
| Local document or image file                                          | Collect title, author, page count, format, and file size         |
| YouTube channel or playlist URL                                       | Batch metadata for latest videos                                 |
| RSS / podcast feed URL                                                | Batch metadata for latest episodes                               |
| URL list file (`.md` / `.txt`)                                        | Batch the selected listed inputs                                 |
| Directory                                                             | Recursively collect metadata for supported local files           |

**Supported document formats:** PDF, EPUB, MOBI, AZW3, AZW, PRC, FB2, LIT, DOCX, PPTX, XLSX, ODT, ODS, ODP, RTF, CSV, CBZ

**Supported image formats:** PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, GIF

Convertible ebooks (MOBI, AZW/AZW3, PRC, FB2, and LIT) require Calibre.

URL lists, RSS or podcast feeds, and YouTube channels or playlists honor `--batch-limit` and `--batch-order`. A directory includes every supported file.

## Flags

```text
--password           Password for encrypted PDFs
--markdown           Print metadata as Markdown frontmatter YAML
--save               With --markdown, write metadata.md and print a confirmation
--url-provider       Article or HTML backend: defuddle|spider|zyte (default defuddle; local .html/.htm always use defuddle)
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
  item-slug/
    manifest.json
```

Child directory names include a `YYYY-MM-DD-` prefix when a content date is available.

`--save --markdown` also writes `metadata.md` in the single-run directory or in each batch child directory. `manifest.json` is written even without `--save`.

## Examples

Choose an existing local file, feed, or URL list:

```bash
bun autoshow metadata input/examples/audio/1-audio.mp3

bun autoshow metadata input/examples/document/1-document.pdf

bun autoshow metadata input/examples/document/protected.pdf --password secret

bun autoshow metadata https://example.com/feed --batch-limit 3

bun autoshow metadata input/examples/batch/2-urls.md --batch-limit all --save --markdown
```

Choose a public YouTube source and install `yt-dlp` with `setup`. For a channel or playlist, start with one item.

```bash
YOUTUBE_URL='<your-public-youtube-watch-url>'
YOUTUBE_BATCH_URL='<your-public-youtube-channel-or-playlist-url>'
bun autoshow metadata "$YOUTUBE_URL"
bun autoshow metadata "$YOUTUBE_URL" --save --markdown
bun autoshow metadata "$YOUTUBE_BATCH_URL" --batch-limit 1
```

Successful metadata does not guarantee that a later media download or captions request will succeed.

For X, choose a Space or linked post your API project can access and set `X_BEARER_TOKEN`. AutoShow does not estimate X API read charges; `--price` does not establish that the metadata request is free or that the account can read the source.

```bash
X_SPACE_URL='<your-accessible-x-space-url>'
bun autoshow metadata "$X_SPACE_URL"
```

See the [X extraction guide](../../02-extract/url/overview.md#x-space-path) for post-URL and raw Space-ID alternatives.

## Setup and Environment

Setup details are in [`setup.md`](../../00-setup-and-utilities/setup.md).

YouTube inputs may be rate-limited or challenged. Follow the [YouTube cookies guide](../../00-setup-and-utilities/cookies.md), then rerun `metadata`.

Hosted article backends selected with `--url-provider` need the matching API key (`SPIDER_API_KEY` or `ZYTE_API_KEY`). Local `defuddle` does not.
