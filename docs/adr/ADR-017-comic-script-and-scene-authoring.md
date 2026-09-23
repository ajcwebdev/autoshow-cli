# ADR-017: Comic Script and Scene Authoring

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-09-02
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed
- **Supersession:** Absorbs "Compile a Text-First Blocking Plan Into a Panel Ledger" and "Draft Episode Scripts From Prose Treatments" in full, plus the `comic review` mechanics from the 2026-09-10 amendment of "Integrate Comic with Shared Model and Native CLI Infrastructure". This record owns the text-to-validated-scene stages: `comic draft-treatment`, `comic draft-scenes` and its blocking stage, `comic review`, and the blocking-derived lines and checks in `comic generate-images`. The canonical and deprecated review command names are owned by [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md).

## Context

The `comic` pipeline starts from an episode script: a title, a scene heading, a bold slugline that resolves against the location catalog, panel notes, and bold speaker labels. Every later stage reads that script and none accepts prose. A treatment names characters and places that are not in the catalogs yet, and a bootstrapped catalog entry needs a style seed image that already exists. The scene stage otherwise lets the model choose the panel count, so a fixed count has to be a checked contract.

Panels are generated one bundle at a time and no pixels cross between panels, so nothing recorded where a character stood in the previous panel or who was on stage but out of frame. The page judge saw only its own panel and its own cast, and the only repair was an image edit seeded with the failed image, which keeps the pose it was asked to change. The recurring defects were side flips, seat swaps, a set piece that changes footprint, a character intruding into a panel they are not in, and a crowd that vanishes between panels. Human review of a drafted scene also needed a local round trip that does not regenerate the sheet or touch the authored script.

Why now: the first treatment that was not already a script arrived, and an episode review produced a written list of continuity defects that three rounds of prose prohibitions had failed to fix, while the later stages were stable enough that a front stage emitting their script shape is cheaper and safer than a second pipeline.

## Options Considered

### Treatment drafting

**Option 1 (selected)**

- **Option:** Add `comic draft-treatment`, a front stage that makes one structured LLM call, validates the draft locally, writes the episode script the later stages already read, and merges new character and location entries into the catalogs; add `draft-scenes --panel-count` so the scene stage keeps the authored count
- **Pros:** Every later stage runs unchanged; the script is a reviewable, hand-editable source; the fixed count is checked when drafting and again at scene validation
- **Cons:** Two hosted calls on the path to scene JSON; a style seed image must exist first
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
- **Pros:** Continuity becomes typed data that deterministic validators reject before any paid call; the image prompt and the judge read one derived source of truth; every new hard check ships advisory behind a per-key policy
- **Cons:** A plan schema, a coordinate frame, and a deterministic compiler to keep satisfied; a hand-authored plan is real work per scene
- **Quantitative Notes:** One added LLM call per scene of up to 3,000 output units

**Option 2**

- **Option:** Cross-panel QA only: a second vision judge comparing each candidate against an anchor panel and its predecessor
- **Pros:** Detects every defect class without changing generation
- **Cons:** Detects but never prevents, and costs one judge call per panel on every run
- **Quantitative Notes:** Adopted as the measurement layer, not the mechanism

**Option 3**

- **Option:** Script staging directives (`**BLOCKING:**`, `**CAMERA:**`, `**BREAK-180:**`, `**COSTUME:**`, `**EXTRAS:**`) plus a static review sheet and a reconcile mode
- **Pros:** Puts staging where the writer already works at no provider cost
- **Cons:** Prose directives carry no geometry, so nothing can be validated arithmetically
- **Quantitative Notes:** Adopted as the authoring channel that feeds the plan

**Option 4**

- **Option:** Location coverage and floor plans: a geometry record per location, a generated plan view, and camera-matched view selection
- **Pros:** Fixes the set-geometry defect class directly
- **Cons:** A generated overhead view contradicts the establishing-camera contract and the hash-locked view set
- **Quantitative Notes:** Geometry records and camera-matched selection adopted; generated plan views dropped

**Option 5**

- **Option:** A rendered top-down blocking card as a required image reference, plus a continuity contact sheet of prior panels
- **Pros:** A picture of the stage is unambiguous
- **Cons:** Spends a scarce reference slot on a diagram the model does not read as staging, and a contact sheet reintroduces cross-panel pixels
- **Quantitative Notes:** Rejected as a reference image

**Option 6**

- **Option:** Coverage keyframes: master and setup plates per stage state, with panels derived by editing the plate
- **Pros:** Strongest spatial lock within a stage state
- **Cons:** Returns to the edit-based lock-in this decision leaves, at the highest cost per stage
- **Quantitative Notes:** Rejected as the mechanism; retained as an experiment behind the continuity baseline

## Decision

The comic pipeline starts from an episode script and a typed blocking plan. `comic draft-treatment` adapts prose into that script and bootstraps the catalogs, `comic draft-scenes` keeps the authored panel count and compiles scene staging into a per-panel ledger that the image prompt and the page judge both read, and `comic review` closes the human review loop locally.

### Treatment drafting

`comic draft-treatment <treatment-path>` adapts a `.md`, `.txt`, or locally extracted `.pdf` treatment into `input/scripts/<episode>-script/<scene>-<slug>.md`. The script's panel count satisfies `--panel-count`, an exact number or a range. Narration is written under `NARRATION` labels and `--speaker` lines are dialogue. `--voice-pacing` defaults to `exclusive`, one voice per panel; `mixed` allows narration and dialogue in the same panel. New characters and locations merge into the catalogs without changing existing keys, hand-edited descriptions stay in place, and ambiguous aliases are dropped and reported. A draft that fails validation writes nothing under `input/`; a failed draft retries once. The run is recorded under `output/<timestamp>_<slug>-treatment/metadata/treatment/`, and the merge report lists the `reference-sketch` command for every added key.

`draft-scenes --panel-count <n>` keeps that count. The command fails before any call when the script's panel notes differ, and a scene response that violates the count retries once.

### Blocking plan and panel ledger

Scene staging is authored or drafted as a typed `metadata/blocking-plan.json` (schemaVersion 1) in a coordinate frame anchored to each location's establishing camera, validated by deterministic arithmetic before any paid call, and compiled deterministically into a per-panel `blocking` object. The derived prose lines of that object are the single source of truth for the image prompt and the page judge. The plan carries stage states forward until a cited exit move removes a character, and a panel whose camera sees an unlisted character is rejected at draft time with a message naming the character and the camera.

`comic draft-scenes` drafts or imports the plan through `--blocking-plan`, `--no-blocking`, `--rebind`, and `--reconcile-from-directives`, leaves a reviewed scene JSON in place, and writes panel citations that are not already on the scene to `metadata/blocking-bindings.json` (schemaVersion 1). Script staging directives are parsed from the screenplay into the structured script. Reviewers get `metadata/blocking/plan-overview.svg`, `panel-NN.svg`, and `blocking-ledger.md`, plus a `panel-NN-layout.png` diagram for any panel whose ledger has at least six visible characters; `--blocking-layout-guide` attaches that diagram as a structural reference for such a panel. Per-location geometry lives in `input/locations/location-plans.json`, hashed separately from the location specification so editing a floor plan does not mark a registered view stale, and location views are selected by camera match.

`comic generate-images` appends the ledger and roster lines to the image prompt and gives the page judge a low-detail identity card for every roster character absent from the panel. The judge records `blockingMatch`, `axisSideMatch`, and `blockingAudit`. Every blocking status ships advisory and `--blocking-hard-keys` promotes individual keys to hard; `scale-wrong` and `crowd-uniform` are recorded in `blockingAudit` and cannot be promoted. When an individual-panel attempt has at least one promoted blocking-class hard failure (`blockingAudit` or `axisSideMatch`) and every hard failure is spatial (those, shot plan, or set continuity), the next attempt regenerates from the canonical references with the ledger appended instead of editing the failed image. `--qa-only --continuity-qa` runs the audit-only continuity judge against human labels and, with `--labels`, reports precision and recall per key.

### Local review

`comic review <script>` writes the HTML sheet by default. `--export-doc` also writes the shared-document export. `--notes <path>` processes notes only and does not regenerate the sheet. A missing script, a blank notes path, or an unknown flag is rejected, and combining `--notes` with `--export-doc` fails before any artifact is written. Only notes processing requires the character catalog. Both modes are local with no `--price` option, and the result identifier is `comic review`.

The sheet and optional export refresh `metadata/review/review-sheet.html` and `metadata/review/export-doc.md` in place. Notes write `metadata/review/review-notes-<run-id>.md`, leave the authored script, scene JSON, and structured script unchanged, and report unmatched notes and unresolved script lines. Generated sheets tell reviewers to run `comic review <script> --notes <path>`, so the round trip is two invocations with human review between them. Review reads and writes the staging directives and the local blocking diagrams, and preserves parsed sound intent as [ADR-013](ADR-013-comic-scene-audio-and-presentation.md) requires.

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
- The defect classes are spatial and prose prohibitions had already failed on them, so only typed data can support an arithmetic rejection before spend.
- Deriving every prompt line and judge line from one compiled object removes the contradiction where set anchors and character positions were both forced into world space.
- A restart from the canonical references is the repair that can move a person; an edit seeded with the failed image preserves the pose it was asked to change.
- Shipping every blocking status advisory lets a precision gate promote one key at a time, because a false hard failure costs a full regeneration.
- A local review sheet and a notes-only mode close the human loop without a provider call and without touching the authored sources.

## Consequences

Positive outcomes:

- A treatment becomes a reviewable script and catalog in one command, and the rest of the production is the documented `comic` walkthrough.
- A character the script stops mentioning stays on their mark, and an intruding character is reported by the judge rather than unrecognized.
- Every new continuity check is measurable against human labels before it is enforced.

Negative outcomes:

- A style seed image must be generated and copied before the first treatment run, and the location catalog's single `styleImage` is shared across projects.
- A scene needs a reviewed plan before its strongest checks mean anything, and a hand-authored plan for a long scene is substantial work.
- The modeled judge input rose from 5,000 to 8,000 units per call and output from 1,200 to 1,400.
- A wrong plan is a source of false hard failures, and the blocking-class restart lane spends a full generation whenever it fires.

## Trade-offs

**Trade-off 1**

- **Gain:** Later stages and their manifests stay as they are
- **Sacrifice:** The treatment stage must produce the script shape those stages already require

**Trade-off 2**

- **Gain:** Deterministic rejection of contradictory staging before any paid call
- **Sacrifice:** A schema, a coordinate frame, and a validator surface that every future staging feature must keep satisfied

**Trade-off 3**

- **Gain:** A repair lane that can move a character instead of editing around them
- **Sacrifice:** Blocking-class repairs cost a full image generation and skip the order-swapped comparison passes an edit candidate must pass

**Trade-off 4**

- **Gain:** Screen-space judging of characters alongside world-space judging of set anchors
- **Sacrifice:** A larger judge prompt and roster cards that add image inputs to every judged panel

## Implementation Note

`comic draft-treatment`, `draft-scenes --panel-count`, the blocking stage with its plan, bindings, and review diagrams, the blocking judge fields and restart lane in `generate-images`, the audit-only continuity judge, and the two-mode `comic review` command have all shipped. Operator behavior is in the command guides under References.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/visuals/comic
bun test test/test-cases/validation/cli/option-resolution-contracts/
bun autoshow comic draft-treatment input/camp.md --episode 02 --speaker papa-bear --price
```

1. The comic suite proves treatment rendering, idempotent catalog merges, the panel-count contract, plan validation, deterministic compilation, the blocking audit and restart lane, the continuity audit report, staging-directive parsing, and both review modes against local fixtures.
2. Option resolution proves every flag parses, rejects invalid values, and keeps its default.
3. `--price` reports the drafting call without a provider call or writes.

## Follow-up Actions

- [ ] Continuity baseline and prompt ablation — Blocked on owner-run paid commands
- [ ] Promote blocking statuses from advisory to hard — Blocked on the continuity baseline precision gate
- [ ] Reviewed geometry records — Pending
- [ ] Rendered blocking card and coverage keyframes — Pending
- [ ] Decide how a first-try production should promote judge-retained originals — Pending
  Either a `generate-images` flag that promotes retained originals when every hard failure is set-continuity, or documented guidance to rerun the failed panels with `--no-qa`.
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
