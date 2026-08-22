# ADR-020: End the Write Pipeline at Step 3 (Text Generation)

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-17
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed

## Context

The `write` command historically orchestrated steps 0 through 7: metadata inspection, download/staging, STT/OCR/URL extraction, LLM text writing, TTS audio synthesis (step 4), image generation (step 5), video generation (step 6), and music generation (step 7). To support this, `write` exposed an extensive flag surface comprising over 130 options across multiple generation provider groups (Text to Speech, MiniMax/Speechify/Hume/ElevenLabs TTS, Multi-Speaker / Dialogue, Image Options, Video Options, Hosted Music) plus step selectors (`--tts`, `--image`, `--video`, `--music`) and the `tts|image|video|music` arguments for `--all-providers`.

This coupling introduced significant architectural and operational issues:

1. **Config Default Auto-Spend Footgun:** Saved configuration defaults (e.g. `config --tts elevenlabs`) persisted into `defaults.post.tts.elevenlabsTts`. Because `mergeConfigIntoRawFlags` injected these defaults into every `write` invocation unless explicitly overridden, users who configured TTS or image defaults for standalone commands inadvertently triggered and paid for generation on every subsequent `write` run.
2. **Single-Summary Execution Gating:** Step 4–7 generation stages silently skipped whenever `write` produced multiple LLM outputs (e.g. via repeatable `--llm`) or when structured validation produced multiple variants, making multi-stage generation inherently fragile and restricted to single-summary runs.
3. **Pricing Over-Estimation:** `write --price` estimated generation stages across document inputs (PDF, EPUB, articles) even though document write flows never executed generation stages.
4. **Resume Divergence:** `write-resume` rebuilt cost and timing from steps 1–3 only and omitted step 4–7 metadata, silently dropping generation cost rows and asset sections when resuming previous write runs.

## Options Considered

**Option 1 (selected)**

- **Option:** Decouple generation from `write` completely; end `write` at step 3 (text generation) and require follow-on execution via standalone commands (`tts`, `image`, `video`, `music`).
- **Pros:** Eliminates config-default auto-spend risk; removes over 130 generation flags and selectors from `write` help; eliminates single-summary execution gates; simplifies `ProcessingOptions` and write runtime types; aligns `--price` on `write` with actual execution.
- **Cons:** Workflows that previously ran write + TTS in a single command invocation now require two discrete CLI commands.
- **Quantitative Notes:** Removed 132 flag occurrences from write resolution tests; narrowed `WriteRuntimeOptions` and `ProcessingOptions` by dropping 5 generation type intersections.

**Option 2**

- **Option:** Keep generation flags on `write` but fix config injection and multi-summary gating.
- **Pros:** Preserves single-command write + generation invocations.
- **Cons:** Retains massive CLI flag surface; maintains redundant stage orchestration code; perpetuates complex option bag coupling.
- **Quantitative Notes:** Rejected.

## Decision

The `write` command is bounded strictly to steps 0–3: metadata inspection, source download/staging, STT/OCR/URL extraction, and LLM text writing. All step 4 (TTS), step 5 (image), step 6 (video), and step 7 (music) execution, pricing, flags, selectors, and type interfaces are severed from `write`.

Follow-on generation is performed by invoking the standalone commands against `write` outputs:

```bash
# 1. Run write to produce rendered markdown
bun autoshow write video.mp4 --llm openai --prompt shortSummary --rendered-text

# 2. Invoke standalone commands on write artifacts
bun autoshow tts output/<run-dir>/text.md --provider elevenlabs
bun autoshow music output/<run-dir>/text.md --provider elevenlabs
bun autoshow image "$(cat output/<run-dir>/text.md)" --provider openai
bun autoshow video "$(cat output/<run-dir>/text.md)" --provider grok
```

With a single `--llm` target the rendered file is `text.md`; multiple targets write one `text-<model>.md` per model. Lyric drafts from project lyric draft mode land under `./output/<name>/lyrics` and pair with `music --lyrics-file`.

Relationship to existing ADRs:

- **[ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md):** The six resume domains (`extract`, `write`, `tts`, `image`, `video`, `music`) remain intact. Generation resume was already keyed to standalone manifests, so narrowing `write`'s execution surface to LLM preserves the rule that every model selectable by an execution command is resume-selectable, while eliminating dead write-generation resume code paths.
- **[ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md):** `WriteRuntimeOptions`, `ExpectedOutputOptions`, and `ProcessingOptions` are narrowed to reflect actual runtime consumption, dropping generation option intersections.
- **`config` and `resume`:** Retain their generation option flags. `config` keeps the prefixed generation flags and the step selectors (`--tts`, `--image`, `--video`, `--music`) that persist defaults for the standalone commands, while `resume` keeps provider-neutral generation options and selects providers through repeatable `--provider provider[=model]`.

## Rationale

- **Decoupling and Predictability:** Users have full control over when expensive generation steps execute without unexpected billing from saved config defaults.
- **Surface Area Reduction:** Simplifies the `write` CLI interface, documentation, and option resolution contracts.
- **Clean Parity:** Standalone generation commands already support complete file/directory inputs (`tts`), prompt strings (`image`, `video`), lyrics files (`music`), and independent price estimation.

## Consequences

Positive outcomes:

- Saved `config` generation defaults cannot trigger paid synthesis or generation during `write` commands.
- `write` help displays only relevant pipeline, extraction, writing, batch, and pricing flags.
- `write --price` accurately reflects steps 0–3 costs across all input routes.
- Removed dead `generation-stage-runner.ts` and associated glue code.

Negative outcomes:

- Users executing combined write and media generation workflows must chain two CLI commands.

## Trade-offs

**Trade-off 1**

- **Gain:** Elimination of config-default auto-spend and clean separation of concerns.
- **Sacrifice:** Single-command write-plus-generation invocation is no longer supported.

**Trade-off 2**

- **Gain:** Precise pricing estimates and streamlined option types.
- **Sacrifice:** Unified single-command pricing for write + downstream media generation now requires running `--price` on the respective standalone generation commands.

## Implementation Note

Implemented across five phases:

1. Severed generation stage runners, resource gating, and post-generation pricing branches from the write runtime (`single/process-video.ts`, `step-3-write/run-text-write.ts`, `aggregate-pricing.ts`).
2. Removed write generation flags, step selectors (`--tts`, `--image`, `--video`, `--music`), and TTS normalization from `write-flags.ts` and the step-selector normalizer (`service-selector-normalization/step-selectors.ts`, which now exposes separate write and config entry points), while preserving selectors on `config-flags.ts`.
3. Narrowed `WriteRuntimeOptions`, `ExpectedOutputOptions`, and `ProcessingOptions`, and swept dead runner types in `src/types/`.
4. Reconciled test catalogs, price registries, and budget preflight contracts.
5. Updated documentation, architecture diagrams, selection guides, and decision records.

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/help-flag-groups.test.ts
bun test test/test-cases/validation/cli/doc-command-flags-contract.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
bun test test/test-cases/validation/providers/provider-selection-contracts/generic-selector-normalization.test.ts
bun test test/test-cases/validation/runtime-contracts/adaptive-concurrency-contracts.test.ts
bun test test/test-cases/validation/content-output/show-note-contracts.test.ts
bun test test/test-cases/validation/reports-pricing/price-mode-contracts/
```

1. Typecheck and unique source check pass cleanly.
2. All 139 mapped price commands pass with zero failures.
3. Help and flag group contracts verify that `write` advertises only step 0–3 flags and rejects generation flags with unknown-flag usage errors.
4. Option resolution contracts confirm preserved behavior for STT, OCR, URL, LLM, batch, and pricing.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md)
- `src/cli/flags/write-flags.ts`
- `src/cli/commands/process-steps/step-3-write/run-text-write.ts`
