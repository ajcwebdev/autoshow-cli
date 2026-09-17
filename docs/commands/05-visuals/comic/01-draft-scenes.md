# comic draft-scenes

`draft-scenes` turns episode script Markdown into structured script JSON, a scene-drafting prompt, a blocking plan, scene JSON, and panel prompt bundles.

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

| Flag                                   | Description                                                                                                                                                                                                                                                                                   | Default                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `--only <stage>`                       | Run only `structure`, `prompt`, `blocking`, `scene`, or `panel-prompts`                                                                                                                                                                                                                       | none (runs all stages) |
| `--blocking`, `--no-blocking`          | Run or skip the `blocking` stage in a full run; `--no-blocking` also drafts scene JSON and panel prompt bundles plan-free                                                                                                                                                                     | `--blocking`           |
| `--blocking-plan <path>`               | Import a hand-authored blocking plan JSON instead of drafting one; makes no provider call and is only valid with `--only blocking` or a full run                                                                                                                                              | none                   |
| `--rebind`                             | Remap the existing plan's citations to the current structured script and report unresolved ones; requires `--only blocking` and makes no provider call                                                                                                                                        | `false`                |
| `--reconcile-from-directives`          | Apply the script's `**CAMERA:**`, `**BREAK-180:**`, `**COSTUME:**`, and `**EXTRAS:**` staging directives to the reviewed scene and blocking plan without an LLM call; rejects panel splits and merges and cannot be combined with `--only`, `--rebind`, `--blocking-plan`, or `--panel-count` | `false`                |
| `--panel-count <n>`                    | Require exactly this many panels from the `scene` stage, one per authored `[Panel N]` note in order; only valid with `--only scene` or a full run                                                                                                                                             | none                   |
| `--provider-concurrency <n>`           | Number of panels to build prompt bundles for in parallel during `panel-prompts`, and the hosted request cap for the `blocking` and `scene` stages                                                                                                                                             | `7`                    |
| `--concurrency-mode <ramp\|immediate>` | Approach hosted LLM work from one request per provider/account lane (`ramp`) or start at the configured cap (`immediate`)                                                                                                                                                                     | `ramp`                 |
| `--price`                              | Estimate API-backed stages without making API calls                                                                                                                                                                                                                                           | `false`                |

### Advanced Options

| Flag                            | Description                                                                                                                                                                                | Default                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `--provider <provider[=model]>` | Text model for the `blocking` and `scene` stages (see [Supported Models](./00-comic-overview.md#supported-models)); the `blocking` stage requires an OpenAI or Gemini vision-capable model | `gpt-5.6-sol` for the `blocking` and `scene` stages |

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

- The full run executes `structure`, `prompt`, `blocking`, `scene`, and `panel-prompts` in order. `--no-blocking` skips `blocking` and makes later stages ignore any existing `metadata/blocking-plan.json`.
- `--only structure` parses episode Markdown into structured script JSON locally, and adds an LLM review pass only when `--provider` is passed explicitly.
- `--only prompt` writes `metadata/draft-prompt.md` and `metadata/blocking-prompt.md` without calling an API. When a blocking plan already exists, the scene-drafting prompt includes it.
- `--only blocking` drafts `metadata/blocking-plan.json` from the structured script, the character catalog, location specifications, and each location's establishing view. A plan that fails validation is saved as `metadata/blocking-plan.invalid.json`.
- `--only scene` drafts scene JSON from an existing prompt bundle. When a plan exists, every panel must cite it. Invalid output is saved as `scene.invalid.json`.
- `--panel-count <n>` requires exactly `n` panels, matching authored `[Panel N]` notes in order when those notes exist. The stage fails before any call when the authored note count differs from `n`. Treatments from [`draft-treatment`](./07-draft-treatment.md) always author one note per panel, so pass the same count here.
- `--only panel-prompts` builds panel prompt bundles from existing scene JSON without calling an API. Register [character and location references](./02-reference-sketch.md) first. When a plan exists, `metadata/blocking/` receives `plan-overview.svg`, one `panel-NN.svg` per panel, `blocking-ledger.md`, and a `panel-NN-layout.png` for dense panels.
- `--price` estimates the `blocking` and `scene` stages without calling a provider, and the `structure` stage when `--provider` is passed. Import, rebind, prompt, and panel-prompts report zero calls. `--panel-count` sets the panel count used in the scene estimate.

### Blocking plan

- When a reviewed `metadata/scene.json` already exists, the `blocking` stage leaves it untouched and writes `metadata/blocking-bindings.json` instead.
- `--blocking-plan <path>` imports a hand-authored plan without a provider call. Stale citations are rejected with a `--rebind` hint. If a reviewed scene exists, the import file must include `panelBindings` for every panel that does not already cite blocking.
- `--rebind` (with `--only blocking`) remaps every citation to the current structured script, writes the plan back, and exits non-zero if any citation remains unresolved. Identical repeated lines that cannot be told apart are left unresolved rather than guessed.
- After a `structure` re-run, `--rebind` uses `metadata/structured-script.previous.json` to follow split or merged segments. That file does not exist until a later structure run replaces an existing script.
- After editing the plan, rerun `--only panel-prompts`. `generate-images` refuses to start when the bundles were built from a different or missing plan.

See the workspace tree in [types and output](../../../diagrams/05-types-and-output.md) for the blocking files this command writes.

### Reconcile from directives

`--reconcile-from-directives` applies these script directives with no provider call:

- `**CAMERA:** {panel: <n>}` sets that panel's camera when the directive text names an existing camera setup id; otherwise it appends `Reviewer camera note: <text>` to the panel's shot plan.
- `**BREAK-180:** {panel: <n>}` marks that panel as an axis break.
- `**COSTUME:** {character: <key>}` appends the deviation to that character's wardrobe in `metadata/blocking-plan.json`.
- `**EXTRAS:** {group: <key>, count: <n>, exclude: <a|b>}` updates the matching extras region's `count`, `exclude`, and `props`.

A directive that asks for a panel split or merge is rejected; only a scene redraft can change the panel list. A directive targeting `next` instead of a bound panel number, or naming a panel, character, or ensemble the scene does not have, is skipped and reported rather than guessed. Applied changes and skips are written to `metadata/review/reconcile-<run-id>.json`. When the plan changed, rerun `--only panel-prompts`.

Next: [reference-sketch](./02-reference-sketch.md).
