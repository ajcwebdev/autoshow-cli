# ADR-017: Comic Script and Scene Authoring

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-09-02
- **Date Updated:** 2026-11-14
- **Verification Status:** Pending

## Context

Comic production needs a reviewable script, validated panel counts, and consistent spatial staging. Typed scene geometry can prevent contradictions that prose prompts and image-only QA cannot reliably resolve.

## Decision

Use the existing episode-script format as the boundary between prose adaptation and scene production. Compile an optional typed blocking plan into a shared generation and QA ledger, and keep human review local and non-mutating.

### Treatment drafting

`comic draft-treatment` adapts Markdown, plaintext, or locally extracted PDF into a validated episode script. It requires an existing style seed image. Panel counts accept an exact number or range; voice pacing defaults to one voice per panel, with mixed narration/dialogue opt-in.

New catalog entries merge without replacing existing keys or hand-edited descriptions. Ambiguous aliases are dropped and reported. One validation retry is allowed; a still-invalid draft leaves `input/` unchanged. The merge report identifies references needed before panel prompts are built.

`draft-scenes --panel-count` rejects an authored panel-note mismatch before dispatch and retries a mismatched generated scene once. The count is a validation contract at both stages.

### Blocking and continuity

`metadata/blocking-plan.json` uses a coordinate frame anchored to the location's establishing camera. Local validation rejects contradictory geometry before publication or generation. Imported plans make no provider call; generated plans allow one validation retry. Characters remain on stage until a cited exit; scene validation rejects camera views exposing unlisted characters. A deterministic per-panel ledger supplies both prompts and judging evidence. Character checks use screen space; set anchors use world space.

`draft-scenes` supports drafting, importing, skipping, rebinding citations, and reconciling reviewed script directives. Import and rebind preserve an existing reviewed scene. Per-location geometry in `input/locations/location-plans.json` is independent of reference-image freshness; location views are selected by camera match.

Final individual-panel images use the ledger and off-frame roster. Grouped pages and sketches do not. `generate-images --blocking-layout-guide` optionally provides a structural diagram for panels with at least six visible characters, only for final images with one panel per image.

Blocking checks are advisory until explicitly promoted with `--blocking-hard-keys`; `scale-wrong` and `crowd-uniform` remain advisory. Within the repair budget, an individual-panel failure involving a promoted blocking check and only spatial hard failures can restart from canonical references instead of editing the faulty image. The continuity judge is audit-only; human labels enable precision/recall measurement before policy promotion.

### Local review

`comic review` produces an HTML sheet with optional shared-document export, or maps reviewer notes to paste-ready staging directives. These modes are mutually exclusive. It reports unmatched notes and unresolved lines without changing scripts, scene JSON, structured scripts, or sound intent. Users apply accepted directives and run a separate reconcile pass.

## Trade-offs

A reviewable script reuses later pipeline stages instead of creating a second production path. Typed geometry enables deterministic validation but requires maintained schemas and reviewed plans. Ledger and roster evidence increases judge cost; restarting spatial repairs costs a full generation but avoids conditioning on a faulty pose. Unmeasured checks remain advisory because false hard failures purchase unnecessary regenerations. Required top-down reference cards and prior-panel contact sheets are not the staging mechanism; coverage keyframes remain an experiment.

## Verification

```bash
bun test test/test-cases/validation/visuals/comic/comic-treatment-draft-validation-contracts.test.ts test/test-cases/validation/visuals/comic/comic-treatment-catalog-merge-contracts.test.ts test/test-cases/validation/visuals/comic/comic-scene-panel-count-contracts.test.ts
bun test test/test-cases/validation/visuals/comic/comic-blocking-validation-contracts.test.ts test/test-cases/validation/visuals/comic/comic-blocking-compilation-contracts.test.ts test/test-cases/validation/visuals/comic/comic-blocking-qa-contracts.test.ts test/test-cases/validation/visuals/comic/comic-review-command-contracts.test.ts
```

Local fixtures and mocked providers verify validation, merge preservation, repair policy, and non-mutating review. They do not establish visual quality or judge precision.

## Follow-up Actions

- [ ] Measure continuity baseline and prompt ablation — Blocked on owner-run paid commands
- [ ] Promote blocking checks using measured precision — Blocked on the baseline
- [ ] Complete reviewed location geometry — Pending
- [ ] Evaluate rendered blocking cards and coverage keyframes — Pending
- [ ] Decide how first-try production promotes judge-retained originals when every hard failure is set continuity — Pending
- [ ] Decide whether per-location style images replace catalog-wide `styleImage` — Pending

## References

- [Treatment drafting](../commands/05-visuals/comic/07-draft-treatment.md), [scene drafting](../commands/05-visuals/comic/01-draft-scenes.md), [image generation](../commands/05-visuals/comic/03-generate-images.md), [review](../commands/05-visuals/comic/06-review.md)
- [ADR-013: Sound intent and presentation](ADR-013-comic-scene-audio-and-presentation.md)
- [ADR-015: Paid verification](ADR-015-govern-documentation-examples-and-verification-evidence.md)
- `src/cli/commands/visuals/comic/comic-utils/blocking-plan-compile.ts`
