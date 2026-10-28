# Input Routing & Batch Orchestration

How `metadata`, `download`, `extract`, and `write` targets become single runs or batches.

## Outline

- [Target Planning](#target-planning)
- [Input Routing](#input-routing)
- [Command Matrix](#command-matrix)
- [Batch Layout](#batch-layout)

## Target Planning

`write` planning:

```
write
  |
  +--> URL, media, document, HTML, X Space, or .md/.txt input list: usage error naming extract
  +--> directory: collect .md/.txt files -> one selected file is a single item; more than one is a batch
  +--> other .md/.txt file: single text item
  +--> otherwise: usage error
```

Project lyric draft mode adds defaults when the target is `<project>/text` or a text file beneath it and the project has `prompt.md` or an explicit `--prompt-file`. See [write usage](../commands/03-write/overview.md#usage).

`metadata`, `download`, and `extract` planning:

```
target
  |
  +--> directory:
  |      collect input files
  |      if the directory basename is `input` in any case, also read `2-urls.md`
  |      -> batch
  |
  +--> .md/.txt input list:
  |      resolve relative paths and markdown links -> source-backed batch
  |
  +--> batch source:
  |      podcast feed, YouTube channel, or YouTube playlist -> source-backed batch
  |
  +--> YouTube collection:
  |      multi-video YouTube URL not resolved as a channel or playlist source -> batch
  |
  +--> fallback:
         single target
```

These directory, list, source, and collection plans run as batches even when they contain one item. `write` runs a single item when only one text file remains after selection.

## Input Routing

Extract classifies each single target and each planned batch item. Write does not classify extract routes; it accepts only local `.md` / `.txt` text:

```
target
  |
  v
input family
  |
  +--> media        local media, direct media URL, streaming URL
  +--> document     PDF, EPUB, image, Office, ODF, ebook, archive, RTF, CSV
  +--> html_article remote article URL or local HTML
  +--> x_space      X/Twitter Space, post, or raw Space ID
  +--> unsupported  unsupported extension, missing file, invalid route
  |
  v
extract route
```

| Input family   | Extract route | Processing                                        |
| -------------- | ------------- | ------------------------------------------------- |
| `media`        | `media`       | STT                                               |
| `document`     | `document`    | OCR or native document extraction                 |
| `html_article` | `article`     | URL/article extraction                            |
| `x_space`      | `x-space`     | X Space route                                     |
| `unsupported`  | none          | skipped in batch, usage error for a single target |

Supported document and image extensions are listed in [extract input routing](../commands/02-extract/overview.md#input-routing).

## Command Matrix

| Family         | `metadata`            | `download`                     | `extract`                 | `write`                                                                  |
| -------------- | --------------------- | ------------------------------ | ------------------------- | ------------------------------------------------------------------------ |
| Media          | metadata only         | download/stage media           | STT route                 | unsupported; extract first                                               |
| Document/image | metadata only         | document metadata only         | OCR/native document route | unsupported; extract first                                               |
| HTML/article   | metadata only         | article prep/download metadata | URL/article route         | unsupported; extract first                                               |
| X Space        | X API metadata lookup | Space audio download           | X Space route             | unsupported; extract first                                               |
| Text prose     | unsupported           | unsupported                    | unsupported               | local `.md`/`.txt`, including extract artifacts and project lyric drafts |

Unsupported extract batch items stay in the parent manifest with item `status: "skipped"` and a `metadata.skipReason`.

## Batch Layout

Every batch root writes the same `manifest.json` used by a single run. Source-backed batches add an optional top-level `source` object. The full shape is in [Types, Metadata & Output Layout](05-types-and-output.md).

`metadata`, `download`, and `write` batches keep item directories next to the parent `manifest.json`. Extract batches are partitioned by route, with child batches under `media/`, `document/`, `article/`, and `x-space/` when those routes are present:

```
output/YYYY-MM-DD_HH-MM-SS-mmm_<batch-label>/
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

Parent items that ran in a child batch include a `child` object pointing at that child directory.
