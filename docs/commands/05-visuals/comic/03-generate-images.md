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
| `--comparison-passes <n>`              | Number of order-swapped revision judgments; revision mode requires exactly `2`                                                                                                                                                                                                | none                                  |
| `--promote <policy>`                   | Revision promotion policy; revision mode requires `clear-winners`                                                                                                                                                                                                             | none                                  |
| `--qa-provider <provider[=model]>`     | Vision judge model; QA supports OpenAI and Gemini vision-capable LLMs                                                                                                                                                                                                         | `gpt-5.6-sol`                         |
| `--max-repairs <n>`                    | Maximum eligible repair attempts after the initial image                                                                                                                                                                                                                      | `2`                                   |
| `--bloopers`                           | Copy every non-promoted panel attempt into `output/bloopers/` with a provenance sidecar for the blooper reel                                                                                                                                                                  | `false`                               |
| `--stop-on-provider-error`             | Abort the remaining panels on the first provider error instead of continuing; already written attempts are preserved and the run exits non-zero                                                                                                                               | `false`                               |
| `--credit-preflight`                   | Verify the provider credential and account credit with one zero-cost models request before any paid call; in `--price` mode it only reports that it would run                                                                                                                 | `false`                               |
| `--price`                              | Estimate API costs without making API calls                                                                                                                                                                                                                                   | `false`                               |

### Advanced Options

| Flag                            | Description                                                                                                                                       | Default                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `--provider <provider[=model]>` | Use one or more supported image models (see [Supported Models](./00-comic-overview.md#supported-models))                                          | `gpt-image-2`           |
| `--variation <name[,name...]>`  | Generate final images with one or more prompt variations: `canonical`, `animation-polish`, `cinematic-depth`                                      | none                    |
| `--size <size>`                 | Image size: `1536x1024`, `1024x1024`, `1024x1536`, `auto`, or a custom `WIDTHxHEIGHT` size for `gpt-image-2` or GPT Image 2.5 (Flare/Sunburst)    | `1536x1024`             |
| `--quality <quality>`           | `low`, `medium`, `high`, or `auto`; Image 2.5 also supports `xhigh` and `max`. Only OpenAI applies this flag; other providers use their defaults. | `high`                  |
| `--panels-per-image <n>`        | Number of ordered panels per generated image; overrides both stage defaults                                                                       | final `1`; sketches `6` |
| `--grid <columns>x<rows>`       | Compose generated individual final panels into local page grids, such as `2x3`; requires `--panels-per-image 1` and `--size 1536x1024`            | none                    |

### Examples

```bash
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target sketches
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target both
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --panels 1,3,7
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --grid 2x3
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --provider openai=gpt-image-2 --provider gemini=gemini-3.1-flash-lite-image
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --variation animation-polish,cinematic-depth
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --panels 1-5 --qa-only --qa-provider gemini=gemini-3.8-flash --max-repairs 0 --price
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --qa-only --continuity-qa --continuity-only --labels output/episode-01-opening/qa/continuity-labels.json --trusted-anchor-panel 1 --qa-provider openai=gpt-5.6-sol --max-repairs 0
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --output-dir output/episode-01-opening --target images --panels 2,4 --panels-per-image 1 --provider openai=gpt-image-2 --qa-provider openai=gpt-5.6-sol --max-repairs 0 --revision-plan output/experiments/opening-revisions.json --comparison-passes 2 --promote clear-winners --price
```

### Behavior

- Requires reviewed scene JSON and panel prompt bundles from `draft-scenes`.
- [`resume <run-directory> --price` and `resume <run-directory>`](../../00-setup-and-utilities/resume.md#comic-recovery) inspects an interrupted generation and continues it, reusing completed images. `--force`, audits, and revision evaluation stay explicit. An older incomplete run that lacks exact intent is left blocked.
- Sketch panel selections must be contiguous. Use `--target images` for a non-contiguous list such as `1,3,7`.
- `--panels-per-image` above 1 and `--grid` write page images under `pages/`. A `--grid` last page leaves unused cells blank.
- Every image run nests files under a run id: `panels/<run-id>/`, `pages/<run-id>/`, and `sketches/<run-id>/`. Multiple models add a `<model>` directory. `--variation` nests final images as `panels/<run-id>/<variation>/<model>/` and `pages/<run-id>/<variation>/<model>/`.
- With `--qa`, only final images that pass the judge are kept. See [Conservative individual-panel repairs](#conservative-individual-panel-repairs).
- `--qa-only` judges existing canonical individual panels and requires `--target images`, `--panels-per-image 1`, QA enabled, and `--max-repairs 0`. It rejects `--force`, grids, variations, grouped pages, image-generation options, the layout guide, and revision mode. Hard failures stay in the report. The run writes `qa/panel-audit-<run-id>/page-qa-report.{json,md}` and `qa-only-audit.json`. Canonical images and the scene manifest stay unchanged, and each run judges the selected panels again. `--price` counts judge calls only.
- `--continuity-qa` adds a continuity report for each selected panel on the same `--qa-provider`: axis, cast, screen side, posture, placement, wardrobe, and furniture against the location anchor and predecessor, plus a blooper category and a repair route. The audit writes findings only.
- Continuity anchors by location. `--trusted-anchor-panel` (or the labels file's `trustedAnchorPanel`) anchors every panel of that location, including after the scene leaves and returns. A location with no trusted panel anchors on its first panel in scene order. The predecessor is the previous panel in the same contiguous visit.
- A continuity run writes `qa/continuity-audit-<run-id>/` and extends `qa-only-audit.json`. `--continuity-only` skips the page judge and writes no `page-qa-report.{json,md}`. A saved page-QA entry is reused when it already includes continuity for the same judge model.
- `--labels` reads `qa/continuity-labels.json`: `schemaVersion`, `sceneSlug`, nullable `trustedAnchorPanel`, `labeled`, `labeler`, `date`, and `pairs` of `[reference, candidate]` panels with verdicts for `side-flip`, `seat-swap`, `furniture-spin`, `intruder`, `vanishing-crowd`, and `wardrobe-swap`. `labeled` must be `true`; an unfilled template is rejected. The report then includes per-key precision and recall. `--price` adds one judge call per selected panel, and `--continuity-only` omits the page-judge calls.
- A panel with a compiled blocking ledger is generated and judged from that ledger. Declared set anchors stay in frame; other anchors may be cropped. A character drawn into a panel that does not list them is `unlisted-on-stage`. A panel without a ledger is not blocking-audited.
- `--blocking-layout-guide` attaches `metadata/blocking/panel-NN-layout.png` for an individual panel whose ledger shows at least six visible named characters. Sparser panels skip it. `--price` counts the guide as a reference on the initial image and on each repair.
- A spatial-only hard-failure set (blocking, axis, shot plan, or set continuity) regenerates that individual panel from the canonical references. A set that also includes a dialogue failure edits the failed image. The replacement becomes canonical only after it passes QA.

#### Blooper ledger

- `--bloopers` copies every attempt whose bytes differ from the promoted panel to `output/bloopers/<episode>/<scene-slug>/panel-NN-attempt-N.png`, with a JSON sidecar for the panel, attempt, model, QA verdict, and a category (`side-flip`, `seat-swap`, `furniture-spin`, `intruder`, `vanishing-crowd`, `wardrobe-swap`, or `other`).
- Each run appends `output/bloopers/bloopers.json` and rewrites `output/bloopers/README.md`. The promoted image stays out of that tree, and nothing under `output/bloopers/` is canonical.

#### Conservative individual-panel repairs

A hard-contract finding stays a QA failure even when no repair is purchased. Ambiguous, hidden, low-confidence, or vague findings are left unedited. A directly visible, high-confidence failure may be edited up to `--max-repairs`, using the failed image, the reviewed contract, and the canonical references.

The edit replaces the canonical panel only when it passes QA and is a clear improvement on the original. The same hard-failure set restarts once from the canonical references, then stops. An oscillating failure set stops. A new initial image that still fails stays unpromoted. Failed attempts remain on disk and in the page QA report.

Grouped page repairs retry up to `--max-repairs` without that confidence gate. Individual-panel `--price` reserves one image edit, one candidate QA call, and two comparison calls for every possible repair. A repair that the confidence gate skips is absent from the calls that run.

#### Revision evaluation mode

`--revision-plan` tests whether one targeted edit should replace an existing canonical panel. The plan fingerprint must match the selected scene and panels. It freezes the panels, the issue, the correction note, and the hashes of the script, prior QA, original panel, reviewed contract, and canonical references.

Revision mode requires `--target images`, `--panels-per-image 1`, `--provider openai=gpt-image-2`, `--qa-provider openai=gpt-5.6-sol`, `--max-repairs 0`, `--comparison-passes 2`, and `--promote clear-winners`. It rejects `--force`, `--qa-only`, `--no-qa`, sketches, grouped pages, grids, variations, multiple image models, and the normal repair loop.

Each pending panel receives one edit that uses only the frozen correction note. A failed, malformed, interrupted, or ambiguous panel is closed and is not sent again. Each completed candidate is compared with the original twice, with the image order swapped on the second pass. A failed or malformed comparison closes that panel.

The candidate replaces the canonical panel only when the frozen importance is meaningful, both comparisons prefer the candidate, both find the targeted issue materially improved, and neither finds a major regression or new preservation damage. Every other outcome keeps the original bytes.

Evidence resumes by plan fingerprint under `revision-evaluations/<experiment-id>-<fingerprint-prefix>/`. Each panel directory holds `original.png`, at most one `candidate.png`, the comparison records, and `panel-ledger.json`. The run root holds the copied plan and `revision-evaluation.json`. Resume preserves an incompatible or unidentified comparison and its images, and it closes an in-flight panel as ambiguous.

Revision `--price` checks the plan and source hashes without writes or provider calls. It prices each pending image edit and the two comparisons still owed for a pending or uncompared candidate. Finished evidence is reused.

Next: [review](./06-review.md).
