# comic draft-scenes

Convert episode Markdown into a prepared structure and draft prompt, a reviewed scene, and panel prompt bundles. Use the workspace variables from [setup](./00-comic-overview.md#setup); `--output-dir "$RUN"` keeps every stage in the same run.

## Options

- `--only prepare|scene|panel-prompts`: run one stage; omitted runs all three in that order. The retired `--only structure` and `--only prompt` selectors are rejected with guidance to use `--only prepare`; `--only blocking` is rejected.
- `--panel-count <n>`: require 1–60 scene panels, valid for a full run or `--only scene`.
- `--provider provider[=model]`: scene-drafting text model, default `openai=gpt-6.1-sol`. Accepted for full runs and `--only scene`; rejected with `--only prepare`, which is always local.
- `--provider-concurrency`: default 7; hosted `--concurrency-mode` defaults to `ramp`.
- `--price`: no provider calls or writes; missing prerequisites can prevent a complete estimate.

The blocking stage and its flags (`--blocking`, `--no-blocking`, `--blocking-plan`, `--rebind`, `--reconcile-from-directives`) are retired and rejected before any work.

## Examples

The [walkthrough](./00-comic-overview.md#walkthrough-harborlight) shows the complete sequence. Each stage can also run alone:

```bash
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only prepare --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only scene --panel-count 4 --provider openai=gpt-6.1-sol --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only panel-prompts --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

The last command requires a completed, reviewed scene. After editing `metadata/scene.json`, rerun only `--only panel-prompts`; it makes zero hosted calls and preserves the edited scene. After editing the script, rerun `--only prepare` before drafting again.

## Behavior

- `prepare` locally parses the script, validates source spans, and builds the draft prompt from that exact structure, including recap montage expansion. It writes `metadata/structured-script.json` and `metadata/draft-prompt.md` together; a parse or prompt failure never leaves a new structure paired with a stale prompt eligible for drafting. Without a pinned output directory, a full run or standalone prepare starts a new run; with `--output-dir`, both files go to that workspace after a source ownership check.
- Scripts that still contain retired staging labels (for example `**BLOCKING:**` or `**CAMERA:**` directives) are reported with their source location before drafting. Soundscape directives and ordinary panel notes are unaffected.
- `scene` uses the prepared pair. A requested panel-count mismatch allows one retry; invalid parsed candidates go to `metadata/scene.invalid.json`.
- Authored `[Panel N]` notes must match `--panel-count` before scene dispatch. Preserve note order and pass the actual count from [draft-treatment](./07-draft-treatment.md).
- `panel-prompts` is local and needs registered references. It writes per-panel bundles under `metadata/panel-prompts/`.
- `--only prepare --price` is free and writes nothing. A full estimate covers scene drafting and its applicable panel-count retry; prepare and panel prompts are local.
- Existing runs: older structure, scene, and bundle records without blocking data stay readable. Records that carry a blocking plan or its hashes are either converted locally or reported with the stage to rebuild; reviewed scene text, cast, speech, panel numbering, and source citations are preserved, and original artifacts are retained.
