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
command + target + flags
        |
        v
resolve `--` passthrough
        |
        +--> download after "--" with leading dash args keeps raw yt-dlp passthrough
        +--> otherwise one target can come after "--"
        |
        v
load config, merge defaults, apply command flags
        |
        +--> extract: map generic --provider flags after route checks
        +--> write: normalize STT, OCR, LLM selectors
        +--> write text project defaults:
             <project>/text with prompt.md -> --text-input mode,
             plus tracks.md and lyrics render defaults when present
        +--> write auto text input:
             a .md/.txt target that does not parse as an input list
             -> --text-input mode
        |
        v
plan the run
```

Write `--text-input` planning:

```
write && --text-input?
  |
  +--> URL target: usage error
  +--> directory: collect .md/.txt files -> batch
  +--> .md/.txt file: single text-input item
  +--> otherwise: usage error
```

Normal target planning:

```
normal target
  |
  +--> directory:
  |      collect input files
  |      if the directory basename is input, also read input/2-urls.md
  |      -> batch
  |
  +--> .md/.txt input list:
  |      resolve relative paths and markdown links -> batch
  |
  +--> batch source:
  |      podcast feed or YouTube source -> source-backed batch
  |
  +--> YouTube collection:
  |      playlist/channel expansion -> batch
  |
  +--> fallback:
         single target
```

Directory, list, source, and collection plans run as batches. Everything else is a single-item run.

## Input Routing

Extract and write classify each single target and each planned batch item:

```
target
  |
  v
input family
  |
  +--> media        local media, direct media URL, streaming URL
  +--> document     PDF, EPUB, image, Office, ODF, ebook, archive, RTF, CSV
  +--> html_article remote article URL or local/remote HTML
  +--> x_space      X/Twitter Space or post route
  +--> unsupported  unsupported extension, missing file, invalid route
  |
  v
document format hint when needed
  |
  v
Step 2 route + extract route + supported/skipReason
```

Extract route mapping:

| Input family   | Step 2 route                      | Extract route                            |
| -------------- | --------------------------------- | ---------------------------------------- |
| `media`        | STT                               | `media`                                  |
| `document`     | OCR or native document extraction | `document`                               |
| `html_article` | URL/article extraction            | `article`                                |
| `x_space`      | none; dedicated X Space route     | `x-space`                                |
| `unsupported`  | none                              | skipped in batch, usage error for single |

The document family includes `.pdf`, `.epub`, `.docx`, `.pptx`, `.xlsx`, `.odt`, `.ods`, `.odp`, `.mobi`, `.prc`, `.azw3`, `.azw`, `.fb2`, `.lit`, `.cbz`, `.rtf`, `.csv`, and image files `.png`, `.jpg`, `.jpeg`, `.tif`, `.tiff`, `.webp`, `.bmp`, `.gif`. Local `.html`/`.htm` files classify as `html_article`. `.acsm` is unsupported.

## Command Matrix

| Family         | `metadata`            | `download`                     | `extract`                 | `write`                                   |
| -------------- | --------------------- | ------------------------------ | ------------------------- | ----------------------------------------- |
| Media          | metadata only         | download/stage media           | STT route                 | STT + LLM                                 |
| Document/image | metadata only         | download/copy document         | OCR/native document route | OCR/native document + LLM                 |
| HTML/article   | metadata only         | article prep/download metadata | URL/article route         | URL/article + LLM                         |
| X Space        | X API metadata lookup | Space audio download           | X Space route             | X Space report + LLM                      |
| Text input     | unsupported           | unsupported                    | unsupported               | `--text-input`, project, or auto-detected |

Unsupported batch items stay in the parent manifest with item `status: "skipped"` and a `metadata.skipReason`. They are not sent to child batch execution.

## Batch Manifests

Every batch root writes the same `manifest.json` used by a single run. Source-backed batch data is the optional top-level `source` object.

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

Each runnable parent item links to its child through `{ route, index, manifestDir }`. `manifestDir` names the child directory relative to the parent root, never a manifest filename.

## Entry Points

| Source                    | Item discovery                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| Directory                 | Input files in the directory, plus optional `input/2-urls.md`.                               |
| Input list                | Line parser for `.md`/`.txt`, markdown links, bullets, and relative paths.                   |
| Podcast or YouTube source | Feed/channel/source enumeration stored in the canonical manifest's optional `source` object. |
| YouTube collection        | Playlist/channel collection expansion.                                                       |
| Text-input write          | Raw text source files for `write --text-input`.                                              |
| Single item               | Route resolved from the input family.                                                        |
