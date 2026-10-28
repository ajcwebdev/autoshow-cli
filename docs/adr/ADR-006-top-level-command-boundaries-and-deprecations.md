# ADR-006: Top-Level Command Boundaries and Deprecations

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-17
- **Date Updated:** 2026-10-28
- **Verification Status:** Passed
- **Supersession:** Absorbs "End the Write Pipeline at Step 3 (Text Generation)" and the command-boundary and native-grammar decisions of "Integrate Comic with Shared Model and Native CLI Infrastructure". Model policy, hosted admission, `links` grammar, and flag spellings remain with ADR-010, ADR-007, ADR-011, and ADR-018 respectively.

## Context

`write` once combined acquisition, extraction, LLM writing, and media generation. Saved defaults could attach paid work the user had not requested, and pricing and resume did not consistently match execution. Removing generation alone left overlapping extraction flags and provider selection even though `extract` already owned that work.

Comic parsed differently from the rest of the CLI, and `links` accepted unknown dashed tokens. Voice management and local comic review also had duplicate command names under `comic reference-voice`, `comic review-sheet`, and `comic review-notes`.

Why now: the command consolidation needed explicit boundaries that prevent saved defaults from adding unrequested work and give every workflow consistent parsing and a canonical name.

## Options Considered

### Write boundary

**Option 1 (selected)**

- **Option:** Confine `write` to LLM text generation over explicit text input; `extract` comes first for media, documents, URLs, and X Spaces, and generation stays on the standalone commands
- **Pros:** One command per job; `write` help, flags, pricing, resume, and config describe only LLM work
- **Cons:** URL-to-summary and file-to-summary workflows need two commands
- **Quantitative Notes:** `write --price` estimates LLM tokens only

**Option 2**

- **Option:** Keep extract-then-LLM `write` and only reject generation flags
- **Pros:** One command still turns a URL or file into a summary
- **Cons:** Keeps the extract flags, the second provider grammar, and saved-default leakage on `write`
- **Quantitative Notes:** Rejected

**Option 3**

- **Option:** Keep generation flags on `write` and patch config injection and multi-summary gating
- **Pros:** Preserves one-command write plus generation
- **Cons:** Leaves `write` coupled to generation beside the standalone generation commands
- **Quantitative Notes:** Rejected

### Comic command tree and grammar

**Option 1 (selected)**

- **Option:** Put comic and `links` on the native command tree
- **Pros:** Consistent parsing, help, and global flags
- **Cons:** Comic must adopt the native grammar
- **Quantitative Notes:** Seven canonical `comic` subcommands

**Option 2**

- **Option:** Preserve comic's old grammar inside native subcommands
- **Pros:** No surface change
- **Cons:** Comic keeps rejecting `--flag=value`, `--`, and last-wins scalar flags
- **Quantitative Notes:** Rejected; the grammar change is intentional

**Option 3**

- **Option:** Flatten comic into three top-level commands
- **Pros:** No nested commands
- **Cons:** Breaks the `comic <subcommand>` surface and clutters root help
- **Quantitative Notes:** Rejected

**Option 4**

- **Option:** Merge comic image, audio, and slideshow generation behind an output selector
- **Pros:** Fewer rendering command names
- **Cons:** Weakens the independent local slideshow boundary; `generate-audio --slideshow` already supports the common combined workflow
- **Quantitative Notes:** Rejected; retains three independently runnable stages

**Option 5**

- **Option:** Merge voice import, design, and clone behind a mode selector
- **Pros:** Fewer voice creation command names
- **Cons:** Local registration, paid design, and authorized cloning have different consent and lifecycle boundaries
- **Quantitative Notes:** Rejected; a mode selector does not remove the three operations

## Decision

Each top-level command owns one job, every command parses through the native command tree, and one canonical name survives for each job. Retired spellings remain as deprecated forwarding aliases for one compatibility release and are removed in a later announced breaking CLI release.

### `write` is text in, LLM out

`write` is LLM text generation over text input only. It does not inspect, download, transcribe, OCR, or extract URLs, and it does not run, price, select, or flag TTS, image, video, or music. Media, documents, HTML articles, and X Spaces are `extract` inputs. Local `.md` / `.txt` files and directories of those files are `write` inputs; anything else is rejected with a usage error that names `extract` as the prior command.

`--provider` selects the model with repeatable `provider[=model]` values, and `--llm` is a compatibility alias; the two spellings cannot be combined. Boolean `--all-providers` selects every hosted LLM. `--all-local`, `--text-input`, `--stt`, `--ocr`, and the extract flag groups are unknown on `write`. Use `--rendered-text` when a later command needs readable Markdown. The [write guide](../commands/03-write/overview.md) documents output filenames and command chaining.

### `extract` and the standalone generation commands

`extract` owns STT, OCR, and URL text extraction, including transcription of X Space audio. `download` acquires source media and metadata without extraction or writing. `tts`, `image`, `video`, and `music` run independently, each with its own flags, pricing, and resume. `setup` and its `config` alias persist generation defaults (`--tts`, `--image`, `--video`, `--music`) for those commands; those defaults never attach work to `write`.

### Comic subcommand tree and native grammar

Comic is a nested `comic <subcommand>` tree: `draft-treatment`, `draft-scenes`, `reference-sketch`, `generate-images`, `generate-audio`, `generate-slideshow`, and `review`. Comic subcommands accept inline assignments such as `--target=sketches`, the `--` separator, and repeated scalar flags with the last occurrence winning. Unknown flags and missing required script arguments fail during parsing. `help comic <subcommand>` and `comic <subcommand> --help` show the same command. Comic uses the shared model selectors governed by [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) and [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md).

### One voice-management entry point

Voice management uses `voice <action>` for standalone and comic character workflows. `comic reference-voice` and its children, including its default `list` action, remain deprecated forwarding aliases for one compatibility release. Help and runtime notices name the canonical command, and ordinary comic help omits the group. Flags, consent requirements, and results match `voice`. Action semantics are owned by [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md).

### One local review command

Local review uses `comic review <script>`. `comic review-sheet` and `comic review-notes` remain deprecated aliases for the same compatibility release, keeping their original flags, validation, and result identifiers, with help naming the replacement and a deprecation notice at runtime. The review command's modes, artifacts, and validation are owned by [ADR-017](ADR-017-comic-script-and-scene-authoring.md).

### `links` and `resume`

`links` uses the native parser with its order-sensitive provider-scoped grammar on repeatable `--provider <name>`; unknown dashed selectors fail as unknown flags. [ADR-011](ADR-011-links-selection-grammar-and-refresh-metadata.md) owns that grammar. `resume` recovers the six pipeline domains under [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) and recorded comic runs under [ADR-013](ADR-013-comic-scene-audio-and-presentation.md).

This applies to:

- `write` execution, help, flags, `--price` estimates, config defaults, and resume.
- The native `comic` subcommand tree, its grammar, and `help comic <subcommand>` parity.
- The canonical `voice` and `comic review` names, their deprecated aliases, and the compatibility-release lifecycle.

It does not apply to:

- Comic workflow logic, prompt assembly, QA, audio mixing, or presentation rendering ([ADR-017](ADR-017-comic-script-and-scene-authoring.md) and [ADR-013](ADR-013-comic-scene-audio-and-presentation.md)).
- Hosted admission policy and lane caps ([ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md)).
- Hosted model registry identity and capability policy ([ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)).
- `links` grammar semantics, selection modes, and refresh artifacts ([ADR-011](ADR-011-links-selection-grammar-and-refresh-metadata.md)).
- Voice-management verb semantics ([ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md)).
- The six resume domains, which stay independent ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).
- Extract execution, artifacts, and provider selection ([ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md) and [ADR-009](ADR-009-stt-timing-captions-and-alignment.md)).
- The standalone generation commands' own flags, pricing, and resume, and the lyric-draft files that remain write inputs.

## Rationale

- Saved generation or extract defaults must not bill the user or attach work to a command that should only call an LLM.
- `extract` already owns STT, OCR, and URL acquisition, and operators already chain `write` with the generation commands, so `extract` then `write` is the same convention.
- The shared command tree already owns parse, help, and dispatch; a comic-specific or `links`-specific copy made that behavior depend on which command the user entered.
- `links` cannot be flattened without changing its grammar, and it does not need a private parser to keep that grammar.
- One canonical name per job keeps help and documentation from teaching two vocabularies, and a compatibility release lets scripts move without breaking on the same day.

## Consequences

Positive outcomes:

- Saved generation and extract defaults cannot trigger paid work or attach extract work during `write`.
- Comic and `links` share the CLI's parsing, help, unknown-flag diagnostics, and global flags.
- `voice` and `comic review` are each one documented name; the retired spellings forward with a notice.

Negative outcomes:

- A URL or media file needs `extract`, then `write`, and scripts that passed those inputs to `write` fail until they insert `extract`.
- Scripts that depended on comic rejecting inline assignments or duplicate scalar flags see new behavior; duplicate scalar options honor the last occurrence.
- Deprecated aliases stay callable for one compatibility release, so help and runtime notices describe them until the announced breaking release.

## Trade-offs

**Trade-off 1**

- **Gain:** No config-default auto-spend, and `write --price` matches write execution
- **Sacrifice:** Single-command write-plus-generation and single-command URL-to-summary are gone, and a combined estimate needs `--price` on each command

**Trade-off 2**

- **Gain:** One parse, help, and dispatch path for every command
- **Sacrifice:** Comic's prior grammar is intentionally retired, and comic depends on central generation infrastructure

**Trade-off 3**

- **Gain:** One canonical name for voice management and local review
- **Sacrifice:** Deprecated aliases must be maintained and announced through one compatibility release

**Trade-off 4**

- **Gain:** `links` gets the same unknown-flag validation as every other command
- **Sacrifice:** `--provider` stays order-sensitive with the sections that follow it, and `provider=section` values are rejected

## Implementation Note

Text-only `write`, the native comic subcommand tree, and the compatibility aliases have shipped in `src/cli/commands/text/write/define-write-command.ts` and `src/cli/commands/visuals/comic/comic-utils/subcommand-help.ts`. Older write manifests containing extraction state are rejected; start a new text-only write from the extracted text ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/cli/cli-usage-errors/extract-write-usage.test.ts test/test-cases/validation/cli/cli-usage-errors/comic-usage.test.ts
bun test test/test-cases/validation/cli/option-resolution-contracts/comic-native-parser-contracts.test.ts
bun test test/test-cases/validation/visuals/comic/comic-review-command-contracts.test.ts
```

1. Repository checks and price preflight validate documentation examples and estimate the mapped commands without provider execution.
2. Usage contracts reject misplaced extract flags and malformed comic arguments and retain the deprecated aliases.
3. Comic parser contracts cover inline assignments, `--`, and last-wins scalar flags.
4. Review contracts cover the local review sheet and notes modes without provider calls.

Verification uses local fixtures and mocked providers.

## Follow-up Actions

- [ ] Remove compatibility aliases — Pending
  Remove `comic reference-voice`, `comic review-sheet`, and `comic review-notes` in a later announced breaking CLI release after the compatibility release.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — resume domains and price planning
- Related ADR: [ADR-005](ADR-005-cli-error-result-and-retry-contract.md) — usage errors and result identifiers
- Related ADR: [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md) — shared hosted admission for comic work
- Related ADR: [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md) — OCR execution behind `extract`
- Related ADR: [ADR-009](ADR-009-stt-timing-captions-and-alignment.md) — STT execution behind `extract`
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — central registry IDs on comic selectors
- Related ADR: [ADR-011](ADR-011-links-selection-grammar-and-refresh-metadata.md) — `links` grammar and refresh artifacts
- Related ADR: [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md) — `voice` action semantics and distinct lifecycle actions
- Related ADR: [ADR-013](ADR-013-comic-scene-audio-and-presentation.md) — recorded comic recovery and the local slideshow boundary
- Related ADR: [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md) — documented command examples as contracts
- Related ADR: [ADR-017](ADR-017-comic-script-and-scene-authoring.md) — `comic review` mechanics and authoring stages
- Related ADR: [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md) — comic `--provider` and `--<role>-provider` spellings
- [write guide](../commands/03-write/overview.md)
- [comic overview](../commands/05-visuals/comic/00-comic-overview.md)
- [comic review](../commands/05-visuals/comic/06-review.md)
- [voice overview](../commands/04-audio/voice/00-voice-overview.md)
- [links](../commands/00-setup-and-utilities/links.md)
