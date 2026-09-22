# ADR-023: Draft Episode Scripts From Prose Treatments

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-09-10
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed

## Context

The `comic` pipeline starts from an episode script: a title, a scene heading, a bold slugline that resolves against the location catalog, panel notes, and bold speaker labels. Scene drafting, panel prompts, image generation, audio, and the slideshow all read that script. None of them accepts prose.

A treatment names characters and places that are not in the catalogs yet. The character catalog refuses an entry that has neither a source image nor a `generationReference`, so a bootstrapped entry needs a style seed image that already exists. The scene stage otherwise lets the model choose the panel count, so a fixed count has to be a checked contract.

Why now: the Camp Manzanita treatment is the first input that is not already a script, and the later stages are stable enough that a front stage which emits their script shape is cheaper and safer than a second pipeline.

## Options Considered

**Option 1 (selected)**

- **Option:** Add `comic draft-treatment`, a front stage that makes one structured LLM call, validates the draft locally, writes the episode script the later stages already read, merges new character and location entries into the catalogs, and writes the script under `input/scripts/`. Add `draft-scenes --panel-count` so the scene stage keeps the authored panel count.
- **Pros:** Every later stage runs unchanged. The generated script is a reviewable, hand-editable source. Catalogs are bootstrapped from the same draft that named the characters. The fixed count is checked when drafting and again when the scene is validated.
- **Cons:** Two hosted calls on the path to scene JSON. The stage must emit sluglines and speaker labels the existing script format accepts. A style seed image must exist before the stage runs.
- **Quantitative Notes:** One drafting call with one retry. Output estimate is 1,200 fixed units plus 260 per panel. No new provider.

**Option 2**

- **Option:** Teach the structure parser to read prose directly, producing structured script JSON from paragraphs.
- **Pros:** No intermediate script file.
- **Cons:** Prose has no panel boundaries, speaker labels, or sluglines, so the parser would need an LLM anyway. The reviewable script disappears, and later audio and slideshow stages have nothing stable to address.
- **Quantitative Notes:** Rejected; the parser's script contract cannot be met from prose without an LLM in the parser.

**Option 3**

- **Option:** Build a separate treatment-to-slideshow command that calls the image, TTS, and FFmpeg helpers directly with its own manifest.
- **Pros:** Fewer catalog requirements for a first try.
- **Cons:** Duplicates image review, audio recovery, and slideshow timing. Drops continuity references. Gives `resume` a second manifest shape to learn.
- **Quantitative Notes:** Rejected; the slideshow still depends on the scene, panel files, audio timeline, and dialogue plan the existing stages produce.

## Decision

`comic draft-treatment <treatment-path>` adapts a `.md`, `.txt`, or locally extracted `.pdf` treatment into `input/scripts/<episode>-script/<scene>-<slug>.md`. The script's panel count satisfies `--panel-count` (an exact number or a range). Narration is written under `NARRATION` labels, and `--speaker` lines are dialogue. `--voice-pacing` defaults to `exclusive` (one voice per panel); `mixed` allows narration and dialogue in the same panel. New characters and locations merge into the catalogs without changing existing keys. The run is recorded under `output/<timestamp>_<slug>-treatment/metadata/treatment/`.

`draft-scenes --panel-count <n>` keeps that count. The command fails before any call when the script's panel notes differ, and a scene response that violates the count retries once.

This applies to:

- The `comic draft-treatment` subcommand, its flags, validation, script output, catalog merge, run artifacts, and price estimate.
- The `--panel-count` contract on `draft-scenes`, including the pre-call check, the single retry, and the price estimate.

It does not apply to:

- The screenplay parser, scene JSON schema, image, audio, or slideshow stages, which this decision does not change and which stay owned by [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md), [ADR-018](ADR-018-synchronize-comic-panels-with-manifest-backed-audio.md), and [ADR-022](ADR-022-compile-a-text-first-blocking-plan-into-a-panel-ledger.md).
- Voice registration, which stays with `voice import` and the existing `role:narrator` casting rule.

## Rationale

- The existing script shape is the narrowest stable seam. Emitting it leaves later stages, including audio binding and slideshow timing, unchanged.
- A draft that fails validation writes nothing under `input/`, so a bad response never leaves a partial catalog or script.
- Merging new catalog entries leaves hand-edited descriptions in place. Ambiguous aliases are dropped and reported so the catalog still loads.
- Checking the panel count in both stages makes a fixed count a contract rather than a prompt hint.

## Consequences

Positive outcomes:

- A treatment becomes a reviewable script and catalog in one command, and the rest of the production is the documented `comic` walkthrough.
- The merge report lists the exact `reference-sketch` commands for every added key.

Negative outcomes:

- A style seed image must be generated and copied before the first run.
- The location catalog's single `styleImage` is shared across projects. The stage replaces it only when the current file is missing.

## Trade-offs

**Trade-off 1**

- **Gain:** Later stages and their manifests stay as they are.
- **Sacrifice:** This stage must produce the script shape those stages already require.

**Trade-off 2**

- **Gain:** The same draft bootstraps the catalogs and the script.
- **Sacrifice:** Each new named character still needs a paid character sheet before panel images.

## Implementation Note

`comic draft-treatment` and `draft-scenes --panel-count` shipped. The command lives under `src/cli/commands/visuals/comic/comic-commands/draft-treatment/`, and the panel-count contract is `src/cli/commands/visuals/comic/comic-commands/draft-scenes/scene-panel-count-contract.ts`. Operator behavior is `docs/commands/05-visuals/comic/07-draft-treatment.md`.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
bun test test/test-cases/validation/visuals/comic/comic-treatment-renderer-contracts.test.ts
bun test test/test-cases/validation/visuals/comic/comic-treatment-catalog-merge-contracts.test.ts
bun test test/test-cases/validation/visuals/comic/comic-treatment-draft-validation-contracts.test.ts
bun test test/test-cases/validation/visuals/comic/comic-scene-panel-count-contracts.test.ts
bun autoshow comic draft-treatment input/camp.md --episode 02 --speaker papa-bear --price
```

1. Names and types stay unique and sound.
2. Help, usage errors, and option defaults cover `draft-treatment` and `--panel-count`.
3. The written script is the episode script shape, and a PDF treatment loads from local text extraction.
4. Catalog merges are idempotent, never replace existing entries, and drop ambiguous aliases.
5. A failed draft retries once. A second failure writes nothing under `input/`. A missing style seed stops before any request.
6. `--panel-count` is enforced, and the retry sees the violation.
7. `--price` reports the drafting call without a provider call or writes.

## Follow-up Actions

- [ ] Decide how a first-try production should promote judge-retained originals — Pending
  Either a `generate-images` flag that promotes retained originals when every hard failure is set-continuity, or documented guidance to rerun the failed panels with `--no-qa`.
- [ ] Decide whether a per-location style image should replace the catalog-wide `styleImage` — Pending

## References

- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md)
- Related ADR: [ADR-018](ADR-018-synchronize-comic-panels-with-manifest-backed-audio.md)
- Related ADR: [ADR-022](ADR-022-compile-a-text-first-blocking-plan-into-a-panel-ledger.md)
- `src/cli/commands/visuals/comic/comic-commands/draft-treatment/draft-treatment-command.ts`
- `src/cli/commands/visuals/comic/comic-commands/draft-treatment/treatment-script-renderer.ts`
- `src/cli/commands/visuals/comic/comic-commands/draft-treatment/treatment-catalog-merge.ts`
- `src/cli/commands/visuals/comic/comic-commands/draft-scenes/scene-panel-count-contract.ts`
- `docs/commands/05-visuals/comic/07-draft-treatment.md`
