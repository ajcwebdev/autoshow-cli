# ADR-007: Integrate Comic with Shared Model and Native CLI Infrastructure

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-17
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed
- **Supersession:** The comic model-selection flag spellings `--image-model`, `--llm-model`, and `--qa-model` are superseded by [ADR-024](ADR-024-derive-cli-help-from-registries-and-generalize-provider-flags.md), which moves comic onto `--provider provider[=model]` plus per-role `--<role>-provider`. Resolving every comic model through the central LLM and image registries, which is this record's decision, remains accepted and unchanged.

## Amendment: Canonical Voice and Review Commands (2026-09-10)

Voice management uses the `voice` command for both standalone and comic workflows. `comic reference-voice` added a second command vocabulary without a distinct capability. Its group and children remain callable as deprecated aliases for one compatibility release, with direct help and runtime notices. The ordinary comic menu omits the group. Provider selection, consent, character-root resolution, and results stay the same as `voice`.

Local review uses `comic review <script>`. The default writes the HTML sheet. `--export-doc` also writes the shared-document export. `--notes <path>` processes notes only and does not regenerate the sheet. A missing script, a blank notes path, or an unknown flag is rejected. Combining `--notes` and `--export-doc` fails before any artifact is written. Only notes processing requires the character catalog. Both modes are local and have no `--price` option. The result identifier is `comic review`.

The sheet and optional export refresh `metadata/review/review-sheet.html` and `metadata/review/export-doc.md` in place. Notes write `metadata/review/review-notes-<run-id>.md`, leave the authored script, scene JSON, and structured script unchanged, and report unmatched notes and unresolved script lines. Generated sheets tell reviewers to run `comic review <script> --notes <path>`. The review round trip is still two invocations, with human review between them.

`comic review-sheet` and `comic review-notes` remain deprecated aliases for the same compatibility release. They keep their original flags, validation, and result identifiers. Their help text names the replacement, and running them prints a deprecation notice. Warning visibility follows the normal quiet and log-level controls. Removing the aliases takes a later announced breaking CLI release.

Current usage is in the [comic overview](../commands/05-visuals/comic/00-comic-overview.md), [review guide](../commands/05-visuals/comic/06-review.md), and [voice overview](../commands/04-audio/voice/00-voice-overview.md).

### Consolidation selection and rejected alternatives

The 2026-09-10 review adopted canonical `voice` management, the combined `comic review` command, and recorded comic recovery through the existing `resume` command. [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md#amendment-recorded-comic-recovery-2026-09-10) records that recovery. A universal `comic build` command, automatic fresh-run planning, and a shared media-execution lifecycle were not adopted. The four alternatives below were rejected. They are not a later roadmap.

**Proposal 2A: one comic rendering command (rejected)**

- **Option:** Merge image, audio, and slideshow generation behind an `--outputs` selector
- **Pros:** Fewer public rendering command names
- **Cons:** Adds mode validation and a larger help surface, and it weakens the independent local slideshow boundary owned by [ADR-018](ADR-018-synchronize-comic-panels-with-manifest-backed-audio.md). Images followed by the existing audio `--slideshow` shortcut already covers prepared-scene generation in two invocations.
- **Quantitative Notes:** Rejected; the three commands share only `--price`

**Proposal 2B: one voice creation command (rejected)**

- **Option:** Replace import, design, and clone with one mode-selecting command
- **Pros:** Fewer public voice creation command names
- **Cons:** Local registration, paid design preview and save, and authorized sample cloning keep different consent and lifecycle boundaries, as archived in [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md#amendment-one-voice-management-entry-point-2026-09-10)
- **Quantitative Notes:** Rejected; a mode selector would replace three names without removing the operations

**Proposal 2C: broad selector and execution-control alignment (rejected)**

- **Option:** Normalize selectors and execution-control flags across commands
- **Pros:** Addresses some real vocabulary differences
- **Cons:** Concurrency controls govern different units of work, and renaming public flags does not fix recovery. No repository-wide flag migration was adopted.
- **Quantitative Notes:** Rejected; no measured recovery benefit from public renaming

**Proposal 3A: common media-job execution and publication (rejected)**

- **Option:** Add a shared media execution and publication lifecycle
- **Pros:** Potential further reuse across media commands
- **Cons:** A broader lifecycle would mix ordinary generation with comic QA and artifact ownership. The demonstrated gap was recovery, which [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md#amendment-recorded-comic-recovery-2026-09-10) covers.
- **Quantitative Notes:** Rejected; further abstraction savings were unmeasured

## Context

Comic did not use the rest of the CLI's shared model catalog or command parser.

It kept its own LLM and image model lists, prices, and providers. Users could only pick a small subset of models, and every catalog or price change had to be duplicated for comic.

`comic` also used a separate public grammar. Inline assignments such as `--target=sketches` and the `--` separator were rejected, repeated scalar flags errored instead of using last-wins, and required script paths were not checked until the command ran.

`links` had a related gap. Its provider-scoped grammar is legitimate, but unknown dashed tokens did not fail as unknown flags the way they do on every other command.

Why now: comic's model catalog and its command grammar were the same architectural choice — comic should use shared CLI infrastructure rather than a private surface — so the deliberately changed public grammar is recorded with the model-registry change.

## Options Considered

**Option 1 (selected)**

- **Option:** Use the central model registry, shared LLM and image generation, and the native nested command tree for comic and `links`
- **Pros:** One catalog for models and prices; comic selections come from that catalog; one parse, help, and dispatch path; globals apply once
- **Cons:** Comic depends on shared generation infrastructure and must adopt native grammar
- **Quantitative Notes:** Canonical nested `comic` subcommands and `links` share the native parser; comic `--provider` and `--<role>-provider` accept registry `provider[=model]` selections

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

Integrate comic with the central model registry and the native command hierarchy. Comic resolves LLM and image models, prices, and hosted generation through the central registries. Image selections omit fal, text selections match `write`, and QA selections are the vision-capable OpenAI and Gemini models. Comic subcommands and `links` use the same command parser as the rest of the CLI.

This applies to:

- Comic model resolution, pricing, and hosted LLM and image generation through the central model registry.
- Native nested `comic` subcommands: `draft-treatment`, `draft-scenes`, `generate-images`, `generate-audio`, `generate-slideshow`, `reference-sketch`, and `review`. `reference-voice`, `review-sheet`, and `review-notes` remain deprecated forwarding aliases for one compatibility release (see the amendment above).
- Native grammar for comic commands: inline assignments such as `--target=sketches`, the `--` separator, last-occurrence scalar flags, unknown-flag diagnostics that show the spelling the user typed, and required script paths checked during parse.
- `links` provider selection through the same parser. Section scoping stays order-sensitive on repeatable `--provider <name>`.
- Comic hosted LLM, image, QA, dialogue, and sound-effect work, which uses the same hosted admission rules as the rest of the CLI.

It does not apply to:

- Comic domain workflow logic, prompt assembly, schemas, panel ordering, QA and repair rules, audio mixing, or presentation rendering.
- Hosted admission policy, ramp and immediate modes, and lane caps, owned by [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md).
- Hosted model registry identity and capability policy, owned by [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md).
- `links` provider-scoped grammar semantics, selection modes, or refresh artifacts, owned by [ADR-011](ADR-011-add-refresh-metadata-to-links.md).
- Voice-management verb semantics, owned by `voice`. The deprecated `comic reference-voice` alias does not change them.

`--provider` and role-scoped `--<role>-provider` validate central registry IDs. [ADR-024](ADR-024-derive-cli-help-from-registries-and-generalize-provider-flags.md) retired `--llm-model`, `--image-model`, and `--qa-model`. `help comic <subcommand>` and `comic <subcommand> --help` show the same command. During the compatibility window, `comic reference-voice` still accepts the shared voice verbs under names such as `comic reference-voice import`.

This is a deliberate public-surface change. Comic domain rules are unchanged: model IDs, target values, grid combinations, concurrency bounds, and reference-sheet modes validate as they did before.

`links` keeps its order-sensitive meaning. Positionals after `--provider <name>` belong to that provider until the next `--provider`, and leading positionals are global sections. Inline values such as `--provider openai=models` stay invalid. Unknown dashed selectors, including retired per-provider flags such as `--openai`, fail as unknown flags. `--provider` is a documented repeatable flag, and `links --help-topic providers` lists the provider names and this scoping.

## Rationale

- The model registry already owns provider and model mechanics, and the shared command tree already owns parse, help, and dispatch. Comic-specific or `links`-specific copies made that behavior depend on which command the user entered.
- A nested comic command should parse, show help, and accept global flags the same way every other command does.
- Global flags on comic should apply once, the same way they do on every other command.
- `links` cannot be flattened without changing its grammar, and it does not need a private parser to keep that grammar.

## Consequences

Positive outcomes:

- Comic uses the shared model catalog, prices, command parsing, help, and hosted admission.
- `comic --help` and `help comic` show the same subcommand tree.
- Global flags on comic commands work like every other command.
- `links` keeps its provider-scoped sections, and unknown selectors fail as unknown flags.
- Unknown-flag diagnostics preserve the user's typed spelling.

Negative outcomes:

- Scripts that depended on comic rejecting inline assignments or duplicate scalar flags see new behavior. Duplicate scalar options now honor the last occurrence.

## Trade-offs

**Trade-off 1**

- **Gain:** One shared model and provider path
- **Sacrifice:** Comic depends on central generation infrastructure

**Trade-off 2**

- **Gain:** One parse, help, and dispatch path for every command
- **Sacrifice:** Comic's prior grammar is intentionally retired

**Trade-off 3**

- **Gain:** One command tree covers every level the product exposes
- **Sacrifice:** During the compatibility window, `comic reference-voice import` still exposes shared voice verbs under fully qualified names

**Trade-off 4**

- **Gain:** Registered `links` provider names and the same unknown-flag validation as every other command
- **Sacrifice:** `--provider` stays order-sensitive with the sections that follow it, and `provider=section` values are rejected

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/cli/native-cli-parser-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/selector-validation.test.ts
bun test test/test-cases/validation/visuals/comic/comic-character-*-contracts.test.ts
bun test test/test-cases/validation/visuals/comic/comic-review-command-contracts.test.ts
```

1. The repository check passes for the comic and `links` command definitions.
2. Parser contracts cover inline assignments, `--`, last-wins scalar flags, and unknown-flag spelling, including comic subcommands.
3. Usage-error and option-resolution contracts cover required script paths, domain option validation, global flags on comic, and central-registry model IDs on `--provider` and `--<role>-provider`.
4. Links selector contracts cover invalid inline `--provider` values and unknown-flag failures, including the retired `--openai` selector.
5. Comic character contracts cover catalog schema, sheet generation, revision, scene validation, and reference snapshots.
6. Review command contracts cover both review modes, the catalog boundary, unchanged source artifacts, and rejection before writes.

Verification uses local fixtures and mocked providers. It does not run live hosted generation.

## Follow-up Actions

- [ ] Remove `comic reference-voice`, `comic review-sheet`, and `comic review-notes` compatibility aliases — Pending a later announced breaking CLI release after the compatibility release

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — recorded comic recovery and price planning
- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) — shared type and ownership boundaries
- Related ADR: [ADR-005](ADR-005-reduce-environment-variable-surface-area.md) — removal of parallel override and client plumbing
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) — shared hosted admission and clean-ramp price planning
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — hosted model identity and capability policy
- Related ADR: [ADR-011](ADR-011-add-refresh-metadata-to-links.md) — links selection modes and refresh artifacts
- Related ADR: [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md) — canonical voice management and distinct lifecycle actions
- Related ADR: [ADR-018](ADR-018-synchronize-comic-panels-with-manifest-backed-audio.md) — independent local slideshow rendering and recovery
- Related ADR: [ADR-024](ADR-024-derive-cli-help-from-registries-and-generalize-provider-flags.md) — comic `--provider` and `--<role>-provider` spellings
- [comic overview](../commands/05-visuals/comic/00-comic-overview.md)
- [comic review](../commands/05-visuals/comic/06-review.md)
- [voice overview](../commands/04-audio/voice/00-voice-overview.md)
- [links](../commands/00-setup-and-utilities/links.md)
