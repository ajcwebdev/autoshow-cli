# comic draft-scenes

`draft-scenes` turns episode script Markdown into structured script JSON, prompts, an optional blocking plan, scene JSON, and panel prompt bundles.

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
| `--blocking-plan <path>`               | Import a plan for the blocking stage without a provider call. A full run still executes the other stages; incompatible with `--no-blocking`                             | none                   |
| `--rebind`                             | Remap the plan's citations to the current structured script and report unresolved ones. Requires `--only blocking` and makes no provider call                           | `false`                |
| `--reconcile-from-directives`          | Apply the script's staging directives to the reviewed scene and plan, with no provider call. Not valid with `--only`, `--rebind`, `--blocking-plan`, or `--panel-count` | `false`                |
| `--panel-count <n>`                    | Require exactly 1–60 panels from the `scene` stage. Valid with `--only scene` or a full run                                                                             | none                   |
| `--provider-concurrency <n>`           | Panels built in parallel during `panel-prompts`, and the hosted request cap for `blocking` and `scene`                                                                  | `7`                    |
| `--concurrency-mode <ramp\|immediate>` | Start hosted work from one request (`ramp`) or at the configured cap (`immediate`)                                                                                      | `ramp`                 |
| `--price`                              | Estimate API-backed stages without making provider calls                                                                                                                | `false`                |

### Advanced Options

| Flag                            | Description                                                                                                                                                                        | Default                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `--provider <provider[=model]>` | Model for structure review, blocking, and scene drafting. Blocking requires an OpenAI or Gemini vision-capable model ([Supported Models](./00-comic-overview.md#supported-models)) | `gpt-6.1-sol` for blocking and scene; structure is local unless explicitly set |

### Examples

Use the variables and fresh workspace from the [Harborlight setup](./00-comic-overview.md#setup). These examples share the same four-panel scene.

The walkthrough imports the authored blocking plan after structure exists and the plan helper has run. The scene drafting call is hosted; include it in the [complete batch estimate](./00-comic-overview.md#cumulative-estimate).

```bash
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only structure --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only prompt --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only blocking --blocking-plan "$ROOT/blocking-plan.json" --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only scene --panel-count 4 --provider openai=gpt-6.1-sol --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only scene --panel-count 4 --provider openai=gpt-6.1-sol --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only panel-prompts --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

To draft blocking instead of importing it, prepare a separate workspace and estimate that call and its validation retry first:

```bash
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only blocking --provider openai=gpt-6.1-sol --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only blocking --provider openai=gpt-6.1-sol --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

For either alternative below, rerun [setup](./00-comic-overview.md#setup) with an unused `--root` and reset the workspace variables. The full pipeline includes hosted structure review, blocking, and scene drafting when `--provider` is explicit. The scene-only alternative requires existing local structure and prompts and ignores any prior blocking plan. Estimate the chosen workflow before running it.

```bash
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --panel-count 4 --provider openai=gpt-6.1-sol --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only scene --panel-count 4 --no-blocking --provider openai=gpt-6.1-sol --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

After pasting accepted directives from `review --notes` into the copied script, refresh structure in the same run, rebind the existing plan, apply the directives, and rebuild panel prompts. These commands are local because no `--provider` is supplied; notes processing alone does not edit the script.

```bash
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only structure --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only blocking --rebind --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --reconcile-from-directives --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only panel-prompts --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

### Behavior

- The full run executes `structure`, `prompt`, `blocking`, `scene`, and `panel-prompts` in order. `--no-blocking` skips `blocking` and later stages ignore any existing `metadata/blocking-plan.json`.
- `--only structure` parses episode Markdown into structured script JSON locally. It calls a model only when `--provider` is passed.
- `--only prompt` writes `metadata/draft-prompt.md` with no provider call, plus `metadata/blocking-prompt.md` when its required catalog inputs are available. An existing blocking plan is included in the scene-drafting prompt.
- `--only blocking` drafts `metadata/blocking-plan.json` from the structured script, the character catalog, location specifications, an optional floor plan in `input/locations/location-plans.json`, and each location's establishing view. A plan that still fails validation after one retry is saved as `metadata/blocking-plan.invalid.json`.
- `--only scene` drafts scene JSON from the prompt bundle. With a plan, every panel must cite it, and a draft that contradicts the plan retries once. Parsed candidates that fail validation are saved as `metadata/scene.invalid.json`.
- `--panel-count <n>` requires exactly `n` panels in authored `[Panel N]` order when those notes exist. A mismatched note count is rejected before the scene drafting call; earlier stages in a full run may already have made hosted calls. A draft that misses the count retries once. [`draft-treatment`](./07-draft-treatment.md) writes one note per panel, so pass that count here.
- `--only panel-prompts` builds panel prompt bundles from scene JSON with no provider call. Register [character and location references](./02-reference-sketch.md) first. When a plan exists, local review files are also written under `metadata/blocking/`.
- `--price` estimates the selected stages without provider calls. Blocking and scene estimates require existing structure and prompts respectively; missing artifacts produce a notice rather than a complete quote. Estimates reserve one validation retry for drafted blocking and for scenes with a plan or `--panel-count`. Structure is billable only with explicit `--provider`; import, rebind, prompt, and panel-prompts are local.

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

Reconcile reads the saved structured script, so rerun `--only structure` after editing source directives and rebind an existing plan before rebuilding prompts. Keep `--output-dir` pinned to the reviewed run as in the [example](#examples).

A directive that splits or merges panels is rejected; redraft the scene to change the panel list. Unresolved targets and axis breaks on panels without blocking are skipped and reported in `metadata/review/reconcile-<run-id>.json`. Rebuild panel prompts after scene or plan changes.

Next: [reference-sketch](./02-reference-sketch.md).
