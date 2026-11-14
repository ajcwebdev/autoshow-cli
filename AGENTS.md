# Repository Structure

- Never create, add, or generate Python source files (`.py`), or create new root directories, including `scripts/`. Put application/runtime code in `src/`, maintenance tools in `src/tools/`, and tests/harnesses in `test/`.
- Tracked files, including generated records and errors, must use repository-relative checkout paths. Use `src/utils/project-root.ts`; consensus reports use `.codex/skills/consensus/scripts/shared/portable_paths.ts`. Enforced by `bun run check:structure`.

# Verification

- Default: `bun run check` and `bun t --price`. Full-suite execution requires explicit user authorization regardless of entry point; verified price-only preflight is allowed.
- Fix every encountered failure, including unrelated or pre-existing ones; preserve intended behavior/assertions and rerun affected checks. Never skip or weaken tests to hide failures.
- Changed behavior needs targeted local behavioral tests; types and price preflight are insufficient. Provider tests need independently documented model/endpoint expectations, accepted controls through actual dispatch, rejection before dispatch, applicable default/override/reset paths, and valid/invalid artifacts. In test names and reports, distinguish transport success, decoded integrity, spoken/text correctness, and perceptual quality; mocks prove neither of the latter two.
- Default smoke/e2e checks stay targeted, local, free, and without third-party API calls. Complete local preparation before paid debugging; paid coverage must serve the task and follow the rules below.

# Paid Providers

- Estimate the complete related batch before execution, using preflight or known rates, including minimum billing, add-ons, and billable retries. Track cumulative spending; never split related work to reset the threshold.
- A known total below $1 USD is automatically approved within the requested task. Unknown totals or totals of $1 or more require explicit approval naming the exact commands and expected cost/risk. Generic “do it” or “rerun it” does not override this rule.
- Apply this to every potentially billable execution, including verification, regardless of flags. Exempt price-only/mocked execution only after verifying it makes no billable calls. Stop accidental unapproved processes promptly and report what ran.

# Episode Publishing

- For ajcwebdev pages, new/rebuilt transcripts require `--provider assemblyai=universal-3-5-pro --diarization`. Reuse only when the manifest confirms that provider, model, and diarization; otherwise retranscribe and retain earlier evidence. Prefer cached recordings.
- Preflight the related transcription/writing batch, including diarization and billable retries, under the paid-provider rules.
- Verify speaker names from introductions, handoffs, and recordings; resolve generic labels before publishing. Regenerate summaries/chapters from the reviewed transcript. Preserve metadata, source links, guest profiles, and raw results.

# TTS Preservation and Benchmarks

- Never delete output directories or temporary TTS work on interruption, failure, or reconfiguration: cached segments may already be paid. Preserve earlier run directories and reuse compatible audio.
- Before `--allow-ambiguous-redispatch`, preserve cached outputs and estimate potentially duplicate charges for unresolved slots under the paid-provider rules. Completed segments are reused; missing segments may already have been billed.
- Verify each benchmark model/control pair and its native syntax/endpoint before paid calls. Select explicit providers/models, never `--all-providers`; skip unsupported/unverified pairs without plain-text fallback. Separate emotion/delivery/instruction from speed/pause tests, using five self-describing lines per case. Exclude nonverbal vocalizations and sound effects. Distinguish numeric speed from pacing guidance and timed silence from qualitative pause tags.
- Keep spoken text, inline tags, and request-level instructions distinct. Never convert arbitrary prose into Eleven v3 tags: dialogue still puts tags in `inputs[].text`, without a separate instruction field. Use concise documented cues; assess spoken-text correctness before passing a case. HTTP success, decoding, hashes, and mocks establish neither spoken correctness nor audible control.
- Fixtures: `input/examples/tts/controls/{emotion,speed-pauses}/`; shared estimate/run ledger: `input/examples/tts/controls/benchmark-plan.json`. Review both with `bun src/tools/tts-controls-benchmark.ts --suite all --price`. Exclude these fixtures from all-provider directory batches.
- Keep cumulative spending across both suites. Set ledger `outputBase` to `docs/benchmarks/tts`; save separate `<YYYY-MM-DD>_05-tts-emotion/` and `<YYYY-MM-DD>_06-tts-speed-pauses/` runs there in the existing TTS dashboard tab. Pin the first-run date in the shared ledger for reuse.

# Git and Pull Requests

- Work only on `staging`. Never create or switch branches, even with commit/push/PR authorization.
- Git is read-only unless the user explicitly requests the mutation; leave staging/committing to them otherwise. Use filesystem commands (`mv`, `rm`, `mkdir`) for file operations.
- PRs must be ready for review, never drafts. Keep descriptions concrete; provider/model refreshes list every added, replaced, updated, and removed model.

# Pre-Commit Book Privacy

- Immediately before staging/committing, audit all candidate tracked diffs and untracked files for source-book artifacts, excerpts, titles, authors, source filenames, metadata, and derivatives. Do not stage/commit with source-book artifacts or identifying titles present; remove them from the candidates and repeat the audit.
- Everything under `docs/benchmarks/` is exempt. Ignored files are outside this audit: do not inspect, modify, move, or delete ignored input/output/runtime files without an explicit broader inspection request.

# Markdown and Reports

- Do not hard-wrap prose. Align table pipes and size cells/delimiters to current column maxima after every edit; remove stale padding.
- Reports belong in `docs/reports/`, classified by purpose regardless of filename: audits, comparisons, evaluations, research, reviews, migrations, dependency/evidence notes, inventories, and generated references. Established benchmark artifacts/generators stay in place.
- Default to one self-contained Markdown report per task with conclusions, decision tables, verification commands/results, and provenance. Keep original evidence in one adjacent `.evidence.zip`, preserving bytes with a checksum manifest; link it once and identify useful entries. Regenerate routine help captures and test logs. Loose supporting files are only for requested deliverables or required standalone tool/test inputs.
- Report generators update a marked section or emit stdout by default, not files per command/provider/architecture/attempt. When updating misplaced reports, move them and supporting artifacts, updating references, links, generator paths, and tests. Before finishing, check all created/updated reports and supporting docs, including untracked files, for correct placement; preserve the benchmark exception.
