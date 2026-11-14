# comic review

Build a local review sheet or map supplied notes into staging directives. Both read existing scene artifacts without provider calls or source/scene mutation; there is no `--price` flag.

## Options

With no mode flag, write the HTML sheet. `--export-doc` adds a shared-document export. `--notes <path>` processes reviewer notes instead; empty paths or combining notes/export are rejected. Notes need the character catalog; the sheet does not.

## Examples

Use [setup](./00-comic-overview.md#setup) variables and a reviewed scene. [Publish canonical panels](./00-comic-overview.md#4-build-panel-prompts-generate-images-and-review) first if images should appear; nested candidates are not selected automatically.

```bash
bun --no-env-file autoshow comic review "$SCRIPT" --export-doc --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic review "$SCRIPT" --notes "$ROOT/review-notes.md" --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

## Review sheet

`metadata/review/review-sheet.html` shows panel sources, description, shot, cast, speech, stage board, canonical image, and retained QA. Missing images or QA are explicit. Notes collect under `### Panel NN` headings. `--export-doc` also writes `metadata/review/export-doc.md` with image links and note space. Files are replaced in place; keep relative run layout when sharing the HTML.

## Notes processing

A `### Panel NN` heading opens a note section; another heading at levels 1–3 ends it. Empty sections are ignored; no note text fails. Unknown panels are unmatched; unresolved script lines are reported. Each mapped note targets the panel's first source segment.

The first matching lexical cue chooses the directive:

- Axis/crossed-line/swapped-side wording → `**BREAK-180:** {panel: N}`.
- Wardrobe/costume/wearing → `**COSTUME:** {character: key}`.
- Extras/crowd/background people → `**EXTRAS:** {group: <ensemble-key>}`.
- Camera/framing/close-up → `**CAMERA:** {panel: N}`.
- Otherwise → `**BLOCKING:** {state: <state-id>, location: key}`.

This is cue matching, not semantic judging. Costume keys prefer recognized panel characters, then the panel's first character; unresolved values remain placeholders. Fill placeholders and review mappings before use.

`metadata/review/review-notes-<run-id>.md` records mapped/unmatched notes and paste-ready directives, also printed to the terminal. Paste accepted directives after their target source beat, refresh structure/rebind, then [reconcile and rebuild prompts](./01-draft-scenes.md#reconcile-from-directives). Reconcile handles camera, axis, costume, and extras; general blocking prose needs a reviewed plan edit.
