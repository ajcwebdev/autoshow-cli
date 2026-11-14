# Input Routing and Batches

## Target Planning

```text
metadata / download / extract target
  |
  +--> directory ------------> collect files + optional input/2-urls.md
  +--> Markdown/text list ---> resolve paths and links
  +--> feed/channel/playlist -> expand selected entries
  +--> YouTube collection ---> enumerate videos
  +--> other ----------------> single target

write target
  |
  +--> directory ------------> collect and select .md/.txt files
  +--> local .md/.txt --------> one text item
  +--> list/URL/other format -> reject; extract first
```

Directory/list/collection plans remain batches even with one item; write uses a single run when one selected text file remains. A directory whose basename is `input` (case-insensitive) also reads `2-urls.md`.

Write's project lyric defaults apply to `<project>/text` or a file beneath it when the project has `prompt.md` or an explicit prompt file. See the [write guide](../commands/03-write/overview.md).

## Input Routing

```text
extract item
  +--> media ----------------> STT
  +--> document/image -------> native extraction or OCR
  +--> remote article/HTML -> article extraction
  +--> X Space/post/ID ------> X Space workflow
  +--> unsupported ----------> single: usage error; batch: skipped item
```

Unsupported batch items retain `status: "skipped"` and `metadata.skipReason`. Source identity and route survive into the work plan and manifest. [Extract routing](../commands/02-extract/overview.md#input-routing) lists supported formats.

## Command Matrix

`metadata` inspects sources, `download` acquires media or prepares source metadata, and `extract` produces text. Local prose belongs to `write`; extracted text is passed to it explicitly. Article extraction can use selected backends or all backends; local HTML executes only Defuddle.

## Batch Layout

```text
ordinary batch/                 extract batch/
  manifest.json                   manifest.json
  <item-output>/                  <route>/
                                    manifest.json
                                    <item-output>/
```

Extract partitions work under the routes present: `media/`, `document/`, `article/`, and `x-space/`. Parent items link to their child manifest through relative directories. Source-backed batches may also carry top-level `source` metadata. [Manifest and output ownership](05-types-and-output.md) is shared with single runs.
