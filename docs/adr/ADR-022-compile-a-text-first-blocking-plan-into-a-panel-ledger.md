# ADR-022: Compile a Text-First Blocking Plan Into a Panel Ledger

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-09-02
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed

## Context

Comic panels are generated one bundle at a time, and no pixels cross between panels. Before a compiled ledger, the pipeline had no record of where a character stood in the previous panel. Scene JSON stored a prose `shotPlan` and a `characterKeys` array, with no positions, no camera, and no roster of who is on stage but out of frame. A character the script stopped mentioning was dropped from `characterKeys`, so the drafter emptied the room by omission. The page judge was told to judge world-space relationships rather than screen position, saw no other panel of the scene, and received identity cards only for that panel's own cast. It could not see a character standing in a panel that did not list them, a swapped screen side, or a crossed axis of action. The only repair was an image edit seeded with the failed image, which keeps a wrong pose instead of moving a person. The recurring defects are side flips, seat swaps, a desk that changes footprint, a character intruding into a panel they are not in, and a crowd that vanishes between panels.

Why now: the Episode 2 review produced a written list of continuity defects that prose prohibitions failed to fix across three rounds of prompt tightening, after a comparison of six designs against the running pipeline.

## Options Considered

**Option 1 (selected)**

- **Option:** Structured blocking plan compiled to a per-panel prose ledger, with an audit-only continuity judge, a blocking-class restart lane, script staging directives, and per-location geometry records.
- **Pros:** Continuity becomes typed data that deterministic validators can reject before any paid call; the ledger is derived, so the image prompt and the judge read one source of truth; every new hard check ships advisory behind a per-key policy; no pixel ever crosses between panels.
- **Cons:** Adds a drafting stage, a plan schema, a geometry frame, and a compiler that must stay deterministic; a hand-authored plan is real authoring work per scene.
- **Quantitative Notes:** One added LLM call per scene, up to 3,000 output units. The compiler and validators make no provider call.

**Option 2**

- **Option:** Cross-panel QA only: a second vision judge comparing each candidate against an approved anchor panel and its predecessor, carrying a text ledger forward.
- **Pros:** Highest verifiability of the six; detects every defect class without changing generation; safe to run audit-only.
- **Cons:** Detects but never prevents; costs one judge call per panel on every run; needs a trusted anchor per location before it means anything.
- **Quantitative Notes:** One extra judge call per panel, permanently. Adopted as the measurement layer rather than the mechanism.

**Option 3**

- **Option:** Script directives and an authoring loop: `**BLOCKING:**`, `**CAMERA:**`, `**BREAK-180:**`, `**COSTUME:**`, and `**EXTRAS:**`, parsed like sound directives, plus a static review sheet and a reconcile mode.
- **Pros:** Puts staging where the writer already works; cheapest per scene; the review sheet closes the notes loop without a provider call.
- **Cons:** Prose directives alone carry no geometry, so nothing can be validated arithmetically; effectiveness depends entirely on author discipline.
- **Quantitative Notes:** No provider call for the review sheet or reconcile mode. Adopted as the authoring channel that feeds the plan.

**Option 4**

- **Option:** Location coverage and floor plans: a geometry record per location, a `plan` view kind, camera-matched view selection, and computed anchor projection.
- **Pros:** Fixes the desk-geometry class directly; camera-matched views give the model the right map of the set.
- **Cons:** A generated overhead plan view contradicts the establishing-camera contract, and location specifications hash-lock their allowed views. Exempting a hand-drawn import from that guard is prohibited.
- **Quantitative Notes:** Geometry records and camera-matched view selection adopted. Generated plan views dropped.

**Option 5**

- **Option:** Rendered blocking card: a locally rasterized top-down card attached as a required image reference, plus a lineage-gated continuity contact sheet.
- **Pros:** A picture of the stage is unambiguous.
- **Cons:** Spends a scarce reference slot on a diagram the model is not trained to read as staging. A contact sheet of prior panels reintroduces cross-panel pixels.
- **Quantitative Notes:** Rejected as a reference image. The derived text ledger was adopted instead.

**Option 6**

- **Option:** Coverage keyframes: master and A/B setup plates per stage state, with panels derived by editing the plate.
- **Pros:** Strongest possible spatial lock within a stage state.
- **Cons:** Returns to the edit-based lock-in this decision exists to leave, and costs the most per stage.
- **Quantitative Notes:** Rejected as the mechanism. Retained as an experiment behind the continuity baseline.

## Decision

Scene staging is authored or drafted as a typed `metadata/blocking-plan.json` (schemaVersion 1) in a coordinate frame anchored to each location's establishing camera, validated by deterministic arithmetic before any paid call, and compiled deterministically into a per-panel `blocking` object. The derived prose lines of that object are the single source of truth for the image prompt and the page judge. When an individual-panel attempt has at least one promoted blocking-class hard failure (`blockingAudit` or `axisSideMatch`) and every hard failure is spatial (those, shot plan, or set continuity), the next attempt regenerates from the canonical references with the ledger appended, instead of editing the failed image. Advisory blocking findings stay out of that lane while `--blocking-hard-keys` is empty.

This applies to:

- The `blocking` stage of `comic draft-scenes`, its plan schema, its validators, and its `--blocking-plan`, `--no-blocking`, `--rebind`, and `--reconcile-from-directives` modes. A reviewed scene JSON is left in place. Panel citations that are not already on the scene are written to `metadata/blocking-bindings.json` (schemaVersion 1).
- The compiled bundle `blocking` object, its `planSha256`, the ledger and roster lines in the image prompt, the `metadata/blocking/` SVG and Markdown review artifacts, and the dense-panel `panel-NN-layout.png` diagrams. `--blocking-layout-guide` attaches that diagram as a structural reference for an individual panel whose ledger has at least six visible characters.
- The page judge's `blockingMatch`, `axisSideMatch`, and `blockingAudit` fields, the `--blocking-hard-keys` policy, the roster identity cards, and the blocking-class restart lane.
- The audit-only continuity judge behind `--qa-only --continuity-qa`, including its labels file and precision-recall report.
- Script staging directives parsed from the screenplay into `structuredScript.staging`, and the review commands that read and write them.
- Per-location geometry records in `input/locations/location-plans.json`, and camera-matched location view selection.

It does not apply to:

- Prompt assembly and QA rule ownership in general, which stays with [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md). This record only adds the blocking-derived lines and checks.
- Provider retry, polling, and result-shape ownership, which stays with [ADR-021](ADR-021-adopt-table-free-text-json-results-and-safe-retry-ownership.md).
- Panel-to-audio synchronization, which stays with [ADR-018](ADR-018-synchronize-comic-panels-with-manifest-backed-audio.md).
- Grouped page images and sketches, which never carry a compiled ledger.

## Rationale

- The defect classes are spatial, and prose prohibitions have already failed on them three times. Only typed data supports an arithmetic rejection before spend.
- Deriving every prompt line and judge line from one compiled object removes the contradiction where set anchors and character positions were both forced into world space.
- A restart from the canonical references is the repair that can move a person. An edit seeded with the failed image preserves the pose it was asked to change.
- Shipping every blocking status advisory behind `--blocking-hard-keys` lets a precision gate promote one candidate key at a time, which matters because a false hard failure costs a full regeneration. `scale-wrong` and `crowd-uniform` are recorded in `blockingAudit` and cannot be promoted.
- Geometry records hash separately from the location specification, so editing a floor plan does not mark a registered view stale and does not force a paid re-render.

## Consequences

Positive outcomes:

- A character the script stops mentioning stays on their mark, because the plan carries stage states forward until a cited exit move removes them.
- A panel whose camera sees an unlisted character is rejected at draft time with a message naming the character and the camera, instead of producing an empty room.
- The judge receives the ledger and a low-detail identity card for every roster character absent from the panel, so an intruding character is reported rather than unrecognized.
- Reviewers get `metadata/blocking/plan-overview.svg`, `panel-NN.svg`, `blocking-ledger.md`, and, for a ledger of at least six visible characters, `panel-NN-layout.png`, written locally with no provider call.
- Every new check is measurable before it is enforced. The continuity audit runs against human labels and reports precision and recall per key.

Negative outcomes:

- A scene needs a reviewed plan before its strongest checks mean anything, and a hand-authored plan for a long scene is a substantial authoring task.
- The page judge prompt and its per-call input estimate both grew. The modeled judge input rose from 5,000 to 8,000 units per call, and output from 1,200 to 1,400.
- A wrong plan is now a source of false hard failures, which is why every blocking status ships advisory.
- The blocking-class restart lane spends a full generation whenever it fires.

## Trade-offs

**Trade-off 1**

- **Gain:** Deterministic rejection of contradictory staging before any paid call.
- **Sacrifice:** A schema, a coordinate frame, and a validator surface that every future staging feature must keep satisfied.

**Trade-off 2**

- **Gain:** A repair lane that can move a character instead of editing around them.
- **Sacrifice:** Blocking-class repairs cost a full image generation and skip the two order-swapped comparison passes that an edit candidate must pass.

**Trade-off 3**

- **Gain:** Screen-space judging of characters alongside world-space judging of set anchors.
- **Sacrifice:** A larger judge prompt, a higher modeled per-call cost, and roster cards that add image inputs to every judged panel.

**Trade-off 4**

- **Gain:** Geometry records that outlive any single generation and can be reviewed on paper.
- **Sacrifice:** A second hash per location, and a review workflow that must stay synchronized with the specification text.

## Implementation Note

`comic draft-scenes` drafts or imports the plan (`--blocking-plan`, `--no-blocking`, `--rebind`, `--reconcile-from-directives`) and leaves a reviewed scene JSON in place. `comic review` reads and writes the staging directives and the local blocking diagrams. `comic generate-images` appends the compiled ledger to the image prompt, records the blocking judge fields, applies `--blocking-hard-keys` and `--blocking-layout-guide`, and restarts a blocking-class failure from the canonical references. `--qa-only --continuity-qa` runs the audit-only continuity judge and, with `--labels`, its precision-recall report. Location geometry is read from `input/locations/location-plans.json` apart from the location specification hash. The plan schema, compiler, and page-judge fields live in `src/cli/commands/visuals/comic/schemas/blocking-plan-schemas.ts`, `src/cli/commands/visuals/comic/comic-utils/blocking-plan-compile.ts`, and `src/cli/commands/visuals/comic/comic-commands/generate-images/comic-page-qa.ts`.

## Test Plan

```
bun run check
bun test test/test-cases/validation/visuals/comic
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

1. `bun run check` proves the plan, bundle, QA, and option types compose.
2. The comic suite proves plan validation, deterministic compilation, the ledger lines in the image prompt, the blocking audit and `--blocking-hard-keys` policy, the blocking-class restart, the continuity audit and its precision-recall report, staging-directive parsing, and the geometry-record reader.
3. The option-resolution suite proves every new flag parses, rejects invalid values, and keeps its default.

## Follow-up Actions

- [ ] Continuity baseline and prompt ablation — Blocked on owner-run paid commands
  Run the baseline continuity audit and the ten-panel ablation under the repository price-preflight and approval rules. Commit the pilot write-up under `docs/reports/` when that measurement lands.
- [ ] Promote blocking statuses from advisory to hard — Blocked on the continuity baseline precision gate
  `--blocking-hard-keys` stays empty until the audit shows acceptable precision for a key.
- [ ] Reviewed geometry records — Pending
  Shipped location geometry may stay `reviewStatus: "provisional"` until a reviewer accepts a hand-drawn floor plan.
- [ ] Rendered blocking card and coverage keyframes — Pending
  A required top-down blocking card and coverage keyframes stay experiments until the continuity baseline lands. The dense-panel `panel-NN-layout.png` is a screen-space diagram, separate from that card.

## References

- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md)
- Related ADR: [ADR-016](ADR-016-govern-readme-command-examples-as-executable-contracts.md)
- Related ADR: [ADR-021](ADR-021-adopt-table-free-text-json-results-and-safe-retry-ownership.md)
- `src/cli/commands/visuals/comic/schemas/blocking-plan-schemas.ts`
- `src/cli/commands/visuals/comic/comic-utils/blocking-plan-compile.ts`
- `src/cli/commands/visuals/comic/comic-commands/generate-images/comic-page-qa.ts`
- [comic draft-scenes](../commands/05-visuals/comic/01-draft-scenes.md)
- [comic generate-images](../commands/05-visuals/comic/03-generate-images.md)
