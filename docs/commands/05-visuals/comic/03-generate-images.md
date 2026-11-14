# comic generate-images

Generate review sketches and final images from reviewed scene JSON, current registered references, and complete panel prompt bundles. Use [Harborlight setup](./00-comic-overview.md#setup) variables and estimate the [related batch](./00-comic-overview.md#cumulative-estimate) before dispatch.

## Options

- `--target images|sketches|both`: default `images`; `both` replaces separate sketch/image invocations.
- `--panels all|range|list`: default `all`; mixed lists such as `1-4,9` work for final images. Sketch selections must be contiguous; overlong ranges clamp.
- `--provider provider[=model]`: repeatable, default `openai=gpt-image-2.5-flare`. `--size` defaults to `1536x1024`, quality to `high`; [model capabilities](../image/overview.md) govern other values.
- `--panels-per-image N`: final default 1, sketch default 6. Grouped output uses `pages/`; `--grid CxR` locally composes individual finals and requires size `1536x1024` and one panel per image.
- `--variation canonical|animation-polish|cinematic-depth`: comma-separated final-image variants; default canonical.
- `--qa`/`--no-qa`: final QA defaults on, with `--qa-provider openai=gpt-6.1-sol`. Judges must be supported OpenAI/Gemini vision models. `--max-repairs` defaults to 2 for generation, 0 for audit/revision.
- `--provider-concurrency`: default 7 across panels/pages/models/variations; hosted `--concurrency-mode` defaults to `ramp`.
- `--force`: regenerate image outputs, preserving reviewed scene/prompts. `--stop-on-provider-error` stops new work after the first provider error while retaining written attempts.
- `--credit-preflight`: check OpenAI model-list access, not credit balance or generation admission. Price mode reports the check without requesting it.
- `--price`: estimate without provider calls; missing prerequisites can leave the quote incomplete.

## Examples

After completing local panel prompts, choose the accepted generation mode:

```bash
bun --no-env-file autoshow comic generate-images "$SCRIPT" --target both --provider openai=gpt-image-2.5-flare --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-images "$SCRIPT" --target images --panels 1,3 --provider openai=gpt-image-2.5-flare --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-images "$SCRIPT" --grid 2x2 --panels-per-image 1 --provider openai=gpt-image-2.5-flare --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Runs write `panels/<run-id>/`, `pages/<run-id>/`, or `sketches/<run-id>/`; multiple models add a model directory, and variants add `<variation>/<model>/`. These candidates are not canonical slideshow panels. Inspect them and follow the [local publication step](./00-comic-overview.md#4-build-panel-prompts-generate-images-and-review). QA publication still requires human review.

Recorded interrupted generation uses [`resume`](../../00-setup-and-utilities/resume.md#comic-recovery), which reuses completed images; missing exact recovery intent blocks older runs. Force, audits, and revisions remain explicit operations.

## Optional audit and revision prerequisites

Audit/revision reads reviewed canonical `panels/panel-NN.png`, not nested candidates. `--qa-only` requires final individual images, QA on, and zero repairs; it rejects force, grids, variations, grouped pages, explicit generation options, layout guides, and revision mode. It judges without generating, repairing, promoting, or changing scene-manifest state.

```bash
bun --no-env-file autoshow comic generate-images "$SCRIPT" --qa-only --max-repairs 0 --panels 1-4 --qa-provider openai=gpt-6.1-sol --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Audit outputs are `qa/panel-audit-<run-id>/page-qa-report.{json,md}` and `qa-only-audit.json`. Hard failures stay in the report. Plain audits judge again on each invocation.

### Continuity audit

`--continuity-qa` requires QA-only and adds axis, cast, screen side, posture, placement, wardrobe, and furniture findings. `--continuity-only` skips page judging. Neither mode repairs images.

`--labels <path>` supplies reviewed [continuity labels](../../../../src/cli/commands/visuals/comic/comic-utils/continuity-labels.ts) for per-key precision/recall. Empty templates are invalid. `--trusted-anchor-panel N` overrides the labels' anchor or panel 1. Anchors apply per location across returns; a location without a trusted panel uses its first panel. Predecessors come from the same contiguous visit.

Findings live in `qa/continuity-audit-<run-id>/`. Page QA is reusable only with matching judge/current inputs and existing continuity evidence; continuity itself runs again. Price mode counts one continuity call per selected panel, plus page calls unless continuity-only.

### Blocking

A compiled ledger drives generation and QA: declared set anchors stay visible; unlisted characters are failures. Panels without a ledger receive no blocking audit. `--blocking-hard-keys <comma-list>` promotes supported statuses from advisory to hard; see `--help` for the accepted keys. `scale-wrong` and `crowd-uniform` remain advisory.

Experimental `--blocking-layout-guide` attaches `metadata/blocking/panel-NN-layout.png` only to final individual panels with at least six visible named characters. It is incompatible with grouped pages, audit, or revision. Price estimates include it as a reference for initial and repair requests.

### Conservative individual-panel repairs

Ambiguous, hidden, vague, or low-confidence findings stay failed without a purchased edit. Visible high-confidence failures may receive up to the repair limit. Only spatial hard failures including a promoted blocking/axis check restart from canonical references; other eligible failures edit the candidate.

Removing hard failures without adding any can proceed without comparisons. Otherwise two order-swapped comparisons must agree on improvement without regression; publication always requires QA success. Stagnation permits one restart, then unresolved/oscillating failures stop. Preserve failed candidates and reports. Grouped-page repairs do not use this confidence gate.

Each possible individual repair reserves an image edit/regeneration, candidate QA, and two comparisons; actual calls may be fewer.

### Revision evaluation mode

A [validated revision plan](../../../../src/cli/commands/visuals/comic/comic-commands/generate-images/revision-plan-validation.ts) freezes panel selections, issues/importance, corrections, and hashes of source, prior QA, original images, reviewed contracts, and references. Another scene's or stale plan fails.

Revision requires final individual images, `openai=gpt-image-2.5-flare`, judge `openai=gpt-6.1-sol`, and zero normal repairs; omitted values are inferred. Explicit `--promote clear-winners` authorizes promotion. Force, audit, disabled QA, sketches, grids, grouping, variants, and multiple models are rejected.

Each pending panel gets at most one edit and two order-swapped comparisons. Promotion requires meaningful importance, agreement that the issue materially improved, and no major regression/preservation damage; otherwise retain original bytes. Failed, malformed, interrupted, or ambiguous requests are not automatically repurchased.

Evidence remains under `revision-evaluations/<experiment-id>-<fingerprint-prefix>/`. Compatible completed evidence is reused; price mode validates hashes and prices only outstanding edits/comparisons without writes.

### Blooper ledger

With `--bloopers`, successful panel renders copy non-promoted attempts to `output/bloopers/<episode>/<scene-slug>/` with provenance sidecars and append the shared ledger. Published bytes are excluded; bloopers never become canonical outputs.
