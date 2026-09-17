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
- Use [`resume <run-directory> --price` and `resume <run-directory>`](../../00-setup-and-utilities/resume.md#comic-recovery) to inspect and continue an interrupted generation while reusing completed images. Forced regeneration, audits, and revision evaluation remain explicit operations; older incomplete runs without exact intent are blocked.
- Sketch panel selections must be contiguous. Use `--target images` for non-contiguous lists such as `1,3,7`.
- `--panels-per-image` above 1 and `--grid` write page images under `pages/`. A `--grid` last page leaves unused cells blank.
- Variation and multi-model runs nest outputs as `panels/<run-id>/<variation>/<model>/`, `pages/<run-id>/<variation>/<model>/`, and `sketches/<run-id>/<model>/`.
- With `--qa`, only final images that pass the judge are kept. Individual-panel repairs are conservative: see [Conservative individual-panel repairs](#conservative-individual-panel-repairs).
- `--qa-only` requires individual canonical panels, `--target images`, `--panels-per-image 1`, QA enabled, and `--max-repairs 0`. It rejects `--force`, grids, variations, grouped pages, image-generation options, the layout guide, and revision mode. Hard failures are findings, not repair triggers. The run writes `qa/panel-audit-<run-id>/page-qa-report.{json,md}` plus `qa-only-audit.json` and never updates canonical images or the scene manifest. Older page-QA entries are not reused. `--price` counts judge calls only.
- `--continuity-qa` adds an audit-only continuity judge on the same `--qa-provider`. For every selected panel it reports axis, cast, screen side, posture, placement, wardrobe, furniture versus the location anchor and predecessor, a blooper category, and a repair route. The audit never generates an image. Continuity findings are audit results, not generation hard failures.
- Continuity anchors by location, not by contiguous run. `--trusted-anchor-panel <n>` (else the labels file's `trustedAnchorPanel`) anchors every panel of that location scene-wide. A location with no trusted panel anchors on its first panel in scene order, so a scene that leaves a location and returns audits the return against the same anchor as the first visit. The predecessor is the previous panel in the same contiguous location segment; the first panel after an interlude has none.
- A continuity run writes `qa/continuity-audit-<run-id>/` and extends `qa-only-audit.json`. With `--continuity-only` the page judge is skipped and no `page-qa-report.{json,md}` is written. An existing page-QA entry is reused only when it already includes continuity for the same judge model.
- `--labels <path>` reads `qa/continuity-labels.json` (`schemaVersion`, `sceneSlug`, `trustedAnchorPanel`, optional `labeled`, `labeler`, `date`, and `pairs` of `[reference, candidate]` panels with verdicts for `side-flip`, `seat-swap`, `furniture-spin`, `intruder`, `vanishing-crowd`, and `wardrobe-swap`) and adds per-key precision and recall to the continuity report. Omit `labeled` or set it `true` for human ground truth. `--labels` refuses `"labeled": false` because a template's all-false verdicts would score as a reviewer asserting the scene contains no bloopers.
- Continuity `--price` adds one judge call per selected panel on the QA model, and drops the page-judge calls under `--continuity-only`.
- When a panel bundle has a compiled blocking ledger, generation follows the compiled camera and ledger over prose spatial language in the panel description. Only declared set anchors are required in frame; undeclared anchors and temporary dressing may be cropped. The page judge records blocking and axis-side findings for on-stage characters, off-frame roster characters, and extras. A character drawn into a panel that does not list them is `unlisted-on-stage`. A bundle without a ledger is not blocking-audited.
- `--blocking-layout-guide` attaches `metadata/blocking/panel-NN-layout.png` as a structural reference for dense individual panels (ledgers with at least six visible named characters). Sparse panels, grouped pages, QA-only audits, and revision evaluations do not use it. `--price` includes the guide in initial and repair reference counts.
- Every blocking audit status is advisory. `--blocking-hard-keys <list>` promotes the named statuses to hard QA failures; `axis-side` in that list makes an axis-side mismatch hard.
- When every hard failure on an individual-panel attempt is spatial (blocking, axis, shot plan, or set continuity), the next attempt regenerates from the canonical references instead of editing the failed image. A mixed spatial-and-dialogue failure still edits. The restarted candidate must pass the full QA contract before promotion.
- Final-image `--price` models reference-image input for each initial OpenAI call and each possible repair edit.

#### Blooper ledger

- `--bloopers` copies every attempt whose bytes differ from the promoted canonical to `output/bloopers/<episode>/<scene-slug>/panel-NN-attempt-N.png` with a JSON sidecar (panel, attempt, model, QA verdict, and a category from `side-flip`, `seat-swap`, `furniture-spin`, `intruder`, `vanishing-crowd`, `wardrobe-swap`, and `other`).
- Each run appends to `output/bloopers/bloopers.json` and rewrites `output/bloopers/README.md`. The promoted image is never copied. Nothing under `output/bloopers/` is canonical.

#### Conservative individual-panel repairs

For individual-panel images, QA records each hard-contract finding separately from whether a paid repair is worth attempting. A finding stays a QA failure even when repair is skipped. Ambiguous, hidden, low-confidence, or vague findings spend no image-edit call. Directly visible, high-confidence failures may be repaired, up to `--max-repairs`.

An eligible repair edits the failed image with the reviewed contract and canonical references, then receives normal QA. If the candidate's hard failures are a strict subset of the original's, it advances without a comparison. Otherwise the candidate is compared with the original twice on `--qa-provider`, with the image order swapped on the second pass. Both comparisons must prefer the candidate, find visible meaningful improvement, and report no major regression. A tie, disagreement, marginal change, low confidence, malformed judgment, or regression retains the original.

Repeated identical hard failures restart once from canonical references; a second repetition after that restart stops. Oscillating failure sets also stop. A candidate replaces the canonical original only when it passes QA. A fresh initial image that still fails is not promoted. Failed attempts stay on disk and in the page QA report even when no canonical panel is promoted.

Grouped page repairs use a bounded QA loop without the conservative value gate. Individual-panel `--price` models, for every possible repair, one image edit, one candidate QA call, and two order-swapped comparison calls; actual calls may be lower when a repair is skipped.

#### Revision evaluation mode

`--revision-plan` tests whether one targeted edit is worth replacing an existing canonical panel. The plan freezes the selected panels, the issue, the correction note, and hash-bound script, prior QA, original panel, reviewed contract, and ordered canonical references. The plan fingerprint must match the selected scene and panels.

Revision mode requires `--target images`, `--panels-per-image 1`, `--provider openai=gpt-image-2`, `--qa-provider openai=gpt-5.6-sol`, `--max-repairs 0`, `--comparison-passes 2`, and `--promote clear-winners`. It rejects force, QA-only, disabled QA, sketches, grouped pages, grids, variations, multiple image models, and the normal repair loop.

Each pending slot sends the canonical original, then the plan's ordered references, and makes one edit using only the frozen correction note. A failed, malformed, interrupted, or ambiguous slot is terminal and is never automatically redispatched. Each completed candidate receives exactly two independent comparisons with swapped image order. Failed or malformed comparisons are also terminal.

A candidate is promoted only when the frozen importance is meaningful, both votes prefer the candidate, both find the targeted issue materially improved, and neither finds a major regression or candidate-introduced preservation damage. Every other outcome retains the original canonical bytes. Pixel-similarity scores in the ledger do not decide promotion.

Evidence is resumable by plan fingerprint under `revision-evaluations/<experiment-id>-<fingerprint-prefix>/`. Each panel directory holds `original.png`, at most one `candidate.png`, comparison records, and `panel-ledger.json`; the run root holds the copied plan and `revision-evaluation.json`. Resuming rejects incompatible or unidentified comparisons before dispatch or promotion and preserves their images and evidence. In-flight slots found after interruption are closed as ambiguous instead of redispatched.

Revision `--price` validates the plan and source hashes without writes or provider calls. It prices only pending image slots and the two future comparisons for each pending or completed-but-uncompared candidate; terminal and completed evidence is reused.

Next: [review](./06-review.md).
