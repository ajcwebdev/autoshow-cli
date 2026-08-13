# ADR-007: Integrate Comic with Shared Model and Native CLI Infrastructure

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-17
- **Date Updated:** 2026-08-13
- **Verification Status:** Passed

## Context

Comic historically maintained two parallel infrastructure stacks inside `src/cli/commands/process-steps/step-8-comic/`.

The first was a private model stack: comic-local LLM and image registries, pricing tables, provider clients, type guards, and dispatch branches duplicated the central model registry and the shared write/image target collectors. That stack limited comic to a small subset of providers and required model and price changes to be repeated.

The second was a private command stack. The top-level native parser accepted `comic` as a permissive variadic command, then `define-comic-command.ts` stripped globals, selected a subcommand, reparsed the remaining argv, rendered help itself, and invoked the selected handler. `cli-args.ts` then rechecked unknown flags, excess positionals, and repeated options that the native layer already knows how to govern. The two-stage path preserved a separate public grammar: inline assignments such as `--target=sketches` and the `--` separator were rejected, repeated scalar flags errored instead of using the native last-wins rule, required script paths were temporarily rewritten as optional parameters, and global flags crossed two parser boundaries.

The `links` command had the last other form of the same structural problem. Its provider-scoped positional grammar is legitimate, but it hid every provider selector behind `allowUnknownFlags`, declared a fake `<provider>` help flag, found the `links` token inside raw process argv, and tokenized flags again in `parseLinksArgv`.

The central model migration was accepted and implemented in the original version of this ADR. Part II, Wave 3 of `legacy-report.md` reopened the record because completing comic's native CLI migration is the same architectural decision: comic should adapt its domain semantics to shared infrastructure rather than maintain a parallel shell. This update records the intentionally changed grammar before and alongside its implementation.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Use the central model registry and shared LLM/image collectors** | One source of truth for models, pricing, clients, and dispatch; centrally registered providers reach comic without comic-specific branches | Comic depends on shared generation infrastructure and must adapt its domain options | Removed the comic model directory, three private clients, and three exhaustive dispatch chains |
| Keep comic-local model dispatch but read central prices | Smaller migration | Preserves parallel clients and provider branches; only solves price drift | Rejected half-measure |
| **Represent comic subcommands as one native `CliCommandDefinition` tree and accept native grammar** | One parse and dispatch path; one help renderer; globals applied once; parser owns unknown flags and parameter cardinality | Public grammar deliberately changes for inline assignments, `--`, and repeated scalar flags | Removes the second-stage shell and about one hundred lines of comic revalidation |
| Preserve comic's old grammar inside native subcommands | Minimizes surface change | Requires permanent comic-specific tokenizer checks and repeated-option guards after the dispatcher migration | Rejected because it preserves the split this decision removes |
| Flatten comic into three top-level commands | Avoids nested-dispatch support | Breaks the established `comic <subcommand>` surface and pollutes root help | Rejected |
| Fully flatten links' provider-scoped grammar | Makes links expressible as ordinary independent flags and positionals | Changes the meaning of ordered sections after provider selectors with no agreed replacement syntax | Out of scope; the grammar remains |
| Keep the links bespoke parser | No test churn | Leaves the final raw-argv tokenizer and permissive unknown-flag bypass in production | Rejected |

## Decision

### 1. Shared model infrastructure

Comic resolves LLM and image model IDs against `getModelRegistry()` and routes generation through the shared structured-LLM and image target infrastructure. Comic-local model arrays, pricing, clients, provider type guards, and dispatch branches remain retired. The live `--llm-model` selectors on `draft-scenes` and `reference-sketch`, and the `--image-model` selectors on image-producing commands, validate central registry IDs.

### 2. A first-class native command tree

`CliCommandDefinition` supports one level of `subcommands`. `comicCommand` registers subcommands (`draft-scenes`, `generate-images`, `generate-audio`, `reference-sketch`, and `reference-voice`) directly. The native parser resolves the child once, creates the final child context, and the dispatcher configures global state and invokes exactly that handler. Parent and child help both use `renderCommandHelp`; `help comic <subcommand>` and `comic <subcommand> --help` resolve the same definition.

Subcommand definitions use their real required parameters and native excess-positional rejection. Comic no longer uses `allowUnknownFlags`, `allowExcessParameters`, or `passThroughHelpAfterFirstPositional`; the child definitions no longer opt into excess parameters. The second dispatcher, parse-time required-to-optional mutation, global-argument stripping pass, bespoke help routing, unknown-flag scan, positional cardinality checks, and repeated-scalar checks are removed.

The public grammar intentionally becomes the native grammar:

- Inline long assignments such as `--target=sketches`, `--grid=2x3`, and `--qa=false` are accepted.
- `--` is accepted as the native separator.
- Repeated non-repeatable flags use the last value, matching every other native command.
- Unknown flags and stray positionals use native usage errors.
- Required comic script paths are enforced before handlers run.

This is a deliberate public-surface change, not a behavior-preserving refactor. Semantic validation remains in comic: model IDs, target values, grid combinations, concurrency bounds, reference-sheet modes, and other domain rules are unchanged.

### 3. Links uses the shared parse boundary while retaining its grammar

Every real links provider selector is registered as a hidden Boolean flag; the fake `<provider>` flag and `allowUnknownFlags` are removed. `parseCommandInvocation` is the sanctioned reusable native boundary for tests and other resolved invocations. Production receives the already parsed command context and reduces ordered native flag/positional metadata into provider-scoped sections; it does not locate or tokenize raw process argv again.

Links keeps its existing order-sensitive meaning: positionals after `--openai` belong to OpenAI until another provider selector appears, while leading positionals are global sections. Inline values on provider selectors remain invalid, direct URL and input-file exclusivity remains unchanged, and unknown dashed selectors now fail through the native unknown-flag path.

This applies to comic model dispatch, the native CLI definition/parser/dispatcher/help boundary, comic subcommand parsing and help, and links selection parsing. It does not change comic workflow artifacts, prompts, schemas, generation behavior, links selection semantics, or provider execution.

## Rationale

The repository already had the right reusable boundaries. The model registry and target collectors own provider/model mechanics; `CliCommandDefinition`, `parseCommandArgv`, the dispatcher, and the help renderer own command mechanics. Retaining comic-local or links-local copies made common behavior conditional on which command a user entered.

Native subcommands are intentionally limited to one level because that is the only hierarchy the product exposes. A general recursive command framework would add policy with no consumer. Parsing directly into the final child context also makes the global-state invariant simple: a flag occurrence is tokenized once and global configuration is applied once.

Links cannot be flattened without changing its grammar, but it does not need a tokenizer to preserve that grammar. The native parser can validate and record real selectors and positionals; the links reducer only assigns already parsed positional tokens to the current provider scope.

## Consequences

Positive outcomes:

- Comic uses shared model, client, pricing, structured-output, image-target, command parsing, dispatch, and help infrastructure.
- The parent command definition is the source of truth for comic's subcommand list, so dispatch, help, help-group tests, and flag coloring walk the same tree.
- Global flags on comic commands work through the ordinary dispatcher and the test harness can treat comic as a normal processing command.
- The global argument stripper and its type surface are deleted after their final two production consumers disappear.
- Links exposes only real registered flags while preserving its provider-scoped sections.
- Native unknown-flag diagnostics preserve the user's typed spelling while suppressing inline values and duplicate occurrences.

Negative outcomes:

- Scripts that depended on comic rejecting inline assignments or duplicate scalar flags observe new behavior; duplicate scalar options now honor the last occurrence.
- `CliRawParsed` carries flag occurrence indices so an order-sensitive domain reducer can align flags with positional tokens without reparsing argv.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| One shared model and provider path | Comic depends on central generation infrastructure |
| One command parser, dispatcher, and help renderer | Comic's legacy grammar is intentionally retired |
| One-level command tree matches the real product hierarchy | No arbitrary-depth subcommand framework |
| Registered links selectors and native validation | Hidden provider flag definitions add registry-derived entries to the command definition |
| Ordered parsed metadata replaces raw-argv tokenization | `CliRawParsed` gains occurrence-index metadata |

## API / Type Impact

- `CliCommandDefinition` gains `subcommands?: readonly CliCommandDefinition[]`.
- `CliRawParsed` gains `flagOccurrenceIndices`, parallel to `flagOccurrences`.
- Parsed comic draft/image arguments require `scriptPath` because native parameter validation runs before coercion.
- The retired `StripGlobalArgsOptions` export and `global-arg-stripper.ts` are deleted.
- Comic model ID types remain registry-validated strings rather than comic-local provider unions.

## Implementation Note

The shared model migration and the native CLI migration are implemented. `comicCommand.subcommands` owns the child definitions (`draft-scenes`, `generate-images`, `generate-audio`, `reference-sketch`, and `reference-voice`); the native parser performs one bounded child resolution; `define-comic-command.ts` is now a declaration rather than a second shell; `cli-args.ts` contains semantic coercion only; the reusable invocation boundary and ordered raw metadata support links; provider selectors are real hidden flags; and the obsolete global argument stripper is gone.

The final CLI diagnostic residual was completed on 2026-08-13. `getUnknownFlagSpellings` derives display-safe spellings from unknown `CliFlagOccurrence` records and is used by both `dispatchNativeCli` and `parseCommandInvocation`. `NativeUnknownFlagError.flagSpellings` makes the presentation contract explicit, while `flagNames` remains a compatibility alias.

## Completed Follow-up: Preserve User-Typed Unknown-Flag Spellings

This subordinate mini-ADR records the final implementation residual left by the native CLI migration. Its accepted recommendation was implemented without changing this record's Accepted · Passed status.

| Previous State | Completed Implementation | Outcome |
|---|---|---|
| Unknown-flag rejection formatted normalized internal keys even though raw occurrences retained the user's spelling. | Derive sanitized display spellings from unknown raw occurrences and use one helper at both native rejection boundaries, with focused usage-error contracts. | Diagnostics now show the typed flag spelling, inline values remain private, repeated spellings are deduplicated, and the ADR remains Accepted · Passed. |

### Context and gap analysis

The parser records an unknown long flag twice. `rawParsed.unknown` stores a camelized lookup key such as `allLocal`, while the matching `CliFlagOccurrence` stores `known: false` and the exact raw token such as `--all-local`. Before this follow-up, both the normal dispatcher and `parseCommandInvocation` constructed `NativeUnknownFlagError` from `Object.keys(rawParsed.unknown)`, so the error discarded information the parser already preserved. The result was an internal normalized name in messages such as `Unexpected flag: allLocal`, even though the user typed `--all-local`.

Changing the parser to keep raw tokens as keys in `rawParsed.unknown` would repair the message but would mix presentation with lookup state, alter a reusable parse contract, and make inline values part of an object key. Extending `CliRawParsed` with another array would duplicate `flagOccurrences`, whose `raw` and `known` fields already provide the required source of truth. Reconstructing dashed names from camelCase would still lose short-flag spelling, capitalization, repeated separators, and the exact token the user supplied.

The raw token cannot be echoed blindly. For an unknown inline assignment such as `--api-tokn=secret`, the diagnostic needs `--api-tokn`, not the value after `=`. Unknown occurrences can repeat or normalize to the same camelized key, so the presentation helper preserves first-seen order while deduplicating identical displayed spellings. Known flags, tokens after `--`, and flags accepted by an `allowUnknownFlags` command remain unaffected.

### Decision and implementation

`getUnknownFlagSpellings` derives unknown-flag display spellings from `rawParsed.flagOccurrences.filter(occurrence => !occurrence.known)` at the rejection boundary. Both `dispatchNativeCli` and `parseCommandInvocation` use the helper. For a long inline assignment it returns the portion before the first `=`; for other long and short flags it returns the raw token unchanged; and it deduplicates exact displayed spellings in encounter order. `rawParsed.unknown` remains the normalized lookup record for compatibility, and its keys are used only as a defensive fallback when a synthetic parse result contains no unknown occurrences.

`NativeUnknownFlagError` receives presentation-ready spellings including their leading dashes. Its message remains `Unexpected flag:` or `Unexpected flags:`, so exit code, error code, and outer error handling do not change. The clearer `flagSpellings` property exposes the new input contract, while `flagNames` aliases the same array for compatibility.

### Alternatives considered

| Option | Advantages | Disadvantages | Recommendation |
|---|---|---|---|
| **Derive sanitized spellings from unknown `CliFlagOccurrence` records at rejection time** | Uses source data already retained; preserves long, short, and unusual dashed spellings; avoids a parse-schema change; can suppress inline values | Requires a small shared helper and two rejection-site updates | Recommended |
| Store raw flag strings as keys in `rawParsed.unknown` | Makes the existing `Object.keys` call print closer to input | Changes lookup semantics, risks embedding inline values in keys, and duplicates occurrence data | Reject |
| Add `unknownFlagSpellings` to `CliRawParsed` | Makes display intent explicit | Adds a third representation of the same token and creates synchronization risk | Reject |
| Re-dash camelCase keys when formatting the error | Small localized change | Cannot faithfully reconstruct the typed spelling or short flags and perpetuates presentation from normalized state | Reject |
| Leave normalized names in diagnostics | No implementation work | Exposes parser internals and gives users a flag spelling they cannot paste back into the CLI | Reject |

### Completed implementation

1. Added a pure native-CLI helper that accepts `CliRawParsed`, selects occurrences with `known: false`, removes only a long inline `=<value>` suffix, and returns unique spellings in original order. Normalized unknown keys provide a defensive fallback for synthetic inputs that lack unknown occurrences.
2. Applied the helper in `src/cli/native/dispatcher.ts` and `parseCommandInvocation`, keeping production dispatch and reusable command parsing aligned.
3. Added `NativeUnknownFlagError.flagSpellings`, retained `flagNames` as an alias, and preserved `code: 'unknown-flag'`, exit code 2, and singular/plural grammar.
4. Updated CLI expectations from normalized names to typed spellings, including `--all-local` and `--local-concurrency`, and added focused coverage for long, short, duplicate, mixed-case/repeated-separator, and inline-assignment occurrences.
5. Retained `allowUnknownFlags`, normalized lookup keys, known flags, links selection, and `--` passthrough behavior.

### Acceptance and verification criteria

- `bun autoshow write <input> --structured` reports `Unexpected flag: --structured` and exits 2.
- `--all-local` is displayed exactly as typed rather than as `allLocal`.
- An unknown `--name=value` diagnostic displays `--name` and never echoes `value`.
- Multiple distinct unknown spellings retain encounter order, while identical repeats do not make the message noisy.
- `rawParsed.unknown`, known-flag normalization, inline known flags, short aliases, links selection, and `--` passthrough retain their existing contracts.
- Verification passed with no provider call.

## Test Plan

- `bun run check` — passed on 2026-08-13.
- `bun t --price` — passed all 165 mapped pricing preflights with 0 failures on 2026-08-13.
- `bun test test/test-cases/validation/cli/native-cli-parser-contracts.test.ts` — passed 12 tests, including both rejection boundaries and the synthetic fallback, on 2026-08-13.
- `bun test test/test-cases/validation/cli/cli-usage-errors.test.ts` — passed 71 tests and confirmed production exit-code/message contracts on 2026-08-13.
- `bun test test/test-cases/validation/cli/option-resolution-contracts/` — passed 138 tests, including native comic option parsing, on 2026-08-13.
- `bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/selector-validation.test.ts` — passed 2 links selector tests on 2026-08-13.
- `bun test test/test-cases/validation/comic/character-handling-contracts.test.ts` — passed 21 comic character and reference-sketch contracts on 2026-08-13.
- No paid or quota-limited provider command was run.

## References

- [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) — shared type and ownership boundaries
- [ADR-005](ADR-005-reduce-environment-variable-surface-area.md) — removal of parallel override/client plumbing
- [ADR-013](ADR-013-add-refresh-metadata-to-links.md) — links selection modes and refresh artifacts
- `docs/reports/legacy-report.md` Part II — W3.0, W3.1/SL-5, and W3.2/SL-6
- `src/cli/native/native-parser.ts`, `dispatcher.ts`, and `help-renderer.ts`
- `src/cli/commands/process-steps/step-8-comic/define-comic-command.ts`
- `src/cli/commands/setup-and-utilities/links/define-links-command.ts`
