# Input Routing & Batch Orchestration

How targets become single runs, source-backed batches, route-aware extract batches, or write text-input runs.

## Outline

- [Target Planning](#target-planning)
- [Input Routing](#input-routing)
- [Command Matrix](#command-matrix)
- [Batch Manifests](#batch-manifests)
- [Entry Points](#entry-points)

## Target Planning

```
handleProcessTarget(command, target, flags)
        |
        v
resolveProcessTargetDoubleDash()
        |
        +--> download after "--" with leading dash args keeps raw yt-dlp passthrough
        +--> otherwise one target can come after "--"
        |
        v
load config + merge config flags + build RuntimeOptions
        |
        +--> extract: normalize generic provider flags after preliminary route checks
        +--> write: normalize step selectors and generic TTS options
        +--> write text project defaults:
             <project>/text -> --text-input mode with prompt.md,
             tracks.md, and rendered lyrics defaults when present
        |
        v
resolveProcessTargetPlan(command, resolvedTarget, opts)
```

`resolveProcessTargetPlan()` is the single top-level planner:

```
write && opts.textInput?
  |
  +--> URL target: usage error
  +--> directory: collectTextInputFiles(.md/.txt) -> batch
  +--> .md/.txt file: single text-input item
  +--> otherwise: usage error

normal target
  |
  +--> directory:
  |      collectInputFiles()
  |      if basename is input, also read input/2-urls.md
  |      -> batch
  |
  +--> .md/.txt input list:
  |      readInputList() -> resolve relative paths and markdown links -> batch
  |
  +--> batch source:
  |      tryResolveBatchSource()
  |      podcast feed or YouTube source -> source-backed batch
  |
  +--> YouTube collection:
  |      resolveYoutubeCollectionItems() -> batch
  |
  +--> fallback:
         single target
```

After planning, `planProcessTargetBatchExecution()` converts directory/list/source/collection plans to a `BatchExecutionPlan`. Single plans go directly to `handleSingleTarget()`.

## Input Routing

Single extract/write items call `resolveInputRoutingForCommand()`:

```
target
  |
  v
classifyInputFamily()
  |
  +--> media        local media, direct media URL, streaming URL
  +--> document     PDF, EPUB, image, Office, ODF, ebook, archive, RTF, CSV
  +--> html_article remote article URL or local/remote HTML
  +--> x_space      X/Twitter Space or post route
  +--> unsupported  unsupported extension, missing file, invalid route
  |
  v
resolveDocumentFormatHint() when needed
  |
  v
resolvedStep2 + extractRoute + supported/skipReason
```

Extract route mapping:

| Input family | Step 2 route | Extract route |
|--------------|--------------|---------------|
| `media` | STT | `media` |
| `document` | OCR or native document extraction | `document` |
| `html_article` | URL/article extraction | `document` |
| `x_space` | X Space metadata extraction | `x-space` |
| `unsupported` | none | skipped in batch, usage error for single |

The document family includes `.pdf`, `.epub`, `.acsm`, `.docx`, `.pptx`, `.xlsx`, `.odt`, `.ods`, `.odp`, `.mobi`, `.prc`, `.azw3`, `.azw`, `.fb2`, `.lit`, `.cbz`, `.rtf`, `.csv`, and image files `.png`, `.jpg`, `.jpeg`, `.tif`, `.tiff`, `.webp`, `.bmp`, `.gif`. Local `.html`/`.htm` files classify as `html_article`.

## Command Matrix

| Family | `metadata` | `download` | `extract` | `write` |
|--------|------------|------------|-----------|---------|
| Media | metadata only | download/stage media | STT route | STT + LLM + optional generation |
| Document/image | metadata only | download/copy document | OCR/native document route | OCR/native document + LLM + optional generation |
| HTML/article | metadata only | article prep/download metadata | URL/article route | URL/article + LLM + optional generation |
| X Space | X API metadata lookup | Space audio download | X Space route | X Space report + LLM |
| Text input | unsupported | unsupported | unsupported | only when `--text-input` is active |

Unsupported batch items are kept in the parent manifest with `completionStatus: "skipped"` and a `skipReason`. They are not sent to child batch execution.

## Batch Manifests

Non-extract batches write one schema v2 `batch.json` and, for source-backed batches, a companion `source.json`:

```jsonc
// batch.json
{
  "schemaVersion": 2,
  "kind": "write",
  "items": [
    {
      "url": "file://input/file.mp3",
      "title": "file",
      "channel": "Local",
      "duration": "Unknown",
      "outputDir": "2026-06-10_12-00-00_file",
      "completionStatus": "full"
    }
  ],
  "source": {
    "sourceKind": "youtube_channel",
    "sourceUrl": "https://...",
    "title": "Channel title",
    "author": "Author",
    "selectedCount": 10
  }
}
```

```jsonc
// source.json
{
  "sourceKind": "podcast_rss",
  "sourceUrl": "https://...",
  "title": "Feed title",
  "author": "Publisher",
  "selectedCount": 5
}
```

Extract batches are route-aware. The parent manifest is `extract-batch.json`; child batches live under `media/`, `document/`, and `x-space/` when those routes are present.

```
output/YYYY-MM-DD_HH-MM-SS_<batch-label>/
  extract-batch.json
  media/
    batch.json
    source.json                # optional source-backed batch metadata, per child batch
    stt-summary.json           # media child summary, including caption usage
    <item-output>/
  document/
    batch.json
    <item-output>/
  x-space/
    batch.json
    <item-output>/
```

```jsonc
// extract-batch.json
{
  "schemaVersion": 2,
  "createdAt": "2026-06-10T17:00:00.000Z",
  "items": [
    {
      "input": "input/video.mp4",
      "inputFamily": "media",
      "extractRoute": "media",
      "childBatchEntry": { "route": "media", "index": 0 },
      "completionStatus": "full",
      "outputDir": "media/2026-06-10_12-00-00_video"
    },
    {
      "input": "input/unknown.bin",
      "inputFamily": "unsupported",
      "completionStatus": "skipped",
      "skipReason": "Unsupported input type"
    }
  ],
  "childBatches": {
    "media": "media",
    "document": "document",
    "x-space": "x-space"
  }
}
```

`executeExtractBatchPlan()` writes the initial parent manifest, partitions runnable items by extract route, executes each child plan, then updates the parent entries with child indexes, final completion status, skip reasons, and relative output directories.

The media child uses the STT batch coordinator and writes `stt-summary.json`, including totals for caption-backed, STT fallback, skipped, incomplete, and failed items.

## Entry Points

| Source | Planner/handler | Item discovery |
|--------|-----------------|----------------|
| Directory | `resolveProcessTargetPlan()` -> `planProcessTargetBatchExecution()` | `collectInputFiles()` plus optional `input/2-urls.md`. |
| Input list | `resolveInputListBatch()` | Line parser for `.md`/`.txt`, markdown links, bullets, and relative paths. |
| Podcast or YouTube source | `tryResolveBatchSource()` | Feed/channel/source enumeration plus `source.json`. |
| YouTube collection | `resolveYoutubeCollectionItems()` | Playlist/channel collection expansion. |
| Text-input write | `collectTextInputFiles()` or single `.md`/`.txt` | Raw text source files for `write --text-input`. |
| Single item | `handleSingleTarget()` | Route resolved by `resolveInputRoutingForCommand()`. |
