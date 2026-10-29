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

The reviewed Harborlight scene is required. The sheet can show missing-image notices; to include images, publish canonical panels through the [local publication step](./00-comic-overview.md#4-build-panel-prompts-generate-images-and-review). Generated candidates alone do not populate the sheet.

```bash
bun --no-env-file autoshow comic review "$SCRIPT" --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic review "$SCRIPT" --export-doc --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic review "$SCRIPT" --notes "$ROOT/review-notes.md" --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Inspect mapped, unmatched, and unresolved entries. Paste only accepted directives into the copied script, refresh the saved structure, rebind the existing plan, then reconcile and rebuild panel prompts in the same pinned run. Follow the [reconcile example](./01-draft-scenes.md#examples); notes processing itself changes neither source nor scene.

### Review sheet

- The static HTML sheet opens locally and links panel images within the run directory. Keep that directory layout when sharing it.
- Each panel section shows source segments, description, shot plan, characters, speech, an available stage board, and the promoted `panels/panel-NN.png` image.
- The QA section shows whatever evidence was kept for the panel. When none was kept, it reads `QA evidence not retained`.
- The notes box under each panel collects into the `### Panel NN` format that [`comic review --notes`](#notes-processing) reads back.
- `--export-doc` writes one `### Panel NN` heading per panel, the promoted image or a missing-image notice, and space for notes beneath it.

#### Output

`metadata/review/review-sheet.html`, and `metadata/review/export-doc.md` when `--export-doc` is set. Each file is rewritten in place on the run that writes it.

### Notes processing

- The notes file is plain Markdown. Each `### Panel NN` heading opens a note section; another heading of level 1–3 ends it. Empty sections are ignored, and a file with no note text is rejected. Unknown panel numbers are reported as unmatched.
- Each note targets that panel's first source segment and its script line. A line that cannot be found is reported as unresolved.

#### Classification

Each note takes the first matching kind below, from top to bottom. These are representative cues rather than a semantic assessment of the note.

| Kind         | Directive        | Typical wording                       |
| ------------ | ---------------- | ------------------------------------- |
| `axis-break` | `**BREAK-180:**` | axis, crossed the line, swapped sides |
| `costume`    | `**COSTUME:**`   | wardrobe, costume, wearing            |
| `extras`     | `**EXTRAS:**`    | extras, crowd, background people      |
| `camera`     | `**CAMERA:**`    | camera, framing, close-up             |
| `blocking`   | `**BLOCKING:**`  | everything else                       |

#### Output

`metadata/review/review-notes-<run-id>.md` lists the mapped notes, any unmatched notes, and one paste-ready directive per mapped note. The same directive lines are printed to the terminal.

Headers use available panel and catalog values; fill any remaining placeholders:

- `**BLOCKING:** {state: <state-id>, location: <panel location key>}` — fill in the stage state id.
- `**CAMERA:** {panel: <panel number>}` and `**BREAK-180:** {panel: <panel number>}`.
- `**COSTUME:** {character: <key>}` — the character the note names when the catalog recognizes one, preferring a key the panel already lists, otherwise the panel's first character, otherwise `<character-key>`.
- `**EXTRAS:** {group: <ensemble-key>}` — always a placeholder.

Paste each directive into the source script immediately after its target beat. The [reconcile pass](./01-draft-scenes.md#reconcile-from-directives) applies camera, axis-break, costume, and extras directives from the refreshed structured script. General `**BLOCKING:**` notes require a reviewed plan change; reconcile does not translate their prose into character positions.

Next: [comic overview](./00-comic-overview.md).
