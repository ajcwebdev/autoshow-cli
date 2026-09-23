# ADR-006: Top-Level Command Boundaries and Deprecations

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-17
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed
- **Supersession:** Absorbs "End the Write Pipeline at Step 3 (Text Generation)" in full, and the command-tree, native-grammar, canonical-command, and rejected-alternative decisions of "Integrate Comic with Shared Model and Native CLI Infrastructure". That record's resolution of comic models through the central registries now lives in [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), its hosted-admission note in [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md), its `links` grammar in [ADR-011](ADR-011-links-selection-grammar-and-refresh-metadata.md), and its flag spellings in [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md). This record answers one question: which top-level command owns which job, and which spellings are deprecated.

## Context

`write` once ran the whole content pipeline, from download and extraction through LLM writing to TTS, image, video, and music generation. Saved generation defaults billed users for generation on writes that never asked for it. Multi-summary writes skipped generation silently. `write --price` counted generation stages that document routes never ran. Resumed write runs dropped previously billed generation costs. After generation was removed, `write` still carried the extract flags and a second provider grammar, and saved extract defaults could still attach work the user never requested, even though `extract` already owned STT, OCR, and URL acquisition and operators already chained `write` with the standalone generation commands.

Comic parsed differently from the rest of the CLI: it rejected inline assignments and the `--` separator, errored on repeated scalar flags instead of taking the last value, and checked required script paths only at run time. `links` accepted unknown dashed tokens that every other command rejects. The 2026-09-10 consolidation review then found a second voice-management vocabulary under `comic reference-voice` and a two-command review round trip under `comic review-sheet` and `comic review-notes`.

Why now: extract-inside-write was the largest remaining dual surface from the old combined pipeline, comic was the last command that parsed differently from the rest of the CLI, and the 2026-09-10 review settled which names survive, so one record now states which top-level command owns which job.

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

- **Option:** Put comic and `links` on the native nested command tree and the central model registry
- **Pros:** One parse, help, and dispatch path; one model catalog; global flags apply once
- **Cons:** Comic must adopt the native grammar
- **Quantitative Notes:** Seven canonical `comic` subcommands

**Option 2**

- **Option:** Keep comic's own model list but read central prices
- **Pros:** Smaller migration
- **Cons:** Comic keeps a private provider list
- **Quantitative Notes:** Rejected

**Option 3**

- **Option:** Preserve comic's old grammar inside native subcommands
- **Pros:** No surface change
- **Cons:** Comic keeps rejecting `--flag=value`, `--`, and last-wins scalar flags
- **Quantitative Notes:** Rejected; the grammar change is intentional

**Option 4**

- **Option:** Flatten comic into three top-level commands
- **Pros:** No nested commands
- **Cons:** Breaks the `comic <subcommand>` surface and clutters root help
- **Quantitative Notes:** Rejected

## Decision

Each top-level command owns one job, every command parses through the native command tree, and one canonical name survives for each job. Retired spellings remain as deprecated forwarding aliases for one compatibility release and are removed in a later announced breaking CLI release.

### `write` is text in, LLM out

`write` is LLM text generation over text input only. It does not inspect, download, transcribe, OCR, or extract URLs, and it does not run, price, select, or flag TTS, image, video, or music. Media, documents, HTML articles, and X Spaces are `extract` inputs. Local `.md` / `.txt` files and directories of those files are `write` inputs; anything else is rejected with a usage error that names `extract` as the prior command.

Chain commands:

```bash
bun autoshow extract video.mp4 --provider deepgram
bun autoshow write output/<extract-run>/transcription.txt --provider openai --prompt shortSummary --rendered-text
bun autoshow tts output/<write-run>/text.md --provider elevenlabs
bun autoshow music output/<write-run>/text.md --provider elevenlabs
bun autoshow image "$(cat output/<write-run>/text.md)" --provider openai
bun autoshow video "$(cat output/<write-run>/text.md)" --provider grok
```

`--provider` selects the model with repeatable `provider[=model]` values, and `--llm` is a compatibility alias. Boolean `--all-providers` selects every hosted LLM. `--all-local`, `--text-input`, `--stt`, `--ocr`, and the extract flag groups are unknown on `write`. One target writes `text.json` and `show-note.md`. Multiple targets write `text-<model>.json` and `show-note-<model>.md` per model, with the provider added to the filename when two providers share a model id. `--rendered-text` also writes `text.md`, or one `text-<model>.md` per model.

### `extract` and the standalone generation commands

`extract` is the only command that runs STT, OCR, URL, and X Space acquisition. `tts`, `image`, `video`, and `music` are standalone follow-on commands that consume write artifacts, each with its own flags, pricing, and resume. `setup` and its `config` alias still persist generation defaults (`--tts`, `--image`, `--video`, `--music`) for those commands, and those defaults never attach work to `write`.

### Comic subcommand tree and native grammar

Comic is a nested `comic <subcommand>` tree: `draft-treatment`, `draft-scenes`, `reference-sketch`, `generate-images`, `generate-audio`, `generate-slideshow`, and `review`. Comic subcommands use the same parser as every other command: inline assignments such as `--target=sketches`, the `--` separator, last-occurrence scalar flags, unknown-flag diagnostics that show the spelling the user typed, required script paths checked during parse, and global flags applied once. `help comic <subcommand>` and `comic <subcommand> --help` show the same command. Comic domain validation is unchanged. Comic selects its primary model with `--provider provider[=model]` and each auxiliary role with `--<role>-provider`, validated against the central registry IDs that [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) governs with the spellings [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md) records.

### One voice-management entry point

Voice management uses `voice <action>` for standalone and comic character workflows. `comic reference-voice` and its children, including its default `list` action, remain deprecated forwarding aliases for one compatibility release, with help and runtime notices that name the canonical command. The ordinary comic menu omits the group. Flags, provider capabilities, consent, character-root resolution, and results stay the same as `voice`. Notices follow the normal quiet and log-level controls. Action semantics and the rule that import, design, clone, approval, audition, retirement, and deletion stay distinct are owned by [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md).

### One local review command

Local review uses `comic review <script>`. `comic review-sheet` and `comic review-notes` remain deprecated aliases for the same compatibility release, keeping their original flags, validation, and result identifiers, with help naming the replacement and a deprecation notice at runtime. The review command's modes, artifacts, and validation are owned by [ADR-017](ADR-017-comic-script-and-scene-authoring.md).

### `links` and `resume`

`links` uses the native parser with its order-sensitive provider-scoped grammar on repeatable `--provider <name>`; unknown dashed selectors fail as unknown flags. [ADR-011](ADR-011-links-selection-grammar-and-refresh-metadata.md) owns that grammar. `resume` recovers the six pipeline domains under [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) and recorded comic runs under [ADR-013](ADR-013-comic-scene-audio-and-presentation.md).

### Deprecation lifecycle

Removing `comic reference-voice`, `comic review-sheet`, and `comic review-notes` takes a later announced breaking CLI release after the compatibility release. No other deprecated spelling is retained.

This applies to:

- `write` execution, help, flags, `--price` estimates, config defaults, and resume.
- The native `comic` subcommand tree, its grammar, and `help comic <subcommand>` parity.
- The canonical `voice` and `comic review` names, their deprecated aliases, and the compatibility-release lifecycle.
- The rejected 2026-09-10 consolidation alternatives recorded below.

It does not apply to:

- Comic workflow logic, prompt assembly, QA, audio mixing, or presentation rendering ([ADR-017](ADR-017-comic-script-and-scene-authoring.md) and [ADR-013](ADR-013-comic-scene-audio-and-presentation.md)).
- Hosted admission policy and lane caps ([ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md)).
- Hosted model registry identity and capability policy ([ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)).
- `links` grammar semantics, selection modes, and refresh artifacts ([ADR-011](ADR-011-links-selection-grammar-and-refresh-metadata.md)).
- Voice-management verb semantics ([ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md)).
- The six resume domains, which stay independent ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).
- Extract execution, artifacts, and provider selection ([ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md) and [ADR-009](ADR-009-stt-timing-captions-and-alignment.md)).
- The standalone generation commands' own flags, pricing, and resume, and the lyric-draft files that remain write inputs.

### Rejected 2026-09-10 consolidation alternatives

The 2026-09-10 review adopted canonical `voice` management, the combined `comic review` command, and recorded comic recovery through `resume` ([ADR-013](ADR-013-comic-scene-audio-and-presentation.md#recorded-comic-recovery-through-resume)). A universal `comic build` command, automatic fresh-run planning, and a shared media-execution lifecycle were not adopted. The four alternatives below are not a later roadmap.

**Proposal 2A: one comic rendering command (rejected)**

- **Option:** Merge image, audio, and slideshow generation behind an `--outputs` selector
- **Pros:** Fewer rendering command names
- **Cons:** Weakens the independent local slideshow boundary owned by [ADR-013](ADR-013-comic-scene-audio-and-presentation.md); images plus the audio `--slideshow` shortcut already cover prepared-scene generation in two invocations
- **Quantitative Notes:** The three commands share only `--price`

**Proposal 2B: one voice creation command (rejected)**

- **Option:** Replace import, design, and clone with one mode-selecting command
- **Pros:** Fewer voice creation command names
- **Cons:** Local registration, paid design, and authorized cloning keep different consent and lifecycle boundaries ([ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md))
- **Quantitative Notes:** A mode selector replaces three names without removing the operations

**Proposal 2C: broad selector and execution-control alignment (rejected)**

- **Option:** Normalize selectors and execution-control flags across commands
- **Pros:** Addresses some vocabulary differences
- **Cons:** Concurrency controls govern different units of work, and renaming public flags does not fix recovery
- **Quantitative Notes:** No measured recovery benefit

**Proposal 3A: common media-job execution and publication (rejected)**

- **Option:** Add a shared media execution and publication lifecycle
- **Pros:** Potential reuse across media commands
- **Cons:** Mixes ordinary generation with comic QA and artifact ownership; the demonstrated gap was recovery, which [ADR-013](ADR-013-comic-scene-audio-and-presentation.md#recorded-comic-recovery-through-resume) covers
- **Quantitative Notes:** Abstraction savings unmeasured

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

Text-only `write`, the native comic subcommand tree, and the deprecated `comic reference-voice`, `comic review-sheet`, and `comic review-notes` aliases have shipped. User-facing behavior is documented in the [write guide](../commands/03-write/overview.md), [comic overview](../commands/05-visuals/comic/00-comic-overview.md), [comic review guide](../commands/05-visuals/comic/06-review.md), [voice overview](../commands/04-audio/voice/00-voice-overview.md), and [links guide](../commands/00-setup-and-utilities/links.md).

## API / Type Impact

`write` accepts `.md` and `.txt` input only. `--stt`, `--ocr`, `--all-providers stt|ocr|url`, `--all-local stt|ocr|url`, `--text-input`, and the extract flag groups are unknown on `write`; boolean `--all-providers` selects every hosted LLM. Older write output directories that recorded extract provider state are not migrated; rerun `extract`, then `write` ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).

Comic subcommands accept `--flag=value`, the `--` separator, and repeated scalar flags with last-occurrence wins, and required script paths fail at parse time. The three deprecated aliases accept their original flags, print a deprecation notice, and return their original result identifiers until the announced breaking release.

## Keep (with rationale)

- Standalone `extract`, `tts`, `image`, `video`, and `music` with their `--provider` selectors, because each is one job.
- `--provider` as the write selector with `--llm` as a compatibility alias, because write has one step.
- `--rendered-text`, `--prompt`, `--prompt-file`, `--track-list`, and lyric-draft directory inputs, because they belong to write.

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/cli/
bun test test/test-cases/validation/visuals/comic/comic-review-command-contracts.test.ts
```

1. `write --price` estimates LLM tokens only and rejects media, URL, and document inputs, while mapped price commands stay no-cost.
2. Help and usage contracts show `write` advertising LLM, prompt, batch, and pricing flags and rejecting extract and generation flags.
3. Parser contracts cover inline assignments, `--`, last-wins scalar flags, unknown-flag spelling, and parse-time script paths on comic subcommands.
4. Review command contracts cover `comic review` and the deprecated aliases keeping their result identifiers.

Verification uses local fixtures and mocked providers.

## Follow-up Actions

- [ ] Remove `comic reference-voice`, `comic review-sheet`, and `comic review-notes` compatibility aliases — Pending a later announced breaking CLI release after the compatibility release

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
