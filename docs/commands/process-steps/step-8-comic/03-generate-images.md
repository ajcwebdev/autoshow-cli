# comic generate-images

`generate-images` turns reviewed panel prompt bundles into optional black-and-white review sketches and final comic panel images.

See the [`comic` overview](./00-comic-overview.md) for catalogs, runtime paths, and the full walkthrough.

## Outline

- [generate-images](#generate-images)
  - [Options](#options)
  - [Advanced Options](#advanced-options)
  - [Examples](#examples)
  - [Behavior](#behavior)

## generate-images

### Options

| Flag                                   | Description                                                                                                                                    | Default       |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `--target <target>`                    | `images`, `sketches`, or `both`                                                                                                                | `images`      |
| `--panels <all\|range\|list>`          | Panels to process: `all`, a range like `1-8`, a list like `1,3,7`, or mixed like `1-4,9`; overlong contiguous ranges clamp to available panels | `all`         |
| `--concurrency <n>`                    | Number of image requests (across panels, pages, models, and variations) to run in parallel                                                     | `7`           |
| `--concurrency-mode <ramp\|immediate>` | Approach hosted image and QA work from one request per provider/account lane (`ramp`) or start at the configured cap (`immediate`)             | `ramp`        |
| `-f, --force`                          | Regenerate image outputs only; never rewrite reviewed scene or prompt artifacts                                                                | `false`       |
| `--qa` / `--no-qa`                     | Enable or disable final-image QA                                                                                                               | enabled       |
| `--qa-only`                            | Judge existing canonical individual panels without generating, repairing, promoting, or changing image-manifest state                         | `false`       |
| `--revision-plan <path>`               | Run the bounded per-panel revision-evaluation workflow described below                                                                          | none          |
| `--comparison-passes <n>`              | Number of order-swapped revision judgments; revision mode requires exactly `2`                                                                  | none          |
| `--promote <policy>`                   | Revision promotion policy; revision mode requires `clear-winners`                                                                               | none          |
| `--qa-model <model>`                   | Vision judge model; QA supports OpenAI and Gemini vision-capable LLMs                                                                           | `gpt-5.6-sol` |
| `--max-repairs <n>`                    | Maximum eligible repair attempts after the initial image                                                                                       | `2`           |
| `--price`                              | Estimate image-generation costs without making API calls                                                                                       | `false`       |

### Advanced Options

| Flag                               | Description                                                                                                                            | Default                 |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `--image-model <model[,model...]>` | Use one or more supported image models (see [Supported Models](./00-comic-overview.md#supported-models))                               | `gpt-image-2`           |
| `--variation <name[,name...]>`     | Generate final images with one or more prompt variations: `canonical`, `animation-polish`, `cinematic-depth`                           | none                    |
| `--size <size>`                    | Image size: `1536x1024`, `1024x1024`, `1024x1536`, `auto`, or a custom `WIDTHxHEIGHT` size for `gpt-image-2`                           | `1536x1024`             |
| `--quality <quality>`              | `low`, `medium`, `high`, or `auto`; only OpenAI applies it, and other providers use their own defaults                                 | `high`                  |
| `--panels-per-image <n>`           | Number of ordered panels per generated image                                                                                           | final `1`; sketches `6` |
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
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --panels 1-5 --qa-only --qa-model gemini-3.1-pro-preview --max-repairs 0 --price
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --panels 1-5 --qa-only --qa-model gemini-3.1-pro-preview --max-repairs 0
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --output-dir output/episode-01-opening --target images --panels 2,4 --panels-per-image 1 --image-model gpt-image-2 --qa-model gemini-3.1-pro-preview --max-repairs 0 --revision-plan output/experiments/opening-revisions.json --comparison-passes 2 --promote clear-winners --price
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --output-dir output/episode-01-opening --target images --panels 2,4 --panels-per-image 1 --image-model gpt-image-2 --qa-model gemini-3.1-pro-preview --max-repairs 0 --revision-plan output/experiments/opening-revisions.json --comparison-passes 2 --promote clear-winners
```

### Behavior

- Requires reviewed scene JSON and panel prompt bundles from `draft-scenes`.
- Sketch panel selections must be contiguous. Use `--target images` for non-contiguous lists such as `1,3,7`.
- `--panels-per-image` above 1 and `--grid` write page images under `pages/`. A `--grid` last page leaves unused cells blank.
- Variation and multi-model runs nest outputs as `panels/<run-id>/<variation>/<model>/`, `pages/<run-id>/<variation>/<model>/`, and `sketches/<run-id>/<model>/`.
- With `--qa`, only final images that pass the judge are kept. Individual-panel repair candidates must also pass the conservative value checks below.
- `--qa-only` requires individual canonical panels, `--target images`, `--panels-per-image 1`, QA enabled, and `--max-repairs 0`; it rejects `--force`, grids, variations, grouped pages, and every image-generation option.
- A QA-only run writes `qa/panel-audit-<run-id>/page-qa-report.{json,md}` plus `qa-only-audit.json`. The audit records canonical SHA-256 values before and after every read and treats hard failures as findings rather than repair triggers.
- QA-only price mode counts judge calls and reports zero image-generation and repair calls. The paid run never updates canonical image artifact references or provider state in the scene manifest.

#### Conservative individual-panel repairs

For individual-panel images, the schema-version-4 QA response records the hard contract finding separately from a repair-worthiness assessment. A finding stays a QA failure even when repair is skipped. Ambiguous or hidden premises, marginal details, low-confidence findings, false positives, source-authorized differences, and corrections too vague to compare spend no image-edit call. Directly visible, meaningful, high-confidence failures use either a low-risk targeted-edit lane or a comparison-protected lane for diffuse, shared-attribute, multi-region, structural, or otherwise risky work. Objective required-cast, unmistakable-identity, dialogue-content, speaker-attribution, and source-precedence failures override an internally inconsistent no-benefit label. The protected lane can spend one edit call but does not weaken the two-pass promotion criteria.

An eligible repair edits the exact failed image with the reviewed contract and immutable canonical references, includes the judge's preservation requirements in the edit prompt, and receives normal QA. The candidate is then compared with its immediate pre-edit original exactly twice using the selected `--qa-model`: pass 1 presents original then candidate, and pass 2 swaps the order. Both comparisons evaluate premise visibility, material correction, full-contract preference, and newly introduced regressions. Comparison contract v4 evaluates explicit preservation requirements for both images; a defect already present equally in both remains a QA finding but cannot be treated as candidate-introduced damage. Comparisons are independent one-attempt calls; malformed or failed judgments are recorded and are not retried.

A candidate can replace the original only when it passes QA and both high-confidence order-swapped judgments unanimously prefer it, both find a visible meaningful improvement, and neither reports a major regression. A tie, disagreement, marginal change, low confidence, malformed judgment, or regression stops that repair chain and leaves an existing canonical original byte-identical. A fresh initial image that still fails has no canonical promotion. Raw attempt QA and comparison evidence remains under the item attempts directory for diagnosis.

The conservative value gate and pairwise promotion check apply to individual-panel mode. Grouped page repairs retain the existing bounded QA loop because the supporting regeneration-value experiment evaluated individual panels only. Individual-panel `--price` therefore models, for every possible repair, one image edit, one candidate QA call, and two order-swapped comparison calls; actual calls may be lower when the worthiness gate skips a repair.

#### Revision evaluation mode

`--revision-plan` enables a strict experiment mode for testing whether one targeted edit is worth replacing an existing canonical panel. The schema-version-1 plan freezes the selected panel numbers, issue importance and category, original finding, correction note, original provider, and SHA-256-bound script, prior-QA record, original panel, reviewed panel contract, and ordered canonical references. The plan fingerprint binds the complete plan and must match the selected scene and panels.

Revision mode requires `--target images`, `--panels-per-image 1`, `--image-model gpt-image-2`, `--qa-model gemini-3.1-pro-preview`, `--max-repairs 0`, `--comparison-passes 2`, and `--promote clear-winners`. It rejects force, QA-only, disabled QA, sketches, grouped pages, grids, variations, multiple image models, and every normal repair-loop combination.

Each pending image slot sends the immutable canonical original first, followed by the plan's ordered canonical references, and makes one edit request using only the frozen correction note. A failed, malformed, interrupted, or ambiguous slot becomes terminal and is never automatically redispatched. Each completed candidate receives exactly two independent comparisons; pass 1 presents original then candidate, and pass 2 swaps that order. Failed or malformed comparisons are also terminal and are not retried.

The comparison records targeted-defect visibility and correction, meaningfulness, major regressions, full-contract preference, frozen-preservation adherence for both images, non-target drift, confidence, normalized votes, and provider usage. Its structured fields use explicit defect semantics (`visible`, `partly-visible`, `not-visible`) and reject internally inconsistent severity/preference or drift/evidence records rather than guessing whether “present” referred to the defect or correction. Both passes explicitly compare crop, camera, composition, poses, subject positions, background architecture, lighting, and object placement outside the requested correction. Major non-target drift or a preservation regression introduced by the candidate blocks promotion even when the candidate fixes the defect and wins the full-contract vote; a shared pre-existing defect does not. SSIM and normalized RMSE remain descriptive measurements only. A candidate is promoted atomically only when the frozen importance is meaningful, both valid normalized votes prefer the candidate, both find the targeted issue materially improved, neither finds a major regression, and neither finds candidate-introduced preservation damage. Every other outcome retains byte-identical canonical originals.

Evidence is resumable by plan fingerprint under `revision-evaluations/<experiment-id>-<fingerprint-prefix>/`. Each panel directory holds immutable `original.png`, at most one `candidate.png`, raw comparison responses or error records, and `panel-ledger.json`; the run root holds the copied plan and `revision-evaluation.json`. In-flight slots found after interruption are closed as ambiguous instead of redispatched. The canonical manifest keeps its existing image-stage provider ownership, refreshes canonical panel hashes, and stores one fingerprint-keyed `comicImageRevisionEvaluations` provenance record.

Revision `--price` validates the same plan, source hashes, panel contracts, original bytes, ordered references, model limits, and resumable ledgers without writes or provider calls. It prices only pending image slots and the two future comparisons for each pending or completed-but-uncompared candidate; terminal and completed evidence is reused.

When a direct host invocation must reuse a scene manifest authored under another immutable workspace mount, set `AUTOSHOW_SOURCE_IDENTITY_ROOT` to the absolute physical host workspace and `AUTOSHOW_SOURCE_IDENTITY_ALIAS` to the normalized absolute POSIX identity root stored in the manifest, such as `/workspace`. Both variables are required together. This mapping changes only the hash-bound source identity path for files contained by the physical root; it does not redirect file reads, change AutoShow's own project root, or alias paths outside that root.

Next: [reference-voice](./04-reference-voice.md).
