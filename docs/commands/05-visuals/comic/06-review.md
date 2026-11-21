# comic review

Build a local review sheet of the current panel selection, preview a candidate image run beside it, or explicitly adopt that run's panels. Review reads existing scene artifacts without provider calls and never changes the source script or scene; there is no `--price` flag.

## Options

- No mode flag: write the HTML review sheet of the current selection.
- `--export-doc`: also write a shared-document export.
- `--run <image-run-id>`: show that image run's candidates beside the corresponding current selections. Use the run ID reported by [generate-images](./03-generate-images.md#outputs-and-selection).
- `--use`: adopt the named run's individual panel candidates as the selection; requires `--run`.
- `--panels all|range|list`: with `--use`, the panels to adopt. Omitted means every declared scene panel; a run that produced only some panels requires an explicit `--panels`.

The hidden `review-notes` and `review-sheet` aliases and the `--notes` option are retired and rejected.

## Examples

Use [setup](./00-comic-overview.md#setup) variables and a reviewed scene. Panels selected automatically during generation appear without any publication step.

```bash
bun --no-env-file autoshow comic review "$SCRIPT" --export-doc --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic review "$SCRIPT" --output-dir "$RUN" --run "$IMAGE_RUN"
bun --no-env-file autoshow comic review "$SCRIPT" --output-dir "$RUN" --run "$IMAGE_RUN" --use --panels 3
```

The second command previews run `$IMAGE_RUN` against the current selection; the third replaces only panel 3. `--use` does not require a prior preview.

## Review sheet

`metadata/review/review-sheet.html` shows panel sources, description, shot, cast, speech, and the selected image. With `--run`, review reads each individual panel candidate and compares its current PNG checksum and dimensions with the run record before displaying it. The sheet identifies missing, changed, or unreadable candidates for each panel. Grouped pages and grids appear with their panel ranges. `--export-doc` also writes `metadata/review/export-doc.md` with image links and note space under `### Panel NN` headings. Files are replaced in place; keep the relative run layout when sharing the HTML. The sheet, preview, and export never change any selection.

## Adopting candidates

`--use` resolves the run with the same verified lookup as preview, then checks every requested panel before replacing any: the candidate must be an individual final panel of that run inside the scene workspace, with its recorded hash and dimensions matching the selected set. Unknown or ambiguous runs, missing panels, stale hashes, mismatched dimensions, and grouped pages or grids are rejected without changing the selection. Prior selected bytes and provenance are preserved, and repeating the same `--use` is a no-op.

Adoption is local. The next [slideshow](./05-generate-slideshow.md) render uses the replaced panels and reuses existing audio.
