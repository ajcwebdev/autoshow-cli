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
load config + merge config flags + compose command/domain option slices
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
| `html_article` | URL/article extraction | `article` |
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

Unsupported batch items are kept in the parent manifest with item `status: "skipped"` and a `metadata.skipReason`. They are not sent to child batch execution.

## Batch Manifests

Every batch root writes the same unversioned canonical `manifest.json` used by a single run. Source-backed batch data is the optional top-level `source` object; it is not duplicated in a companion file.

```json
{
  "command": "download",
  "scope": "batch",
  "createdAt": "2026-08-10T17:00:00.000Z",
  "updatedAt": "2026-08-10T17:00:05.000Z",
  "source": {
    "sourceKind": "youtube_channel",
    "sourceUrl": "https://...",
    "title": "Channel title",
    "author": "Author",
    "selectedCount": 10
  },
  "items": [
    {
      "input": "input/file.mp3",
      "outputDir": "2026-06-10_12-00-00_file",
      "status": "full",
      "metadata": {
        "title": "file",
        "channel": "Local",
        "duration": "Unknown"
      },
      "providers": []
    }
  ]
}
```

Extract batches are route-aware. The parent manifest is `manifest.json`; child batches live under `media/`, `document/`, `article/`, and `x-space/` when those routes are present.

```
output/YYYY-MM-DD_HH-MM-SS_<batch-label>/
  manifest.json
  media/
    manifest.json
    <item-output>/
  document/
    manifest.json
    <item-output>/
  article/
    manifest.json
    <item-output>/
  x-space/
    manifest.json
    <item-output>/
```

```json
{
  "command": "extract",
  "scope": "batch",
  "createdAt": "2026-06-10T17:00:00.000Z",
  "updatedAt": "2026-06-10T17:00:05.000Z",
  "items": [
    {
      "input": "input/video.mp4",
      "inputFamily": "media",
      "extractRoute": "media",
      "outputDir": "media/2026-06-10_12-00-00_video",
      "child": { "route": "media", "index": 0, "manifestDir": "media" },
      "status": "full",
      "metadata": {},
      "providers": []
    },
    {
      "input": "input/unknown.bin",
      "inputFamily": "unsupported",
      "status": "skipped",
      "metadata": { "skipReason": "Unsupported input type" },
      "providers": []
    }
  ]
}
```

`executeExtractBatchPlan()` writes the initial parent manifest, partitions runnable items by extract route, executes each child plan, then updates the parent items with their final status and containment-checked relative output directories. Each runnable parent item links to its child through `{ route, index, manifestDir }`; `manifestDir` names the child directory relative to the parent root, never a manifest filename.

The media child uses the STT batch coordinator and records caption-backed or STT routing in ordinary item metadata. Counts and resume views are derived from canonical item and provider states rather than persisted in a second summary artifact.

## Entry Points

| Source | Planner/handler | Item discovery |
|--------|-----------------|----------------|
| Directory | `resolveProcessTargetPlan()` -> `planProcessTargetBatchExecution()` | `collectInputFiles()` plus optional `input/2-urls.md`. |
| Input list | `resolveInputListBatch()` | Line parser for `.md`/`.txt`, markdown links, bullets, and relative paths. |
| Podcast or YouTube source | `tryResolveBatchSource()` | Feed/channel/source enumeration stored in the canonical manifest's optional `source` object. |
| YouTube collection | `resolveYoutubeCollectionItems()` | Playlist/channel collection expansion. |
| Text-input write | `collectTextInputFiles()` or single `.md`/`.txt` | Raw text source files for `write --text-input`. |
| Single item | `handleSingleTarget()` | Route resolved by `resolveInputRoutingForCommand()`. |
