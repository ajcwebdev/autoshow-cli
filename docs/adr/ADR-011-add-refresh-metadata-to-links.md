# ADR-011: Add Refresh Metadata to Links

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-14
- **Date Updated:** 2026-09-20
- **Verification Status:** Passed

## Context

`links` is AutoShow's local documentation bundle command. It fetches curated provider documentation URLs, a direct remote URL, or an input-file URL list, converts HTML pages to Markdown as needed, and writes a combined Markdown file into a timestamped run directory under `output/`, the same `--output-root` / `--output-dir` layout used by other artifact commands.

That file records no freshness metadata: when each source was fetched, whether content changed since a prior run, or how large the result is in bytes or reference tokens. The curated registry also mixed model-reference URLs into general or modality sections, so `links models` was incomplete and the same URL could appear in more than one category.

A hardcoded project-local documentation directory made `links` ignore `--output-root`, reject `--output-dir`, and sit outside the run-directory contract every other artifact command follows.

Why now: `links` is used as a repeatable documentation snapshot, so refresh metadata, a complete `models` selection, and standard `output/` run-directory writes need to be first-class command behavior.

## Options Considered

**Option 1 (selected)**

- **Option:** Add opt-in `--refresh` / `--refresh-only` flags with a JSON sidecar, and promote model-reference URLs into first-class `models` sections
- **Pros:** Makes refresh behavior explicit; preserves default markdown-only output; gives `models` a first-class global section; prevents duplicate URLs across categories
- **Cons:** Adds command flags and a sidecar artifact; token counts are estimates
- **Quantitative Notes:** 2 boolean flags, 1 JSON sidecar per refresh run

**Option 2**

- **Option:** Always write refresh metadata on every `links` run
- **Pros:** Users get metadata automatically and the CLI surface stays smaller
- **Cons:** Changes default behavior and writes extra files when users only want combined markdown
- **Quantitative Notes:** Adds sidecar output to 100% of `links` runs

**Option 3**

- **Option:** Store metadata inside the generated markdown
- **Pros:** Keeps all output in one file and avoids sidecar discovery
- **Cons:** Pollutes the source bundle, complicates downstream markdown use, and makes metadata updates harder to diff cleanly
- **Quantitative Notes:** Adds metadata blocks to every refreshed markdown artifact

**Option 4**

- **Option:** Add token counts only, without hashes or previous-refresh comparison
- **Pros:** Smaller surface; gives rough context-size estimates
- **Cons:** Does not answer whether content changed or when a link last succeeded
- **Quantitative Notes:** Omits change status, previous hash, and previous token count

**Option 5 (selected)**

- **Option:** Write each `links` run into a timestamped `output/<timestamp>_<slug>/` directory, honor `--output-root` and `--output-dir`, and keep the existing selection-based markdown filename inside that directory
- **Pros:** Matches image, tts, extract, and other artifact commands; pins refresh comparison with `--output-dir`; removes the dedicated project-local documentation directory
- **Cons:** Default runs no longer overwrite a stable path, so `--refresh-only` against a prior bundle requires `--output-dir`
- **Quantitative Notes:** One run directory per invocation; same markdown and `.refresh.json` filenames as before, relocated

**Option 6**

- **Option:** Write a stable overwrite file under `output/<stem>-links.md` without a timestamped run directory
- **Pros:** Keeps refresh comparison on the same path without pinning `--output-dir`
- **Cons:** Still a `links`-only layout; `--output-dir` would not mean the same thing as on other commands
- **Quantitative Notes:** Rejected; `links` would remain a run-directory exception

**Option 7**

- **Option:** Keep writing under a dedicated project-local documentation directory
- **Pros:** No path migration
- **Cons:** Ignores `--output-root`, rejects `--output-dir`, and keeps a unique output root no other command uses
- **Quantitative Notes:** Rejected; this is the special case being removed

## Decision

Add `--refresh` as an explicit boolean flag for `links`. When present, `links` fetches every unique selected link, records per-link SHA-256 hashes and reference token counts for the converted markdown, compares the current refresh against prior metadata, and writes a JSON sidecar next to the generated markdown. `--refresh-only` implies `--refresh` but leaves an existing markdown bundle in place, updating sidecar metadata only; if no bundle exists yet, the markdown is written. When `--refresh-only` finds that remote content has drifted from an existing bundle, the command warns.

Promote model-reference URLs into `models` sections across the curated registry so `links models` and provider-scoped `models` selections work consistently.

Write each `links` run into a timestamped directory under `output/` (or `--output-root`) using the same run-directory helpers as other artifact commands. `--output-dir` pins that directory. The combined markdown keeps its selection-based filename inside the run directory, and the refresh sidecar stays beside it. `--refresh-only` compares against files in the resolved run directory, so a previous bundle is only reused when `--output-dir` pins that earlier run.

This applies to:

- Curated `links` selections, including global sections, provider selectors, mixed selections, and deduplicated overlapping URLs.
- Direct URL mode and input file mode.
- Combined markdown and refresh sidecars in the resolved run directory, for example `output/<timestamp>_openai-models-links/openai-models-links.md` and `openai-models-links.refresh.json`.
- `models` as a global and provider-scoped selection wherever model-reference URLs exist.
- Global `--output-root` and `--output-dir` on `links`.

It does not apply to:

- Changing normal `links` behavior when `--refresh` is omitted.
- How curated documentation URLs are chosen or kept current.
- Changing the combined markdown format.
- Pipeline `manifest.json` or `resume` for `links`.

### Amendment (2026-09-20): one refresh command, with findings

`--refresh-only` is removed and now fails as an unknown flag. It fetched and converted every page exactly as `--refresh` does, matched `--refresh` outright in a default timestamped run, and against a pinned `--output-dir` left the sidecar describing remote content that the bundle on disk did not hold. `--refresh` always rewrites the bundle; the sidecar no longer carries `markdownWritten`. References to `--refresh-only` elsewhere in this record describe the original decision.

`--refresh` also reports links that need attention, which supersedes the statement above that keeping curated URLs current is out of scope. The sidecar gains a `findings` array and `totals.attentionCount`, derived from the pages the run already fetched: `http-error`, `fetch-failed`, `empty`, `login-redirect`, `duplicate-target`, `redirect`, `duplicate-content`, and `shrunk`. Findings are logged as warnings and do not change the exit code. A separate link-audit script was folded into this path so one command both refreshes the bundle and checks the configs.

Change status compares a `changeHash` rather than `contentHash`. `changeHash` hashes the markdown with ISO 8601 timestamps masked and lines sorted, because `docs.x.ai` reorders table rows and Gladia's OpenAPI spec regenerates example timestamps on every request, which marked four links `changed` on every run. `contentHash` still records the exact bundle bytes and still drives `duplicate-content`. A reorder-only or timestamp-only edit now reads as `unchanged`; that was accepted because a `changed` status that always fires carries no signal. `shrunk` fires at 60% of the previous token count instead of 50%, after a page that lost its request parameters landed at 50.1% and went unreported.

Five changes followed a review of what a refresh run could and could not tell its reader. The sidecar moved to `schemaVersion` 2.

- **The comparison is the default.** A refresh was only useful against a previous refresh, yet a default run wrote a new timestamped directory and compared with nothing, so the useful mode needed a directory passed by hand. `--refresh` without `--output-dir` now reuses `docs/links/<selection>-links/`. `--output-dir` still overrides it, and runs without `--refresh` are unchanged.
- **A changed link comes with its diff.** `changed` reported that a page moved and the run then overwrote the only copy of the previous body, so every change had to be re-derived by hand. The run now reads the bundle it is about to overwrite and writes `<selection>-links.changes.md`. Reusing the bundle as the previous state was chosen over a per-link content store because it needs no new storage and no migration.
- **Conversion is checked.** Every earlier check described the fetch, while the only lossy step is HTML to markdown conversion, which a converter change had silently broken for Mistral's request parameters. Each HTML page now records the identifiers its text holds that the markdown lacks, and `conversion-loss` reports identifiers that the previous capture held, the page still has, and this run lost. An absolute recall threshold was rejected because a correct capture of a marketing page scores as low as 0.13, and a recall delta between runs was rejected after it misfired when the identifier pattern changed and when a related-models carousel gained items. Neither can affect a comparison against the previous capture's own identifiers.
- **The pages the model registry cites are fetched.** `pricingSourceUrl` and `catalogSourceUrl` named 78 pages, 51 of them in no link config, so no refresh read the pages prices came from. Whole-provider refreshes now derive those pages from the registry. Deriving them was chosen over copying them into link configs because the copy is what had drifted. The first run found three dead pricing sources, five stale ones, and seven model IDs that no fetched page spells out: four are registry labels for endpoints that take no model parameter, and three are Mistral names that its model cards render in the browser. `pricingCheckedAt` and `catalogCheckedAt` stay hand-written, since fetching a page does not compare its numbers with the registry's.
- **The sidecar is an index.** Each link records `startLine` and `lineCount`, so one page can be read out of a bundle of several hundred thousand lines. The per-link tokenizer block, 29% of the file, is recorded once.

Speed was measured and left alone: a full run is about 25 seconds and is bound by seven workers, and only 48% of links send a cache validator.

## Rationale

- Opt-in flags keep existing `links` usage stable while making comparison and sidecar writes intentional.
- A JSON sidecar keeps freshness data out of the combined markdown that users paste, diff, or archive.
- Hashing converted markdown measures the content users actually receive.
- Comparing both content hash and token count catches same-size text edits and size-changing edits.
- Token counts are reference estimates for context sizing, not exact billable counts.
- First-class `models` sections make `bun autoshow links models` complete and keep model pages from being duplicated across modality sections.
- Standard run directories make `links` honor `--output-root` and `--output-dir` like other artifact commands.

## Consequences

Positive outcomes:

- Users can tell whether refreshed documentation sources are new, unchanged, changed, or failed without manually diffing the combined markdown.
- Token totals make documentation bundles easier to size before using them as model context.
- Failed refreshes preserve previous successful hash, token count, and successful refresh timestamp when available.
- `links models` and provider-scoped `models` selections work across the curated registry.
- `links` writes into the same `output/` run-directory layout as other artifact commands.

Negative outcomes:

- Refresh runs can be slow because they fetch every selected page.
- Refresh writes an extra `.refresh.json` sidecar that cleanup workflows need to account for.
- Token counts are reference estimates rather than exact billable counts for any specific provider or model.
- Default timestamped runs do not overwrite a previous bundle, so refresh comparison against an earlier run requires `--output-dir`.

## Trade-offs

**Trade-off 1**

- **Gain:** Explicit source freshness and change status
- **Sacrifice:** Additional JSON sidecar artifact per refreshed Markdown file

**Trade-off 2**

- **Gain:** Stable default `links` bundle output
- **Sacrifice:** Users must opt in with `--refresh` or `--refresh-only`

**Trade-off 3**

- **Gain:** Per-link reference token counts for context sizing
- **Sacrifice:** Those counts are not exact billable counts for every provider or model

**Trade-off 4**

- **Gain:** Refresh uses the same fetch and conversion path as ordinary `links`
- **Sacrifice:** Refresh duration remains tied to remote fetch latency across selected links

**Trade-off 5**

- **Gain:** `links` uses the same `output/` run-directory contract as other artifact commands
- **Sacrifice:** `--refresh-only` against a prior bundle requires `--output-dir` instead of a stable overwrite path

## Implementation Note

`--refresh` and `--refresh-only` ship in `src/cli/commands/setup-and-utilities/links/define-links-command.ts`. Default output uses `createGenerationOutputDir` so `links` creates a timestamped run directory under `output/` and accepts `--output-root` and `--output-dir`. Curated `models` sections live in `src/cli/commands/setup-and-utilities/links/model-links/`. User-facing behavior is documented in `docs/commands/00-setup-and-utilities/links.md`.

## API / Type Impact

- `links` accepts `--refresh` and `--refresh-only` as command-specific boolean flags.
- `links` creates a run directory and accepts global `--output-root` and `--output-dir`.
- The sidecar path replaces the markdown file's `.md` extension with `.refresh.json` in the same run directory, for example `openai-models-links.refresh.json` beside `openai-models-links.md`.
- `--refresh-only` updates the sidecar without overwriting an existing markdown bundle in the resolved run directory, and writes the markdown when no bundle exists yet.
- Each link records fetch status, change status (`new`, `unchanged`, `changed`, or `failed`), hash, token count, timestamps, previous successful values, and a failure reason when the fetch fails.
- `models` is a global section and a provider-scoped section wherever model-reference URLs exist.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/links-refresh-metadata.test.ts
bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/links-input-modes.test.ts
bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/links-output-directory.test.ts
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

1. First refresh, unchanged second refresh, hash-only and token-count changes, `--refresh-only` preserving an existing bundle, and failed fetch preserving previous successful metadata.
2. Direct URL mode, input file mode, and URL deduplication.
3. Help, usage errors, and option resolution for `--refresh` and `--refresh-only`.
4. Default timestamped run directories under `--output-root`, pinned `--output-dir`, and `--refresh-only` against a pinned existing bundle.

Verification is local and no-cost.

## References

- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md)
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- Related ADR: [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md)
- `docs/commands/00-setup-and-utilities/links.md`
- `src/cli/commands/setup-and-utilities/links/define-links-command.ts`
- `src/cli/commands/setup-and-utilities/links/model-links/`
