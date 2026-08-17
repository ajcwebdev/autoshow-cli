# ADR-007: Integrate Comic with Shared Model and Native CLI Infrastructure

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-17
- **Date Updated:** 2026-08-14
- **Verification Status:** Passed

## Context

Comic maintained two parallel infrastructure stacks inside `src/cli/commands/process-steps/step-8-comic/`.

The first was a private model stack: comic-local LLM and image registries, pricing tables, provider clients, type guards, and dispatch branches duplicated the central model registry and the shared write/image target collectors. That stack limited comic to a small subset of providers and required every model and price change to be repeated.

The second was a private command stack. The top-level native parser accepted `comic` as a permissive variadic command, then `define-comic-command.ts` stripped globals, selected a subcommand, reparsed the remaining argv, rendered help itself, and invoked the selected handler; `cli-args.ts` then rechecked unknown flags, excess positionals, and repeated options that the native layer already governs. The two-stage path preserved a separate public grammar: inline assignments such as `--target=sketches` and the `--` separator were rejected, repeated scalar flags errored instead of using the native last-wins rule, required script paths were temporarily rewritten as optional parameters, and global flags crossed two parser boundaries.

The `links` command had the last other form of the same problem. Its provider-scoped positional grammar is legitimate, but it hid every provider selector behind `allowUnknownFlags`, declared a fake `<provider>` help flag, found the `links` token inside raw process argv, and tokenized flags again in `parseLinksArgv`.

Why now: comic's model migration and its CLI migration are the same architectural decision — comic should adapt its domain semantics to shared infrastructure rather than maintain a parallel shell — so the intentionally changed public grammar is recorded alongside its implementation.

## Options Considered

**Option 1 (selected)**

- **Option:** Use the central model registry and shared LLM/image collectors
- **Pros:** One source of truth for models, pricing, clients, and dispatch; centrally registered providers reach comic without comic-specific branches
- **Cons:** Comic depends on shared generation infrastructure and must adapt its domain options
- **Quantitative Notes:** Removed 1 private model directory, 3 private clients, and 3 dispatch chains

**Option 2**

- **Option:** Keep comic-local model dispatch but read central prices
- **Pros:** Smaller migration
- **Cons:** Preserves parallel clients and provider branches; only solves price drift
- **Quantitative Notes:** Preserves 3 private clients

**Option 3 (selected)**

- **Option:** Represent comic subcommands as one native `CliCommandDefinition` tree and accept native grammar
- **Pros:** One parse and dispatch path; one help renderer; globals applied once; parser owns unknown flags and parameter cardinality
- **Cons:** Public grammar deliberately changes for inline assignments, `--`, and repeated scalar flags
- **Quantitative Notes:** Removes 1 second-stage shell and ~100 lines of comic revalidation

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

Integrate comic workflows with the central model registry, shared hosted coordinator, and native CLI command hierarchy. Comic-local model registries, clients, and dispatch branches are retired in favor of shared generation infrastructure, while comic subcommands and `links` adopt the native parser and dispatcher.

This applies to:

- Comic model resolution, client dispatch, pricing, structured-LLM collectors, and image target collectors.
- Native CLI command definitions supporting single-level subcommands, shared dispatcher, and unified help rendering for comic (`draft-scenes`, `generate-images`, `generate-audio`, `reference-sketch`, `reference-voice`).
- Native grammar adoption for comic commands (inline assignments, `--` separator, last-occurrence scalar flags, and typed unknown-flag diagnostics).
- `links` provider selection parsing via ordered native flag and positional metadata instead of raw argv tokenization.
- Comic hosted admission for LLM, image, QA, dialogue, and sound-effect tasks via the shared hosted coordinator.

It does not apply to:

- Comic domain workflow logic, prompt assembly, schemas, panel ordering, QA/repair rules, audio mixing, or presentation rendering.
- `links` provider-scoped grammar semantics or provider execution logic.
- Arbitrary multi-level subcommand nesting beyond the single level required by the CLI.

### 1. Shared model infrastructure

Comic resolves LLM and image model IDs against `getModelRegistry()` and routes generation through the shared structured-LLM and image target infrastructure. Comic-local model arrays, pricing, clients, provider type guards, and dispatch branches are retired. The `--llm-model` selectors on `draft-scenes` and `reference-sketch`, and the `--image-model` selectors on image-producing commands, validate central registry IDs.

### 2. A first-class native command tree

`CliCommandDefinition` supports one level of `subcommands`. `comicCommand` registers `draft-scenes`, `generate-images`, `generate-audio`, `reference-sketch`, and `reference-voice` directly. The native parser resolves the child once, creates the final child context, and the dispatcher configures global state and invokes exactly that handler. Parent and child help both use `renderCommandHelp`; `help comic <subcommand>` and `comic <subcommand> --help` resolve the same definition.

Subcommand definitions use their real required parameters and native excess-positional rejection. Comic no longer uses `allowUnknownFlags`, `allowExcessParameters`, or `passThroughHelpAfterFirstPositional`. The second dispatcher, parse-time required-to-optional mutation, global-argument stripping pass, bespoke help routing, unknown-flag scan, positional cardinality checks, and repeated-scalar checks are removed.

The public grammar intentionally becomes the native grammar:

- Inline long assignments such as `--target=sketches`, `--grid=2x3`, and `--qa=false` are accepted.
- `--` is accepted as the native separator.
- Repeated non-repeatable flags use the last value, matching every other native command.
- Unknown flags and stray positionals use native usage errors, displaying the spelling the user typed.
- Required comic script paths are enforced before handlers run.

This is a deliberate public-surface change, not a behavior-preserving refactor. Semantic validation remains in comic: model IDs, target values, grid combinations, concurrency bounds, reference-sheet modes, and other domain rules are unchanged.

### 3. Links uses the shared parse boundary while retaining its grammar

Every real links provider selector is registered as a hidden Boolean flag; the fake `<provider>` flag and `allowUnknownFlags` are removed. `parseCommandInvocation` is the sanctioned reusable native boundary for tests and other resolved invocations. Production receives the already parsed command context and reduces ordered native flag/positional metadata into provider-scoped sections; it does not locate or tokenize raw process argv again.

Links keeps its order-sensitive meaning: positionals after `--openai` belong to OpenAI until another provider selector appears, while leading positionals are global sections. Inline values on provider selectors remain invalid, direct URL and input-file exclusivity is unchanged, and unknown dashed selectors fail through the native unknown-flag path.

### 4. Comic adopts shared hosted admission

Comic LLM generation, image generation, image QA, dialogue synthesis, and sound-effect execution use the same run-scoped hosted coordinator as the rest of the pipeline. `draft-scenes`, `generate-images`, `generate-audio`, and `reference-sketch` expose `--concurrency-mode ramp|immediate`; their existing `--concurrency`, provider, TTS-chunk, and SFX caps remain hard maxima. Provider plus non-secret account label defines the lane, so LLM, image, and QA work sharing an account share its live bound while independent providers start and ramp independently.

Comic work selectors retain panel ordering, QA/repair sequencing, cancellation, artifact promotion, durable-admission, and ambiguous-redispatch rules. The coordinator controls only hosted admission and rate-limit pressure. Local prompt assembly, page composition, audio mixing, and slideshow rendering remain immediate.

## Rationale

- The repository already had the right reusable boundaries: the model registry and target collectors own provider/model mechanics, while `CliCommandDefinition`, `parseCommandArgv`, the dispatcher, and the help renderer own command mechanics. Comic-local or links-local copies made common behavior conditional on which command a user entered.
- Native subcommands are limited to one level because that is the only hierarchy the product exposes; a recursive command framework would add policy with no consumer.
- Parsing directly into the final child context keeps the global-state invariant simple: a flag occurrence is tokenized once and global configuration is applied once.
- Links cannot be flattened without changing its grammar, but it does not need a tokenizer to preserve that grammar. The native parser validates and records real selectors and positionals; the links reducer only assigns already parsed positional tokens to the current provider scope.

## Consequences

Positive outcomes:

- Comic uses shared model, client, pricing, structured-output, image-target, command parsing, dispatch, and help infrastructure.
- The parent command definition is the source of truth for comic's subcommand list, so dispatch, help, help-group tests, and flag coloring walk the same tree.
- Global flags on comic commands work through the ordinary dispatcher, and the test harness can treat comic as a normal processing command.
- Links exposes only real registered flags while preserving its provider-scoped sections.
- Unknown-flag diagnostics preserve the user's typed spelling while suppressing inline values and duplicate occurrences.

Negative outcomes:

- Scripts that depended on comic rejecting inline assignments or duplicate scalar flags observe new behavior; duplicate scalar options now honor the last occurrence.
- `CliRawParsed` carries flag occurrence indices so an order-sensitive domain reducer can align flags with positional tokens without reparsing argv.

## Trade-offs

**Trade-off 1**

- **Gain:** One shared model and provider path
- **Sacrifice:** Comic depends on central generation infrastructure

**Trade-off 2**

- **Gain:** One command parser, dispatcher, and help renderer
- **Sacrifice:** Comic's prior grammar is intentionally retired

**Trade-off 3**

- **Gain:** One-level command tree matches the real product hierarchy
- **Sacrifice:** No arbitrary-depth subcommand framework

**Trade-off 4**

- **Gain:** Registered links selectors and native validation
- **Sacrifice:** Hidden provider flag definitions add registry-derived entries to the command definition

**Trade-off 5**

- **Gain:** Ordered parsed metadata replaces raw-argv tokenization
- **Sacrifice:** `CliRawParsed` gains occurrence-index metadata

## API / Type Impact

- `CliCommandDefinition` gains `subcommands?: readonly CliCommandDefinition[]`.
- `CliRawParsed` gains `flagOccurrenceIndices`, parallel to `flagOccurrences`.
- Parsed comic draft/image arguments require `scriptPath` because native parameter validation runs before coercion.
- `NativeUnknownFlagError` gains `flagSpellings`; `flagNames` remains an alias, and `code: 'unknown-flag'` and exit code 2 are unchanged.
- The `StripGlobalArgsOptions` export and `global-arg-stripper.ts` are deleted.
- Comic model ID types are registry-validated strings rather than comic-local provider unions.
- Parsed comic runtime options carry the shared hosted concurrency mode and one coordinator for LLM, image, QA, dialogue, and sound-effect work.

## Test Plan

- Baseline verification: `bun run check`.
- Local contract validation suites (no paid or quota-limited provider calls):
  - `bun test test/test-cases/validation/cli/native-cli-parser-contracts.test.ts`
  - `bun test test/test-cases/validation/cli/cli-usage-errors.test.ts`
  - `bun test test/test-cases/validation/cli/option-resolution-contracts/`
  - `bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/selector-validation.test.ts`
  - `bun test test/test-cases/validation/comic/character-handling-contracts.test.ts`
- Verification uses local fixtures and mocked providers without executing live hosted generation commands.

## References

- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) — shared type and ownership boundaries
- Related ADR: [ADR-005](ADR-005-reduce-environment-variable-surface-area.md) — removal of parallel override/client plumbing
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) — shared hosted admission, pressure recovery, and clean-ramp price planning
- Related ADR: [ADR-011](ADR-011-add-refresh-metadata-to-links.md) — links selection modes and refresh artifacts
- `src/cli/native/native-parser.ts`
- `src/cli/native/dispatcher.ts`
- `src/cli/native/help-renderer.ts`
- `src/cli/commands/process-steps/step-8-comic/define-comic-command.ts`
- `src/cli/commands/setup-and-utilities/links/define-links-command.ts`
