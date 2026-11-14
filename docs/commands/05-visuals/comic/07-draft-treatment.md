# comic draft-treatment

Adapt `.md`, `.markdown`, `.txt`, or searchable PDF treatments into a panel-validated episode script and merged catalogs. PDF text extraction is local; drafting is hosted. The generated script then enters [the comic workflow](./00-comic-overview.md#walkthrough-harborlight).

## Options

- `--panel-count N|min-max`: 1–60 panels, default 10.
- `--voice-pacing exclusive|mixed`: default exclusive. Exclusive gives each panel one voice in consecutive narration/speech runs; mixed permits both.
- `--speaker <key>`: repeatable/comma-separated character keys whose quoted speech becomes dialogue. Without it, all panels use narration.
- `--episode NN`: defaults above the highest existing two-digit episode, starting at 01. `--scene` defaults 01; `--slug` defaults to the treatment title without “treatment”. Output: `input/scripts/<episode>-script/<scene>-<slug>.md`.
- `--style-seed <filename>`: existing PNG under the characters root, default `<slug>--style-seed.png`.
- `--catalog-policy skip-existing|fail`: default skip-existing. Existing catalog keys stay authored; fail aborts on collisions before publishing.
- `--force`: overwrite an existing target script; preserve earlier work first. Ambiguous episode/scene shorthand is still rejected.
- `--provider provider[=model]`: default `openai=gpt-6.1-sol`; hosted mode defaults ramp.
- `--price`: estimate drafting plus one validation retry, without calls/writes. It does not establish generated catalog compatibility or validate every execution prerequisite.

`--characters-root` selects character catalogs and sibling locations. `--output-dir` pins the treatment run, separately from its generated script destination.

## Examples

This optional upstream branch adapts the longer [Harborlight treatment](../../../../input/examples/harborlight-README.md) into 20–25 panels. It cannot reuse the four-panel walkthrough's downstream artifacts. Prepare an isolated catalog and unused script destination:

```bash
bun --no-env-file src/tools/prepare-harborlight-comic.ts --root runtime/examples/harborlight-comic-treatment
bun --no-env-file -e 'const { copyFile, constants } = await import("node:fs/promises"); await copyFile("input/examples/comic/harborlight-camp--style-seed.png", "runtime/examples/harborlight-comic-treatment/characters/harborlight-camp--style-seed.png", constants.COPYFILE_EXCL)'
bun --no-env-file autoshow comic draft-treatment input/examples/comic/harborlight-camp-treatment.md --episode 02 --scene 02 --slug harborlight-camp-treatment --speaker papa-bear --speaker mira --panel-count 20-25 --characters-root runtime/examples/harborlight-comic-treatment/characters --style-seed harborlight-camp--style-seed.png --config-path runtime/examples/harborlight-comic-treatment/empty-config.json --price
```

Choose another episode/scene if the destination exists. Include drafting/retry and selected downstream work in the [related estimate](./00-comic-overview.md#cumulative-estimate). `--catalog-policy fail` examines provider-generated candidates, so a collision may still incur drafting charges.

## Behavior

Validate panel count, characters/locations, narration/dialogue policy, and rendered-script/catalog agreement before publishing. Invalid candidates get one retry; a second failure preserves catalogs/script and writes `metadata/treatment/treatment.invalid.json`. Exclusive pacing splits long speech across panels without repeating it as narration. Pass the generated panel count to `draft-scenes --panel-count`.

## Emitted script shape

A bold slugline opens each location; panels have authored notes followed by `**NARRATION**` or a selected speaker's catalog name:

```markdown
**EXT. HARBORLIGHT CAMPSITE - DUSK**

[Panel 1: MIRA points toward the lantern map.]

**MIRA**
Is that a path or a fold in the paper?
```

## Catalog merge

Append new character descriptions, aliases, wardrobe, and the style seed as `generationReference`; preserve existing entries. Drop/report aliases already owned elsewhere or shared by new characters; fail policy rejects these collisions before writes.

Append locations with canonical slugline aliases and specifications. Set `styleImage` only when creating the catalog or its current file is missing; otherwise retain it. These paths follow the selected catalog roots, not always `input/characters/` and `input/locations/`.

Generate/register [references](./02-reference-sketch.md) for added entries before panel prompts. The merge report lists required commands.

## Artifacts

The run's `metadata/treatment/` holds rendered `script.md`, `merge-report.md`, matching JSON, and an invalid candidate record when applicable. The published script and selected character/location catalogs remain outside the run.

## Walkthrough: harborlight-camp

Review the new script and catalogs, then follow the [main sequence](./00-comic-overview.md#walkthrough-harborlight) using its actual script path/count and a fresh pinned run. Preserve the original four-panel example.
