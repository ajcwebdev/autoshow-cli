# comic review-notes

`review-notes` maps a Markdown review-notes file onto the reviewed panels of a scene and emits paste-ready staging directives. It reads only local artifacts and makes no provider call.

See the [`comic` overview](./00-comic-overview.md) for catalogs, runtime paths, and the full walkthrough.

## Outline

- [review-notes](#review-notes)
  - [Options](#options)
  - [Examples](#examples)
  - [Behavior](#behavior)
  - [Classification](#classification)
  - [Output](#output)

## review-notes

### Options

| Flag             | Description                                                                                     | Default  |
| ---------------- | ----------------------------------------------------------------------------------------------- | -------- |
| `--notes <path>` | Markdown review-notes file whose `### Panel NN` headings hold the notes for each reviewed panel | required |

### Examples

```bash
bun autoshow comic review-notes 02-01 --notes docs/plans/episode-2-review-notes.md
bun autoshow comic review-notes input/scripts/02-script/01-mandatory-meeting.md --notes review/pass-2.md
```

### Behavior

- The notes file is plain Markdown. Every `### Panel NN` heading opens a section, and the prose under it until the next heading is that panel's note. A section with no prose is ignored, and a note whose panel number is absent from `metadata/scene.json` is reported as unmatched rather than dropped.
- Each note is mapped to its panel in `metadata/scene.json`, then to that panel's first `sourceSegmentIds` entry in `metadata/structured-script.json`, which supplies the target beat, its beat index, its type, and its speaker label. The script line is located by matching the beat's `rawMarkdown` (or its text) in the source script; when no line matches, the line is reported as unresolved instead of guessed.
- The command reads `metadata/scene.json` and `metadata/structured-script.json` and writes `metadata/review/review-notes-<run-id>.md`. It never rewrites the script, the scene JSON, or the structured script, and it makes no LLM or image generation API call, so it has no `--price` mode.

### Classification

Each note is classified by the first matching row of this table, evaluated top to bottom. A note that matches no keyword is a blocking note, because a stage mark is what a reviewer describes by default.

| Kind         | Directive          | Keywords                                                                                                              |
| ------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `axis-break` | `**BREAK-180:**`   | axis, 180, line of action, cross the line, reverse angle, flipped sides, swapped sides, side flip                      |
| `costume`    | `**COSTUME:**`     | wardrobe, costume, outfit, uniform, jumpsuit, coverall, loincloth, hoodie, jacket, vest, hat, helmet, wearing, dressed, clothes |
| `extras`     | `**EXTRAS:**`      | extras, crowd, background people, background characters, background figures, ensemble, bystanders, villagers, onlookers, deck crew |
| `camera`     | `**CAMERA:**`      | camera, shot, angle, framing, frame, close-up, wide, medium, zoom, crop, lens, over-the-shoulder, ots, elevation, eye level, low angle, high angle |
| `blocking`   | `**BLOCKING:**`    | everything else                                                                                                        |

### Output

`metadata/review/review-notes-<run-id>.md` carries a summary table (panel, kind, target beat, script line, placeholders), an unmatched-notes list when any note failed to map, and one block per directive giving the target beat, the script file and line, the beat text, the reviewer's own words, the keywords that classified it, and a fenced paste-ready directive. The same directive lines are printed to the terminal.

Headers are filled in from the panel where the panel already answers them, and left as an explicit placeholder where a person must decide:

- `**BLOCKING:** {state: <state-id>, location: <panel location key>}` — the stage state id is a placeholder because a note does not name one.
- `**CAMERA:** {panel: <panel number>}` and `**BREAK-180:** {panel: <panel number>}`.
- `**COSTUME:** {character: <key>}` — the character the note itself names when the catalog recognizes one (preferring a key the panel already lists), otherwise the panel's first character key, otherwise a `<character-key>` placeholder.
- `**EXTRAS:** {group: <ensemble-key>}` — the ensemble key is always a placeholder because a note names a crowd, not a catalog key.

Paste each directive into the source script immediately after its target beat. Directives are parsed like `**SFX:**` blocks: they never become a beat or a coverage segment, and the structured-script parser stores them under `staging`. See [writing blocking notes](./01-draft-scenes.md) for how the blocking stage consumes them.

Next: [comic overview](./00-comic-overview.md).
