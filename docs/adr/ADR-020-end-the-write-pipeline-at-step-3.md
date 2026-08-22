# ADR-020: End the Write Pipeline at Step 3 (Text Generation)

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-17
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed

## Context

The `write` command used to run steps 0 through 7: metadata inspection, download, STT/OCR/URL extraction, LLM writing, then TTS, image, video, and music generation. That meant `write` advertised more than 130 generation flags plus the generation step selectors `--tts`, `--image`, `--video`, and `--music`.

The coupling caused four problems:

1. **Config-default auto-spend:** Saved generation defaults such as `config --tts elevenlabs` applied to every later `write` run. Users who set TTS or image defaults for the standalone commands then paid for generation on writes they never requested.
2. **Silent skip on multi-summary writes:** Generation after write ran only for a single LLM summary. Repeatable `--llm` or multiple text variants skipped TTS, image, video, and music without a clear failure.
3. **Price over-estimation:** `write --price` included generation stages even on document routes (PDF, EPUB, articles) that never ran them.
4. **Resume cost drop:** Resuming a write run rebuilt cost and timing from steps 1–3 only, so previously billed generation costs and assets disappeared from the resumed report.

Why now: saved `config` generation defaults were charging users on `write` runs that should have stopped at text.

## Options Considered

**Option 1 (selected)**

- **Option:** End `write` at step 3 (text generation) and run TTS, image, video, and music through the standalone commands
- **Pros:** Stops config-default auto-spend; drops 130+ generation flags from `write` help; generation no longer depends on a single summary; `write --price` matches what `write` actually runs
- **Cons:** Write-plus-generation workflows need two CLI commands instead of one
- **Quantitative Notes:** Removed 132 generation flags from the `write` surface

**Option 2**

- **Option:** Keep generation flags on `write` and patch config injection plus multi-summary gating
- **Pros:** Preserves one-command write + generation
- **Cons:** Leaves the large `write` flag surface and dual write-versus-standalone generation paths
- **Quantitative Notes:** Rejected; the auto-spend and gating bugs can be patched without shrinking the `write` surface, so the coupling remains

## Decision

The `write` command runs only steps 0–3: metadata inspection, source download, STT/OCR/URL extraction, and LLM text writing. TTS, image, video, and music are not executed, priced, selected, or flagged from `write`. Run those standalone commands against `write` output:

```bash
bun autoshow write video.mp4 --llm openai --prompt shortSummary --rendered-text
bun autoshow tts output/<run-dir>/text.md --provider elevenlabs
bun autoshow music output/<run-dir>/text.md --provider elevenlabs
bun autoshow image "$(cat output/<run-dir>/text.md)" --provider openai
bun autoshow video "$(cat output/<run-dir>/text.md)" --provider grok
```

A single `--llm` target writes `text.md`; multiple targets write one `text-<model>.md` per model.

This applies to:

- The `write` command's execution, help, flags, and `--price` estimates.
- `--all-providers` and `--all-local` on `write`, which select extraction and LLM steps only.
- Follow-on generation from write artifacts via `tts`, `image`, `video`, and `music`.
- Resume of write runs, which covers steps 0–3 only.

It does not apply to:

- The six resume domains (`extract`, `write`, `tts`, `image`, `video`, `music`), which remain independent ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).
- `config` generation defaults and step selectors (`--tts`, `--image`, `--video`, `--music`), which still persist defaults for the standalone commands.
- The standalone `tts`, `image`, `video`, and `music` commands' own flags, pricing, and resume.

## Rationale

- Saved generation defaults must not bill users during `write`.
- `write` help and `--price` should describe only the work `write` performs.
- The standalone `tts`, `image`, `video`, and `music` commands already accept write artifacts and have their own `--price` estimates.

## Consequences

Positive outcomes:

- Saved `config` generation defaults cannot trigger paid generation during `write`.
- `write` help shows pipeline, extraction, writing, batch, and pricing flags only.
- `write --price` estimates steps 0–3 for every input route.

Negative outcomes:

- Combined write and media generation takes two CLI commands.

## Trade-offs

**Trade-off 1**

- **Gain:** No config-default auto-spend, and write stays separate from generation
- **Sacrifice:** Single-command write-plus-generation is gone

**Trade-off 2**

- **Gain:** `write --price` matches write execution
- **Sacrifice:** A combined write + generation estimate requires `--price` on each standalone command

## Implementation Note

Shipped as a step-3-only `write` command in `src/cli/flags/write-flags.ts` and `src/cli/commands/process-steps/step-3-write/run-text-write.ts`.

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/help-flag-groups.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

1. Typecheck and unique source check pass.
2. `write --price` cases estimate steps 0–3 only.
3. Help and usage-error contracts show `write` advertising step 0–3 flags and rejecting generation flags.
4. Option resolution keeps STT, OCR, URL, LLM, batch, and pricing behavior.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- `src/cli/flags/write-flags.ts`
- `src/cli/commands/process-steps/step-3-write/run-text-write.ts`
- `docs/commands/process-steps/step-3-write/write-text.md`
