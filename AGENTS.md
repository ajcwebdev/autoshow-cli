# Repository Structure Rules

- Python source files (`.py`) are prohibited in this repository. Never create, add, or generate them.
- A root-level `scripts/` directory is prohibited. Place application code and runtime helpers under `src/`, maintenance utilities under `src/tools/`, and tests and test harnesses under `test/`.
- Never create a new root-level directory for any reason. Use the existing repository structure and place new subdirectories beneath appropriate existing directories.
- Never write absolute paths to a checkout of this repository (for example, a path under your home directory that ends in the repository directory name) into tracked files, including generated manifests, reports, front matter, and error artifacts. Store project paths relative to the repository root with the helpers in `src/utils/project-root.ts`, and write consensus reports through `.codex/skills/consensus/scripts/shared/portable_paths.ts`. `bun run check:structure` rejects violations.

# Agent Verification Rules

- Use `bun run check` and `bun t --price` for the default verification pass.
- Fix every failure encountered during verification, including failures outside the immediate change or from earlier workspace changes. Do not finish with known failing tests or checks merely because they are unrelated. Diagnose the cause, preserve the intended behavior and meaningful assertions, and rerun the affected checks. Do not hide failures by skipping tests or weakening assertions. Paid-provider approval rules still apply.
- Also run targeted local behavioral tests for changed behavior. Type checks and price preflight are not functional verification. Provider tests must use independently documented model/endpoint expectations, cover accepted controls through actual dispatch and rejected controls before dispatch, and exercise default, override, and reset paths where applicable. Test both valid and deliberately invalid output artifacts. Distinguish transport success, decoded artifact integrity, spoken/text correctness, and perceptual quality in test names and reports; passing mocks does not establish the latter two.
- Keep default smoke and e2e verification targeted, local, and no-cost, without third-party API calls. Paid coverage must directly serve the requested task and satisfy the Paid Provider Execution Rules below. Local smoke examples:
  - `bun test test/test-cases/validation/cli/cli-help-contracts.test.ts`
  - `bun test test/test-cases/validation/cli/cli-usage-errors/`
  - `bun test test/test-cases/validation/cli/option-resolution-contracts/`
- Full-suite execution requires explicit user authorization, regardless of command spelling or entry point. Verified price-only preflight such as `bun t --price` is allowed.

# Paid Provider Execution Rules

- An individual paid-provider run or a planned combination of related paid-provider runs is automatically approved when its estimated total cost is at most $0.25 USD. Do not ask for additional confirmation for runs within this threshold.
- Estimate costs before execution using price preflight or known provider rates, including applicable minimum billing, add-ons, and billable retries. Track cumulative spending for a combination; do not split related work into new combinations to reset the threshold.
- If the applicable estimate is unknown or exceeds $0.25 USD, obtain explicit user approval naming the exact command or combination and expected cost/risk before execution. Generic instructions like “do it”, “try it”, or “rerun it” do not override the threshold. This spending threshold does not authorize unrelated work.
- Apply these rules to any execution that can incur provider charges, including verification, regardless of command or provider flags. Exclude price-only and mocked execution only when verified to make no billable provider calls.
- For provider failure debugging, complete local/no-cost preparation and validation first, then apply these spending rules to any billable execution.
- If an unapproved paid-provider process is accidentally started, stop it promptly and report what was run.

# Work Preservation & Slot Recovery Rules

- For TTS controls benchmarks, verify support for each model/control pair and use the model's native input syntax or request fields before any paid call. Keep emotion/delivery/instruction tests separate from speed/pause tests, with five self-describing lines per case. Exclude nonverbal vocalizations and sound effects entirely. Distinguish numeric speed from qualitative pacing guidance and exact timed silence from qualitative pause tags. Use explicit provider/model selections, never `--all-providers`. Skip unsupported or unverified model/control pairs; do not synthesize them as plain-text fallbacks. Reuse already-completed compatible audio rather than purchasing it again.
- Keep spoken text, inline delivery tags, and request-level free-form instruction fields distinct. Never translate arbitrary instruction prose into Eleven v3 bracket tags. Its dialogue API still uses tags inside `inputs[].text`; selecting dialogue does not create a separate instruction field. Use concise documented delivery cues, explicitly verify the selected endpoint, and assess spoken-text correctness before calling a controls case passed. HTTP success, WAV decoding, hashes, and mocked payload checks do not establish spoken-text or audible-control correctness.
- Active fixtures are in `input/examples/tts/controls/emotion/` and `input/examples/tts/controls/speed-pauses/`; `input/examples/tts/controls/benchmark-plan.json` tracks their shared spending estimate. Use `bun src/tools/tts-controls-benchmark.ts --suite all --price` to review both. Save the suites separately under `docs/benchmarks/tts/`. The shared ledger’s `outputBase` is `docs/benchmarks/tts`; the independent benchmarks use `2026-09-12_05-tts-emotion/` and `2026-09-12_06-tts-speed-pauses/` beneath it, within the existing TTS dashboard tab. Keep spending cumulative across both benchmarks. Preserve earlier run directories. The earlier mixed controls run and `05-tts-controls.txt` are historical. Exclude all controls fixtures from all-provider directory batches.

- Never delete output directories or temporary TTS working directories (`rm -rf output/...` or `.tts-tmp-...`) when a process is interrupted, fails, or requires configuration adjustments. Deleting output directories destroys cached audio segment files that were already synthesized and paid for, forcing duplicate provider API calls and double billing.
- When a TTS run is blocked with `automatic redispatch is blocked pending reconciliation`, preserve cached outputs and apply the Paid Provider Execution Rules before using `--allow-ambiguous-redispatch`. The flag reuses completed segment audio on disk but can repurchase missing audio for a slot whose earlier provider request may already have been billed; include that potential cost in the estimate.

# Git Command Rules

- Always work on `staging`. Never create another branch, including temporary, verification, feature, or agent-named branches. Authorization to commit, push, or open a pull request does not authorize creating or switching to another branch.
- Use read-only Git commands by default. Git mutations require an explicit user request for the action; leave staging and committing to the user otherwise. Branch creation and switching remain prohibited even when other Git mutations are requested. Use plain filesystem commands (`mv`, `rm`, `mkdir`) for file operations.

# Pre-Commit Book Privacy Rules

- Everything under `docs/benchmarks/` is exempt from the pre-commit book privacy rules below, including source-book artifacts, excerpts, titles, author names, metadata, and generated derivatives.
- Immediately before staging or committing, inspect the complete candidate change set, including tracked diffs and untracked files, for source-book artifacts, excerpts, book titles, author names, source filenames, metadata, and generated derivatives.
- Never stage or commit while any source-book artifact or identifying book title remains in the candidate change set. Remove it from the candidate change set and repeat the audit before proceeding.
- Git-ignored files are outside this pre-commit audit. Do not inspect, modify, move, or delete ignored `input/`, `output/`, or other runtime files as part of the audit unless the user explicitly requests a broader workspace inspection.

# Pull Request Rules

- Always open pull requests ready for review. Never create or convert a pull request as a draft.
- Keep pull request descriptions concise and concrete. For provider or model refreshes, include a quick rundown of every added, replaced, updated, and removed model instead of generic rationale or impact boilerplate.

# Markdown

- Do not hard-wrap Markdown prose.
- Align Markdown tables so pipes line up: pad each cell and the delimiter row to the longest current value in that column (header or body). After adding, splitting, shortening, or removing cells, re-fit the whole table to those current widths. Do not keep leftover padding from a previous longer value.

# Report Files

- Location: Save agent task reports under `docs/reports/`. Classify by purpose and content, not filename: audits, comparisons, evaluations, research summaries, implementation reviews, migration notes, dependency/evidence write-ups, environment inventories, and generated reference summaries are reports. Preserve established benchmark artifacts and generators in their existing locations; they are exempt from relocation.
- Packaging: Default to one self-contained Markdown report per task with conclusions, decision tables, verification commands/results, and provenance, rather than separate summary JSON/CSV files or log directories. If original evidence is needed, keep it in one adjacent compressed `.evidence.zip` archive, preserving original bytes and including a checksum manifest; link it once and identify useful entries in the report. Regenerate routine help captures and test logs by default. Create loose supporting artifacts only for requested deliverables or actual tool/test inputs that require standalone files.
- Maintenance: Agent task report generators should update a marked section of the existing report or emit to stdout by default, never create a file per command, provider, architecture, or verification attempt. When updating a report outside `docs/reports/` that is not covered by the established benchmark exception, move it and its supporting artifacts there and update references, relative links, generator output paths, and affected tests. Before finishing, review all reports and supporting documentation created or updated during the session, including untracked files, and relocate misplaced reports subject to the benchmark exception above.
