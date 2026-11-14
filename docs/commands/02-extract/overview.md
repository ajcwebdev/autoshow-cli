# extract

Extract text or metadata from media, documents, images, web pages, and X Spaces. Use [`resume`](../00-setup-and-utilities/resume.md) to recover an existing run or add provider outputs.

```bash
bun autoshow extract [input] [flags]
```

## Input Routing

| Input                                       | Route and default without saved selections                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Local/remote audio and video, media sites   | [STT](stt/overview.md), local whisperfile `tiny`                                                           |
| Documents, ebooks, archives, and images     | [OCR/native extraction](ocr/overview.md); PDF/images default to Tesseract, EPUB and office formats to text |
| Remote articles and local `.html`/`.htm`    | [URL extraction](url/overview.md), local `defuddle`                                                        |
| X/Twitter Space/post URLs and raw Space IDs | [X Space metadata](url/overview.md#x-space-path), not an audio transcript                                  |

YouTube can also use [existing transcript retrieval](url/overview.md#public-media-url-transcripts). Convertible ebooks pass through EPUB; `.acsm` fulfillment files require a readable EPUB or PDF instead.

## Common Options

- `--provider provider[=model]` selects targets for the detected route. STT/OCR selections are repeatable; articles accept one explicit backend.
- `--all-providers` selects route-supported hosted targets; `--all-local` selects local engines. Article routes reject either shortcut combined with an explicit provider.
- `--price` estimates without provider dispatch. It does not check credentials, account access, or source availability.
- `--output-dir` pins the output directory. `--provider-concurrency`, `--local-concurrency`, and `--batch-concurrency` cap different work; see `bun autoshow extract --help` for applicable scopes and defaults.

Local engines have no provider charge. Install prerequisites with [`setup`](../00-setup-and-utilities/setup.md).

## Batch Inputs

Directories, input-list `.md`/`.txt` files, RSS feeds, and YouTube channels/playlists expand into batches. Lists and directories may mix routes. Directory extraction includes every supported file; `--batch-limit` and `--batch-order` select list/feed/collection items. Their limit defaults to five; use `all` for the complete selection.

```bash
bun autoshow extract input/examples/batch/2-urls.md --batch-limit all --price
bun autoshow extract input/examples/document --price
```

For a channel/playlist, inspect one item before scaling; [cookies](../00-setup-and-utilities/cookies.md) may be required by YouTube:

```bash
YOUTUBE_BATCH_URL='<your-public-youtube-channel-or-playlist-url>'
bun autoshow metadata "$YOUTUBE_BATCH_URL" --batch-limit 1
bun autoshow extract "$YOUTUBE_BATCH_URL" --batch-limit 1 --price
```

Remove `--price` only after reviewing the estimate. Successful discovery does not guarantee download or transcription. Mixed batches keep a parent manifest and route-specific `media/`, `document/`, `article/`, and `x-space/` child directories.

## Detailed Extract Docs

- [STT](stt/overview.md): providers, captions, alignment, and reviewed transcripts.
- [OCR](ocr/overview.md): native document text, page OCR, chapters, and pooling.
- [URL and X](url/overview.md): articles, YouTube transcripts, and X metadata.
