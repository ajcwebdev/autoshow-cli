# comic draft-scenes

`draft-scenes` turns episode script Markdown into structured script JSON, scene and blocking prompts, a blocking plan, scene JSON, and panel prompt bundles.

See the [`comic` overview](./00-comic-overview.md) for catalogs, runtime paths, and the full walkthrough.

## Outline

- [draft-scenes](#draft-scenes)
  - [Options](#options)
  - [Advanced Options](#advanced-options)
  - [Examples](#examples)
  - [Behavior](#behavior)
  - [Blocking plan](#blocking-plan)
  - [Reconcile from directives](#reconcile-from-directives)

## draft-scenes

### Options

| Flag                                   | Description                                                                                                                                                             | Default                |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `--only <stage>`                       | Run only `structure`, `prompt`, `blocking`, `scene`, or `panel-prompts`                                                                                                 | none (runs all stages) |
| `--blocking`, `--no-blocking`          | Include or skip the `blocking` stage. `--no-blocking` drafts later stages without a plan                                                                                | `--blocking`           |
| `--blocking-plan <path>`               | Import a hand-authored plan instead of drafting one, with no provider call. Valid with `--only blocking` or a full run, and not with `--no-blocking`                    | none                   |
| `--rebind`                             | Remap the plan's citations to the current structured script and report unresolved ones. Requires `--only blocking` and makes no provider call                           | `false`                |
| `--reconcile-from-directives`          | Apply the script's staging directives to the reviewed scene and plan, with no provider call. Not valid with `--only`, `--rebind`, `--blocking-plan`, or `--panel-count` | `false`                |
| `--panel-count <n>`                    | Require exactly this many panels from the `scene` stage. Valid with `--only scene` or a full run                                                                        | none                   |
| `--provider-concurrency <n>`           | Panels built in parallel during `panel-prompts`, and the hosted request cap for `blocking` and `scene`                                                                  | `7`                    |
| `--concurrency-mode <ramp\|immediate>` | Start hosted work from one request (`ramp`) or at the configured cap (`immediate`)                                                                                      | `ramp`                 |
| `--price`                              | Estimate API-backed stages without making provider calls                                                                                                                | `false`                |

### Advanced Options

| Flag                            | Description                                                                                                                                                       | Default                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `--provider <provider[=model]>` | Text model for `blocking` and `scene`. `blocking` requires an OpenAI or Gemini vision-capable model ([Supported Models](./00-comic-overview.md#supported-models)) | `gpt-5.6-sol` for `blocking` and `scene` |

### Examples

```bash
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only structure
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only prompt
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only blocking --price
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only blocking
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only blocking --blocking-plan input/blocking/01-01.json
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only blocking --rebind
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only scene
bun autoshow comic draft-scenes 02-01 --only scene --panel-count 10 --no-blocking
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only panel-prompts
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --no-blocking
```

### Behavior

- The full run executes `structure`, `prompt`, `blocking`, `scene`, and `panel-prompts` in order. `--no-blocking` skips `blocking` and later stages ignore any existing `metadata/blocking-plan.json`.
- `--only structure` parses episode Markdown into structured script JSON locally. It calls a model only when `--provider` is passed.
- `--only prompt` writes `metadata/draft-prompt.md` and `metadata/blocking-prompt.md` with no provider call. An existing blocking plan is included in the scene-drafting prompt.
- `--only blocking` drafts `metadata/blocking-plan.json` from the structured script, the character catalog, location specifications, an optional floor plan in `input/locations/location-plans.json`, and each location's establishing view. A plan that still fails validation after one retry is saved as `metadata/blocking-plan.invalid.json`.
- `--only scene` drafts scene JSON from the prompt bundle. With a plan, every panel must cite it, and a draft that contradicts the plan retries once. Invalid output is saved as `scene.invalid.json`.
- `--panel-count <n>` requires exactly `n` panels, in the same order as authored `[Panel N]` notes when those notes exist. The stage fails before any call when the note count differs from `n`, and a draft that misses the count retries once. [`draft-treatment`](./07-draft-treatment.md) writes one note per panel, so pass that count here.
- `--only panel-prompts` builds panel prompt bundles from scene JSON with no provider call. Register [character and location references](./02-reference-sketch.md) first. When a plan exists, local review files are also written under `metadata/blocking/`.
- `--price` estimates `blocking` and `scene`, and `structure` when `--provider` is passed. Those estimates include one retry for a drafted blocking plan and for a scene draft that has a plan or `--panel-count`. Import, rebind, prompt, and panel-prompts report zero calls. `--panel-count` is the panel count used in the scene estimate.

### Blocking plan

- When a reviewed `metadata/scene.json` already exists, `blocking` leaves it unchanged and writes `metadata/blocking-bindings.json` instead.
- `--blocking-plan <path>` imports a hand-authored plan with no provider call. Stale citations are rejected and the error names `--rebind`. If a reviewed scene exists, the import must include `panelBindings` for every panel that does not already cite blocking.
- `--rebind` rewrites the plan against the current structured script and exits non-zero when any citation stays unresolved. Repeated lines that cannot be distinguished stay unresolved.
- To follow segments that were split or merged, re-run `structure` in the same run with global `--output-dir`, then `--rebind`. A full run and `--only structure` otherwise start a fresh run directory.
- After editing the plan, rerun `--only panel-prompts`. `generate-images` refuses bundles built from a different or missing plan.

See the workspace tree in [types and output](../../../diagrams/05-types-and-output.md) for the blocking files this command writes.

### Reconcile from directives

`--reconcile-from-directives` applies these script directives with no provider call:

- `**CAMERA:** {panel: <n>}` sets that panel's camera when the panel cites blocking and the text names a camera setup in the plan. Any other camera text is kept as a note on that panel's shot.
- `**BREAK-180:** {panel: <n>}` marks that panel as an axis break when the panel cites blocking.
- `**COSTUME:** {character: <key>}` records that character's wardrobe change on the blocking plan.
- `**EXTRAS:** {group: <key>, count: <n>, exclude: <a|b>}` sets that group's count when the header includes one, and adds the listed names to its exclusions.

A directive that splits or merges panels is rejected. Change the panel list by redrafting the scene. A directive that targets `next`, names a panel, character, or ensemble the scene does not have, or marks an axis break on a panel that does not cite blocking, is skipped and reported. Applied changes and skips are written to `metadata/review/reconcile-<run-id>.json`. The pass starts a fresh run directory unless global `--output-dir` pins the reviewed run. When the plan changes, rerun `--only panel-prompts`.

Next: [reference-sketch](./02-reference-sketch.md).
