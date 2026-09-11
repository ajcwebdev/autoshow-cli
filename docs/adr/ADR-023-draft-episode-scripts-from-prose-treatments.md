# ADR-023: Draft Episode Scripts From Prose Treatments

## Status

- **Decision Status:** Proposed
- **Date Created:** 2026-09-10
- **Date Updated:** 2026-09-10
- **Verification Status:** Pending

## Context

The `comic` pipeline starts from an episode script whose Markdown shape is fixed by the deterministic structure parser: a title heading, a scene heading, a bold slugline that resolves against the location catalog, `[Panel N: ...]` notes, and bold speaker labels. Every later stage (scene drafting, panel prompts, image generation, audio, and the slideshow) consumes the structured script that parser produces. Nothing accepts prose.

A first production from a prose treatment, `input/camp.md`, needs to become a ten-panel slideshow with a narrator plus one character's spoken lines. The treatment names nine characters and two places, none of which exist in the catalogs. The character catalog refuses to load an entry whose source image and `generationReference` are both missing, so bootstrapped entries must name a style seed image that already exists. The scene stage lets the model choose the panel count, so a fixed count needs a contract the stage validates.

Why now: the Camp Manzanita treatment is the first input that is not already a script, and the downstream stages are stable enough that a front stage which emits their exact input shape is cheaper and safer than a parallel pipeline.

## Options Considered

**Option 1 (selected)**

- **Option:** Add `comic draft-treatment`, a front stage that makes one structured LLM call, validates the draft locally, renders the exact script Markdown the parser expects, merges new character and location entries into the catalogs, and writes the script under `input/scripts/`; add `draft-scenes --panel-count` so the scene stage keeps the authored panel count.
- **Pros:** Every downstream stage runs unchanged; the generated script is a reviewable, hand-editable source; catalogs are bootstrapped from the same draft that named the characters; the fixed count is enforced twice, once when drafting and once when the scene JSON is validated.
- **Cons:** Two hosted calls on the path to scene JSON; the treatment stage must know parser traps such as lowercase action fragments and slugline resolution; a style seed image must exist before the stage runs.
- **Quantitative Notes:** One drafting call with one retry; roughly 1,200 fixed output units plus 260 per panel; ten new source modules, no new provider.

**Option 2**

- **Option:** Teach the structure parser to read prose directly, producing structured script JSON from paragraphs.
- **Pros:** No intermediate script file.
- **Cons:** Prose has no panel boundaries, speaker labels, or sluglines, so the parser would need an LLM anyway; source spans would bind to prose the downstream audio and slideshow stages cannot address; the reviewable script artifact disappears.
- **Quantitative Notes:** Rejected; the deterministic parser's exact source-span contract cannot be met from prose without an LLM in the parser.

**Option 3**

- **Option:** Build a separate lightweight treatment-to-slideshow command that calls the image, TTS, and FFmpeg helpers directly with its own manifest.
- **Pros:** Fewer catalog requirements for a first try.
- **Cons:** Duplicates image QA, audio slot recovery, presentation timing, and recovery manifests; loses continuity references; a second manifest shape for `resume` to learn.
- **Quantitative Notes:** Rejected; the slideshow renderer alone depends on the scene JSON, panel files, audio timeline, and dialogue plan that the existing stages produce.

## Decision

`comic draft-treatment <treatment-path>` adapts a `.md`, `.txt`, or locally extracted `.pdf` treatment into `input/scripts/<episode>-script/<scene>-<slug>.md` with a panel count that satisfies `--panel-count` (an exact number or a range), writes narration under `NARRATION` labels and `--speaker` quotes as dialogue, paces voices under `--voice-pacing` (exclusive by default: one voice per panel, consecutive panels grouped into runs, and a cap on voice changes), merges new characters and locations into the catalogs without touching existing keys, and records every artifact under `output/<timestamp>_<slug>-treatment/metadata/treatment/`. `draft-scenes --panel-count <n>` appends a panel count contract to the scene prompt, fails before any call when the authored note count differs, and retries once on a contract violation.

This applies to:

- The `comic draft-treatment` subcommand, its flags, validation, rendering, catalog merge, run artifacts, and price estimate.
- The `--panel-count` contract on `draft-scenes`, including its prompt section, validator, retry reason, and price estimate.
- The `verifyAssets` option on the character catalog index, used only to self-check a rendered script against catalog entries whose images do not exist yet.

It does not apply to:

- The screenplay parser, scene JSON schema, image, audio, or slideshow stages, which are unchanged and owned by [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md), [ADR-018](ADR-018-synchronize-comic-panels-with-manifest-backed-audio.md), and [ADR-022](ADR-022-compile-a-text-first-blocking-plan-into-a-panel-ledger.md).
- Voice registration, which stays with `voice import` and the existing `role:narrator` casting rule.

## Rationale

- The parser's exact input shape is the narrowest stable seam: emitting it keeps every downstream contract, including source-span audio binding and slideshow timing, intact.
- Validating the draft locally and self-parsing the rendered script before any write means a bad model response never leaves a half-written catalog or script.
- Merging rather than replacing catalog entries protects hand-edited descriptions, and dropping ambiguous aliases keeps the catalog loadable, which the index otherwise refuses.
- Enforcing the panel count in both stages turns "fit it in ten panels" into a checked contract instead of a prompt hint.

## Consequences

Positive outcomes:

- A treatment becomes a reviewable script and catalog in one call, and the rest of the production is the documented `comic` walkthrough.
- The merge report lists the exact `reference-sketch` commands for every added key.

Negative outcomes:

- A style seed image must be generated and copied before the first run.
- The location catalog's single `styleImage` is shared across projects; the stage only replaces it when the current file is missing.

## Trade-offs

**Trade-off 1**

- **Gain:** Unchanged downstream stages and manifests.
- **Sacrifice:** The treatment stage carries parser-specific sanitization rules.

**Trade-off 2**

- **Gain:** Catalog bootstrap from the same draft that wrote the script.
- **Sacrifice:** Character sheets for every named character are paid work before panel images.

## Follow-up Actions

- [x] Run the Camp Manzanita production end to end — In progress
  Ran on 2026-09-10: `draft-treatment` (one call), structure, 11 character sheets, 7 location views, `--only scene --panel-count 10 --no-blocking` (one call), panel prompts, 10 panel images with QA, two provider-stock voice imports, segmented Hume audio, and the local slideshow. The page judge accepted 4 panels and retained the originals for 6 on set-continuity grounds, so those 6 canonical panels were promoted by hand from the preserved attempts for the first slideshow; the image stage manifest still records the QA failures.
- [ ] Decide how a first-try production should promote judge-retained originals — Pending
  Either a `generate-images` flag that promotes retained originals when every hard failure is set-continuity, or documented guidance to rerun the failed panels with `--no-qa`.
- [ ] Decide whether a per-location style image should replace the catalog-wide `styleImage` — Pending

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
2. The help closed list, usage errors, and option defaults cover the new subcommand and `--panel-count`.
3. The rendered script parses into the expected beats, sanitization holds, and the loader reads page-marked treatments.
4. Catalog merges are idempotent, never clobber existing entries, drop ambiguous aliases, and the index accepts image-less entries only with verification disabled.
5. Validation issues drive one retry, a second failure writes nothing to `input/`, and a missing style seed stops before any request.
6. The panel count contract is built, appended, validated, and reflected in the retry prompt.
7. Price mode reports the drafting call without provider calls or writes.

## References

- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md)
- Related ADR: [ADR-018](ADR-018-synchronize-comic-panels-with-manifest-backed-audio.md)
- Related ADR: [ADR-022](ADR-022-compile-a-text-first-blocking-plan-into-a-panel-ledger.md)
- `src/cli/commands/visuals/comic/comic-commands/draft-treatment/draft-treatment-command.ts`
- `src/cli/commands/visuals/comic/comic-commands/draft-treatment/treatment-script-renderer.ts`
- `src/cli/commands/visuals/comic/comic-commands/draft-treatment/treatment-catalog-merge.ts`
- `src/cli/commands/visuals/comic/comic-commands/draft-scenes/scene-panel-count-contract.ts`
- `docs/commands/visuals/comic/07-draft-treatment.md`
