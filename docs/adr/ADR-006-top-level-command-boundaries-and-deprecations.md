# ADR-006: Command Boundaries and Deprecations

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-17
- **Date Updated:** 2026-11-14
- **Verification Status:** Passed

## Context

Overlapping command responsibilities let saved defaults add unrequested paid work and made parsing, pricing, and recovery inconsistent. Each command needs one explicit job and one canonical name.

## Decision

- `metadata` inspects and expands sources. `download` acquires media and metadata. `extract` performs STT, OCR, and URL extraction, including X Space transcription.
- `write` accepts local `.md` / `.txt` files or directories and performs LLM text generation only. Other inputs fail with guidance to run `extract` first. Extraction and generation defaults never attach work to `write`; its pricing and resume cover LLM work only. `--provider provider[=model]` and compatibility alias `--llm` are mutually exclusive; `--all-providers` expands hosted LLMs. Use `--rendered-text` for readable Markdown consumed downstream.
- `tts`, `image`, `video`, and `music` execute independently with their own selection, pricing, and resume. `setup` and its `config` alias persist defaults for those commands.
- Comic retains `draft-treatment`, `draft-scenes`, `reference-sketch`, `generate-images`, `generate-audio`, `generate-slideshow`, and `review` subcommands. Image, audio, and local slideshow stages remain independently runnable; `generate-audio --slideshow` provides the combined path.
- Every command uses the native parser: inline assignments, `--`, last-wins scalar flags, early rejection of unknown flags or missing arguments, and equivalent `help <command>` / `<command> --help` output. [ADR-011](ADR-011-links-selection-grammar-and-refresh-metadata.md) owns the order-sensitive `links` grammar.
- `voice <action>` is canonical for standalone and comic voice management. `comic review <script>` is canonical for local review. Deprecated `comic reference-voice`, `comic review-sheet`, and `comic review-notes` forward with matching validation/results and deprecation notices; ordinary comic help omits the voice alias.
- `resume` owns pipeline recovery ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)) and recorded comic recovery ([ADR-013](ADR-013-comic-scene-audio-and-presentation.md)). Incompatible write manifests require a new text-only run.

## Trade-offs

Explicit command chaining adds steps for source-to-summary workflows but makes paid work and estimates predictable. Shared parsing removes command-specific grammar, while temporary aliases preserve scripts until a documented transition. Voice import, paid design, and cloning stay separate because their consent and lifecycle requirements differ.

## Verification

```bash
bun test test/test-cases/validation/cli/cli-usage-errors/extract-write-usage.test.ts test/test-cases/validation/cli/cli-usage-errors/comic-usage.test.ts
bun test test/test-cases/validation/cli/option-resolution-contracts/comic-native-parser-contracts.test.ts
bun test test/test-cases/validation/visuals/comic/comic-review-command-contracts.test.ts
```

Local contracts cover command boundaries, native grammar, aliases, and review modes without provider calls.

## Follow-up Actions

- [ ] Publish an identified compatibility release and replacement-command migration notice, then remove deprecated aliases in a separately announced breaking release. The development package version alone does not establish that milestone.

## References

- [Write guide](../commands/03-write/overview.md), [comic overview](../commands/05-visuals/comic/00-comic-overview.md), [voice overview](../commands/04-audio/voice/00-voice-overview.md)
- [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md): voice operations; [ADR-017](ADR-017-comic-script-and-scene-authoring.md): local review
- Registration: `src/cli/commands/visuals/comic/comic-utils/subcommand-help.ts`; voice alias: `src/cli/commands/visuals/comic/comic-commands/reference-voice/reference-voice-command.ts`
