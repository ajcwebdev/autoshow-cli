# download

Prepare media or download X Space audio. Documents and articles produce metadata only; use `extract` to obtain their text.

```bash
bun autoshow download input/examples/audio/1-audio.mp3
bun autoshow download "https://www.youtube.com/watch?v=u1-WHqATSQU" --media-quality best
bun autoshow download https://example.com/feed --batch-limit all --media-quality original --flat-batch
```

## Supported Inputs

Accepts the [metadata input formats](../metadata/overview.md#supported-inputs), including local files, media/document/article URLs, X Spaces or linked posts, collections, feeds, URL lists, and directories. Convertible ebooks require Calibre.

## Flags

- `--media-quality audio|original|best`: default `audio` prepares compressed audio. `original` keeps selected source audio/media without normalization. `best` selects video+audio where available and preserves direct/local media.
- `--flat-batch`: place primary media files at the batch root instead of item directories.
- `--password`: encrypted PDF password.
- `--url-provider defuddle|spider|zyte`: metadata backend; default `defuddle`, always used for local HTML.
- `--batch-limit N|all`, `--batch-order newest|oldest`, `--batch-concurrency N`: defaults `5`, `newest`, and `7`.
- `--price`: estimate without downloading.

See [shared globals](../../00-setup-and-utilities/usage.md) for output paths, JSON, and logging.

## yt-dlp Passthrough

Put extra yt-dlp arguments after `--`:

```bash
bun autoshow download "https://www.youtube.com/watch?v=u1-WHqATSQU" -- --write-thumbnail
bun autoshow download input/examples/batch/2-urls.md --batch-limit 3 -- --format bestaudio
```

Passthrough accepts media URL downloads, including direct URLs, feed items, and X Spaces; local files, documents, and articles reject it. Each routed item must produce exactly one primary media file. Configure cookies through `setup`, not passthrough.

Without an input, raw mode permits yt-dlp workflows with zero or multiple primary media files:

```bash
bun autoshow download -- --format bestaudio -o "%(title)s.%(ext)s" "https://www.youtube.com/watch?v=u1-WHqATSQU"
```

## Output

Each run writes `manifest.json` and any prepared media. Documents/articles do not copy the source into the run. Normal batches have a parent manifest and item directories; `--flat-batch` places media beside that parent manifest. Original-quality downloads retain source extensions; best-quality platform downloads may produce MKV, MP4, or WebM.

## Setup and Environment

Use [setup](../../00-setup-and-utilities/setup.md) for binaries and [cookies](../../00-setup-and-utilities/cookies.md) for authenticated/challenged media. X post resolution requires `X_BEARER_TOKEN`; direct Spaces may need cookies. Hosted article metadata requires `SPIDER_API_KEY` or `ZYTE_API_KEY`; local `defuddle` needs no API key.
