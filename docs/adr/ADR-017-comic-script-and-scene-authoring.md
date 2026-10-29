# ADR-017: Comic Script and Scene Authoring

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-09-02
- **Date Updated:** 2026-10-28
- **Verification Status:** Passed
- **Supersession:** Absorbs "Compile a Text-First Blocking Plan Into a Panel Ledger" and "Draft Episode Scripts From Prose Treatments" in full, plus the `comic review` mechanics from the 2026-09-10 amendment of "Integrate Comic with Shared Model and Native CLI Infrastructure". This record owns the text-to-validated-scene stages: `comic draft-treatment`, `comic draft-scenes` and its blocking stage, `comic review`, and the blocking-derived lines and checks in `comic generate-images`. The canonical and deprecated review command names are owned by [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md).

## Context

The `comic` pipeline starts from an episode script with scene headings, catalog-resolvable sluglines, panel notes, and speaker labels. A prose treatment needs adaptation into that format and may introduce characters and locations that require catalog entries and an existing style seed image. A fixed panel count also needs validation rather than a prompt hint.

Independent panel generation originally lacked persistent staging and off-frame cast information. Recurring defects included side flips, seat swaps, changing set geometry, intruding characters, and disappearing crowds; edits seeded with a failed image could preserve the faulty pose. Human review also needed a local notes round trip that leaves the authored script unchanged.

Why now: the first treatment that was not already a script arrived, and an episode review produced a written list of continuity defects that three rounds of prose prohibitions had failed to fix, while the later stages were stable enough that a front stage emitting their script shape is cheaper and safer than a second pipeline.

## Options Considered

### Treatment drafting

**Option 1 (selected)**

- **Option:** Add `comic draft-treatment`, a front stage that makes one structured LLM call, validates the draft locally, writes the episode script the later stages already read, and merges new character and location entries into the catalogs; add `draft-scenes --panel-count` so the scene stage keeps the authored count
- **Pros:** Every later stage runs unchanged; the script is a reviewable, hand-editable source; the fixed count is checked when drafting and again at scene validation
- **Cons:** Adds a hosted drafting call before scene preparation; a style seed image must exist first
- **Quantitative Notes:** One drafting call with one retry; no new provider

**Option 2**

- **Option:** Teach the structure parser to read prose directly
- **Pros:** No intermediate script file
- **Cons:** Prose has no panel boundaries, speaker labels, or sluglines, so the parser would need an LLM anyway and the reviewable script disappears
- **Quantitative Notes:** Rejected

**Option 3**

- **Option:** Build a separate treatment-to-slideshow command with its own manifest
- **Pros:** Fewer catalog requirements for a first try
- **Cons:** Duplicates image review, audio recovery, and slideshow timing, and gives `resume` a second manifest shape
- **Quantitative Notes:** Rejected

### Blocking and continuity

**Option 1 (selected)**

- **Option:** A structured blocking plan compiled to a per-panel prose ledger, with an audit-only continuity judge, a blocking-class restart lane, script staging directives, and per-location geometry records
- **Pros:** Contradictory staging can be rejected before image generation; the image prompt and judge share one derived source of truth; blocking checks remain advisory until explicitly promoted
- **Cons:** A plan schema, a coordinate frame, and a deterministic compiler to keep satisfied; a hand-authored plan is real work per scene
- **Quantitative Notes:** One blocking drafting call per scene, with one validation retry; importing a plan makes no provider call

**Option 2**

- **Option:** Cross-panel QA only: a second vision judge comparing each candidate against an anchor panel and its predecessor
- **Pros:** Can measure continuity defects without changing generation
- **Cons:** Detects but never prevents, and costs one judge call per panel on every run
- **Quantitative Notes:** Adopted as the measurement layer, not the mechanism

**Option 3**

- **Option:** Script staging directives (`**BLOCKING:**`, `**CAMERA:**`, `**BREAK-180:**`, `**COSTUME:**`, `**EXTRAS:**`) plus a static review sheet and a reconcile mode
- **Pros:** Puts staging where the writer already works at no provider cost
- **Cons:** Prose directives carry no geometry, so nothing can be validated arithmetically
- **Quantitative Notes:** Adopted as the authoring channel that feeds the plan

**Option 4**

- **Option:** Location coverage and floor plans: a geometry record per location, a generated plan view, and camera-matched view selection
- **Pros:** Gives set geometry explicit constraints
- **Cons:** A generated overhead view can conflict with the establishing camera and registered views
- **Quantitative Notes:** Geometry records and camera-matched selection adopted; generated plan views dropped

**Option 5**

- **Option:** A rendered top-down blocking card as a required image reference, plus a continuity contact sheet of prior panels
- **Pros:** Makes intended staging visible
- **Cons:** Spends a scarce reference slot on a diagram the model does not read as staging, and a contact sheet reintroduces cross-panel pixels
- **Quantitative Notes:** Rejected as a reference image

**Option 6**

- **Option:** Coverage keyframes: master and setup plates per stage state, with panels derived by editing the plate
- **Pros:** Strongest spatial lock within a stage state
- **Cons:** Returns to the edit-based lock-in this decision leaves, at the highest cost per stage
- **Quantitative Notes:** Rejected as the mechanism; retained as an experiment behind the continuity baseline

## Decision

The comic pipeline uses an episode script with an optional typed blocking plan. `comic draft-treatment` adapts prose into that script and bootstraps the catalogs, `comic draft-scenes` enforces an explicit panel count and compiles staging into a shared generation and QA ledger, and `comic review` closes the human review loop locally.

### Treatment drafting

`comic draft-treatment <treatment-path>` adapts a `.md`, `.txt`, or locally extracted `.pdf` treatment into an episode script. Its `--panel-count` accepts an exact number or range. `--voice-pacing` defaults to `exclusive`, one voice per panel; `mixed` allows narration and dialogue together. New characters and locations merge without replacing existing keys or hand-edited descriptions, and ambiguous aliases are dropped and reported. Validation retries once; a draft that remains invalid leaves `input/` unchanged. The merge report identifies the references that must be generated before panel prompts are built.

`draft-scenes --panel-count <n>` keeps that count. The scene stage rejects a mismatched authored panel-note count before its drafting call, and a scene response that violates the count retries once.

### Blocking plan and panel ledger

Scene staging is authored or drafted as `metadata/blocking-plan.json` in a coordinate frame anchored to each location's establishing camera. Local validation rejects contradictory geometry before publication and image generation; generated plans may require a paid validation retry. A compiled per-panel ledger supplies both the image prompt and the page judge. Characters remain on stage until a cited exit removes them, and scene validation rejects a camera view that exposes an unlisted character.

`comic draft-scenes` can draft a plan, import one with `--blocking-plan`, skip it with `--no-blocking`, remap source citations with `--rebind`, or apply reviewed script directives with `--reconcile-from-directives`. Import and rebind preserve an existing reviewed scene. Local blocking diagrams and a ledger support review; `--blocking-layout-guide` optionally supplies a structural diagram for panels with at least six visible characters. Per-location geometry lives in `input/locations/location-plans.json`, independently of reference-image freshness, and location views are selected by camera match.

`comic generate-images` uses the ledger and off-frame roster to guide generation and QA. Blocking checks are advisory by default; `--blocking-hard-keys` promotes selected checks, while `scale-wrong` and `crowd-uniform` remain advisory. Within the repair budget, an individual-panel failure involving a promoted blocking check and only spatial hard failures can trigger regeneration from canonical references instead of an edit. `--qa-only --continuity-qa` runs the audit-only continuity judge; adding `--labels` reports precision and recall against human labels.

### Local review

`comic review <script>` writes a local HTML sheet, with a shared-document export when `--export-doc` is set. `--notes <path>` instead maps reviewer notes to paste-ready staging directives and reports unmatched notes and unresolved script lines. It cannot be combined with `--export-doc`. Neither mode changes the script, scene JSON, or structured script; users apply accepted directives and run a separate reconcile pass. Parsed sound intent remains intact as [ADR-013](ADR-013-comic-scene-audio-and-presentation.md) requires.

This applies to:

- `comic draft-treatment`, the `--panel-count` contract on `draft-scenes`, and their price estimates.
- The blocking stage of `draft-scenes`, the compiled ledger and roster lines, the review diagrams, the page judge's blocking fields and policy, the blocking-class restart lane, the continuity audit, staging directives, and location geometry.
- `comic review` modes, artifacts, and validation.

It does not apply to:

- Prompt assembly and QA rule ownership in general, which stays with the comic image stage as documented in the [comic command guides](../commands/05-visuals/comic/00-comic-overview.md). This record only adds the blocking-derived lines and checks.
- Provider retry, polling, and result shapes, which stay with [ADR-005](ADR-005-cli-error-result-and-retry-contract.md).
- Scene audio, panel-to-audio synchronization, and slideshow rendering, which stay with [ADR-013](ADR-013-comic-scene-audio-and-presentation.md).
- Grouped page images and sketches, which never carry a compiled ledger.
- Voice registration, which stays with `voice import`, the `role:narrator` casting rule, and [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md).
- The canonical and deprecated review command names, which [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md) owns.

## Rationale

- The existing script shape is the narrowest stable seam, so emitting it leaves audio binding and slideshow timing unchanged.
- Checking the panel count in both stages makes a fixed count a contract rather than a prompt hint.
- The defects are spatial, and typed staging supports deterministic checks before image generation.
- Deriving every prompt line and judge line from one compiled object removes the contradiction where set anchors and character positions were both forced into world space.
- Restarting from canonical references avoids conditioning a spatial repair on the faulty pose in the failed image.
- Shipping every blocking status advisory lets a precision gate promote one key at a time, because a false hard failure costs a full regeneration.
- A local review sheet and a notes-only mode close the human loop without a provider call and without touching the authored sources.

## Consequences

Positive outcomes:

- A treatment becomes a reviewable script and catalog in one command, and the rest of the production is the documented `comic` walkthrough.
- The plan retains off-frame cast and gives the judge evidence to identify intruding characters.
- Every new continuity check is measurable against human labels before it is enforced.

Negative outcomes:

- A valid style seed image must be created or copied before the first treatment run, and one `styleImage` serves every location in a catalog.
- A scene needs a reviewed plan before its strongest checks mean anything, and a hand-authored plan for a long scene is substantial work.
- The ledger and off-frame references increase judge input and cost.
- A wrong plan is a source of false hard failures, and the blocking-class restart lane spends a full generation whenever it fires.

## Trade-offs

**Trade-off 1**

- **Gain:** Later stages and their manifests stay as they are
- **Sacrifice:** The treatment stage must produce the script shape those stages already require

**Trade-off 2**

- **Gain:** Deterministic rejection of contradictory staging before image generation
- **Sacrifice:** A schema, a coordinate frame, and a validator surface that every future staging feature must keep satisfied

**Trade-off 3**

- **Gain:** A repair lane that can move a character instead of editing around them
- **Sacrifice:** Blocking-class repairs cost a full image generation

**Trade-off 4**

- **Gain:** Screen-space judging of characters alongside world-space judging of set anchors
- **Sacrifice:** A larger judge prompt and roster cards that add image inputs to every judged panel

## Implementation Note

Treatment adaptation, blocking compilation and repair, and local review are implemented under `src/cli/commands/visuals/comic/comic-commands/draft-treatment/`, `src/cli/commands/visuals/comic/comic-utils/blocking-plan-compile.ts`, `src/cli/commands/visuals/comic/comic-commands/generate-images/`, and `src/cli/commands/visuals/comic/comic-commands/review/`. Operator behavior is in the command guides under References.

## Test Plan

```bash
bun test test/test-cases/validation/visuals/comic/comic-treatment-draft-validation-contracts.test.ts test/test-cases/validation/visuals/comic/comic-treatment-catalog-merge-contracts.test.ts test/test-cases/validation/visuals/comic/comic-scene-panel-count-contracts.test.ts
bun test test/test-cases/validation/visuals/comic/comic-blocking-validation-contracts.test.ts test/test-cases/validation/visuals/comic/comic-blocking-compilation-contracts.test.ts test/test-cases/validation/visuals/comic/comic-blocking-qa-contracts.test.ts
bun test test/test-cases/validation/visuals/comic/comic-review-command-contracts.test.ts
```

1. Treatment tests check invalid drafts, catalog merges, and the panel-count contract using local fixtures.
2. Blocking tests check geometry validation, compilation, and QA repair policy with mocked providers; they do not establish visual quality or judge precision.
3. Review tests check local mode selection, validation, and preservation of authored artifacts.

## Follow-up Actions

- [ ] Continuity baseline and prompt ablation — Blocked on owner-run paid commands
- [ ] Promote blocking statuses from advisory to hard — Blocked on the continuity baseline precision gate
- [ ] Reviewed geometry records — Pending
- [ ] Rendered blocking card and coverage keyframes — Pending
- [ ] Decide how a first-try production should promote judge-retained originals — Pending
- [ ] Decide whether a per-location style image should replace the catalog-wide `styleImage` — Pending

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — treatment run records and no-provider `--price` planning
- Related ADR: [ADR-005](ADR-005-cli-error-result-and-retry-contract.md) — provider retry, polling, and result shapes
- Related ADR: [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md) — comic subcommand tree and the canonical and deprecated review names
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — the central registries that resolve comic text and image models
- Related ADR: [ADR-013](ADR-013-comic-scene-audio-and-presentation.md) — scene audio, sound intent preserved by review, and slideshow rendering
- Related ADR: [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md) — documented comic examples and paid-approval rules for the continuity baseline
- Related ADR: [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md) — comic `--provider` and `--<role>-provider` spellings
- [comic draft-treatment](../commands/05-visuals/comic/07-draft-treatment.md)
- [comic draft-scenes](../commands/05-visuals/comic/01-draft-scenes.md)
- [comic generate-images](../commands/05-visuals/comic/03-generate-images.md)
- [comic review](../commands/05-visuals/comic/06-review.md)
