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

| Flag                                   | Description                                                                                                                | Default                |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `--only <stage>`                       | Run only `structure`, `prompt`, `blocking`, `scene`, or `panel-prompts`                                                    | none (runs all stages) |
| `--blocking`, `--no-blocking`          | Run or skip the `blocking` stage in a full run; `--no-blocking` also drafts scene JSON and panel prompt bundles plan-free  | `--blocking`           |
| `--blocking-plan <path>`               | Import a hand-authored blocking plan JSON instead of drafting one; makes no provider call and is only valid with `--only blocking` or a full run | none                   |
| `--rebind`                             | Remap the existing plan's citations to the current structured script and report unresolved ones; requires `--only blocking` and makes no provider call | `false`                |
| `--reconcile-from-directives`          | Apply the script's `**CAMERA:**`, `**BREAK-180:**`, `**COSTUME:**`, and `**EXTRAS:**` staging directives to the reviewed scene and blocking plan without an LLM call; rejects panel splits and merges and cannot be combined with `--only`, `--rebind`, or `--blocking-plan` | `false`                |
| `--panel-count <n>`                    | Require exactly this many panels from the `scene` stage, one per authored `[Panel N]` note in order; only valid with `--only scene` or a full run | none                   |
| `--concurrency <n>`                    | Number of panels to build prompt bundles for in parallel during `panel-prompts`, and the hosted request cap for LLM stages | `7`                    |
| `--concurrency-mode <ramp\|immediate>` | Approach hosted LLM work from one request per provider/account lane (`ramp`) or start at the configured cap (`immediate`)  | `ramp`                 |
| `--price`                              | Estimate API-backed stages without making API calls                                                                        | `false`                |

### Advanced Options

| Flag                  | Description                                                                                          | Default                             |
| --------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `--llm-model <model>` | Text model for the `blocking` and `scene` stages (see [Supported Models](./00-comic-overview.md#supported-models)); the `blocking` stage requires an OpenAI or Gemini vision-capable model | `gpt-5.6-sol` for the `blocking` and `scene` stages |

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

- The full run executes `structure`, `prompt`, `blocking`, `scene`, and `panel-prompts` in order. `--no-blocking` drops `blocking` from a full run and makes the `scene` and `panel-prompts` stages ignore any `metadata/blocking-plan.json` already in the workspace.
- `--only structure` parses episode Markdown into structured script JSON locally, and adds an LLM review pass only when `--llm-model` is passed explicitly.
- `--only prompt` writes `metadata/draft-prompt.md` and `metadata/blocking-prompt.md` without calling an API. When a blocking plan already exists, the scene-drafting prompt includes it.
- `--only blocking` drafts `metadata/blocking-plan.json` from the structured script, the character catalog, the canonical location specifications, and each location's establishing view. It makes one vision-capable LLM call plus at most one retry. A plan that still fails is saved as `metadata/blocking-plan.invalid.json`.
- `--only scene` drafts scene JSON from an existing prompt bundle. When a plan exists, every panel must cite it, the draft is validated against the plan with one retry, and invalid output is saved as `scene.invalid.json`.
- `--panel-count <n>` requires exactly `n` panels, matching authored `[Panel N]` notes in order when those notes exist. The stage fails before any call when the authored note count differs from `n`, and a draft that breaks the contract gets one retry. Treatments from [`draft-treatment`](./07-draft-treatment.md) always author one note per panel, so pass the same count here.
- `--only panel-prompts` builds panel prompt bundles from existing scene JSON without calling an API. Register [character and location references](./02-reference-sketch.md) first. When a plan exists, `metadata/blocking/` receives `plan-overview.svg`, one `panel-NN.svg` per panel, `blocking-ledger.md`, and a `panel-NN-layout.png` for every ledger with at least six visible named characters.
- `--price` estimates the `blocking` and `scene` stages without calling a provider. Import, rebind, prompt, panel-prompts, and reconcile report zero calls. A plan section or `--panel-count` contract doubles the scene estimate to cover the retry; `--panel-count` also sets the panel count used in the estimate.

### Blocking plan

- Bind mode is automatic: when a reviewed `metadata/scene.json` already exists, the `blocking` stage leaves it untouched and writes `metadata/blocking-bindings.json` with one camera and stage-state citation per panel.
- `--blocking-plan <path>` imports a hand-authored plan without any provider call. Stale citations are rejected with a `--rebind` hint. In bind mode the file must carry `panelBindings` for every panel that does not already cite blocking.
- `--rebind` (with `--only blocking`) remaps every segment citation to the current structured script, writes the plan back, and exits non-zero if any citation remains unresolved. Identical repeated lines that cannot be told apart are left unresolved rather than guessed.
- After a `structure` re-run, `--rebind` uses `metadata/structured-script.previous.json` to recognize segments that were split or merged rather than only renumbered. The first `structure` run in a workspace has no previous snapshot.
- After editing the plan, rerun `--only panel-prompts`. `generate-images` refuses to start when the bundles were built from a different or missing plan.
- Artifacts: `metadata/blocking-prompt.md`, `metadata/blocking-plan.json`, `metadata/blocking-plan.invalid.json`, `metadata/blocking-bindings.json`, and `metadata/blocking/{plan-overview.svg, panel-NN.svg, panel-NN-layout.png for dense ledgers, blocking-ledger.md}`; see the workspace tree in [types and output](../../../diagrams/05-types-and-output.md).

### Reconcile from directives

`--reconcile-from-directives` is a standalone pass that makes no provider call. It applies directive-only corrections:

- `**CAMERA:** {panel: <n>}` sets that panel's camera when the directive text names an existing camera setup id; otherwise it appends `Reviewer camera note: <text>` to the panel's shot plan.
- `**BREAK-180:** {panel: <n>}` marks that panel as an axis break.
- `**COSTUME:** {character: <key>}` appends the deviation to that character's wardrobe in `metadata/blocking-plan.json`.
- `**EXTRAS:** {group: <key>, count: <n>, exclude: <a|b>}` updates the matching extras region's `count`, `exclude`, and `props`.

A directive that asks for a panel split or merge is rejected with a validation error naming the directive, because only a scene redraft can change the panel list. A directive targeting `next` instead of a bound panel number, or naming a panel, character, or ensemble the scene does not have, is skipped and reported rather than guessed. Every applied change and every skip is written to `metadata/review/reconcile-<run-id>.json`. When the plan changed, re-run `--only panel-prompts` to rebuild the bundles from the edited plan.

Next: [reference-sketch](./02-reference-sketch.md).
