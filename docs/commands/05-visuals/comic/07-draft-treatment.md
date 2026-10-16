# comic draft-treatment

`draft-treatment` adapts a prose treatment into a fixed-count episode script and bootstraps the character and location catalog entries that script needs. It writes the script under `input/scripts/` for later `comic` stages.

See the [`comic` overview](./00-comic-overview.md) for catalogs, runtime paths, and the full walkthrough.

## Outline

- [draft-treatment](#draft-treatment)
  - [Options](#options)
  - [Examples](#examples)
  - [Behavior](#behavior)
  - [Emitted script shape](#emitted-script-shape)
  - [Catalog merge](#catalog-merge)
  - [Artifacts](#artifacts)
  - [Walkthrough: harborlight-camp](#walkthrough-harborlight-camp)

## draft-treatment

### Options

| Flag                                   | Description                                                                                                                                                      | Default                                      |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `--panel-count <n\|min-max>`           | Number of panels to fit the treatment into, from 1 through 60: an exact count such as `10` or a range such as `20-25`                                            | `10`                                         |
| `--voice-pacing <pacing>`              | `exclusive` gives every panel one voice and groups consecutive panels into narration and speech runs; `mixed` lets a panel carry narration and dialogue together | `exclusive`                                  |
| `--episode <NN>`                       | Two-digit episode number that selects `input/scripts/<NN>-script/`                                                                                               | next unused number                           |
| `--scene <SC>`                         | Two-digit scene prefix for the generated script filename                                                                                                         | `01`                                         |
| `--slug <text>`                        | Kebab-case script slug                                                                                                                                           | treatment title without the word "treatment" |
| `--speaker <key>`                      | Character key whose quoted lines become dialogue instead of narration; repeatable                                                                                | none, so every panel is narration only       |
| `--style-seed <filename>`              | PNG filename under the characters root written as every new character's `generationReference`                                                                    | `<slug>--style-seed.png`                     |
| `--catalog-policy <policy>`            | `skip-existing` keeps an existing catalog key as authored and reports it; `fail` aborts before writing catalogs or the script                                    | `skip-existing`                              |
| `--force`                              | Overwrite an existing script at the target path                                                                                                                  | `false`                                      |
| `--provider <provider[=model]>`        | Text model for the drafting call                                                                                                                                 | `gpt-5.6-sol`                                |
| `--concurrency-mode <ramp\|immediate>` | Start hosted work from one request (`ramp`) or at the configured cap (`immediate`)                                                                               | `ramp`                                       |
| `--price`                              | Estimate the drafting call without provider calls or writes                                                                                                      | `false`                                      |

Global `--output-dir <path>` pins the treatment run directory. Global `--characters-root <path>` selects the character catalog root; the location catalog is its sibling `locations` directory.

### Examples

This is an optional upstream **alternative** to the supplied four-panel script. It adapts the longer original [Harborlight treatment](../../../../input/examples/harborlight-README.md), with 24 story beats, into 20–25 panels. Its output must go through the complete pipeline again; it cannot reuse four-panel scene, panel, review, or audio artifacts.

Use an isolated catalog root and an unused script destination. The helper refuses an existing root; the exclusive copy refuses an existing seed. Existing Papa Bear and Mira catalog entries retain their original face/clothing designs rather than treating a people-free campsite seed as their likenesses.

```bash
bun --no-env-file src/tools/prepare-harborlight-comic.ts --root runtime/examples/harborlight-comic-treatment
bun --no-env-file -e 'const { copyFile, constants } = await import("node:fs/promises"); await copyFile("input/examples/comic/harborlight-camp--style-seed.png", "runtime/examples/harborlight-comic-treatment/characters/harborlight-camp--style-seed.png", constants.COPYFILE_EXCL)'
bun --no-env-file autoshow comic draft-treatment input/examples/comic/harborlight-camp-treatment.md --episode 02 --scene 02 --slug harborlight-camp-treatment --speaker papa-bear --speaker mira --panel-count 20-25 --characters-root runtime/examples/harborlight-comic-treatment/characters --style-seed harborlight-camp--style-seed.png --config-path runtime/examples/harborlight-comic-treatment/empty-config.json --price
```

Choose another unused episode/scene if `input/scripts/02-script/02-harborlight-camp-treatment.md` exists. Remove `--price` only after this drafting call, its possible retries, and the downstream chosen image/voice/audio scope are included in an accepted cumulative batch. The searchable PDF treatment is an alternative input, not a second required purchase.

For an optional catalog-policy quote, use the same isolated catalog with `--catalog-policy fail --price`. This prices the drafting call; it cannot predict the generated candidate and does not prove a collision will occur. Existing keys can be reused without collision. A candidate that tries to add an existing key or conflicting alias fails only after the provider response and before catalog/script writes. This is not an expected local pre-dispatch failure or a required stage. `--force` is a separate destructive overwrite choice and is excluded from the normal sequence; preserve the earlier script/run and review the exact destination before choosing it.

### Behavior

- `<treatment-path>` is a `.md`, `.txt`, or `.pdf` file. PDF text is extracted locally, so it costs nothing extra and never calls an OCR provider.
- The style seed PNG named by `--style-seed` must already exist under the characters root. Copy the bundled seed into the chosen demonstration characters root as above, or generate your own with [`image`](../image/overview.md).
- The draft includes story and scene titles, the characters and locations the panels need, and a panel list whose length satisfies `--panel-count`. Each panel has a visual note, narration, and any dialogue for `--speaker` characters. A failed draft retries once. If the second attempt fails, the command exits non-zero, leaves `input/` unchanged, and saves the issues as `metadata/treatment/treatment.invalid.json` in the run directory.
- With `--voice-pacing exclusive`, a long spoken passage is split across dialogue panels, and narration resumes afterward without restating that speech. The `treatment-script generated` line reports the drafted panel count and the number of voice changes. Pass that panel count to [`draft-scenes --panel-count`](./01-draft-scenes.md).
- The script is written to `input/scripts/<episode>-script/<scene>-<slug>.md`. The command refuses to overwrite an existing file without `--force`, and refuses a target whose `<episode>-<scene>` shorthand would match more than one file. With no `--episode`, the next unused two-digit episode number is chosen. Catalogs and the script are written together only after the rendered script matches the merged catalogs.
- `--price` estimates the drafting call, including one retry, without a provider call or writes.

### Emitted script shape

Narration is written under a `**NARRATION**` label. Quoted lines from `--speaker` characters become dialogue under the character's uppercase catalog name. A bold slugline opens the scene and is repeated whenever the location changes.

This illustrative script excerpt shows the format; it is not a captured provider result.

```markdown
# Episode 02: Harborlight Camp

**Treatment: input/examples/comic/harborlight-camp-treatment.md**

---

## Scene 1: The Lantern Map

**EXT. HARBORLIGHT CAMPSITE - DUSK**

[Panel 1: PAPA BEAR puts a teal enamel mug beside Mira's notebook.]

**NARRATION**
Mira and Papa Bear prepare to watch the first stars above the harbor.

[Panel 2: MIRA points toward a mark on the old lantern map.]

**MIRA**
Is that a path or a fold in the paper?

[Panel 3: PAPA BEAR holds the map toward the remaining light.]

**PAPA BEAR**
Let's look carefully before we decide.
```

### Catalog merge

- New characters are appended to `input/characters/characters-reference.json` with the style seed as `generationReference` and the drafted description, aliases, and wardrobe. Existing entries stay as authored. An alias that already belongs to another character, or that two new characters both claim, is dropped and listed in the merge report. `--catalog-policy fail` treats that collision like an existing key and aborts before any write.
- New locations are appended to `input/locations/locations-reference.json` with the canonical slugline as the first alias and the drafted style paragraph in `specification`. `styleImage` is set to the style seed when the catalog is created or the current file is missing on disk. An existing style image is kept, and the merge report says so.
- Run [`reference-sketch`](./02-reference-sketch.md) for every added character and location before building panel prompts. The merge report lists those commands.

### Artifacts

```text
output/<YYYY-MM-DD_HH-MM-SS-mmm>_<slug>-treatment/
  metadata/treatment/
    script.md
    merge-report.md
    merge-report.json
    treatment.invalid.json            # only when both attempts fail
input/scripts/<episode>-script/<scene>-<slug>.md
input/characters/characters-reference.json
input/locations/locations-reference.json
```

`merge-report.md` is the readable record of added keys, skipped keys, dropped aliases, and the `styleImage` action. `merge-report.json` is the same record for scripts.

### Walkthrough: harborlight-camp

Use the isolated treatment example above only if you want a newly generated longer script. Inspect every authored panel note and both speakers, then follow the [main workflow](./00-comic-overview.md#walkthrough-harborlight) with that new script path, its own catalogs and a fresh pinned run. Keep its actual panel count in every scene, QA, image and audio selection. The supplied four-panel source bundle remains the no-cost starting point for the maintained walkthrough.
