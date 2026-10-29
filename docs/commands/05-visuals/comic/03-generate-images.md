# comic generate-images

`generate-images` turns reviewed panel prompt bundles into optional black-and-white review sketches and final comic panel images.

See the [`comic` overview](./00-comic-overview.md) for catalogs, runtime paths, and the full walkthrough.

`bun autoshow comic generate-images --help-topic audit` lists the QA-only constraints. Audit mode does not generate, repair, or promote images.

## Outline

- [generate-images](#generate-images)
  - [Options](#options)
  - [Advanced Options](#advanced-options)
  - [Examples](#examples)
  - [Behavior](#behavior)
  - [Blooper ledger](#blooper-ledger)
  - [Conservative individual-panel repairs](#conservative-individual-panel-repairs)
  - [Revision evaluation mode](#revision-evaluation-mode)

## generate-images

### Options

| Flag                                   | Description                                                                                                                                                                                                                                                                   | Default                               |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `--target <target>`                    | `images`, `sketches`, or `both`                                                                                                                                                                                                                                               | `images`                              |
| `--panels <all\|range\|list>`          | Panels to process: `all`, a range like `1-8`, a list like `1,3,7`, or mixed like `1-4,9`; overlong contiguous ranges clamp to available panels                                                                                                                                | `all`                                 |
| `--provider-concurrency <n>`           | Number of image and QA requests (across panels, pages, models, and variations) to run in parallel                                                                                                                                                                             | `7`                                   |
| `--concurrency-mode <ramp\|immediate>` | Approach hosted image and QA work from one request per provider/account lane (`ramp`) or start at the configured cap (`immediate`)                                                                                                                                            | `ramp`                                |
| `-f, --force`                          | Regenerate image outputs only; never rewrite reviewed scene or prompt artifacts                                                                                                                                                                                               | `false`                               |
| `--qa` / `--no-qa`                     | Enable or disable final-image QA                                                                                                                                                                                                                                              | enabled                               |
| `--qa-only`                            | Judge existing canonical individual panels without generating, repairing, promoting, or changing image-manifest state                                                                                                                                                         | `false`                               |
| `--blocking-hard-keys <list>`          | Blocking audit statuses promoted from advisory to hard QA failures as a comma list of `side-swapped`, `depth-swapped`, `facing-wrong`, `posture-wrong`, `wardrobe-wrong`, `missing-on-mark`, `unlisted-on-stage`, `exposed-empty-mark`, `excluded-extra-present`, `axis-side` | none (every blocking status advisory) |
| `--blocking-layout-guide`              | Attach the compiled screen-space marker guide to dense single-panel blocking requests; experimental and incompatible with grouped pages or QA-only/revision mode                                                                                                              | `false`                               |
| `--continuity-qa`                      | Run the audit-only continuity judge beside the page judge; requires `--qa-only`                                                                                                                                                                                               | `false`                               |
| `--continuity-only`                    | Skip the page judge and run only the continuity judge; requires `--continuity-qa`                                                                                                                                                                                             | `false`                               |
| `--labels <path>`                      | Human continuity labels JSON in the `qa/continuity-labels.json` shape; adds per-key precision and recall to the continuity report and requires `--continuity-qa`                                                                                                              | none                                  |
| `--trusted-anchor-panel <n>`           | Panel number the continuity audit anchors on instead of the labels file value or panel 1; requires `--continuity-qa`                                                                                                                                                          | none                                  |
| `--revision-plan <path>`               | Run the bounded per-panel revision-evaluation workflow described below                                                                                                                                                                                                        | none                                  |
| `--promote <policy>`                   | Revision promotion policy; revision mode requires `clear-winners`                                                                                                                                                                                                             | none                                  |
| `--qa-provider <provider[=model]>`     | Vision judge model; QA supports OpenAI and Gemini vision-capable LLMs                                                                                                                                                                                                         | `openai=gpt-6.1-sol`                  |
| `--max-repairs <n>`                    | Non-negative integer limit of eligible repair attempts after the initial image                                                                                                                                                                                                | generation `2`; audit/revision `0`    |
| `--bloopers`                           | Copy non-promoted attempts from successful panel renders into `output/bloopers/` with provenance sidecars                                                                                                                                                                     | `false`                               |
| `--stop-on-provider-error`             | Abort the remaining panels on the first provider error instead of continuing; already written attempts are preserved and the run exits non-zero                                                                                                                               | `false`                               |
| `--credit-preflight`                   | Check OpenAI model-list access with a zero-cost request; credit and image-generation admission remain unverified. `--price` only reports the check                                                                                                                            | `false`                               |
| `--price`                              | Estimate API costs without making API calls                                                                                                                                                                                                                                   | `false`                               |

### Advanced Options

| Flag                            | Description                                                                                                                                       | Default                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `--provider <provider[=model]>` | Use one or more supported image models (see [Supported Models](./00-comic-overview.md#supported-models))                                          | `openai=gpt-image-2.5-flare` |
| `--variation <name[,name...]>`  | Generate final images with a comma-separated list of prompt variations: `canonical`, `animation-polish`, `cinematic-depth`                        | `canonical`                  |
| `--size <size>`                 | Image size: `1536x1024`, `1024x1024`, `1024x1536`, `auto`, or a custom `WIDTHxHEIGHT` size for GPT Image 2.5 (Flare/Sunburst)                     | `1536x1024`                  |
| `--quality <quality>`           | `low`, `medium`, `high`, or `auto`; Image 2.5 also supports `xhigh` and `max`. Only OpenAI applies this flag; other providers use their defaults. | `high`                       |
| `--panels-per-image <n>`        | Number of ordered panels per generated image; overrides both stage defaults                                                                       | final `1`; sketches `6`      |
| `--grid <columns>x<rows>`       | Compose generated individual final panels into local page grids, such as `2x3`; requires `--panels-per-image 1` and `--size 1536x1024`            | none                         |

### Examples

Use the variables and fresh workspace from the [Harborlight setup](./00-comic-overview.md#setup). These examples share the same four-panel scene.

Prerequisite: reviewed four-panel `scene.json`, current registered canonical references, and complete panel prompt bundles from the walkthrough. Generation and QA resolve the latest canonical files and descriptions directly without per-scene reference copies. Execute only the chosen image mode after the cumulative estimate. `sketches` followed by `images` is the main route; `both` is its combined alternative, not an extra required purchase.

```bash
bun --no-env-file autoshow comic generate-images "$SCRIPT" --target sketches --provider openai=gpt-image-2.5-flare --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-images "$SCRIPT" --target images --provider openai=gpt-image-2.5-flare --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-images "$SCRIPT" --target both --provider openai=gpt-image-2.5-flare --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-images "$SCRIPT" --target images --panels 1,3 --provider openai=gpt-image-2.5-flare --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-images "$SCRIPT" --grid 2x2 --panels-per-image 1 --provider openai=gpt-image-2.5-flare --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-images "$SCRIPT" --provider openai=gpt-image-2.5-flare --provider gemini=gemini-3.1-flash-lite-image --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-images "$SCRIPT" --variation animation-polish,cinematic-depth --provider openai=gpt-image-2.5-flare --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Grid, subset, multiple-model, and variation commands are optional price-only comparisons. Select at most the accepted alternatives; variation/page outputs are not automatically canonical slideshow panels.

After generation, inspect the selected `panels/<image-run-id>/` candidate files and use the [local canonical publication step](./00-comic-overview.md#4-build-panel-prompts-generate-images-and-review). The commands below read canonical `panels/panel-NN.png` files, not nested candidate runs.

#### Optional audit and revision prerequisites

Audit and revision commands require reviewed canonical images. QA-only can be priced once those images exist:

```bash
bun --no-env-file autoshow comic generate-images "$SCRIPT" --qa-only --max-repairs 0 --panels 1-4 --qa-provider openai=gpt-6.1-sol --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

For continuity evaluation, a reviewer must first author `$RUN/qa/continuity-labels.json` in the [validated labels schema](../../../../src/cli/commands/visuals/comic/comic-utils/continuity-labels.ts) against these actual panels. Confirm a real trusted anchor (panel 1 below), not an assumed correct image. The labels evaluate an audit; they are not a generation input or proof of quality.

```bash
bun --no-env-file autoshow comic generate-images "$SCRIPT" --qa-only --max-repairs 0 --continuity-qa --labels "$RUN/qa/continuity-labels.json" --trusted-anchor-panel 1 --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Revision evaluation also needs `$RUN/qa/revision-plan.json` with this scene's current input hashes, frozen issues, and correction notes for panels 2 and 4. See [revision evaluation mode](#revision-evaluation-mode) and its [validated plan schema/fingerprint helper](../../../../src/cli/commands/visuals/comic/comic-commands/generate-images/revision-plan-validation.ts). An empty template or another scene's plan is rejected. This bounded experiment reserves an edit and two comparisons per pending panel, and belongs in the cumulative estimate.

```bash
bun --no-env-file autoshow comic generate-images "$SCRIPT" --target images --panels 2,4 --provider openai=gpt-image-2.5-flare --qa-provider openai=gpt-6.1-sol --revision-plan "$RUN/qa/revision-plan.json" --max-repairs 0 --promote clear-winners --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

`--force` is a separate deliberate regeneration policy. Preserve the reviewed run and choose a copied compatible workspace before using it; it does not update the script or prompt bundle.

### Behavior

- Requires reviewed scene JSON and panel prompt bundles from `draft-scenes`.
- [`resume <run-directory> --price` and `resume <run-directory>`](../../00-setup-and-utilities/resume.md#comic-recovery) inspects an interrupted generation and continues it, reusing completed images. `--force`, audits, and revision evaluation stay explicit. An older incomplete run that lacks exact intent is left blocked.
- Sketch panel selections must be contiguous. Use `--target images` for a non-contiguous list such as `1,3,7`.
- `--panels-per-image` above 1 and `--grid` write page images under `pages/`. A `--grid` last page leaves unused cells blank.
- Every image run nests files under a run id: `panels/<run-id>/`, `pages/<run-id>/`, and `sketches/<run-id>/`. Multiple models add a `<model>` directory. `--variation` nests final images as `panels/<run-id>/<variation>/<model>/` and `pages/<run-id>/<variation>/<model>/`.
- With `--qa`, only passing new candidates are published; failed attempts remain available for inspection. A judge pass does not replace human review. See [Conservative individual-panel repairs](#conservative-individual-panel-repairs).
- `--qa-only` judges existing canonical individual panels and requires `--target images`, `--panels-per-image 1`, QA enabled, and `--max-repairs 0`. It rejects `--force`, grids, variations, grouped pages, image-generation options, the layout guide, and revision mode. Hard failures stay in the report. The run writes `qa/panel-audit-<run-id>/page-qa-report.{json,md}` and `qa-only-audit.json`. Canonical images and the scene manifest stay unchanged. Without continuity mode, each audit judges the selected panels again. `--price` counts judge calls only.
- `--continuity-qa` adds a continuity report for each selected panel on the same `--qa-provider`: axis, cast, screen side, posture, placement, wardrobe, and furniture against the location anchor and predecessor, plus a blooper category and a repair route. The audit writes findings only.
- Continuity anchors by location. `--trusted-anchor-panel` (or the labels file's `trustedAnchorPanel`) anchors every panel of that location, including after the scene leaves and returns. A location with no trusted panel anchors on its first panel in scene order. The predecessor is the previous panel in the same contiguous visit.
- A continuity run writes `qa/continuity-audit-<run-id>/` and extends `qa-only-audit.json`. `--continuity-only` skips the page judge and writes no `page-qa-report.{json,md}`. A saved page-QA entry is reused only when its judge model and complete current inputs match and it already includes continuity; the continuity judge still runs.
- `--labels` requires reviewed labels in the linked schema; an unfilled template is rejected. The report adds per-key precision and recall. `--price` adds one continuity judge call per selected panel, and `--continuity-only` omits the page-judge calls.
- A panel with a compiled blocking ledger is generated and judged from that ledger. Declared set anchors stay in frame; other anchors may be cropped. A character drawn into a panel that does not list them is `unlisted-on-stage`. A panel without a ledger is not blocking-audited.
- `--blocking-layout-guide` attaches `metadata/blocking/panel-NN-layout.png` for an individual panel whose ledger shows at least six visible named characters. Sparser panels skip it. `--price` counts the guide as a reference on the initial image and on each repair.
- A hard-failure set that includes a promoted blocking or axis check and only spatial failures regenerates the individual panel from canonical references instead of editing it. Other eligible failures use the edit path. A replacement is published only after it passes QA.

#### Blooper ledger

- After a successful panel render, `--bloopers` copies attempts whose bytes differ from the published panel to `output/bloopers/<episode>/<scene-slug>/panel-NN-attempt-N.png`, with a JSON sidecar identifying the panel, attempt, model, QA verdict, and continuity category.
- Each run appends `output/bloopers/bloopers.json` and rewrites `output/bloopers/README.md`. The promoted image stays out of that tree, and nothing under `output/bloopers/` is canonical.

#### Conservative individual-panel repairs

A hard-contract finding stays a QA failure even when no repair is purchased. Ambiguous, hidden, low-confidence, or vague findings are left unedited. A directly visible, high-confidence failure may be edited up to `--max-repairs`, using the failed image, the reviewed contract, and the canonical references.

A repair that removes hard failures without adding another failure can proceed without pairwise comparisons. Otherwise, two order-swapped comparisons must agree that it is a meaningful improvement without regression. Publication still requires a QA pass. Repeated failures allow one restart from canonical references; unresolved or oscillating failures stop. Failed candidates remain unpromoted, on disk and in the page QA report.

Grouped page repairs retry up to `--max-repairs` without that confidence gate. Individual-panel `--price` reserves one image edit or regeneration, one candidate QA call, and two comparison calls for every possible repair. Actual work may use fewer calls.

#### Revision evaluation mode

`--revision-plan` tests whether one targeted edit should replace an existing canonical panel. The plan fingerprint must match the selected scene and panels. It freezes the panels, the issue, the correction note, and the hashes of the script, prior QA, original panel, reviewed contract, and canonical references.

Revision mode requires `--target images`, `--panels-per-image 1`, `--provider openai=gpt-image-2.5-flare`, `--qa-provider openai=gpt-6.1-sol`, and `--max-repairs 0`; these values are inferred when omitted. Promotion requires explicit `--promote clear-winners` authorization. Revision mode rejects `--force`, `--qa-only`, `--no-qa`, sketches, grouped pages, grids, variations, multiple image models, and the normal repair loop.

Each pending panel receives at most one edit using the frozen correction note. Failed, malformed, interrupted, or ambiguous work is not sent again. Each completed candidate is compared with the original twice, with the image order swapped on the second pass. Both comparisons must complete successfully for promotion.

The candidate replaces the canonical panel only when the frozen importance is meaningful, both comparisons prefer the candidate, both find the targeted issue materially improved, and neither finds a major regression or new preservation damage. Every other outcome keeps the original bytes.

Evidence resumes by plan fingerprint under `revision-evaluations/<experiment-id>-<fingerprint-prefix>/`, retaining originals, candidates, comparisons, and the copied plan. Incompatible or unidentified evidence is preserved; interrupted in-flight work is marked ambiguous and is not repurchased automatically.

Revision `--price` checks the plan and source hashes without writes or provider calls. It prices each pending image edit and the two comparisons still owed for a pending or uncompared candidate. Finished evidence is reused.

Next: [review](./06-review.md).
