# comic review

Build a local per-panel review sheet, or map supplied reviewer notes to paste-ready staging directives. Both modes read existing scene artifacts and make no provider calls.

See the [`comic` overview](./00-comic-overview.md) for catalogs, runtime paths, and the full walkthrough.

## Outline

- [review](#review)
  - [Options](#options)
  - [Examples](#examples)
  - [Review sheet](#review-sheet)
  - [Notes processing](#notes-processing)

## review

### Options

| Flag | Description | Default |
| --- | --- | --- |
| `--export-doc` | Write the HTML sheet and a shared-document export; cannot be combined with `--notes` | `false` |
| `--notes <path>` | Process a Markdown notes file with `### Panel NN` headings instead of generating the sheet | none |

With neither option, the command writes the HTML review sheet. `--notes` selects notes processing only. Empty notes paths and combining `--notes` with `--export-doc` are rejected. There is no `--price` mode because both operations are local. Neither mode rewrites the script or runs generation. Notes processing uses the character catalog to fill costume keys; generating a sheet does not require that catalog.

### Examples

```bash
bun autoshow comic review 02-01
bun autoshow comic review 02-01 --export-doc
bun autoshow comic review 02-01 --notes review/pass-2.md
```

### Review sheet

- The sheet is a self-contained HTML file you can open locally. It does not load from the network.
- Each panel section shows the source-segment text, description, shot plan, characters, speech, the stage board when `metadata/blocking/panel-NN.svg` exists (or a no-plan placeholder), and the canonical `panels/panel-NN.png` when one is promoted.
- When QA evidence was retained, the sheet shows attempt count, hard failures, repair route, and lineage. Otherwise it reads `QA evidence not retained`, which is normal after a successful run is cleaned up.
- The notes box under each panel collects into the `### Panel NN` format that [`comic review --notes`](#notes-processing) reads back.
- `--export-doc` writes `metadata/review/export-doc.md`: one `### Panel NN` heading per panel, the image line, and a blank paragraph after each image so notes typed in a shared document still map to panel numbers.

#### Output

`metadata/review/review-sheet.html`, plus `metadata/review/export-doc.md` with `--export-doc`. Both are rewritten in place on every run.

### Notes processing

- The notes file is plain Markdown. Every `### Panel NN` heading opens a section, and the prose under it until the next heading is that panel's note. A section with no prose is ignored. A note whose panel number is not in the scene is reported as unmatched rather than dropped.
- Each note maps to its panel, then to that panel's first source beat, then to the matching script line. When no line matches, the line is reported as unresolved instead of guessed.
- The command writes `metadata/review/review-notes-<run-id>.md`. It never rewrites the script, the scene JSON, or the structured script.

#### Classification

Each note is classified by the first matching row of this table, evaluated top to bottom. A note that matches no keyword is a blocking note.

| Kind         | Directive          | Keywords                                                                                                              |
| ------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `axis-break` | `**BREAK-180:**`   | axis, 180, line of action, cross the line, reverse angle, flipped sides, swapped sides, side flip                      |
| `costume`    | `**COSTUME:**`     | wardrobe, costume, outfit, uniform, jumpsuit, coverall, loincloth, hoodie, jacket, vest, hat, helmet, wearing, dressed, clothes |
| `extras`     | `**EXTRAS:**`      | extras, crowd, background people, background characters, background figures, ensemble, bystanders, villagers, onlookers, deck crew |
| `camera`     | `**CAMERA:**`      | camera, shot, angle, framing, frame, close-up, wide, medium, zoom, crop, lens, over-the-shoulder, ots, elevation, eye level, low angle, high angle |
| `blocking`   | `**BLOCKING:**`    | everything else                                                                                                        |

#### Output

`metadata/review/review-notes-<run-id>.md` carries a summary table (panel, kind, target beat, script line, placeholders), an unmatched-notes list when any note failed to map, and one block per directive with the target beat, script file and line, beat text, the reviewer's words, and a fenced paste-ready directive. The same directive lines are printed to the terminal.

Headers are filled in from the panel where the panel already answers them, and left as an explicit placeholder where a person must decide:

- `**BLOCKING:** {state: <state-id>, location: <panel location key>}` — the stage state id is a placeholder because a note does not name one.
- `**CAMERA:** {panel: <panel number>}` and `**BREAK-180:** {panel: <panel number>}`.
- `**COSTUME:** {character: <key>}` — the character the note names when the catalog recognizes one (preferring a key the panel already lists), otherwise the panel's first character key, otherwise a `<character-key>` placeholder.
- `**EXTRAS:** {group: <ensemble-key>}` — the ensemble key is always a placeholder because a note names a crowd, not a catalog key.

Paste each directive into the source script immediately after its target beat. See [reconcile from directives](./01-draft-scenes.md#reconcile-from-directives) for how `draft-scenes --reconcile-from-directives` applies camera, axis-break, costume, and extras directives.

Next: [comic overview](./00-comic-overview.md).
