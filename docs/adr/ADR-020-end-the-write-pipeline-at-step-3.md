# ADR-020: End the Write Pipeline at Step 3 (Text Generation)

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-17
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed

## Context

`write` used to run the whole content pipeline: metadata inspection, download, transcription, OCR, and URL extraction, LLM writing, then TTS, image, video, and music. Help advertised more than 130 generation flags plus the selectors `--tts`, `--image`, `--video`, and `--music`.

That coupling caused four user-visible failures:

1. **Config-default auto-spend.** Saved generation defaults such as `config --tts elevenlabs` applied to every later `write`. Users who set TTS or image defaults for the standalone commands paid for generation on writes they never requested.
2. **Silent skip on multi-summary writes.** Generation after write ran only for a single LLM summary. Repeatable provider selections or multiple text variants skipped TTS, image, video, and music without a clear failure.
3. **Price over-estimation.** `write --price` included generation stages on document routes (PDF, EPUB, articles) that never ran them.
4. **Resume cost drop.** Resuming a write run omitted previously billed generation costs and assets from the report.

Generation was then removed, and `write` remained a combined extract-then-summarize command. That leftover coupling still put the extract surface on a text command:

1. **Extract flags on write.** `write` advertised `--stt`, `--ocr`, transcription, OCR document, and article-extraction flags, plus write-only `--all-providers stt|ocr|url|llm` and `--all-local stt|ocr|url`.
2. **Saved defaults leaked into write.** Saved extract or generation defaults could fail a write or attach work the user never asked for.
3. **Two provider grammars.** `extract` uses `--provider`. `write` used `--stt`, `--ocr`, and `--llm` because it still ran extract.
4. **Chaining is already the product rule.** TTS, image, video, and music already consume write artifacts as a second command. A URL or local file follows the same convention: `extract`, then `write` on the extracted text.

Why now: extract-inside-write was the largest remaining dual surface from the old combined pipeline, and it still attached extract flags and saved extract defaults to a command that should only call an LLM.

## Options Considered

**Option 1 (selected)**

- **Option:** Confine `write` to LLM text generation over explicit text input. Media, documents, URLs, and X Spaces go through `extract` first; TTS, image, video, and music remain standalone follow-on commands
- **Pros:** One command per job; `write` help, flags, pricing, resume, and config match only LLM work; extract stays the only STT, OCR, and URL surface; chaining matches generation
- **Cons:** URL-to-summary and file-to-summary workflows need two CLI commands
- **Quantitative Notes:** Removes write `--stt`, `--ocr`, transcription, OCR, article, and write-only `--all-providers` / `--all-local` step lists; `write --price` estimates LLM tokens only

**Option 2**

- **Option:** Keep extract-then-LLM `write` and only reject generation flags
- **Pros:** One command still turns a URL or local file into a summary
- **Cons:** Leaves extract flags and a second provider grammar on `write`; saved extract and generation defaults can still change a write the user did not ask to extract
- **Quantitative Notes:** Rejected; preserves the dual extract surface this decision removes

**Option 3**

- **Option:** Keep generation flags on `write` and patch config injection plus multi-summary gating
- **Pros:** Preserves one-command write plus generation
- **Cons:** Leaves the large `write` flag surface and a second path beside the standalone generation commands
- **Quantitative Notes:** Rejected; patching auto-spend and gating leaves the `write` surface coupled to generation

## Decision

`write` is LLM text generation over text input only. It does not inspect, download, transcribe, OCR, or extract URLs. It does not run, price, select, or flag TTS, image, video, or music. Media, documents, HTML articles, and X Spaces are `extract` inputs. Text files and directories of `.md` / `.txt` are `write` inputs.

Chain commands:

```bash
bun autoshow extract video.mp4 --provider deepgram
bun autoshow write output/<extract-run>/transcription.txt --provider openai --prompt shortSummary --rendered-text
bun autoshow tts output/<write-run>/text.md --provider elevenlabs
bun autoshow music output/<write-run>/text.md --provider elevenlabs
bun autoshow image "$(cat output/<write-run>/text.md)" --provider openai
bun autoshow video "$(cat output/<write-run>/text.md)" --provider grok
```

One `--provider` or `--llm` target writes `text.json` and `show-note.md`. Multiple targets write `text-<model>.json` and `show-note-<model>.md` per model; when two providers share a model id, the filename includes the provider. `--rendered-text` also writes `text.md`, or one `text-<model>.md` per model.

`write` accepts local `.md` / `.txt` files and directories of those files. It rejects URLs, media, documents, HTML, X Spaces, and URL-list files with a usage error that names `extract` as the prior command. `--text-input` is not a write flag. `--provider` selects the model, with repeatable `provider[=model]` values. `--llm` is a compatibility alias for `--provider`. Boolean `--all-providers` selects every hosted LLM. `--all-local` is not a write flag.

This applies to:

- `write` execution, help, flags, `--price` estimates, config defaults, and resume.
- Removal of `--stt`, `--ocr`, transcription flags, OCR document flags, article-extraction flags, and write-only `--all-providers` / `--all-local` step lists from `write`.
- Follow-on generation from write artifacts via `tts`, `image`, `video`, and `music`.
- `extract` as the only command that runs STT, OCR, URL, and X Space acquisition for later writing.

It does not apply to:

- The six resume domains (`extract`, `write`, `tts`, `image`, `video`, `music`), which stay independent ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).
- Extract execution, artifacts, and provider selection ([ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)).
- `setup` and config-file generation defaults (`--tts`, `--image`, `--video`, `--music`), which still persist defaults for the standalone commands. `config` remains a forwarding alias for `setup`.
- The standalone `tts`, `image`, `video`, and `music` commands' own flags, pricing, and resume.
- Lyric-draft files that already treat `./output/<name>/text` as raw text. Those files remain write inputs.

## Rationale

- Saved generation or extract defaults must not bill the user or attach extra work to a `write` that should only call an LLM.
- `write` help and `write --price` should describe only token-priced text generation.
- Extract already owns STT, OCR, and URL acquisition. A second copy of those flags on `write` forces two grammars for one job.
- Operators already chain `write` with `tts`, `image`, `video`, and `music`. `extract` then `write` is the same convention.

## Consequences

Positive outcomes:

- Saved generation defaults do not trigger paid generation during `write`.
- Saved extract defaults do not attach STT, OCR, or URL work to `write`.
- `write` help shows provider selection, writing, batch, and pricing flags.
- `write --price` estimates LLM tokens only.

Negative outcomes:

- A URL or media file needs `extract`, then `write`.
- Existing scripts that pass a URL or media file to `write` fail until they insert `extract`.

## Trade-offs

**Trade-off 1**

- **Gain:** No config-default auto-spend, and write stays separate from generation
- **Sacrifice:** Single-command write-plus-generation is gone

**Trade-off 2**

- **Gain:** `write --price` matches write execution
- **Sacrifice:** A combined write and generation estimate requires `--price` on each command

**Trade-off 3**

- **Gain:** Write is text in and LLM out, with extract as the only transcription and document path
- **Sacrifice:** URL-to-summary and file-to-summary workflows need `extract`, then `write`

## Implementation Note

Text-only `write` ships from `src/cli/commands/text/write/`. Help, `--price`, resume, and config defaults cover LLM text generation and do not apply extract or generation settings saved for other commands. Flags live in `src/cli/flags/write-flags.ts`.

## API / Type Impact

`write` accepts `.md` and `.txt` input only. `--stt`, `--ocr`, `--all-providers stt|ocr|url`, `--all-local stt|ocr|url`, `--text-input`, and the extract flag groups are unknown on `write`. Boolean `--all-providers` remains and selects every hosted LLM. Older write output directories that recorded extract provider state are not migrated; rerun `extract`, then `write` ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).

## Keep (with rationale)

- Standalone `extract`, `tts`, `image`, `video`, and `music`, including their `--provider` selectors.
- `--provider` as the write provider selector, with `--llm` as a compatibility alias, because write has one step.
- `--rendered-text`, `--prompt`, `--prompt-file`, `--track-list`, and lyric-draft directory inputs, which belong to write.

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/help-flag-groups.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

1. The repository check passes.
2. `write --price` estimates LLM tokens only and rejects media, URL, and document inputs.
3. Help and usage errors show `write` advertising LLM, prompt, batch, and pricing flags, and rejecting extract and generation flags.
4. `extract` keeps STT, OCR, URL, batch, and pricing behavior.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- Related ADR: [ADR-016](ADR-016-govern-readme-command-examples-as-executable-contracts.md)
- `src/cli/flags/write-flags.ts`
- `src/cli/commands/text/write/`
- `docs/commands/03-write/overview.md`
