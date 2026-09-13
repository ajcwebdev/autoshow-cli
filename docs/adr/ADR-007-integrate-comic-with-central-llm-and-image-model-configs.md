# ADR-007: Integrate Comic with Shared Model and Native CLI Infrastructure

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-17
- **Date Updated:** 2026-09-10
- **Verification Status:** Passed

## Amendment: Canonical Voice and Review Commands (2026-09-10)

Voice management now uses the canonical `voice` command for both standalone and comic workflows. `comic reference-voice` already forwarded to the same nine voice handlers, so it added a second command vocabulary without a distinct capability. Its group and children remain callable as deprecated aliases for one compatibility release, with direct help and runtime notices. The ordinary comic menu omits the group. Provider selection, consent, character-root resolution, and result behavior remain shared.

The two local review operations now share `comic review <script>`. Its default writes the HTML sheet; `--export-doc` also writes the shared-document export; `--notes <path>` processes notes only, without regenerating the sheet. Missing script operands, blank notes paths, and unknown flags are rejected. Combining `--notes` and `--export-doc` fails before catalog loading or artifact writes. Only notes processing requires the character catalog. Both modes are local and expose no `--price` option. The canonical result identifier is `comic review`, with the existing result payload fields.

The sheet and optional export refresh `metadata/review/review-sheet.html` and `metadata/review/export-doc.md` in place; notes produce `metadata/review/review-notes-<run-id>.md`. Notes preserve authored scripts, scene JSON, structured scripts, unmatched-note reporting, and unresolved script-line reporting. Generated sheets direct reviewers to the canonical notes invocation. The human review round trip still requires two invocations separated by review.

`comic review-sheet` and `comic review-notes` remain deprecated aliases for the same compatibility release, preserving their original flags, validation, and result identifiers. Their direct help documents the replacements, and execution emits deprecation notices through the normal logger. Warning visibility follows the normal quiet and log-level controls for all three deprecated entries. Alias removal requires a later announced breaking CLI release.

This amendment supersedes the command-surface recommendations below that present `comic reference-voice` as a normal entry point. The original decision remains as historical context. Current usage and migration details live in the [comic overview](../commands/05-visuals/comic/00-comic-overview.md), [review guide](../commands/05-visuals/comic/06-review.md), and [voice overview](../commands/04-audio/voice/00-voice-overview.md). Shared provider infrastructure and domain responsibilities are unchanged.

### Consolidation selection and rejected alternatives

The 2026-09-10 consolidation review implemented canonical voice management (proposal 1A), the combined local review command (1B), and recorded comic recovery through the existing `resume` command (the selected extension of 3B). Resume had rejected comic manifests despite retained stage and provider state. The [ADR-002 recovery amendment](ADR-002-pipeline-state-resume-and-dry-run-planning.md#amendment-recorded-comic-recovery-2026-09-10) closes that gap while keeping initial generation, human checkpoints, and explicit rerenders separate. The original universal `comic build` interface, automatic fresh-run planning, and broad media execution abstraction were excluded.

Loading registered definitions without invoking handlers counted 14 top-level commands and 13 global flags at the review date. Canonical immediate comic entries fell from eight to six: `draft-scenes`, `reference-sketch`, `generate-images`, `generate-audio`, `generate-slideshow`, and `review`. Registered immediate entries grew from eight to nine while the three deprecated entries remained. The nine canonical voice actions and nine nested compatibility aliases were unchanged. Recovery added no public command or comic-specific resume flag. These are historical surface counts; the voice handlers were already shared, so the consolidation did not eliminate nine implementations.

The selection favored clear actions, shallow nesting, consistent vocabulary, and stable automation. Rankings were engineering judgments based on registered definitions and implementation; usage frequency, production time savings, and spending reductions were not measured. The following four alternatives were rejected as competing consolidation projects. They are not a parallel roadmap. Flag counts below are command-local keys at the review date, excluding globals and positional operands.

**Proposal 2A: one comic rendering command (rejected)**

- **Option:** Merge image, audio, and slideshow generation behind an `--outputs` selector
- **Pros:** Fewer public rendering command names
- **Cons:** Adds mode validation and a larger help surface; weakens the independent local slideshow boundary owned by [ADR-018](ADR-018-synchronize-comic-panels-with-manifest-backed-audio.md). Images followed by the existing audio `--slideshow` shortcut already covers prepared-scene generation in two invocations.
- **Quantitative Notes:** Image, audio, and slideshow commands had 28, 18, and 4 flags; their union was 47, with only `--price` shared by all three

**Proposal 2B: one voice creation command (rejected)**

- **Option:** Replace import, design, and clone with one mode-selecting command
- **Pros:** Fewer public voice creation command names
- **Cons:** Local registration, paid design preview/save, and authorized sample cloning retain different consent and lifecycle boundaries, as archived in [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md#amendment-one-voice-management-entry-point-2026-09-10)
- **Quantitative Notes:** A mode selector would replace three names without removing the underlying operations

**Proposal 2C: broad selector and execution-control alignment (rejected)**

- **Option:** Normalize selectors and execution-control flags across commands
- **Pros:** Addresses some real vocabulary differences
- **Cons:** Concurrency controls govern different units of work, and public renaming does not fix recovery. Only internal normalization needed by the comic adapter was selected; no repository-wide flag migration was scheduled.
- **Quantitative Notes:** No measured recovery benefit from public renaming

**Proposal 3A: common media-job execution and publication (rejected)**

- **Option:** Add a shared media execution and publication lifecycle
- **Pros:** Potential further implementation reuse
- **Cons:** Comic image targets already reuse standalone targets, and comic audio already uses shared TTS rendering and scheduling. A broader lifecycle risks mixing ordinary generation with comic QA and artifact ownership; the recovery adapter addresses the demonstrated gap.
- **Quantitative Notes:** Further abstraction savings were unmeasured

## Context

Comic did not use the rest of the CLI's shared model catalog or command parser.

It kept its own LLM and image model lists, prices, and providers. Users could only pick a small subset of models, and every catalog or price change had to be duplicated for comic.

`comic` also used a separate public grammar. Inline assignments such as `--target=sketches` and the `--` separator were rejected, repeated scalar flags errored instead of using last-wins, and required script paths were not checked until the command ran.

`links` had a related gap. Its provider-scoped grammar is legitimate, but unknown dashed tokens did not fail as unknown flags the way they do on every other command.

Why now: comic's model catalog and its command grammar were the same architectural choice — comic should use shared CLI infrastructure rather than a private surface — so the deliberately changed public grammar is recorded with the model-registry change.

## Options Considered

**Option 1 (selected)**

- **Option:** Use the central model registry, shared LLM/image generation, and the native nested command tree for comic and `links`
- **Pros:** One catalog for models and prices; every registered provider reaches comic; one parse, help, and dispatch path; globals apply once
- **Cons:** Comic depends on shared generation infrastructure and must adopt native grammar
- **Quantitative Notes:** Six nested `comic` subcommands and `links` share the native parser; comic `--llm-model` and `--image-model` accept the same registry IDs as other commands

**Option 2**

- **Option:** Keep comic's own model list but read central prices
- **Pros:** Smaller migration
- **Cons:** Comic still has a private provider list; only price drift is fixed
- **Quantitative Notes:** Rejected; does not give comic the shared model catalog

**Option 3**

- **Option:** Preserve comic's old grammar inside native subcommands
- **Pros:** Minimizes surface change
- **Cons:** Comic would keep rejecting `--flag=value`, `--`, and last-wins for repeated scalar flags
- **Quantitative Notes:** Rejected; the public grammar change is intentional

**Option 4**

- **Option:** Flatten comic into three top-level commands
- **Pros:** Avoids nested commands
- **Cons:** Breaks the established `comic <subcommand>` surface and clutters root help
- **Quantitative Notes:** Rejected; adds three top-level commands

**Option 5**

- **Option:** Flatten `links` provider-scoped grammar into ordinary independent flags
- **Pros:** Makes `links` look like every other command
- **Cons:** Changes the meaning of ordered sections after provider selectors with no agreed replacement syntax
- **Quantitative Notes:** n/a

**Option 6**

- **Option:** Keep the `links` bespoke parser
- **Pros:** No test churn
- **Cons:** Unknown dashed selectors would still bypass native unknown-flag errors
- **Quantitative Notes:** Rejected; the provider-scoped grammar does not need a private parser

## Decision

Integrate comic with the central model registry, shared hosted admission, and native CLI command hierarchy. Comic uses the same models, prices, and generation paths as the rest of the CLI. Comic subcommands and `links` use the native command parser.

This applies to:

- Comic model resolution, pricing, and hosted LLM/image generation through the central model registry.
- Native nested `comic` subcommands: `draft-scenes`, `reference-sketch`, `generate-images`, `reference-voice`, `generate-audio`, and `generate-slideshow`.
- Native grammar for comic commands: inline assignments such as `--target=sketches`, the `--` separator, last-occurrence scalar flags, unknown-flag diagnostics that show the spelling the user typed, and required script paths checked during parse.
- `links` provider selection through the native parser, without changing its provider-scoped grammar.
- Comic hosted LLM, image, QA, dialogue, and sound-effect work through shared hosted admission.

It does not apply to:

- Comic domain workflow logic, prompt assembly, schemas, panel ordering, QA/repair rules, audio mixing, or presentation rendering.
- Hosted admission policy, ramp/immediate modes, and lane caps, owned by [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md).
- Hosted model registry identity and capability policy, owned by [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md).
- `links` provider-scoped grammar semantics, selection modes, or refresh artifacts, owned by [ADR-011](ADR-011-add-refresh-metadata-to-links.md).
- Voice management verb semantics, which `comic reference-voice` re-exposes through the shared `voice` commands without changing them.

`--llm-model` and `--image-model` validate central registry IDs. `help comic <subcommand>` and `comic <subcommand> --help` resolve the same command. `comic reference-voice` nests one level deeper by re-exposing the shared voice verbs under fully qualified names such as `comic reference-voice import`.

This is a deliberate public-surface change, not a behavior-preserving refactor. Domain validation stays in comic: model IDs, target values, grid combinations, concurrency bounds, reference-sheet modes, and other domain rules are unchanged.

`links` keeps its order-sensitive meaning: positionals after `--openai` belong to OpenAI until another provider selector appears, while leading positionals are global sections. Inline values on provider selectors remain invalid. Unknown dashed selectors fail through the native unknown-flag path.

## Rationale

- The model registry already owns provider and model mechanics, and the native command tree already owns parse, help, and dispatch. Comic-specific or `links`-specific copies made common behavior depend on which command the user entered.
- A nested verb such as `comic reference-voice import` should reach the same parse, help, and dispatch path as a top-level command.
- Global flags on comic should apply once, the same way they do on every other native command.
- `links` cannot be flattened without changing its grammar, but it does not need a private parser to preserve that grammar.

## Consequences

Positive outcomes:

- Comic uses shared models, prices, command parsing, dispatch, help, and hosted admission.
- `comic --help` and `help comic` show the same subcommand tree.
- Global flags on comic commands work like every other native command.
- `links` keeps its provider-scoped sections while unknown selectors fail as unknown flags.
- Unknown-flag diagnostics preserve the user's typed spelling.

Negative outcomes:

- Scripts that depended on comic rejecting inline assignments or duplicate scalar flags observe new behavior; duplicate scalar options now honor the last occurrence.

## Trade-offs

**Trade-off 1**

- **Gain:** One shared model and provider path
- **Sacrifice:** Comic depends on central generation infrastructure

**Trade-off 2**

- **Gain:** One parse, help, and dispatch path for every command
- **Sacrifice:** Comic's prior grammar is intentionally retired

**Trade-off 3**

- **Gain:** One command tree covers every level the product exposes
- **Sacrifice:** `comic reference-voice import` re-exposes shared voice verbs under fully qualified names

**Trade-off 4**

- **Gain:** Registered `links` selectors and native validation
- **Sacrifice:** Provider selectors stay hidden from help so their order-sensitive meaning is not advertised as ordinary independent flags

## Implementation Note

Comic model resolution, native nested `comic` commands, shared hosted admission, and native `links` parsing live in `src/cli/commands/visuals/comic/define-comic-command.ts`, `src/cli/commands/setup-and-utilities/links/define-links-command.ts`, and the native parser, dispatcher, and help renderer under `src/cli/native/`.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/cli/native-cli-parser-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/selector-validation.test.ts
bun test test/test-cases/validation/visuals/comic/comic-character-*-contracts.test.ts
```

1. Typecheck and unique-source check pass against the native comic and `links` command definitions.
2. Native parser contracts cover nested `comic` subcommands, inline assignments, `--`, last-wins scalar flags, and unknown-flag spelling.
3. CLI usage-error and option-resolution contracts cover required script paths, domain option validation, and global flags on comic.
4. Links selector-validation contracts cover provider-scoped sections, invalid inline selector values, and native unknown-flag failures.
5. Comic character-handling contracts cover central-registry model IDs on comic commands.

Verification uses local fixtures and mocked providers without executing live hosted generation commands.

### Consolidation verification recorded on 2026-09-10

The implementation review recorded 299 passing tests across 47 files for the initial voice/review consolidation, including combined review behavior and compatibility aliases. A later CLI pass recorded 280 tests across 45 files covering help, usage errors, option resolution, documentation flags, JSON output, and comic workspace documentation. These overlapping passes are separate evidence snapshots. The [review command contracts](../../test/test-cases/validation/visuals/comic/comic-review-command-contracts.test.ts) retain coverage for both modes, catalog boundaries, unchanged source artifacts, and rejection before writes.

`bun run check` passed, and `bun t --price` passed all 136 mapped pricing commands without provider execution. Recovery-specific evidence and its limits are retained in [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md#comic-recovery-verification-recorded-on-2026-09-10) and [ADR-018](ADR-018-synchronize-comic-panels-with-manifest-backed-audio.md#recovery-verification-recorded-on-2026-09-10). The recorded verification used local files, synthetic media, mocked provider responses, and read-only price preflights; it did not establish live-provider reliability or production performance gains.

## Follow-up Actions

- [ ] Remove `comic reference-voice`, `comic review-sheet`, and `comic review-notes` compatibility aliases — Pending a later announced breaking CLI release after the compatibility release

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — recorded comic recovery and price planning
- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) — shared type and ownership boundaries
- Related ADR: [ADR-005](ADR-005-reduce-environment-variable-surface-area.md) — removal of parallel override/client plumbing
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) — shared hosted admission, pressure recovery, and clean-ramp price planning
- Related ADR: [ADR-011](ADR-011-add-refresh-metadata-to-links.md) — links selection modes and refresh artifacts
- Related ADR: [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md) — canonical voice management and distinct lifecycle actions
- Related ADR: [ADR-018](ADR-018-synchronize-comic-panels-with-manifest-backed-audio.md) — independent local slideshow rendering and recovery
- [comic](../commands/05-visuals/comic/00-comic-overview.md)
- `docs/commands/00-setup-and-utilities/links.md`
- `src/cli/native/native-parser.ts`
- `src/cli/native/dispatcher.ts`
- `src/cli/native/help-renderer.ts`
- `src/cli/commands/visuals/comic/define-comic-command.ts`
- `src/cli/commands/setup-and-utilities/links/define-links-command.ts`
