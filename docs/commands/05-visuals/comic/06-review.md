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

| Flag             | Description                                                                                | Default |
| ---------------- | ------------------------------------------------------------------------------------------ | ------- |
| `--export-doc`   | Write the HTML sheet and a shared-document export; cannot be combined with `--notes`       | `false` |
| `--notes <path>` | Process a Markdown notes file with `### Panel NN` headings instead of generating the sheet | none    |

With neither option, the command writes the HTML review sheet. An empty `--notes` path, or `--notes` combined with `--export-doc`, is rejected. Neither mode rewrites the script, the scene JSON, or the structured script. Notes processing requires the character catalog; the sheet does not.

### Examples

Use the variables and fresh workspace from the [Harborlight setup](./00-comic-overview.md#setup). These examples share the same four-panel scene.

Prerequisite: the reviewed Harborlight scene. A sheet can show a missing-image notice; publishing an illustrated review or generating a slideshow additionally needs actual canonical panels from the [explicit local publication step](./00-comic-overview.md#4-build-panel-prompts-generate-images-and-review). Generated nested candidates alone do not populate the sheet. Supplied notes are an authored mapping exercise, not observed hosted-image defects.

```bash
bun --no-env-file autoshow comic review "$SCRIPT" --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic review "$SCRIPT" --export-doc --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic review "$SCRIPT" --notes "$ROOT/review-notes.md" --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Inspect mapped/unmatched/unresolved entries. Only paste directives you accept into the copied runtime script, then use the pinned [reconcile pass](./01-draft-scenes.md#reconcile-from-directives). Notes processing itself changes neither source nor scene.

### Review sheet

- The sheet is a self-contained HTML file you can open locally.
- Each panel section shows the source segments, description, shot plan, characters, speech, the stage board when `metadata/blocking/panel-NN.svg` exists (or a note that the scene has no blocking plan), and `panels/panel-NN.png` when that image is promoted.
- The QA section shows whatever evidence was kept for the panel. When none was kept, it reads `QA evidence not retained`.
- The notes box under each panel collects into the `### Panel NN` format that [`comic review --notes`](#notes-processing) reads back.
- `--export-doc` writes `metadata/review/export-doc.md` with one `### Panel NN` heading per panel, the promoted image or a line that none is promoted, and a blank paragraph so notes added in a shared document stay under that panel.

#### Output

`metadata/review/review-sheet.html`, and `metadata/review/export-doc.md` when `--export-doc` is set. Each file is rewritten in place on the run that writes it.

### Notes processing

- The notes file is plain Markdown. Every `### Panel NN` heading opens a section, and the prose under it until the next heading is that panel's note. A section with no prose is ignored. A file with no remaining note text is rejected. A note whose panel number is not in the scene is reported as unmatched.
- Each note is tied to that panel's first beat and the script line for that beat. A line that cannot be found is reported as unresolved.
- The command writes `metadata/review/review-notes-<run-id>.md`.

#### Classification

Each note takes the first matching row below, from top to bottom.

| Kind         | Directive        | Keywords                                                                                                                                           |
| ------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `axis-break` | `**BREAK-180:**` | axis, 180, line of action, cross the line, reverse angle, flipped sides, swapped sides, side flip                                                  |
| `costume`    | `**COSTUME:**`   | wardrobe, costume, outfit, uniform, jumpsuit, coverall, loincloth, hoodie, jacket, vest, hat, helmet, wearing, dressed, clothes                    |
| `extras`     | `**EXTRAS:**`    | extras, crowd, background people, background characters, background figures, ensemble, bystanders, villagers, onlookers, deck crew                 |
| `camera`     | `**CAMERA:**`    | camera, shot, angle, framing, frame, close-up, wide, medium, zoom, crop, lens, over-the-shoulder, ots, elevation, eye level, low angle, high angle |
| `blocking`   | `**BLOCKING:**`  | everything else                                                                                                                                    |

#### Output

`metadata/review/review-notes-<run-id>.md` lists the mapped notes, any unmatched notes, and one paste-ready directive per mapped note. The same directive lines are printed to the terminal.

Headers are filled from the panel when known, and left as placeholders you must fill:

- `**BLOCKING:** {state: <state-id>, location: <panel location key>}` — fill in the stage state id.
- `**CAMERA:** {panel: <panel number>}` and `**BREAK-180:** {panel: <panel number>}`.
- `**COSTUME:** {character: <key>}` — the character the note names when the catalog recognizes one, preferring a key the panel already lists, otherwise the panel's first character, otherwise `<character-key>`.
- `**EXTRAS:** {group: <ensemble-key>}` — always a placeholder.

Paste each directive into the source script immediately after its target beat. See [reconcile from directives](./01-draft-scenes.md#reconcile-from-directives) for how `draft-scenes --reconcile-from-directives` applies camera, axis-break, costume, and extras directives.

Next: [comic overview](./00-comic-overview.md).
