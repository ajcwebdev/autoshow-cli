# comic draft-scenes

Convert episode Markdown into structure, prompts, optional blocking, a reviewed scene, and panel prompt bundles. Use the workspace variables from [setup](./00-comic-overview.md#setup); `--output-dir "$RUN"` keeps every stage in the same run.

## Options

- `--only structure|prompt|blocking|scene|panel-prompts`: run one stage; omitted runs all in that order.
- `--no-blocking`: skip blocking and ignore existing plans downstream.
- `--blocking-plan <path>`: import authored blocking without a provider call; incompatible with `--no-blocking`.
- `--rebind`: remap citations locally; requires `--only blocking`.
- `--reconcile-from-directives`: apply reviewed staging locally; incompatible with `--only`, `--rebind`, `--blocking-plan`, and `--panel-count`.
- `--panel-count <n>`: require 1–60 scene panels, valid for a full run or `--only scene`.
- `--provider provider[=model]`: text model, default `openai=gpt-6.1-sol`; blocking needs a supported OpenAI/Gemini vision model. Structure calls it only when explicitly selected.
- `--provider-concurrency`: default 7; hosted `--concurrency-mode` defaults to `ramp`.
- `--price`: no provider calls; missing prerequisites can prevent a complete estimate.

## Examples

The [walkthrough](./00-comic-overview.md#walkthrough-harborlight) shows the complete sequence. Once structure and the authored plan exist:

```bash
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only blocking --blocking-plan "$ROOT/blocking-plan.json" --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only scene --panel-count 4 --provider openai=gpt-6.1-sol --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only panel-prompts --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

The last command requires a completed, reviewed scene. To purchase hosted blocking instead of importing, omit `--blocking-plan` and select `--provider`; include its validation retry in the batch estimate.

After applying accepted review directives to the script:

```bash
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only structure --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only blocking --rebind --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --reconcile-from-directives --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only panel-prompts --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

## Behavior

- `structure` locally parses the script; explicit `--provider` adds hosted review. Without a pinned output directory, a full run or structure stage starts a new run.
- `prompt` writes `metadata/draft-prompt.md`, plus `blocking-prompt.md` when required catalog inputs exist. Existing blocking is included in the scene prompt.
- `blocking` uses structured sources, character/location catalogs, establishing views, and optional location geometry. One validator retry is allowed; an invalid final candidate is saved as `metadata/blocking-plan.invalid.json`.
- `scene` uses the prompt bundle. Planned scenes must cite blocking; contradictions or a requested panel-count mismatch allow one retry. Invalid parsed candidates go to `metadata/scene.invalid.json`.
- Authored `[Panel N]` notes must match `--panel-count` before scene dispatch; earlier stages of a full run may already have incurred charges. Preserve note order and pass the actual count from [draft-treatment](./07-draft-treatment.md).
- `panel-prompts` is local and needs registered references. It writes per-panel bundles and, with blocking, local review files under `metadata/blocking/`.
- Price planning requires structure for blocking and prompts for scene drafting. It reserves the applicable validation retry; import, rebind, prompt, and panel prompts are local.

## Blocking plan

Import/rebind preserves reviewed `metadata/scene.json`, recording bindings separately in `metadata/blocking-bindings.json`. Imported plans need current citations and `panelBindings` for reviewed panels without their own blocking citation. Rebind uses segment content hashes; ambiguous repeated or unresolved lines fail rather than guess.

After source edits, refresh structure in the pinned run and rebind. After plan edits, rebuild panel prompts: image generation rejects bundles tied to a different or missing plan. See [location geometry](./02-reference-sketch.md#location-plans).

## Reconcile from directives

Reconcile reads saved structure and applies these directives without an LLM:

- `**CAMERA:** {panel: N}` selects a named plan camera for blocking-bound panels; other text remains a shot note.
- `**BREAK-180:** {panel: N}` marks an axis break on a blocking-bound panel.
- `**COSTUME:** {character: key}` records wardrobe changes.
- `**EXTRAS:** {group: key, count: N, exclude: a|b}` updates counts/exclusions.

Panel splits/merges are rejected; redraft to change the panel list. Unresolved targets and unbound axis breaks are skipped and reported in `metadata/review/reconcile-<run-id>.json`. General `**BLOCKING:**` prose needs a reviewed plan edit; reconcile does not infer positions.
