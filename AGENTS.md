# Agent Verification Rules

- Use `bun run check` and `bun t --price` for the default verification pass.
- For smoke coverage, run only targeted local/no-cost tests that do not call third-party APIs, such as:
  - `bun test test/test-cases/validation/cli/cli-help-contracts.test.ts`
  - `bun test test/test-cases/validation/cli/cli-usage-errors.test.ts`
  - `bun test test/test-cases/validation/cli/option-resolution-contracts/`
- Never run `bun run t` or `bun test/test-runner.ts` unless the user explicitly asks for the full suite.
- Never run smoke or e2e tests that can make third-party API calls with any cost, billing, quota, or price association.

# Paid Provider Execution Rules

- Never run CLI commands that can call paid or quota-limited third-party providers unless the user explicitly approves that exact paid run immediately beforehand.
- Treat commands such as `bun autoshow extract ... --provider openai`, `--provider gemini`, `--provider mistral`, `--provider deepinfra`, hosted STT/TTS/image/video/music generation, or any command with provider API flags as paid-provider runs, not verification.
- For provider failure debugging, run only local/no-cost preparation and validation steps, such as PDF repair, file inspection, manifest inspection, and local chunk/render smoke checks. Then report the exact provider command for the user to run themselves.
- Do not interpret a generic instruction like “do it”, “try it”, or “rerun it” as approval to spend provider credits. Ask for explicit approval naming the provider command and expected cost/risk instead.
- If a paid-provider process is accidentally started, stop it promptly and report what was run.

# Work Preservation & Slot Recovery Rules

- Never delete output directories or temporary TTS working directories (`rm -rf output/...` or `.tts-tmp-...`) when a process is interrupted, fails, or requires configuration adjustments. Deleting output directories destroys cached audio segment files that were already synthesized and paid for, forcing duplicate provider API calls and double billing.
- When a TTS run is blocked with `automatic redispatch is blocked pending reconciliation`, pass `--tts-allow-ambiguous-redispatch` (or `--allow-ambiguous-redispatch`). This flag safely reconciles the in-flight slot, reuses all completed segment audio files already saved on disk, and resumes synthesis without deleting output directories or losing work.

# Git Command Rules

- Never run git commands that modify repository state (e.g. `git add`, `git commit`, `git mv`, `git rm`, `git checkout`, `git reset`, `git push`, `git stash`). Use plain filesystem commands (`mv`, `rm`, `mkdir`) for file operations instead.
- Only read-only git commands are allowed (e.g. `git status`, `git diff`, `git log`, `git grep`, `git show`).
- Leave staging and committing to the user unless they explicitly ask for it.

# Pull Request Rules

- Always open pull requests ready for review. Never create or convert a pull request as a draft.
- Keep pull request descriptions concise and concrete. For provider or model refreshes, include a quick rundown of every added, replaced, updated, and removed model instead of generic rationale or impact boilerplate.

# Markdown

ALl markdown documents should be written with unwrapped prose and not hard-wrapped Markdown.
