# Repository Structure Rules

- Python source files (`.py`) are prohibited in this repository. Never create, add, or generate them.
- A root-level `scripts/` directory is prohibited. Place application code and runtime helpers under `src/`, maintenance utilities under `src/tools/`, and tests and test harnesses under `test/`.
- Never create a new root-level directory for any reason. Use the existing repository structure and place new subdirectories beneath appropriate existing directories.

# Agent Verification Rules

- Use `bun run check` and `bun t --price` for the default verification pass.
- Keep default smoke and e2e verification targeted, local, and no-cost, without third-party API calls. Paid coverage must directly serve the requested task and satisfy the Paid Provider Execution Rules below. Local smoke examples:
  - `bun test test/test-cases/validation/cli/cli-help-contracts.test.ts`
  - `bun test test/test-cases/validation/cli/cli-usage-errors/`
  - `bun test test/test-cases/validation/cli/option-resolution-contracts/`
- Full-suite execution requires explicit user authorization, regardless of command spelling or entry point. Verified price-only preflight such as `bun t --price` is allowed.

# Paid Provider Execution Rules

- An individual paid-provider run is automatically approved when its estimated total cost is strictly less than $0.01 USD. A planned combination of related paid-provider runs is automatically approved when its combined estimated total cost is strictly less than $0.10 USD. Do not ask for additional confirmation for runs within these thresholds.
- Estimate costs before execution using price preflight or known provider rates, including applicable minimum billing, add-ons, and billable retries. Track cumulative spending for a combination; do not split related work into new combinations to reset the threshold.
- If the applicable estimate is unknown or reaches or exceeds its threshold, obtain explicit user approval naming the exact command or combination and expected cost/risk before execution. Generic instructions like “do it”, “try it”, or “rerun it” do not override the thresholds. These spending thresholds do not authorize unrelated work.
- Apply these rules to any execution that can incur provider charges, including verification, regardless of command or provider flags. Exclude price-only and mocked execution only when verified to make no billable provider calls.
- For provider failure debugging, complete local/no-cost preparation and validation first, then apply these spending rules to any billable execution.
- If an unapproved paid-provider process is accidentally started, stop it promptly and report what was run.

# Work Preservation & Slot Recovery Rules

- Never delete output directories or temporary TTS working directories (`rm -rf output/...` or `.tts-tmp-...`) when a process is interrupted, fails, or requires configuration adjustments. Deleting output directories destroys cached audio segment files that were already synthesized and paid for, forcing duplicate provider API calls and double billing.
- When a TTS run is blocked with `automatic redispatch is blocked pending reconciliation`, preserve cached outputs and apply the Paid Provider Execution Rules before using `--allow-ambiguous-redispatch`. The flag reuses completed segment audio on disk but can repurchase missing audio for a slot whose earlier provider request may already have been billed; include that potential cost in the estimate.

# Git Command Rules

- Always work on `staging`. Never create another branch, including temporary, verification, feature, or agent-named branches. Authorization to commit, push, or open a pull request does not authorize creating or switching to another branch.
- Use read-only Git commands by default. Git mutations require an explicit user request for the action; leave staging and committing to the user otherwise. Branch creation and switching remain prohibited even when other Git mutations are requested. Use plain filesystem commands (`mv`, `rm`, `mkdir`) for file operations.

# Pre-Commit Book Privacy Rules

- Immediately before staging or committing, inspect the complete candidate change set, including tracked diffs and untracked files, for source-book artifacts, excerpts, book titles, author names, source filenames, metadata, and generated derivatives.
- Never stage or commit while any source-book artifact or identifying book title remains in the candidate change set. Remove it from the candidate change set and repeat the audit before proceeding.
- Git-ignored files are outside this pre-commit audit. Do not inspect, modify, move, or delete ignored `input/`, `output/`, or other runtime files as part of the audit unless the user explicitly requests a broader workspace inspection.

# Pull Request Rules

- Always open pull requests ready for review. Never create or convert a pull request as a draft.
- Keep pull request descriptions concise and concrete. For provider or model refreshes, include a quick rundown of every added, replaced, updated, and removed model instead of generic rationale or impact boilerplate.

# Markdown

Do not hard-wrap Markdown prose.

# Report Files

- Location: Save agent task reports under `docs/reports/`. Classify by purpose and content, not filename: audits, comparisons, evaluations, research summaries, implementation reviews, migration notes, dependency/evidence write-ups, environment inventories, and generated reference summaries are reports. Preserve established benchmark artifacts and generators in their existing locations; they are exempt from relocation.
- Packaging: Default to one self-contained Markdown report per task with conclusions, decision tables, verification commands/results, and provenance, rather than separate summary JSON/CSV files or log directories. If original evidence is needed, keep it in one adjacent compressed `.evidence.zip` archive, preserving original bytes and including a checksum manifest; link it once and identify useful entries in the report. Regenerate routine help captures and test logs by default. Create loose supporting artifacts only for requested deliverables or actual tool/test inputs that require standalone files.
- Maintenance: Agent task report generators should update a marked section of the existing report or emit to stdout by default, never create a file per command, provider, architecture, or verification attempt. When updating a report outside `docs/reports/` that is not covered by the established benchmark exception, move it and its supporting artifacts there and update references, relative links, generator output paths, and affected tests. Before finishing, review all reports and supporting documentation created or updated during the session, including untracked files, and relocate misplaced reports subject to the benchmark exception above.
