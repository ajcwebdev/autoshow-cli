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

## draft-scenes

### Options

| Flag                                   | Description                                                                                                                | Default                |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `--only <stage>`                       | Run only `structure`, `prompt`, `blocking`, `scene`, or `panel-prompts`                                                    | none (runs all stages) |
| `--blocking`, `--no-blocking`          | Run or skip the `blocking` stage in a full run; `--no-blocking` also drafts scene JSON and panel prompt bundles plan-free  | `--blocking`           |
| `--blocking-plan <path>`               | Import a hand-authored blocking plan JSON as the `blocking` stage output instead of drafting one; makes no provider call and combines with `--only blocking` | none                   |
| `--rebind`                             | Remap the existing plan's segment citations to the current structured script by segment content hash, report unresolved citations, and exit non-zero when any remain; requires `--only blocking` and makes no provider call | `false`                |
| `--reconcile-from-directives`          | Apply the script's `**CAMERA:**`, `**BREAK-180:**`, `**COSTUME:**`, and `**EXTRAS:**` staging directives to the reviewed scene and blocking plan without an LLM call; rejects panel splits and merges and cannot be combined with `--only`, `--rebind`, or `--blocking-plan` | `false`                |
| `--concurrency <n>`                    | Number of panels to build prompt bundles for in parallel during `panel-prompts`, and the hosted request cap for LLM stages | `7`                    |
| `--concurrency-mode <ramp\|immediate>` | Approach hosted LLM work from one request per provider/account lane (`ramp`) or start at the configured cap (`immediate`)  | `ramp`                 |
| `--price`                              | Estimate API-backed stages without making API calls                                                                        | `false`                |

### Advanced Options

| Flag                  | Description                                                                                          | Default                             |
| --------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `--llm-model <model>` | Use a supported vision-capable text model (see [Supported Models](./00-comic-overview.md#supported-models)) | `gpt-5.6-sol` for the `blocking` and `scene` stages |

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
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only panel-prompts
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --no-blocking
```

### Behavior

- The full run executes `structure`, `prompt`, `blocking`, `scene`, and `panel-prompts` in order. `--no-blocking` drops `blocking` from a full run and makes the `scene` and `panel-prompts` stages ignore any `metadata/blocking-plan.json` already in the workspace.
- `--only structure` parses episode Markdown into structured script JSON locally, and adds an LLM review pass only when `--llm-model` is passed explicitly.
- `--only prompt` builds the scene-drafting prompt bundle (`metadata/draft-prompt.md`) and the blocking drafter prompt (`metadata/blocking-prompt.md`) without calling an API. When `metadata/blocking-plan.json` already exists, the scene-drafting prompt ends with a `## Scene blocking plan` section.
- `--only blocking` drafts `metadata/blocking-plan.json` from the structured script, the character catalog, the canonical location specifications, and each location's establishing view with one vision-capable LLM call plus at most one automatic retry that appends the validator errors; a plan that still fails is saved as `metadata/blocking-plan.invalid.json` with the errors. The stage stamps hashes and provenance (`structuredScriptSha256`, `specificationSha256`, citation `sourceSegmentSha256`, `generatedBy`) itself, so the model and hand-authored imports never compute digests.
- `--only scene` drafts scene JSON from an existing prompt bundle. When a plan exists, the prompt carries the plan section, every panel must cite a `blocking` object (`cameraSetupId`, optional `stageStateId`, `croppedOnStage`, `axisBreak`), the draft is validated against the plan geometry with one automatic retry that appends the issues, and the written scene carries `blockingPlanSha256`. Invalid model output is saved as `scene.invalid.json` with validation details.
- `--only panel-prompts` builds panel prompt bundles from existing scene JSON without calling an API. Register [character and location references](./02-reference-sketch.md) first. When a plan exists, every bundle carries a compiled root `blocking` object and `planSha256`, the character snapshot widens to the plan's on-stage roster, and `metadata/blocking/` receives `plan-overview.svg`, one `panel-NN.svg` per panel, `blocking-ledger.md`, and a deterministic `panel-NN-layout.png` for every ledger with at least six visible named characters.
- `--price` estimates the `blocking` stage as up to two calls at 3,000 output units each plus 1,000 modeled image input units per location establishing view, and the `scene` stage as 400 fixed output units plus 480 output units per estimated panel, doubled to two calls when a plan section is present. Import and rebind runs report zero calls.

### Blocking plan

- Bind mode is automatic: when a reviewed `metadata/scene.json` already exists, the `blocking` stage leaves it untouched and writes `metadata/blocking-bindings.json` (`sceneSha256`, `planSha256`, and one camera and stage-state citation per panel) instead of requiring `blocking` objects inside the scene JSON.
- `--blocking-plan <path>` imports a hand-authored plan JSON as the stage output without any provider call; missing hashes are stamped, stale citations are rejected with a `--rebind` hint, and in bind mode the file must carry `panelBindings` for every panel without a `blocking` citation.
- `--rebind` (with `--only blocking`) rereads `metadata/blocking-plan.json` after a `structure` re-run, remaps every segment citation to the current structured script by segment content hash, writes the plan back, logs `blocking-plan rebound remapped=<n> unresolved=<n>`, and exits non-zero with a validation error listing each unresolved citation.
- A citation whose content hash matches more than one current segment, and whose own segment id survives in none of them, is reported unresolved rather than bound to the first match, because a repeated short line gives the rebind no way to tell the two apart.
- The `structure` stage copies the structured script it is about to replace to `metadata/structured-script.previous.json`, and `--rebind` reads that snapshot to recognize a segment that was split or merged rather than only renumbered. The snapshot is absent on a workspace's first `structure` run, and the rebind error says so when a citation could only have been resolved from it. An unreadable snapshot is treated as absent.
- `generate-images` refuses to start when a bundle's `planSha256` differs from the current `metadata/blocking-plan.json` (or the plan is missing); rerun `--only panel-prompts` after editing the plan.
- Artifacts: `metadata/blocking-prompt.md`, `metadata/blocking-plan.json`, `metadata/blocking-plan.invalid.json`, `metadata/blocking-bindings.json`, and `metadata/blocking/{plan-overview.svg, panel-NN.svg, panel-NN-layout.png for dense ledgers, blocking-ledger.md}`; see the workspace tree in [types and output](../../../diagrams/05-types-and-output.md).

### Reconcile from directives

`--reconcile-from-directives` is a standalone pass that makes no provider call. It reads `structuredScript.staging` and applies directive-only corrections:

- `**CAMERA:** {panel: <n>}` rewrites that panel's `blocking.cameraSetupId` when the directive text names an existing camera setup id; otherwise it appends `Reviewer camera note: <text>` to the panel's `shotPlan`.
- `**BREAK-180:** {panel: <n>}` sets that panel's `blocking.axisBreak`, citing the directive's `afterSegmentId` when it has one and the panel's first source segment otherwise.
- `**COSTUME:** {character: <key>}` appends the deviation to that character's `wardrobe` in the stage state that carries their mark, editing `metadata/blocking-plan.json` in place.
- `**EXTRAS:** {group: <key>, count: <n>, exclude: <a|b>}` updates the matching extras region's `count`, `exclude`, and `props`.

A directive that asks for a panel split or merge is rejected with a `ValidationError` naming the directive, because only a scene redraft can change the panel list. A directive targeting `next` instead of a bound panel number, or naming a panel, character, or ensemble the scene does not have, is skipped and reported rather than guessed. Every applied change and every skip is written to `metadata/review/reconcile-<run-id>.json`. When the plan changed, re-run `--only panel-prompts` to recompile the bundles from the edited plan.

Next: [reference-sketch](./02-reference-sketch.md).
