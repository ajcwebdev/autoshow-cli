# ADR-007: Integrate Comic with Shared Model and Native CLI Infrastructure

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-17
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed

## Context

Comic maintained two parallel stacks instead of using the rest of the CLI's shared infrastructure.

The first was a private model stack: comic-local LLM and image registries, pricing tables, and provider clients duplicated the central model registry. That stack limited comic to a small subset of providers and required every model and price change to be repeated.

The second was a private command stack. `comic` accepted a subcommand through a second parser and help renderer, which preserved a separate public grammar: inline assignments such as `--target=sketches` and the `--` separator were rejected, repeated scalar flags errored instead of using the native last-wins rule, and required script paths were not enforced until the handler ran.

The `links` command had the last other form of the same problem. Its provider-scoped positional grammar is legitimate, but it re-tokenized raw process argv and treated provider selectors as unknown flags rather than registered options.

Why now: comic's model migration and its CLI migration are the same architectural decision — comic should adapt its domain semantics to shared infrastructure rather than maintain a parallel shell — so the intentionally changed public grammar is recorded alongside the model-registry change.

## Options Considered

**Option 1 (selected)**

- **Option:** Use the central model registry and shared LLM/image generation paths
- **Pros:** One source of truth for models, pricing, clients, and dispatch; centrally registered providers reach comic without comic-specific branches
- **Cons:** Comic depends on shared generation infrastructure and must adapt its domain options
- **Quantitative Notes:** Removed 1 private model directory, 3 private clients, and 3 dispatch chains

**Option 2**

- **Option:** Keep comic-local model dispatch but read central prices
- **Pros:** Smaller migration
- **Cons:** Preserves parallel clients and provider branches; only solves price drift
- **Quantitative Notes:** Preserves 3 private clients

**Option 3 (selected)**

- **Option:** Represent comic subcommands as one native nested command tree, parse `links` through the same native boundary, and accept native grammar for comic
- **Pros:** One parse and dispatch path; one help renderer; globals applied once; parser owns unknown flags and parameter cardinality
- **Cons:** Public grammar deliberately changes for inline assignments, `--`, and repeated scalar flags
- **Quantitative Notes:** Removed 1 second-stage shell and ~100 lines of comic revalidation

**Option 4**

- **Option:** Preserve comic's old grammar inside native subcommands
- **Pros:** Minimizes surface change
- **Cons:** Requires permanent comic-specific tokenizer checks and repeated-option guards
- **Quantitative Notes:** Preserves ~100 lines of custom validation

**Option 5**

- **Option:** Flatten comic into three top-level commands
- **Pros:** Avoids nested-dispatch support
- **Cons:** Breaks the established `comic <subcommand>` surface and pollutes root help
- **Quantitative Notes:** Adds 3 top-level commands

**Option 6**

- **Option:** Fully flatten links' provider-scoped grammar
- **Pros:** Makes links expressible as ordinary independent flags and positionals
- **Cons:** Changes the meaning of ordered sections after provider selectors with no agreed replacement syntax
- **Quantitative Notes:** n/a

**Option 7**

- **Option:** Keep the links bespoke parser
- **Pros:** No test churn
- **Cons:** Leaves the final raw-argv tokenizer and permissive unknown-flag bypass in production
- **Quantitative Notes:** Preserves 1 bespoke parser

## Decision

Integrate comic workflows with the central model registry, shared hosted coordinator, and native CLI command hierarchy. Comic-local model registries, clients, and dispatch branches are retired in favor of shared generation infrastructure, while comic subcommands and `links` adopt the native command parser.

This applies to:

- Comic model resolution, pricing, and hosted LLM/image generation through the central model registry.
- Native nested `comic` subcommands: `draft-scenes`, `generate-images`, `generate-audio`, `generate-slideshow`, `reference-sketch`, and `reference-voice`.
- Native grammar for comic commands (inline assignments, `--` separator, last-occurrence scalar flags, and unknown-flag diagnostics that show the spelling the user typed).
- `links` provider selection through the native parser, without changing its provider-scoped grammar.
- Comic hosted admission for LLM, image, QA, dialogue, and sound-effect tasks via the shared hosted coordinator.

It does not apply to:

- Comic domain workflow logic, prompt assembly, schemas, panel ordering, QA/repair rules, audio mixing, or presentation rendering.
- `links` provider-scoped grammar semantics or provider execution logic.
- Voice management verb semantics, which `comic reference-voice` re-exposes through the shared `voice` handlers without changing them.

Comic `--llm-model` and `--image-model` flags validate central registry IDs. `help comic <subcommand>` and `comic <subcommand> --help` resolve the same definition. `comic reference-voice` nests one level deeper by re-exposing the shared voice verbs under fully qualified names.

The public grammar intentionally becomes the native grammar:

- Inline long assignments such as `--target=sketches`, `--grid=2x3`, and `--qa=false` are accepted.
- `--` is accepted as the native separator.
- Repeated non-repeatable flags use the last value, matching every other native command.
- Unknown flags and stray positionals use native usage errors, displaying the spelling the user typed.
- Required comic script paths are enforced before handlers run.

This is a deliberate public-surface change, not a behavior-preserving refactor. Semantic validation remains in comic: model IDs, target values, grid combinations, concurrency bounds, reference-sheet modes, and other domain rules are unchanged.

Links keeps its order-sensitive meaning: positionals after `--openai` belong to OpenAI until another provider selector appears, while leading positionals are global sections. Inline values on provider selectors remain invalid, direct URL and input-file exclusivity is unchanged, and unknown dashed selectors fail through the native unknown-flag path.

`draft-scenes`, `generate-images`, `generate-audio`, and `reference-sketch` expose `--concurrency-mode ramp|immediate`; their existing `--concurrency`, provider, TTS-chunk, and SFX caps remain hard maxima. Provider plus non-secret account label defines the lane, so LLM, image, and QA work sharing an account share its live bound while independent providers start and ramp independently.

## Rationale

- The repository already had the right reusable boundaries: the model registry owns provider and model mechanics, while the native command tree owns parse, help, and dispatch. Comic-local or links-local copies made common behavior conditional on which command a user entered.
- A nested verb such as `comic reference-voice import` should reach the same parse, help, and dispatch path as a top-level command.
- Global flags on comic should apply once, the same way they do on every other native command.
- Links cannot be flattened without changing its grammar, but it does not need a private tokenizer to preserve that grammar.

## Consequences

Positive outcomes:

- Comic uses shared model, pricing, command parsing, dispatch, help, and hosted-admission infrastructure.
- The parent command definition is the source of truth for comic's subcommand list, so `comic --help` and `help comic` show the same tree.
- Global flags on comic commands work like every other native command.
- Links keeps its provider-scoped sections while unknown selectors fail as unknown flags.
- Unknown-flag diagnostics preserve the user's typed spelling.

Negative outcomes:

- Scripts that depended on comic rejecting inline assignments or duplicate scalar flags observe new behavior; duplicate scalar options now honor the last occurrence.

## Trade-offs

**Trade-off 1**

- **Gain:** One shared model and provider path
- **Sacrifice:** Comic depends on central generation infrastructure

**Trade-off 2**

- **Gain:** One command parser, dispatcher, and help renderer
- **Sacrifice:** Comic's prior grammar is intentionally retired

**Trade-off 3**

- **Gain:** One recursive command tree covers every level the product exposes
- **Sacrifice:** Nested definitions such as `comic reference-voice import` re-expose shared handlers under fully qualified names

**Trade-off 4**

- **Gain:** Registered links selectors and native validation
- **Sacrifice:** Provider selectors stay hidden from help so their order-sensitive meaning is not advertised as ordinary independent flags

## Implementation Note

Comic model resolution, native nested `comic` commands, shared hosted admission, and native `links` parsing shipped in `src/cli/commands/process-steps/step-8-comic/define-comic-command.ts`, `src/cli/commands/setup-and-utilities/links/define-links-command.ts`, and the native parser, dispatcher, and help renderer under `src/cli/native/`. The comic-local model stack, second-stage comic parser and help renderer, and `links` raw-argv tokenizer were removed.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/cli/native-cli-parser-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/selector-validation.test.ts
bun test test/test-cases/validation/comic/character-handling-contracts.test.ts
```

1. Typecheck and unique-source check pass against the native comic and links command definitions.
2. Native parser contracts cover nested `comic` subcommands, inline assignments, `--`, last-wins scalar flags, and unknown-flag spelling.
3. CLI usage-error and option-resolution contracts cover required script paths, domain option validation, and global flags on comic.
4. Links selector-validation contracts cover provider-scoped sections, invalid inline selector values, and native unknown-flag failures.
5. Comic character-handling contracts cover central-registry model IDs on comic commands.

Verification uses local fixtures and mocked providers without executing live hosted generation commands.

## References

- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) — shared type and ownership boundaries
- Related ADR: [ADR-005](ADR-005-reduce-environment-variable-surface-area.md) — removal of parallel override/client plumbing
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) — shared hosted admission, pressure recovery, and clean-ramp price planning
- Related ADR: [ADR-011](ADR-011-add-refresh-metadata-to-links.md) — links selection modes and refresh artifacts
- `docs/commands/process-steps/step-8-comic/00-comic-overview.md`
- `docs/commands/setup-and-utilities/links/links.md`
- `src/cli/native/native-parser.ts`
- `src/cli/native/dispatcher.ts`
- `src/cli/native/help-renderer.ts`
- `src/cli/commands/process-steps/step-8-comic/define-comic-command.ts`
- `src/cli/commands/setup-and-utilities/links/define-links-command.ts`
