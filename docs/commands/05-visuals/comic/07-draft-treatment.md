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
  - [Walkthrough: camp-manzanita](#walkthrough-camp-manzanita)

## draft-treatment

### Options

| Flag | Description | Default |
| --- | --- | --- |
| `--panel-count <n\|min-max>` | Number of panels to fit the treatment into, from 1 through 60: an exact count such as `10` or a range such as `20-25` that lets the model choose the natural beat count | `10` |
| `--voice-pacing <pacing>` | `exclusive` gives every panel one voice and groups consecutive panels into narration and speech runs; `mixed` lets a panel carry narration and dialogue together | `exclusive` |
| `--episode <NN>` | Two-digit episode number that selects `input/scripts/<NN>-script/` | next unused number |
| `--scene <SC>` | Two-digit scene prefix for the generated script filename | `01` |
| `--slug <text>` | Kebab-case script slug | treatment title without the word "treatment" |
| `--speaker <key>` | Character key whose quoted lines become dialogue instead of narration; repeatable | none, so every panel is narration only |
| `--style-seed <filename>` | PNG filename under `input/characters/` written as every new character's `generationReference` | `<slug>--style-seed.png` |
| `--catalog-policy <policy>` | `skip-existing` keeps an existing catalog key as authored and reports it; `fail` aborts before writing catalogs or the script | `skip-existing` |
| `--force` | Overwrite an existing script at the target path | `false` |
| `--llm-model <model>` | Text model for the drafting call | `gpt-5.6-sol` |
| `--concurrency-mode <ramp\|immediate>` | Approach the hosted LLM lane from one request (`ramp`) or start at the configured cap (`immediate`) | `ramp` |
| `--price` | Estimate the drafting call without provider calls or writes | `false` |

Global `--output-dir <path>` pins the treatment run directory. Global `--characters-root <path>` selects the character catalog root; the location catalog is its sibling `locations` directory.

### Examples

```bash
bun autoshow comic draft-treatment input/camp.md --episode 02 --speaker papa-bear --price
bun autoshow comic draft-treatment input/camp.md --episode 02 --speaker papa-bear
bun autoshow comic draft-treatment input/camp.md --panel-count 20-25 --speaker papa-bear --force
bun autoshow comic draft-treatment input/camp.md --panel-count 8 --slug camp-manzanita --style-seed camp-manzanita--style-seed.png --voice-pacing mixed
bun autoshow comic draft-treatment input/camp-manzanita-treatment.pdf --episode 02 --speaker papa-bear --catalog-policy fail
```

### Behavior

- `<treatment-path>` is a `.md`, `.txt`, or `.pdf` file. Markdown and text are read as-is and `--- Page N ---` markers count as pages. A PDF is extracted locally with `mutool`, so PDF input costs nothing extra and never calls an OCR provider.
- The style seed PNG named by `--style-seed` must already exist under the characters root. Generate the seed with [`image`](../image/overview.md) and copy it into `input/characters/` first.
- The draft includes story and scene titles, a shared style paragraph, the characters and locations the panels need, and a panel list whose length satisfies `--panel-count`. Each panel has a visual note, narration, any dialogue for `--speaker` characters, and the treatment excerpt it adapts. Validation checks the count and numbering, that every panel has narration or dialogue, that every dialogue speaker is an allowed `--speaker` key, that every location slugline reads like `EXT. PLACE - NIGHT` and resolves to its own key, and that names and aliases identify exactly one character. One failed check retries once; a second failure is saved as `treatment.invalid.json` and the command exits non-zero without touching `input/`.
- With `--voice-pacing exclusive`, each panel has one voice and consecutive panels form runs: a speaker's long passage is split across several dialogue panels with fresh visuals and no narration between them, and narration hands off into a speech run and picks up the frame story afterwards without restating the speech. Validation rejects a panel that carries both voices, a panel that mixes speakers, and a script whose voice changes more than one third of the panel count. `--voice-pacing mixed` lets a panel carry narration and dialogue together. The run summary reports the drafted panel count and the number of voice changes.
- The script is written to `input/scripts/<episode>-script/<scene>-<slug>.md`. The command refuses to overwrite an existing file without `--force` and refuses a target whose `<episode>-<scene>` shorthand would match more than one file. With no `--episode`, the next unused two-digit episode number is chosen.
- The command checks that the rendered script parses against the merged catalogs before writing catalogs or the script.
- `--price` reports up to two calls with 1,200 fixed output units plus 260 units per panel at the range maximum; it performs no provider call and writes nothing.

### Emitted script shape

Narration is written under a `**NARRATION**` label, which [`generate-audio`](./04-generate-audio.md) casts to the `role:narrator` voice. Quoted lines from `--speaker` characters become dialogue under the character's uppercase catalog name. A bold slugline opens the scene and is repeated whenever the location changes. With the default exclusive pacing each panel carries one voice, so a narration panel leads into a run of speech panels:

```markdown
# Episode 02: Camp Manzanita

**Treatment: input/camp.md**

---

## Scene 1: The Legend of Charleston VanDenFord

**EXT. CAMP MANZANITA FIREPIT - NIGHT**

[Panel 1: PAPA BEAR stands by the firepit while the campers gather on log benches.]

**NARRATION**
By the flicker of the fire, Papa Bear leans toward the campers and begins the history of the camp.

[Panel 2: PAPA BEAR raises his walking stick toward the dark pines.]

**PAPA BEAR**
The Camp Manzanita we know and love is nestled deep in the forest.

**EXT. VANDENFORD MINING CAMP - DAY**

[Panel 3: Prospectors pan the river below timber-framed mine shafts.]

**PAPA BEAR**
But in the 1850s this forest was the heart of the gold rush.
```

### Catalog merge

- New characters are appended to `input/characters/characters-reference.json` with the style seed as `generationReference` and the drafted description, aliases, and wardrobe. Existing entries are never modified. An alias that already belongs to another character, or that two new characters both claim, is dropped and listed in the merge report.
- New locations are appended to `input/locations/locations-reference.json` with the canonical slugline as their first alias and the shared style paragraph in the specification. The catalog's `styleImage` is set to the style seed when the catalog is created or when its current style image is missing on disk; otherwise it is kept and reported.
- With `--catalog-policy skip-existing`, a drafted key that already exists is skipped and reported. With `--catalog-policy fail`, an existing key or a colliding alias aborts the command before writing catalogs or the script.
- Run [`reference-sketch`](./02-reference-sketch.md) for every added character and location before building panel prompts; the merge report lists the exact commands.

### Artifacts

```text
output/<YYYY-MM-DD_HH-MM-SS-mmm>_<slug>-treatment/
  metadata/treatment/
    source.<ext>
    source.txt
    prompt.md
    response-attempt-N.json
    treatment.json
    treatment.invalid.json            # only when both attempts fail
    structured-script.preview.json
    script.md
    merge-report.json
    merge-report.md
input/scripts/<episode>-script/<scene>-<slug>.md
input/characters/characters-reference.json
input/locations/locations-reference.json
```

### Walkthrough: camp-manzanita

This walkthrough drafts `input/camp.md` into episode 02 with a narrator plus Papa Bear's spoken legend, fitting the treatment into 20-25 panels. Generate the style seed first. Every paid step accepts `--price` first.

```bash
# 1. Style seed for every camp character and location (paid image call)
bun autoshow image "<campfire comic style reference, no people>" --provider openai=gpt-image-2.5-sunburst --size 1536x1024 --quality high --format png --count 1 --output-dir output/camp-manzanita-style-seed
cp output/camp-manzanita-style-seed/generated-image.png input/characters/camp-manzanita--style-seed.png

# 2. Draft the script and catalog entries
bun autoshow comic draft-treatment input/camp.md --episode 02 --speaker papa-bear --panel-count 20-25 --price
bun autoshow comic draft-treatment input/camp.md --episode 02 --speaker papa-bear --panel-count 20-25
```

Continue with [`draft-scenes`](./01-draft-scenes.md) as `02-01`, passing `--panel-count` matching the drafted count from the run summary. See the [`comic` overview](./00-comic-overview.md) for the rest of the pipeline.

Next: [draft-scenes](./01-draft-scenes.md).
