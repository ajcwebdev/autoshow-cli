# ADR-011: Add Refresh Metadata to Links

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-14
- **Date Updated:** 2026-08-21
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

`--refresh` and `--refresh-only` ship in `src/cli/commands/setup-and-utilities/links/define-links-command.ts`. Default output uses `createGenerationOutputDir` so `links` creates a timestamped run directory under `output/` and accepts `--output-root` and `--output-dir`. Curated `models` sections live in `src/cli/commands/setup-and-utilities/links/model-links/`. User-facing behavior is documented in `docs/commands/setup-and-utilities/links/links.md`.

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
- `docs/commands/setup-and-utilities/links/links.md`
- `src/cli/commands/setup-and-utilities/links/define-links-command.ts`
- `src/cli/commands/setup-and-utilities/links/model-links/`
