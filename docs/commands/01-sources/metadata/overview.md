# metadata

Inspect media, documents, articles, or X Spaces. Remote documents are fetched temporarily; successful metadata does not guarantee a later download or captions request will succeed.

```bash
bun autoshow metadata input/examples/audio/1-audio.mp3
bun autoshow metadata input/examples/document/1-document.pdf
bun autoshow metadata input/examples/batch/2-urls.md --batch-limit all --markdown --save
```

## Supported Inputs

- Local media, document/image files, and directories of supported files.
- YouTube, Twitch, TikTok, direct media/document/image URLs, articles, and local HTML.
- YouTube channels/playlists, RSS/podcast feeds, and `.md`/`.txt` URL lists.
- X Space URLs, raw Space IDs, and posts linking to a Space.

Document formats: PDF, EPUB, MOBI, AZW3/AZW, PRC, FB2, LIT, DOCX, PPTX, XLSX, ODT/ODS/ODP, RTF, CSV, CBZ, HTML/HTM. Images: PNG, JPG/JPEG, TIF/TIFF, WebP, BMP, GIF. Convertible ebooks require Calibre; DRM-protected content and `.acsm` fulfillment files are unsupported.

Lists, feeds, and YouTube collections honor batch limits/order; directories include all supported files.

## Flags

- `--password`: encrypted PDF password.
- `--markdown`: print frontmatter YAML; incompatible with `--json`.
- `--save`: with `--markdown`, save `metadata.md` and print confirmation instead.
- `--url-provider defuddle|spider|zyte`: article backend; default `defuddle`. Local HTML always uses `defuddle`.
- `--batch-limit N|all`, `--batch-order newest|oldest`, `--batch-concurrency N`: defaults `5`, `newest`, and `7`.
- `--price`: estimate without execution. X API read charges are not estimated.

See [shared globals](../../00-setup-and-utilities/usage.md) for output paths, JSON, and logging.

## Output

Every item writes `manifest.json`, even without `--save`; default output is a compact summary. Batches add a parent manifest and child directories, prefixed with a content date when available. `--markdown --save` writes `metadata.md` in each item's directory. Media metadata can include title, duration, chapters, and description; documents include title, author, page count, format, and size where available.

## Examples

Choose a public source accessible to your account:

```bash
bun autoshow metadata "https://www.youtube.com/watch?v=u1-WHqATSQU"
bun autoshow metadata https://example.com/feed --batch-limit 3
```

For X, set `X_BEARER_TOKEN` and use an accessible Space or linked post. `--price` proves neither free reads nor account access. See the [X route](../../02-extract/url/overview.md#x-space-path).

## Setup and Environment

[Setup](../../00-setup-and-utilities/setup.md) installs required tools. YouTube access problems may require [cookies](../../00-setup-and-utilities/cookies.md). Hosted article backends require `SPIDER_API_KEY` or `ZYTE_API_KEY`; local `defuddle` needs no API key.
