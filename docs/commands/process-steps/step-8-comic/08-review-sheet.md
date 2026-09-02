# comic review-sheet

`review-sheet` builds a static per-panel review sheet for a scene: one section per reviewed panel with its source segments, its contract, its stage board, its canonical image, its QA evidence, and a notes box. It reads only local artifacts and makes no provider call.

See the [`comic` overview](./00-comic-overview.md) for catalogs, runtime paths, and the full walkthrough.

## Outline

- [review-sheet](#review-sheet)
  - [Options](#options)
  - [Examples](#examples)
  - [Behavior](#behavior)
  - [Output](#output)

## review-sheet

### Options

| Flag           | Description                                                                                                                      | Default |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--export-doc` | Also write `metadata/review/export-doc.md` with one `### Panel NN` heading and image line per panel for a shared document         | `false` |

### Examples

```bash
bun autoshow comic review-sheet 02-01
bun autoshow comic review-sheet 02-01 --export-doc
bun autoshow comic review-sheet input/scripts/02-script/01-mandatory-meeting.md
```

### Behavior

- The sheet is one self-contained HTML file: inline CSS, no external stylesheet, script, font, or image host, and one small inline script that collects the notes boxes. It loads nothing from the network and generates nothing.
- Each panel section shows the panel's source-segment text from `metadata/structured-script.json`, its `description`, prose `shotPlan`, `characterKeys`, and speech from `metadata/scene.json`, the stage board inlined from `metadata/blocking/panel-NN.svg` when a blocking plan exists (and an explicit no-plan placeholder when it does not), and the canonical `panels/panel-NN.png` as a relative `<img>` when one is promoted.
- QA evidence is read from a retained `panels/page-qa-report.json`: the attempt count from the panel's attempts directory, the hard-failure keys, the repair route including a `blocking-class` or `repeated-hard-failure` restart reason, and the resulting lineage. When no report was retained the section reads `QA evidence not retained`, which is the normal state after a successful run is cleaned up.
- The notes box under each panel collects into the exact `### Panel NN` format that [`comic review-notes`](./07-review-notes.md) reads back, so a review pass round-trips without retyping panel numbers.
- `--export-doc` writes `metadata/review/export-doc.md`: one `### Panel NN` heading per panel, the image line, and a blank paragraph after each image so notes typed in a shared document still map to panel numbers.

### Output

`metadata/review/review-sheet.html`, plus `metadata/review/export-doc.md` with `--export-doc`. Both are rewritten in place on every run; neither is versioned by run id, because they are a current view of the scene rather than evidence.

Next: [comic overview](./00-comic-overview.md).
