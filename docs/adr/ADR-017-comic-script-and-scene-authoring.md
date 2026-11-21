# ADR-017: Comic Script and Scene Authoring

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-09-02
- **Date Updated:** 2026-11-20
- **Verification Status:** Passed

## Context

Comic production needs a reviewable script, validated panel counts, and a predictable path from generated images to a finished slideshow. A typed blocking plan and automated image judging added hosted cost, retries, and authored geometry without reliably resolving spatial contradictions, so both are retired; prose shot descriptions and human review remain the staging mechanism.

## Decision

Use the existing episode-script format as the boundary between prose adaptation and scene production. Prepare the scene locally, draft it once with a validated panel count, make the first valid generated panel the default selection, and keep human review local, optional, and explicit.

### Treatment drafting

`comic draft-treatment` adapts Markdown, plaintext, or locally extracted PDF into a validated episode script. It requires an existing style seed image. Panel counts accept an exact number or range; voice pacing defaults to one voice per panel, with mixed narration/dialogue opt-in.

New catalog entries merge without replacing existing keys or hand-edited descriptions. Ambiguous aliases are dropped and reported. One validation retry is allowed; a still-invalid draft leaves `input/` unchanged. The merge report identifies references needed before panel prompts are built.

### Scene drafting

`draft-scenes` runs three stages: local `prepare` (parse the script, validate source spans, and build the draft prompt from that exact structure), hosted `scene`, and local `panel-prompts`. Each stage is callable with `--only`. Prepare publishes `metadata/structured-script.json` and `metadata/draft-prompt.md` as a consistent pair and never calls a provider; hosted structure review is retired.

`draft-scenes --panel-count` rejects an authored panel-note mismatch before dispatch and retries a mismatched generated scene once. The count is a validation contract at both stages. Scripts containing retired staging labels are reported with their source location before drafting. Older structure, scene, and bundle records without blocking data stay readable; plan-bearing records are converted locally or reported with the stage to rebuild.

Location references carry no authored geometry. An existing `location-plans.json` is no longer read; comic commands warn once and leave it in place. Location views are generated or revised on request and registered without a vision verdict.

### Image selection and local review

Each `generate-images` run uses one image model and writes run-scoped candidates. The first verified individual final panel fills an empty `panels/panel-NN.png` slot; later runs, including `--force`, add candidates without replacing a selection. Sketches, grouped pages, and local grids never fill slots.

`comic review` writes an HTML sheet with optional shared-document export, previews a named image run beside the current selection with `--run`, and adopts that run's individual panels only with `--use`. Sheet, preview, and export never change scripts, scene JSON, structured scripts, sound intent, or selections. `--use` validates every requested panel before replacing any and preserves prior provenance. The slideshow can render without a review step.

## Trade-offs

A reviewable script reuses later pipeline stages instead of creating a second production path. Without typed geometry and automated judging, an image can complete with a visible continuity or lettering error; users catch it in review and replace the panel explicitly, which costs a new generation rather than a modeled repair budget. Making the first valid panel the selection removes a publication step but means a replacement always requires an explicit choice.

## Verification

```bash
bun test test/test-cases/validation/visuals/comic/comic-treatment-draft-validation-contracts.test.ts test/test-cases/validation/visuals/comic/comic-treatment-catalog-merge-contracts.test.ts test/test-cases/validation/visuals/comic/comic-scene-panel-count-contracts.test.ts
bun test test/test-cases/validation/visuals/comic/comic-review-command-contracts.test.ts test/test-cases/validation/visuals/comic/comic-review-sheet-contracts.test.ts
```

Local fixtures and mocked providers verify validation, merge preservation, panel-count retry, first selection, explicit adoption, and non-mutating review. They do not establish visual quality.

## Follow-up Actions

- [ ] Decide whether per-location style images replace catalog-wide `styleImage` — Pending

## References

- [Treatment drafting](../commands/05-visuals/comic/07-draft-treatment.md), [scene drafting](../commands/05-visuals/comic/01-draft-scenes.md), [image generation](../commands/05-visuals/comic/03-generate-images.md), [review](../commands/05-visuals/comic/06-review.md)
- [ADR-013: Sound intent and presentation](ADR-013-comic-scene-audio-and-presentation.md)
- [ADR-015: Paid verification](ADR-015-govern-documentation-examples-and-verification-evidence.md)
- `src/cli/commands/visuals/comic/comic-commands/draft-scenes/draft-scenes-command.ts`
- `src/cli/commands/visuals/comic/comic-utils/panel-selection.ts`
