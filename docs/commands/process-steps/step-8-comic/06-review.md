# comic review

Build a local per-panel review sheet, or map supplied reviewer notes to paste-ready staging directives. Both modes read existing scene artifacts and make no provider calls.

See the [`comic` overview](./00-comic-overview.md) for catalogs, runtime paths, and the full walkthrough.

## Outline

- [review](#review)
  - [Options](#options)
  - [Examples](#examples)
  - [Review sheet](#review-sheet)
  - [Notes processing](#notes-processing)
  - [Deprecated aliases](#deprecated-aliases)

## review

### Options

| Flag | Description | Default |
| --- | --- | --- |
| `--export-doc` | Write the HTML sheet and a shared-document export; cannot be combined with `--notes` | `false` |
| `--notes <path>` | Process a Markdown notes file with `### Panel NN` headings instead of generating the sheet | none |

With neither option, the command writes the HTML review sheet. Supplying `--notes` selects notes processing only. Empty notes paths and combining `--notes` with `--export-doc` are rejected before artifact writes. Global output-directory controls remain available. There is no `--price` mode because both operations are local.

Only notes processing loads the character catalog. Generating a sheet does not require that catalog. Neither mode applies directives to authored scripts or runs generation.

### Examples

```bash
bun autoshow comic review 02-01
bun autoshow comic review 02-01 --export-doc
bun autoshow comic review 02-01 --notes review/pass-2.md
```

### Review sheet

- The sheet is one self-contained HTML file: inline CSS, no external stylesheet, script, font, or image host, and one small inline script that collects the notes boxes. It loads nothing from the network and generates nothing.
- Each panel section shows the panel's source-segment text from `metadata/structured-script.json`, its `description`, prose `shotPlan`, `characterKeys`, and speech from `metadata/scene.json`, the stage board inlined from `metadata/blocking/panel-NN.svg` when a blocking plan exists (and an explicit no-plan placeholder when it does not), and the canonical `panels/panel-NN.png` as a relative `<img>` when one is promoted.
- QA evidence is read from a retained `panels/page-qa-report.json`: the attempt count from the panel's attempts directory, the hard-failure keys, the repair route including a `blocking-class` or `repeated-hard-failure` restart reason, and the resulting lineage. When no report was retained the section reads `QA evidence not retained`, which is the normal state after a successful run is cleaned up.
- The notes box under each panel collects into the exact `### Panel NN` format that [`comic review --notes`](./06-review.md#notes-processing) reads back, so a review pass round-trips without retyping panel numbers.
- `--export-doc` writes `metadata/review/export-doc.md`: one `### Panel NN` heading per panel, the image line, and a blank paragraph after each image so notes typed in a shared document still map to panel numbers.

#### Output

`metadata/review/review-sheet.html`, plus `metadata/review/export-doc.md` with `--export-doc`. Both are rewritten in place on every run; neither is versioned by run id, because they are a current view of the scene rather than evidence.

### Notes processing

- The notes file is plain Markdown. Every `### Panel NN` heading opens a section, and the prose under it until the next heading is that panel's note. A section with no prose is ignored, and a note whose panel number is absent from `metadata/scene.json` is reported as unmatched rather than dropped.
- Each note is mapped to its panel in `metadata/scene.json`, then to that panel's first `sourceSegmentIds` entry in `metadata/structured-script.json`, which supplies the target beat, its beat index, its type, and its speaker label. The script line is located by matching the beat's `rawMarkdown` (or its text) in the source script; when no line matches, the line is reported as unresolved instead of guessed.
- The command reads `metadata/scene.json` and `metadata/structured-script.json` and writes `metadata/review/review-notes-<run-id>.md`. It never rewrites the script, the scene JSON, or the structured script, and it makes no LLM or image generation API call, so it has no `--price` mode.

#### Classification

Each note is classified by the first matching row of this table, evaluated top to bottom. A note that matches no keyword is a blocking note, because a stage mark is what a reviewer describes by default.

| Kind         | Directive          | Keywords                                                                                                              |
| ------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `axis-break` | `**BREAK-180:**`   | axis, 180, line of action, cross the line, reverse angle, flipped sides, swapped sides, side flip                      |
| `costume`    | `**COSTUME:**`     | wardrobe, costume, outfit, uniform, jumpsuit, coverall, loincloth, hoodie, jacket, vest, hat, helmet, wearing, dressed, clothes |
| `extras`     | `**EXTRAS:**`      | extras, crowd, background people, background characters, background figures, ensemble, bystanders, villagers, onlookers, deck crew |
| `camera`     | `**CAMERA:**`      | camera, shot, angle, framing, frame, close-up, wide, medium, zoom, crop, lens, over-the-shoulder, ots, elevation, eye level, low angle, high angle |
| `blocking`   | `**BLOCKING:**`    | everything else                                                                                                        |

#### Output

`metadata/review/review-notes-<run-id>.md` carries a summary table (panel, kind, target beat, script line, placeholders), an unmatched-notes list when any note failed to map, and one block per directive giving the target beat, the script file and line, the beat text, the reviewer's own words, the keywords that classified it, and a fenced paste-ready directive. The same directive lines are printed to the terminal.

Headers are filled in from the panel where the panel already answers them, and left as an explicit placeholder where a person must decide:

- `**BLOCKING:** {state: <state-id>, location: <panel location key>}` — the stage state id is a placeholder because a note does not name one.
- `**CAMERA:** {panel: <panel number>}` and `**BREAK-180:** {panel: <panel number>}`.
- `**COSTUME:** {character: <key>}` — the character the note itself names when the catalog recognizes one (preferring a key the panel already lists), otherwise the panel's first character key, otherwise a `<character-key>` placeholder.
- `**EXTRAS:** {group: <ensemble-key>}` — the ensemble key is always a placeholder because a note names a crowd, not a catalog key.

Paste each directive into the source script immediately after its target beat. Directives are parsed like `**SFX:**` blocks: they never become a beat or a coverage segment, and the structured-script parser stores them under `staging`. See [writing blocking notes](./01-draft-scenes.md) for how the blocking stage consumes them.

### Deprecated aliases

`comic review-sheet <script> [--export-doc]` and `comic review-notes <script> --notes <path>` remain callable for one compatibility release. They retain their original flags, validation, output artifacts, and result identifiers, and emit a deprecation notice. Their direct `--help` pages name the replacements; normal comic help lists `review`.

Use `comic review <script> [--export-doc]` or `comic review <script> --notes <path>` in new scripts. The canonical command identifies results as `comic review` and preserves the existing sheet and notes result payloads. Alias removal requires a later announced breaking CLI release.

Next: [comic overview](./00-comic-overview.md).
