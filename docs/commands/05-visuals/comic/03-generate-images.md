# comic generate-images

`generate-images` turns reviewed panel prompt bundles into optional black-and-white review sketches and final comic panel images.

See the [`comic` overview](./00-comic-overview.md) for catalogs, runtime paths, and the full walkthrough.

`bun autoshow comic generate-images --help-topic audit` shows the QA-only constraints. Audit mode requires `--target images`, `--panels-per-image 1`, and `--max-repairs 0` (the audit defaults). It rejects `--no-qa`, `--grid`, `--variation`, `--force`, `--image-model`, `--size`, `--quality`, `--blocking-layout-guide`, and revision mode; it does not generate, repair, or promote images.

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

| Flag                                   | Description                                                                                                                                    | Default       |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `--target <target>`                    | `images`, `sketches`, or `both`                                                                                                                | `images`      |
| `--panels <all\|range\|list>`          | Panels to process: `all`, a range like `1-8`, a list like `1,3,7`, or mixed like `1-4,9`; overlong contiguous ranges clamp to available panels | `all`         |
| `--concurrency <n>`                    | Number of image and QA requests (across panels, pages, models, and variations) to run in parallel                                              | `7`           |
| `--concurrency-mode <ramp\|immediate>` | Approach hosted image and QA work from one request per provider/account lane (`ramp`) or start at the configured cap (`immediate`)             | `ramp`        |
| `-f, --force`                          | Regenerate image outputs only; never rewrite reviewed scene or prompt artifacts                                                                | `false`       |
| `--qa` / `--no-qa`                     | Enable or disable final-image QA                                                                                                               | enabled       |
| `--qa-only`                            | Judge existing canonical individual panels without generating, repairing, promoting, or changing image-manifest state                         | `false`       |
| `--blocking-hard-keys <list>`          | Blocking audit statuses promoted from advisory to hard QA failures as a comma list of `side-swapped`, `depth-swapped`, `facing-wrong`, `posture-wrong`, `wardrobe-wrong`, `missing-on-mark`, `unlisted-on-stage`, `exposed-empty-mark`, `excluded-extra-present`, `axis-side` | none (every blocking status advisory) |
| `--blocking-layout-guide`              | Attach the compiled screen-space marker guide to dense single-panel blocking requests; experimental and incompatible with grouped pages or QA-only/revision mode | `false` |
| `--continuity-qa`                      | Run the audit-only continuity judge beside the page judge; requires `--qa-only`                                                                | `false`       |
| `--continuity-only`                    | Skip the page judge and run only the continuity judge; requires `--continuity-qa`                                                              | `false`       |
| `--labels <path>`                      | Human continuity labels JSON in the `qa/continuity-labels.json` shape; adds per-key precision and recall to the continuity report and requires `--continuity-qa` | none |
| `--trusted-anchor-panel <n>`           | Panel number the continuity audit anchors on instead of the labels file value or panel 1; requires `--continuity-qa`                           | none          |
| `--revision-plan <path>`               | Run the bounded per-panel revision-evaluation workflow described below                                                                          | none          |
| `--comparison-passes <n>`              | Number of order-swapped revision judgments; revision mode requires exactly `2`                                                                  | none          |
| `--promote <policy>`                   | Revision promotion policy; revision mode requires `clear-winners`                                                                               | none          |
| `--qa-model <model>`                   | Vision judge model; QA supports OpenAI and Gemini vision-capable LLMs                                                                           | `gpt-5.6-sol` |
| `--max-repairs <n>`                    | Maximum eligible repair attempts after the initial image                                                                                       | `2`           |
| `--bloopers`                           | Copy every non-promoted panel attempt into `output/bloopers/` with a provenance sidecar for the blooper reel                                    | `false`       |
| `--stop-on-provider-error`             | Abort the remaining panels on the first provider error instead of continuing; already written attempts are preserved and the run exits non-zero | `false`       |
| `--credit-preflight`                   | Verify the provider credential and account credit with one zero-cost models request before any paid call                                        | `false`       |
| `--price`                              | Estimate API costs without making API calls                                                                                                    | `false`       |

### Advanced Options

| Flag                               | Description                                                                                                                            | Default                 |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `--image-model <model[,model...]>` | Use one or more supported image models (see [Supported Models](./00-comic-overview.md#supported-models))                               | `gpt-image-2`           |
| `--variation <name[,name...]>`     | Generate final images with one or more prompt variations: `canonical`, `animation-polish`, `cinematic-depth`                           | none                    |
| `--size <size>` | Image size: `1536x1024`, `1024x1024`, `1024x1536`, `auto`, or a custom `WIDTHxHEIGHT` size for `gpt-image-2` or GPT Image 2.5 (Flare/Sunburst) | `1536x1024` |
| `--quality <quality>` | `low`, `medium`, `high`, or `auto`; Image 2.5 also supports `xhigh` and `max`. Only OpenAI applies this flag; other providers use their defaults. | `high` |
| `--panels-per-image <n>`           | Number of ordered panels per generated image; overrides both stage defaults                                                            | final `1`; sketches `6` |
| `--grid <columns>x<rows>`          | Compose generated individual final panels into local page grids, such as `2x3`; requires `--panels-per-image 1` and `--size 1536x1024` | none                    |

### Examples

```bash
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target sketches
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target both
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --panels 1,3,7
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --grid 2x3
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target sketches --panels 5-8
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --image-model gpt-image-2,gemini-3.1-flash-lite-image
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --variation animation-polish,cinematic-depth
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --panels 1-5 --qa-only --qa-model gemini-3.8-flash --max-repairs 0 --price
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --panels 1-5 --qa-only --qa-model gemini-3.8-flash --max-repairs 0
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --qa-only --continuity-qa --continuity-only --qa-model gpt-5.6-sol --max-repairs 0 --price
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --qa-only --continuity-qa --continuity-only --labels output/episode-01-opening/qa/continuity-labels.json --trusted-anchor-panel 1 --qa-model gpt-5.6-sol --max-repairs 0
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --output-dir output/episode-01-opening --target images --panels 2,4 --panels-per-image 1 --image-model gpt-image-2 --qa-model gpt-5.6-sol --max-repairs 0 --revision-plan output/experiments/opening-revisions.json --comparison-passes 2 --promote clear-winners --price
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --output-dir output/episode-01-opening --target images --panels 2,4 --panels-per-image 1 --image-model gpt-image-2 --qa-model gpt-5.6-sol --max-repairs 0 --revision-plan output/experiments/opening-revisions.json --comparison-passes 2 --promote clear-winners
```

### Behavior

- Requires reviewed scene JSON and panel prompt bundles from `draft-scenes`.
- Ordinary generation saves recovery intent before dispatch. Use [`resume <run-directory> --price` and `resume <run-directory>`](../../00-setup-and-utilities/resume.md#comic-recovery) to inspect and continue that request while reusing completed images. Forced regeneration, audits, and revision evaluation remain explicit operations; older incomplete runs without exact intent are blocked.
- Sketch panel selections must be contiguous. Use `--target images` for non-contiguous lists such as `1,3,7`.
- `--panels-per-image` above 1 and `--grid` write page images under `pages/`. A `--grid` last page leaves unused cells blank.
- Variation and multi-model runs nest outputs as `panels/<run-id>/<variation>/<model>/`, `pages/<run-id>/<variation>/<model>/`, and `sketches/<run-id>/<model>/`.
- With `--qa`, only final images that pass the judge are kept. Individual-panel repairs are conservative: see [Conservative individual-panel repairs](#conservative-individual-panel-repairs).
- `--qa-only` requires individual canonical panels, `--target images`, `--panels-per-image 1`, QA enabled, and `--max-repairs 0`; it rejects `--force`, grids, variations, grouped pages, and every image-generation option.
- A QA-only run writes `qa/panel-audit-<run-id>/page-qa-report.{json,md}` (schemaVersion 6) plus `qa-only-audit.json`. Hard failures are findings, not repair triggers. Existing page-QA entries that lack the current schema are not reused.
- QA-only `--price` counts judge calls and reports zero image-generation and repair calls. The paid run never updates canonical images or the scene manifest.
- `--continuity-qa` adds an audit-only continuity judge on the same `--qa-model`. For every selected panel it reports axis status; a per-roster cast audit (`present`, `intruding`, `vanished`, `not-assessable`); per-character screen side, posture, placement, and wardrobe; furniture orientation versus the location anchor and the immediate predecessor; an observed stage state; a blooper category (`side-flip`, `seat-swap`, `furniture-spin`, `intruder`, `vanishing-crowd`, `wardrobe-swap`, or `none`); and a repair route. The audit never generates an image.
- Continuity anchors by location, not by contiguous run. `--trusted-anchor-panel <n>` (else the labels file's `trustedAnchorPanel`) anchors every panel of that location scene-wide. A location with no trusted panel anchors on its first panel in scene order, so a scene that leaves a location and returns (A, B, A) audits the return against the same anchor as the first visit. The predecessor is the previous panel in the same contiguous location segment; the first panel after an interlude has none. Continuity findings are audit results, not generation hard failures.
- A continuity run writes `qa/continuity-audit-<run-id>/{stage-state.json, continuity-report.json, continuity-report.md, panel-NN-continuity.json}` and extends `qa-only-audit.json` with `continuity: { judged, hardFailures, byKey, anchorPanel, trustedAnchorPanel, reportDirectory }`. With `--continuity-only` the page judge is skipped and no `page-qa-report.{json,md}` is written; otherwise each page QA entry gains a `continuity` summary.
- With `--continuity-qa`, an existing `page-qa-report.json` entry is reused only when it already carries a `continuity` summary for the same judge model; otherwise the panel is judged again.
- When a panel bundle has a compiled blocking ledger, the page judge records `blockingMatch`, `axisSideMatch`, and a `blockingAudit` for on-stage characters, off-frame roster characters, and extras regions. A character drawn into a panel that does not list them is `unlisted-on-stage`. A bundle without a ledger returns an empty `blockingAudit` with both booleans true.
- Blocking-aware generation follows the compiled camera and ledger over prose spatial language in the panel description. `anchorsInFrame` is the complete required set-anchor list; undeclared anchors and temporary dressing may be cropped or hidden and must not widen the shot. Only declared anchors are mandatory in QA unless the candidate itself reveals the physical region where another canonical anchor belongs.
- `--blocking-layout-guide` attaches `metadata/blocking/panel-NN-layout.png` as a final reference for dense individual panels (ledgers with at least six visible named characters). The guide is a camera-facing structural diagram; the prompt forbids copying its marks, colors, grids, or style into the comic. Sparse panels, grouped pages, QA-only audits, and revision evaluations do not use it. `--price` includes the guide in initial and repair reference counts.
- Every blocking audit status is advisory. `--blocking-hard-keys <list>` promotes the named statuses to hard QA failures; `axis-side` in that list makes `axisSideMatch: false` hard. Hard blocking failures are reported as `panel-N:blockingAudit` and `panel-N:axisSideMatch`.
- When an individual-panel attempt has at least one blocking or axis failure and every hard failure is spatial (`blockingAudit`, `axisSideMatch`, `shotPlanMatch`, `setContinuityMatch`, or `setContinuityAudit`), the next attempt regenerates from the canonical references instead of editing the failed image. A mixed spatial-and-dialogue failure still edits. The restarted candidate must pass the full QA contract before promotion.
- `--labels <path>` reads `qa/continuity-labels.json` (`{ schemaVersion: 1, sceneSlug, trustedAnchorPanel, labeled?, labeler, date, pairs: [{ panels: [reference, candidate], verdicts: { side-flip, seat-swap, furniture-spin, intruder, vanishing-crowd, wardrobe-swap } }] }`) and emits per-key precision and recall. A pair matches when its candidate was judged against the reference as anchor or predecessor. The judge is positive for a key when `blooperCategory` names it or the cast audit implies it (`intruding` for `intruder`, `vanished` for `vanishing-crowd`).
- Omit `labeled` or set it `true` for human ground truth. `--labels` refuses `"labeled": false` because a template's all-false verdicts would score as a reviewer asserting the scene contains no bloopers.
- Continuity `--price` adds one 9,000-input, 1,500-output unit call per selected panel on the QA model, and drops the page judge calls under `--continuity-only`.
- Final-image `--price` adds `Image input (modeled): <n> units across <k> references`, modeling 1,000 units for every high-detail reference image sent by each initial OpenAI call and by each possible repair edit (which also sends the failed image). The line is priced at the registry `imageInputCostPer1MCents` rate when one exists and is otherwise marked unpriced. Paid runs record the provider's returned image usage and append `imageInputUnits=<n>` to the run summary.

#### Blooper ledger

- `--bloopers` copies every attempt whose bytes differ from the promoted canonical to `output/bloopers/<episode>/<scene-slug>/panel-NN-attempt-N.png` with a `.json` sidecar (run id, panel and attempt numbers, SHA-256, image model, QA verdict, hard-failure keys, and a category from `side-flip`, `seat-swap`, `furniture-spin`, `intruder`, `vanishing-crowd`, `wardrobe-swap`, and `other`).
- Each run appends to `output/bloopers/bloopers.json` and rewrites `output/bloopers/README.md`. The promoted image is never copied. Nothing under `output/bloopers/` is canonical.

#### Conservative individual-panel repairs

For individual-panel images, QA records each hard-contract finding separately from whether a paid repair is worth attempting. A finding stays a QA failure even when repair is skipped. Ambiguous, hidden, low-confidence, or vague findings spend no image-edit call. Directly visible, high-confidence failures may be repaired, up to `--max-repairs`.

An eligible repair edits the failed image with the reviewed contract and canonical references, then receives normal QA. If the candidate's hard-failure set is a strict subset of the baseline's, it advances without a subjective comparison. Otherwise the candidate is compared with the pre-edit original twice on `--qa-model`, with the image order swapped on the second pass. Both comparisons must prefer the candidate, find visible meaningful improvement, and report no major regression. A tie, disagreement, marginal change, low confidence, malformed judgment, or regression retains the baseline.

Repeated identical hard failures restart once from canonical references; a second repetition after that restart stops. An alternating A-B-A signature or two evaluated attempts without strict-subset improvement stops with `repairPolicy.reason: "constraint-oscillation"`. A candidate replaces the canonical original only when it passes QA. A fresh initial image that still fails is not promoted. Attempt evidence remains under the item attempts directory, and failed branches remain in the aggregate page report even when no canonical panel is promoted.

Grouped page repairs use a bounded QA loop without the conservative value gate. Individual-panel `--price` models, for every possible repair, one image edit, one candidate QA call, and two order-swapped comparison calls; actual calls may be lower when a repair is skipped.

#### Revision evaluation mode

`--revision-plan` tests whether one targeted edit is worth replacing an existing canonical panel. The plan freezes the selected panels, the issue, the correction note, and SHA-256-bound script, prior-QA, original panel, reviewed contract, and ordered canonical references. The plan fingerprint must match the selected scene and panels.

Revision mode requires `--target images`, `--panels-per-image 1`, `--image-model gpt-image-2`, `--qa-model gpt-5.6-sol`, `--max-repairs 0`, `--comparison-passes 2`, and `--promote clear-winners`. It rejects force, QA-only, disabled QA, sketches, grouped pages, grids, variations, multiple image models, and every normal repair-loop combination.

Each pending slot sends the canonical original, then the plan's ordered references, and makes one edit using only the frozen correction note. A failed, malformed, interrupted, or ambiguous slot is terminal and is never automatically redispatched. Each completed candidate receives exactly two independent comparisons with swapped image order. Failed or malformed comparisons are also terminal.

A candidate is promoted only when the frozen importance is meaningful, both votes prefer the candidate, both find the targeted issue materially improved, and neither finds a major regression or candidate-introduced preservation damage. Every other outcome retains byte-identical canonical originals. SSIM and RMSE in the ledger are descriptive only and do not decide promotion.

Evidence is resumable by plan fingerprint under `revision-evaluations/<experiment-id>-<fingerprint-prefix>/`. Each panel directory holds `original.png`, at most one `candidate.png`, comparison records, and `panel-ledger.json`; the run root holds the copied plan and `revision-evaluation.json`. Comparison slots and evidence record OpenAI and `gpt-5.6-sol`; resuming rejects incompatible or unidentified comparisons before dispatch or promotion and preserves their images and evidence. In-flight slots found after interruption are closed as ambiguous instead of redispatched.

Revision `--price` validates the plan and source hashes without writes or provider calls. It prices only pending image slots and the two future comparisons for each pending or completed-but-uncompared candidate; terminal and completed evidence is reused.

When a host invocation must reuse a scene manifest authored under another workspace mount, set `AUTOSHOW_SOURCE_IDENTITY_ROOT` to the absolute physical host workspace and `AUTOSHOW_SOURCE_IDENTITY_ALIAS` to the identity root stored in the manifest, such as `/workspace`. Both are required together. The mapping changes only hash-bound source identity; it does not redirect file reads or AutoShow's project root.

Next: [review](./06-review.md).
