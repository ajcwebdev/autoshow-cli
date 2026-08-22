# ADR-020: End the Write Pipeline at Step 3 (Text Generation)

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-17
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed. `bun run check` and `bun t --price` succeeded after text-only write, command-scoped config merge, and leftover-surface cleanup.
- **Supersession:** The previously shipped mechanism that `write` still ran steps 0–3 (metadata, download, STT/OCR/URL extraction, then LLM) is superseded in place by this record. The earlier decision that TTS, image, video, and music never run from `write` remains accepted. Extract execution stays owned by [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md). Pipeline resume stays owned by [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md).

## Context

The `write` command used to run steps 0 through 7: metadata inspection, download, STT/OCR/URL extraction, LLM writing, then TTS, image, video, and music generation. That meant `write` advertised more than 130 generation flags plus the generation step selectors `--tts`, `--image`, `--video`, and `--music`.

The generation coupling caused four problems:

1. **Config-default auto-spend:** Saved generation defaults such as `config --tts elevenlabs` applied to every later `write` run. Users who set TTS or image defaults for the standalone commands then paid for generation on writes they never requested.
2. **Silent skip on multi-summary writes:** Generation after write ran only for a single LLM summary. Repeatable `--llm` or multiple text variants skipped TTS, image, video, and music without a clear failure.
3. **Price over-estimation:** `write --price` included generation stages even on document routes (PDF, EPUB, articles) that never ran them.
4. **Resume cost drop:** Resuming a write run rebuilt cost and timing from steps 1–3 only, so previously billed generation costs and assets disappeared from the resumed report.

The first implementation of this record removed generation from `write` and left `write` as a combined extract-then-LLM command. That remaining coupling still causes four problems:

1. **Extract flags on write:** `write` still advertises `--stt`, `--ocr`, transcription, OCR document, and article-extraction flags, plus write-only `--all-providers stt|ocr|url|llm` and `--all-local stt|ocr|url`. Operators who only want an LLM pass over text still inherit the extract surface.
2. **Shared option bag:** `write` still enters through `handleProcessTarget`, so download and extract option projection, `skipLLM`, Whisper defaults, and `defaults.post` generation injection remain on the write path. Saved extract or generation defaults can still fail or reshape a write the user never asked to extract.
3. **Dual provider grammar:** `extract` uses `--provider`; `write` uses `--stt` / `--ocr` / `--llm`. That split exists only because `write` still runs extract.
4. **Chaining is already the product rule:** TTS, image, video, and music already consume write artifacts as a second command. Transcription of a URL or local file should follow the same convention: `extract`, then `write` on the extracted text.

Why now: the leftover extract-in-write path is the largest remaining dual surface from the old mega-pipeline, and it blocks collapsing write-only `--stt` / `--ocr` flags, `skipLLM`, and `ProcessingOptions` write fields described in `docs/reports/04-legacy-report-2026-08-21.md`.

## Options Considered

**Option 1 (selected)**

- **Option:** Confine `write` to LLM text generation over explicit text input. Media, documents, URLs, and X Spaces go through `extract` first; TTS, image, video, and music remain standalone follow-on commands
- **Pros:** One command per job; `write` help, flags, pricing, resume, and config match only LLM work; extract stays the only STT/OCR/URL surface; chaining matches the generation convention already shipped
- **Cons:** URL-to-summary and file-to-summary workflows need two CLI commands instead of one
- **Quantitative Notes:** Removes write `--stt`, `--ocr`, transcription, OCR, article, and write-only `--all-providers` / `--all-local` step lists; `write --price` estimates LLM tokens only

**Option 2**

- **Option:** Keep the previously shipped extract-then-LLM `write` (steps 0–3) and only reject generation flags
- **Pros:** One command still turns a URL or local file into a summary
- **Cons:** Leaves extract flags, `handleProcessTarget`, `skipLLM`, and dual `--stt` / `--provider` grammar on `write`; saved extract and generation defaults can still leak into write
- **Quantitative Notes:** Rejected; this is the current tree and is the dual surface the legacy cleanup must remove

**Option 3**

- **Option:** Keep generation flags on `write` and patch config injection plus multi-summary gating
- **Pros:** Preserves one-command write plus generation
- **Cons:** Leaves the large `write` flag surface and dual write-versus-standalone generation paths
- **Quantitative Notes:** Rejected; the auto-spend and gating bugs can be patched without shrinking the `write` surface, so the coupling remains

## Decision

The `write` command is LLM text generation over text input only. It does not inspect, download, transcribe, OCR, or extract URLs. It does not execute, price, select, or flag TTS, image, video, or music. Media, documents, HTML articles, and X Spaces are `extract` inputs. Text files and directories of `.md` / `.txt` are `write` inputs.

Chain commands:

```bash
bun autoshow extract video.mp4 --provider deepgram
bun autoshow write output/<extract-run>/transcription.txt --llm openai --prompt shortSummary --rendered-text
bun autoshow tts output/<write-run>/text.md --provider elevenlabs
bun autoshow music output/<write-run>/text.md --provider elevenlabs
bun autoshow image "$(cat output/<write-run>/text.md)" --provider openai
bun autoshow video "$(cat output/<write-run>/text.md)" --provider grok
```

A single `--llm` target writes `text.md`; multiple targets write one `text-<model>.md` per model.

`write` accepts local `.md` / `.txt` files, directories of those files, and stdin-equivalent text paths. It rejects URLs, media, documents, HTML, X Spaces, and URL-list files with a usage error that names `extract` as the prior command. `--text-input` is not a mode flag; text is the only write input. `--llm` is the write provider selector, matching extract/generation `--provider` on their commands.

This applies to:

- The `write` command's execution, help, flags, `--price` estimates, config defaults, and resume.
- Removal of `--stt`, `--ocr`, transcription flags, OCR document flags, article-extraction flags, and write-only `--all-providers` / `--all-local` step lists from `write`.
- Follow-on generation from write artifacts via `tts`, `image`, `video`, and `music`.
- Extract remaining the only command that runs STT, OCR, URL, and X Space acquisition for later writing.

It does not apply to:

- The six resume domains (`extract`, `write`, `tts`, `image`, `video`, `music`), which remain independent ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).
- Extract execution, artifacts, and provider selection ([ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)).
- `config` generation defaults and step selectors (`--tts`, `--image`, `--video`, `--music`), which still persist defaults for the standalone commands.
- The standalone `tts`, `image`, `video`, and `music` commands' own flags, pricing, and resume.
- Project lyric-draft conventions that already treat `./output/<name>/text` as raw text; those remain write inputs.

## Rationale

- Saved generation or extract defaults must not bill users or reshape a `write` run that should only call an LLM.
- `write` help and `--price` should describe only the work `write` performs: token-priced text generation.
- Extract already owns STT, OCR, and URL. Keeping a second copy of that surface on `write` is the leftover mega-pipeline.
- Operators already chain `write` then `tts` / `image` / `video` / `music`. `extract` then `write` is the same convention.

## Consequences

Positive outcomes:

- Saved `config` generation defaults cannot trigger paid generation during `write`.
- Saved extract defaults cannot attach STT/OCR/URL work to `write`.
- `write` help shows writing, batch, and pricing flags only.
- `write --price` estimates LLM tokens only.
- `--stt` / `--ocr` / write-only `--all-providers` step lists disappear from `write`.

Negative outcomes:

- Combined extract and write takes two CLI commands.
- Existing scripts that pass a URL or media file to `write` fail and must insert `extract`.

## Trade-offs

**Trade-off 1**

- **Gain:** No config-default auto-spend, and write stays separate from generation
- **Sacrifice:** Single-command write-plus-generation is gone

**Trade-off 2**

- **Gain:** `write --price` matches write execution
- **Sacrifice:** A combined write + generation estimate requires `--price` on each standalone command

**Trade-off 3**

- **Gain:** Write is text-in / LLM-out, with extract as the only transcription and document path
- **Sacrifice:** URL-to-summary and file-to-summary workflows need `extract` then `write`

## Follow-up Actions

- [x] Confine `write` to text input
  Reject URLs, media, documents, HTML, and X Spaces. Drop `--text-input` as a mode flag. Route `write` through `run-write-command.ts` / `runTextWrite` rather than `handleProcessTarget`. Usage errors name `extract` as the prior command.
- [x] Strip extract flags from `write`
  Remove `--stt`, `--ocr`, transcription, OCR document, article-extraction, and write-only `--all-providers` / `--all-local` step lists from `src/cli/flags/write-flags.ts`. Keep `--llm`, prompts, rendered-text, batch, reasoning, and pricing.
- [x] Stop projecting extract and generation options onto `write`
  Command-scoped option builders. `skipLLM` is gone. Write does not load extract or generation config defaults.
- [x] Price and resume write as LLM-only
  `write --price` and `resume` of write runs estimate and continue step 3 only. Extract resume stays on `extract`.
- [x] Update docs, help, and executable examples
  `docs/commands/process-steps/step-3-write/write-text.md`, README examples, diagrams, and ADR-016 fixtures chain `extract` then `write`. Help contracts reject extract flags on `write`.
- [x] Fold this break into the leftover-surface cleanup
  Implement with `docs/reports/04-legacy-report-2026-08-21.md` section 6. Dual `--stt` / `--ocr` write selectors, `ProcessingOptions` write fields on download/extract, and write-shaped `skipLLM` are gone because write no longer runs extract.

## Implementation Note

Text-only `write` now routes through `src/cli/commands/process-steps/step-3-write/run-write-command.ts` and `runTextWrite`. It no longer enters `handleProcessTarget` and no longer advertises extract flags. `runTextWrite` remains the LLM execution path. Command-scoped config merge stops injecting extract and generation defaults into write. `skipLLM` is gone from `buildOptsFromFlags`.

## API / Type Impact

`write` no longer accepts non-text inputs. `--stt`, `--ocr`, `--all-providers stt|ocr|url`, `--all-local stt|ocr|url`, `--text-input`, and the extract flag groups become unknown on `write`. `WriteRuntimeOptions` loses extract and generation fields. `skipLLM` is not a public flag and should disappear from `buildOptsFromFlags`. Older write output directories that recorded extract provider states are not migrated; rerun `extract` then `write` ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).

## Keep (with rationale)

- Standalone `extract`, `tts`, `image`, `video`, and `music` commands, including their `--provider` selectors.
- `--llm` as the write provider selector, because write has one step.
- `--rendered-text`, `--prompt`, `--prompt-file`, `--track-list`, and lyric-draft directory conventions, which are write-native.
- Historical model rates for retired selectors ([ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)).

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
2. `write --price` cases estimate LLM tokens only and reject media, URL, and document inputs.
3. Help and usage-error contracts show `write` advertising LLM, prompt, batch, and pricing flags and rejecting extract and generation flags.
4. `extract` keeps STT, OCR, URL, batch, and pricing behavior.
5. README and command-doc examples that previously called `write` on a URL or media file chain `extract` then `write`.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- Related ADR: [ADR-016](ADR-016-govern-readme-command-examples-as-executable-contracts.md)
- `src/cli/flags/write-flags.ts`
- `src/cli/commands/process-steps/step-3-write/run-text-write.ts`
- `src/cli/commands/process-steps/step-3-write/define-write-command.ts`
- `src/cli/commands/process-steps/step-1-download/download-targets/handle-process-target.ts`
- `docs/commands/process-steps/step-3-write/write-text.md`
- `docs/reports/04-legacy-report-2026-08-21.md`
