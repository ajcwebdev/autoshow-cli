# Input Routing & Batch Orchestration

How targets become single runs or batches.

## Outline

- [Target Planning](#target-planning)
- [Input Routing](#input-routing)
- [Command Matrix](#command-matrix)
- [Batch Layout](#batch-layout)

## Target Planning

```
command + target + flags
        |
        +--> write: <project>/text with prompt.md -> --text-input
        +--> write: a .md/.txt file that is not an input list -> --text-input
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
  |      if the directory basename is `input`, also read `2-urls.md`
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
  +--> html_article remote article URL or local HTML
  +--> x_space      X/Twitter Space or post
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

Local `.html`/`.htm` files classify as `html_article`. `.acsm` is unsupported. Supported document and image extensions are listed in [Types, Metadata & Output Layout](05-types-and-output.md#type-reference).

## Command Matrix

| Family         | `metadata`            | `download`                     | `extract`                 | `write`                                   |
| -------------- | --------------------- | ------------------------------ | ------------------------- | ----------------------------------------- |
| Media          | metadata only         | download/stage media           | STT route                 | STT + LLM                                 |
| Document/image | metadata only         | download/copy document         | OCR/native document route | OCR/native document + LLM                 |
| HTML/article   | metadata only         | article prep/download metadata | URL/article route         | URL/article + LLM                         |
| X Space        | X API metadata lookup | Space audio download           | X Space route             | X Space report + LLM                      |
| Text input     | unsupported           | unsupported                    | unsupported               | `--text-input`, project, or auto-detected |

Unsupported batch items stay in the parent manifest with item `status: "skipped"` and a `metadata.skipReason`.

## Batch Layout

Every batch root writes the same `manifest.json` used by a single run. Source-backed batches add an optional top-level `source` object. The full shape is in [Types, Metadata & Output Layout](05-types-and-output.md).

Non-extract batches keep item directories next to the parent `manifest.json`. Extract batches are partitioned by route, with child batches under `media/`, `document/`, `article/`, and `x-space/` when those routes are present:

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
