# ADR-022: Compile a Text-First Blocking Plan Into a Panel Ledger

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-09-02
- **Date Updated:** 2026-09-02
- **Verification Status:** Passed

## Context

Comic panels are generated one bundle at a time and no pixels cross between panels, so nothing in the pipeline knows where a character stood in the previous panel. Scene JSON records a prose `shotPlan` and a `characterKeys` array; it has no world-space field, no camera field, and no roster of who is on stage but out of frame. A character the script stops mentioning is silently dropped from `characterKeys`, so the drafter empties the room by omission, and the page judge is explicitly told to "judge world-space topology and relative relationships, not screen coordinates," receives no other panel of the scene, and receives identity cards only for the panel's own cast. It therefore cannot see a character standing in a panel that does not list them, cannot see a swapped screen side, and cannot see a crossed axis of action. The one repair lane is an image edit seeded with the failed image, which locks in a wrong pose instead of moving a person. The recurring artifacts are concrete: side flips, seat swaps, a desk that changes footprint, a character intruding into a panel they are not in, and a crowd that vanishes between panels.

Why now: the review of Episode 2 produced a written list of continuity defects that prose prohibitions have failed to fix across three rounds of prompt tightening, and `docs/reports/character-blocking-continuity-plan.md` scored six candidate architectures against the real code before any of them was built.

## Options Considered

**Option 1 (selected)**

- **Option:** Structured blocking plan compiled to a per-panel prose ledger, with an audit-only continuity judge, a blocking-class restart lane, script staging directives, and per-location geometry records.
- **Pros:** Continuity becomes typed data that deterministic validators can reject before any paid call; the ledger is derived, so the image prompt and the judge read one source of truth; every new hard check ships advisory behind a per-key policy; no pixel ever crosses between panels.
- **Cons:** Adds a drafting stage, a plan schema, a geometry frame, and a compiler that must stay deterministic; a hand-authored plan is real authoring work per scene.
- **Quantitative Notes:** Judge averages 7.7 effectiveness, 7.3 feasibility, 8.7 cost, 8.3 verifiability, 6.3 regression safety. One added LLM call per scene at up to 3,000 output units; the compiler and validators are free.

**Option 2**

- **Option:** Cross-panel QA only: a second vision judge comparing each candidate against an approved anchor panel and its predecessor, carrying a text ledger forward.
- **Pros:** Highest verifiability of the six; detects every defect class without changing generation; safe to run audit-only.
- **Cons:** Detects but never prevents; costs one judge call per panel forever; needs a trusted anchor per location before it means anything.
- **Quantitative Notes:** 5.7 effectiveness, 8.3 feasibility, 5.7 cost, 9.7 verifiability, 8.0 regression safety. Adopted as the measurement layer rather than the mechanism.

**Option 3**

- **Option:** Script directives and an authoring loop: `**BLOCKING:**`, `**CAMERA:**`, `**BREAK-180:**`, `**COSTUME:**`, `**EXTRAS:**` parsed like sound directives, plus a static review sheet and a reconcile mode.
- **Pros:** Puts staging where the writer already works; cheapest per scene; the review sheet closes the notes loop without a provider call.
- **Cons:** Prose directives alone carry no geometry, so nothing can be validated arithmetically; effectiveness depends entirely on author discipline.
- **Quantitative Notes:** 6.7 effectiveness, 6.0 feasibility, 8.3 cost, 7.7 verifiability, 5.0 regression safety. Adopted as the authoring channel feeding the plan.

**Option 4**

- **Option:** Location coverage and floor plans: a geometry record per location, a `plan` view kind, camera-matched view selection, and computed anchor projection.
- **Pros:** Fixes the desk-geometry class directly; camera-matched views give the model the right map of the set.
- **Cons:** Generated plan views contradict the establishing-camera contract at `location-reference-command.ts:25`, and 37 of 55 specifications carry a hash-locked overhead-view prohibition; the guard-script exemption it wanted for hand-drawn imports is prohibited by project policy.
- **Quantitative Notes:** 5.3 effectiveness, 6.0 feasibility, 6.0 cost, 7.3 verifiability, 5.7 regression safety. Geometry records and camera-matched view selection adopted; generated plan views dropped.

**Option 5**

- **Option:** Rendered blocking card: a locally rasterized top-down card attached as a required image reference, plus a lineage-gated continuity contact sheet.
- **Pros:** A picture of the stage is unambiguous; the reserve-slot fix it required is independently useful.
- **Cons:** Spends a scarce reference slot on a diagram the model has never been trained to read as staging; a contact sheet of prior panels reintroduces cross-panel pixels.
- **Quantitative Notes:** 6.7 effectiveness, 6.0 feasibility, 6.7 cost, 7.3 verifiability, 5.0 regression safety. Only the derived ledger and the reserve-slot fix adopted.

**Option 6**

- **Option:** Coverage keyframes: master and A/B setup plates per stage state, with panels derived by editing the plate.
- **Pros:** Strongest possible spatial lock within a stage state.
- **Cons:** Re-enters the edit-based lock-in regime this ADR exists to leave, and costs the most per stage.
- **Quantitative Notes:** 7.3 effectiveness, 6.0 feasibility, 4.7 cost, 7.7 verifiability, 4.3 regression safety. Rejected as a mechanism; retained as an experiment.

## Decision

Scene staging is authored or drafted as a typed `metadata/blocking-plan.json` (schemaVersion 1) in a coordinate frame anchored to each location's establishing camera, validated by deterministic arithmetic before any paid call, and compiled deterministically into a per-panel `blocking` object whose derived prose lines are the single source of truth for the image prompt and the page judge. When every hard QA failure on an attempt is blocking-class, the next attempt regenerates from the canonical references with the ledger appended instead of editing the failed image.

This applies to:

- The `blocking` stage of `comic draft-scenes`, its plan schema, its validators, and its `--blocking-plan`, `--no-blocking`, and `--rebind` modes.
- The compiled bundle `blocking` object, its `planSha256`, the ledger and roster lines in the image prompt, and the `metadata/blocking/` SVG and Markdown review artifacts.
- The page judge's `blockingMatch`, `axisSideMatch`, and `blockingAudit` fields, the `--blocking-hard-keys` policy, the roster identity cards, and the blocking-class restart lane in `panel-qa-pipeline.ts`.
- The audit-only continuity judge behind `--qa-only --continuity-qa` and its labels and precision-recall report.
- Script staging directives parsed out of the screenplay into `structuredScript.staging`, and the review commands that read and write them.
- Per-location geometry records in `input/locations/location-plans.json` and camera-matched location view selection.

It does not apply to:

- Prompt assembly and QA rule ownership in general, which stays with [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md); this record only adds the blocking-derived lines and checks.
- Provider retry, polling, and result-shape ownership, which stays with [ADR-021](ADR-021-adopt-table-free-text-json-results-and-safe-retry-ownership.md).
- Panel-to-audio synchronization, which stays with [ADR-018](ADR-018-synchronize-comic-panels-with-manifest-backed-audio.md).
- Grouped page images and sketches, which never carry a compiled ledger.

## Rationale

- The defect classes are spatial, and prose prohibitions have already failed on them three times; only typed data supports an arithmetic rejection before spend.
- Deriving every prompt and judge line from one compiled object removes the contradiction that shipped in the judge instruction, where set anchors and character positions were both forced into world space.
- A restart lane is the only repair that can actually move a person; an edit seeded with the failed image preserves the pose it was asked to change.
- Shipping every blocking status advisory behind `--blocking-hard-keys` lets the precision gate promote one key at a time without a code change, which is required because a false hard failure costs a full regeneration.
- Geometry records hash separately from the location specification, so editing a floor plan never marks a registered view stale and never forces a paid re-render.

## Consequences

Positive outcomes:

- A character the script stops mentioning stays on their mark, because the plan carries stage states forward until a cited exit move removes them.
- A panel whose camera sees an unlisted character is rejected at draft time with a message naming the character and the camera, instead of producing an empty room.
- The judge is given the ledger and a low-detail identity card for every roster character absent from the panel, so an intruding character is reported rather than unrecognized.
- Reviewers get `metadata/blocking/plan-overview.svg`, `panel-NN.svg`, and `blocking-ledger.md` with no ImageMagick and no provider call.
- Every new check is measurable before it is enforced, because the continuity audit runs against human labels and reports precision and recall per key.

Negative outcomes:

- A scene now needs a reviewed plan before its strongest checks mean anything, and a hand-authored plan for a 27-panel scene is a substantial authoring task.
- The page judge prompt and its per-call input estimate both grew; the modeled judge input rose from 5,000 to 8,000 units per call and output from 1,200 to 1,400.
- A wrong plan is now a source of false hard failures, which is why every blocking status ships advisory.
- The blocking-class restart lane spends a full generation rather than an edit whenever it fires.

## Trade-offs

**Trade-off 1**

- **Gain:** Deterministic rejection of contradictory staging before any paid call.
- **Sacrifice:** A schema, a coordinate frame, and a validator surface that every future staging feature must keep satisfied.

**Trade-off 2**

- **Gain:** A repair lane that can move a character instead of editing around them.
- **Sacrifice:** Blocking-class repairs cost a full image generation and skip the two order-swapped comparison judgments that protect edit candidates.

**Trade-off 3**

- **Gain:** Screen-space judging of characters alongside world-space judging of set anchors, with the contradiction removed.
- **Sacrifice:** A larger judge prompt and a higher modeled per-call cost, plus roster cards that add image inputs to every judged panel.

**Trade-off 4**

- **Gain:** Geometry records that outlive any single generation and can be reviewed on paper.
- **Sacrifice:** A second hash per location and a review workflow that must be kept synchronized with the specification text.

## Implementation Note

The plan schema, validators, and geometry helpers are `schemas/blocking-plan-schemas.ts`, `comic-utils/blocking-plan-validation.ts`, and `comic-utils/blocking-geometry.ts`. Drafting and import live in `comic-commands/draft-scenes/generate-blocking-plan.ts` and the `draft-scenes` stage machine; compilation and the review artifacts live in `comic-utils/blocking-plan-compile.ts` and `comic-utils/blocking-diagram-svg.ts`. The prompt lines are added in `comic-commands/generate-images/comic-page-utils.ts`; the audit fields, roster cards, and hard-key policy live in `comic-commands/generate-images/comic-page-qa.ts`, and the restart lane in `comic-commands/generate-images/panel-qa-pipeline.ts`. The continuity judge is `comic-commands/generate-images/continuity-qa.ts` with `comic-utils/continuity-audit-report.ts` and `comic-utils/continuity-labels.ts`. Staging directives are `comic-utils/structured-script-utils/staging-directives.ts`; the review commands live under `comic-commands/review/`. Geometry records are read by `comic-utils/location-plan-records.ts`. Rebinding after a structure re-run also touches two files outside the blocking surface: `comic-utils/structured-script-utils/generator.ts` snapshots the structured script it replaces to `metadata/structured-script.previous.json` so a split or merged segment can be recognized, and `comic-utils/comic-manifest.ts` reads the existing manifest without artifact verification because it is itself the function that re-stamps the structured-script reference.

## Test Plan

```
bun run check
bun test test/test-cases/validation/comic
bun test test/test-cases/validation/cli/option-resolution-contracts/
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/doc-command-flags-contract.test.ts
bun test test/test-cases/validation/cli/help-flag-groups.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/native-cli-parser-contracts.test.ts
bun test test/test-cases/validation/providers/openai-rest-contracts/image-comic-image-contracts.test.ts
```

1. `bun run check` proves the plan, bundle, QA, and option types compose across the whole tree and that every new file basename is unique.
2. The comic suite proves plan validation and its exact error prefixes, deterministic compilation, the pinned prompt sentences, the blocking audit parser and hard-key truth table, the blocking-class restart lane, the continuity audit and its precision-recall report, staging-directive parsing, and the geometry-record reader.
3. The option-resolution, help, usage-error, and native-parser suites prove every new flag parses, groups, rejects invalid values, and appears in help exactly once.
4. The doc-command-flags contract proves every documented flag exists and every command doc matches its flag table.
5. The OpenAI REST contract suite proves the image request shape is unchanged by the added prompt lines.

## Follow-up Actions

- [ ] Phase 0 baseline and prompt ablation — Blocked on owner-run paid commands
  The baseline continuity audit, the ten-panel ablation, and Erik's blind verdicts are recorded in `docs/reports/blocking-plan-pilot-2026-09.md` in the project repository; every row is owner-run under that repository's price-preflight and approval rules.
- [ ] Promote blocking statuses from advisory to hard — Blocked on the Phase 0 precision gate
  `--blocking-hard-keys` stays empty until the audit shows acceptable precision for a key.
- [ ] Reviewed geometry records — Pending
  The four Episode 2 rooms ship `reviewStatus: "provisional"`; a reviewed record requires a hand-drawn floor plan and a reviewer.
- [ ] Phase 5 rendered blocking card and coverage keyframes — Pending
  Deliberately not built; retained as experiments behind the Phase 0 measurements.

## References

- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md)
- Related ADR: [ADR-016](ADR-016-govern-readme-command-examples-as-executable-contracts.md)
- Related ADR: [ADR-021](ADR-021-adopt-table-free-text-json-results-and-safe-retry-ownership.md)
- `src/cli/commands/process-steps/step-8-comic/schemas/blocking-plan-schemas.ts`
- `src/cli/commands/process-steps/step-8-comic/comic-utils/blocking-plan-compile.ts`
- `src/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/comic-page-qa.ts`
- `docs/commands/process-steps/step-8-comic/01-draft-scenes.md`
- `docs/commands/process-steps/step-8-comic/03-generate-images.md`
