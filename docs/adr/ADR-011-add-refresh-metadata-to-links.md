# ADR-011: Add Refresh Metadata to Links

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-14
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed
- **Supersession:** `--refresh-only`, and the rule that every refresh wrote a new timestamped directory, were replaced in this record on 2026-09-20. `--refresh` rewrites the bundle. A refresh without `--output-dir` reuses `docs/links/<selection>-links/`. The rest of this decision remains accepted.

## Context

`links` fetches curated provider documentation URLs, a direct remote URL, or an input-file URL list, converts HTML pages to Markdown as needed, and writes one combined Markdown file. That file recorded no freshness metadata: when each source was fetched, whether the content had changed, or how large the result is in bytes or reference tokens. Model-reference URLs were mixed into general or modality sections, so `links models` was incomplete and the same URL could appear in more than one category. A hardcoded project-local documentation directory ignored `--output-root`, rejected `--output-dir`, and sat outside the run-directory contract other artifact commands follow.

Why now: `links` is used as a repeatable documentation snapshot, so refresh metadata, a complete `models` selection, and standard run-directory writes need to be first-class command behavior.

## Options Considered

**Option 1 (selected)**

- **Option:** Add an opt-in `--refresh` flag that rewrites the bundle, writes a JSON sidecar and a changes diff, and reports links that need attention
- **Pros:** Makes refresh explicit; preserves markdown-only output by default; one command both refreshes the bundle and reports stale, failed, duplicate, and lossy pages
- **Cons:** Adds a flag and extra artifacts; token counts are estimates; attention findings still exit 0
- **Quantitative Notes:** 1 boolean flag; 1 JSON sidecar per refresh; 1 changes file from the second comparison on

**Option 2 (selected)**

- **Option:** Write a plain `links` run into a timestamped `output/<timestamp>_<slug>/` directory, honor `--output-root` and `--output-dir`, and reuse `docs/links/<selection>-links/` when `--refresh` is set without `--output-dir`
- **Pros:** A plain run matches other artifact commands; a refresh compares against a stable directory without passing that directory every time; `--output-dir` still pins either kind of run
- **Cons:** A default refresh writes under `docs/links/`, including when `--output-root` is set; a plain run does not compare with a previous bundle
- **Quantitative Notes:** One new run directory per plain invocation; one reused directory per refresh selection

**Option 3**

- **Option:** Always write refresh metadata on every `links` run
- **Pros:** Metadata arrives without a flag, and the CLI surface stays smaller
- **Cons:** Changes the default and writes extra files when the user only wants combined markdown
- **Quantitative Notes:** Adds sidecar output to every `links` run

**Option 4**

- **Option:** Store metadata inside the generated markdown
- **Pros:** Keeps output in one file
- **Cons:** Mixes freshness data into the bundle users paste, diff, and archive
- **Quantitative Notes:** Adds metadata blocks to every refreshed markdown artifact

**Option 5**

- **Option:** Record token counts only, without hashes or a previous-refresh comparison
- **Pros:** Smaller sidecar; gives a rough context-size estimate
- **Cons:** Omits whether content changed and when a link last succeeded
- **Quantitative Notes:** Rejected; omits change status, previous hash, and previous token count

**Option 6**

- **Option:** Add `--refresh-only`, which updates the sidecar and leaves an existing markdown bundle in place
- **Pros:** Could record remote drift while keeping a known bundle byte-for-byte
- **Cons:** Fetches and converts every page the same way `--refresh` does, and the sidecar can describe remote content the bundle on disk does not hold
- **Quantitative Notes:** Rejected; the flag is unknown

**Option 7**

- **Option:** Write a stable overwrite file under `output/<stem>-links.md` without a timestamped run directory
- **Pros:** Refresh comparison stays on one path without pinning `--output-dir`
- **Cons:** Leaves `links` on its own layout, so `--output-dir` would mean something different from other commands
- **Quantitative Notes:** Rejected; `links` would remain a run-directory exception

**Option 8**

- **Option:** Keep every `links` run under a dedicated project-local documentation directory
- **Pros:** No path migration
- **Cons:** Ignores `--output-root`, rejects `--output-dir`, and keeps an output root no other command uses
- **Quantitative Notes:** Rejected; this is the special case being removed

## Decision

`--refresh` fetches every unique selected link, records a content hash, a change hash, and a reference token count for the converted markdown, compares that with the previous refresh, and writes a JSON sidecar beside the markdown. It always rewrites the bundle. From the second comparison on it also writes `<selection>-links.changes.md`, a diff of each changed link taken from the bundle it is about to overwrite, plus links that are new or no longer selected. `--refresh-only` is an unknown flag.

Change status is `new`, `unchanged`, `changed`, or `failed`. Comparison ignores line order and ISO 8601 timestamps, so a reorder or a regenerated timestamp reads as `unchanged`. `contentHash` is the normalized markdown body. `changeHash` is what change status compares. A failed fetch keeps the previous successful hash, token count, and timestamp when they exist. Token counts are reference estimates for context sizing. Each link records `startLine` and `lineCount` so one page can be read out of the bundle.

The sidecar includes a `findings` array and `totals.attentionCount`. Findings are logged as warnings and the command exits 0. The statuses are `http-error`, `fetch-failed`, `empty`, `login-redirect`, `duplicate-target`, `redirect`, `duplicate-content`, `shrunk`, `conversion-loss`, and `model-undocumented`. `shrunk` reports a page at or below 60% of its previous token count. `conversion-loss` reports identifiers the previous capture held, the page still has, and this run's markdown lost. `duplicate-content` uses `contentHash`.

A refresh that selects every provider, or each `--provider` named without sections, also fetches the documentation pages the model registry cites for prices and catalogs. A source on an `api.` host is skipped. A section-scoped, direct-URL, or input-file refresh fetches only what it was asked for. `model-undocumented` reports a configured model id that no fetched page of its source site spells out. Model ids that no documentation page is expected to spell out are omitted. Refresh does not update hand-written registry check dates.

Model-reference URLs live in `models` sections, so `links models` and provider-scoped `models` selections stay complete and the same URL is not repeated across categories.

A plain `links` run writes a timestamped directory under `output/` or `--output-root` and honors `--output-dir`. A `--refresh` run without `--output-dir` reuses `docs/links/<selection>-links/`, including when `--output-root` is set. `--output-dir` overrides that directory. The markdown filename stays selection-based inside the directory, with the sidecar and changes file beside it.

This applies to:

- Curated `links` selections, including global sections, provider selectors, mixed selections, and deduplicated overlapping URLs.
- Direct URL mode and input file mode.
- Combined markdown, refresh sidecars, and changes files in the resolved directory, for example `output/<timestamp>_openai-models-links/openai-models-links.md`, `openai-models-links.refresh.json`, and `openai-models-links.changes.md`.
- `models` as a global and provider-scoped selection wherever model-reference URLs exist.
- Global `--output-root` and `--output-dir` on `links`.
- Needs-attention findings produced from pages a refresh already fetched.

It does not apply to:

- A plain `links` run, which writes markdown only into a new timestamped directory and does not compare.
- Choosing or editing curated documentation URLs, or updating registry price and catalog check dates.
- The combined markdown format.
- Pipeline `manifest.json` or `resume` for `links`.

## Rationale

- An opt-in `--refresh` flag keeps existing markdown-only `links` usage stable.
- A JSON sidecar keeps freshness data out of the combined markdown users paste, diff, or archive.
- Hashing converted markdown measures the content users receive. Ignoring line order and timestamps keeps change status from firing on a host that serves the same document differently each request.
- The changes file is read from the bundle about to be overwritten, so a `changed` link stays readable after the rewrite.
- Token counts size a bundle before it is used as model context.
- First-class `models` sections make `bun autoshow links models` complete.
- A plain run uses the shared run directory. A refresh reuses one directory per selection, so comparison is the default and `--output-dir` remains the pin.
- Findings use pages the refresh already fetched, including registry source pages on a whole-provider run, so the same command refreshes the bundle and reports links that need attention.

## Consequences

Positive outcomes:

- Users can tell whether a refreshed source is new, unchanged, changed, or failed, and can read the diff, without hand-diffing the combined markdown.
- Token totals make a documentation bundle easier to size before using it as model context.
- A failed refresh preserves the previous successful hash, token count, and timestamp when they exist.
- `links models` and provider-scoped `models` selections work across the curated registry.
- A plain run uses the same `output/` layout as other artifact commands. A refresh compares against `docs/links/<selection>-links/` unless `--output-dir` pins another directory.

Negative outcomes:

- A refresh fetches every selected page, so runtime follows remote latency.
- A refresh writes `.refresh.json` and, from the second comparison on, `.changes.md`.
- Token counts are reference estimates for context sizing.
- A `--refresh` run without `--output-dir` writes under `docs/links/<selection>-links/` even when `--output-root` is set.
- Attention findings exit 0, so a successful exit still needs a reading of the findings.

## Trade-offs

**Trade-off 1**

- **Gain:** Explicit source freshness and change status
- **Sacrifice:** An additional JSON sidecar, and a changes file once a previous bundle exists

**Trade-off 2**

- **Gain:** A plain `links` run stays one markdown file in a new run directory
- **Sacrifice:** Freshness metadata exists only when the user passes `--refresh`

**Trade-off 3**

- **Gain:** Per-link reference token counts for context sizing
- **Sacrifice:** The count can differ from a provider's billable tokenizer

**Trade-off 4**

- **Gain:** Refresh uses the same fetch and conversion path as ordinary `links`
- **Sacrifice:** Refresh duration stays tied to remote fetch latency across the selected links

**Trade-off 5**

- **Gain:** A plain run uses the shared `output/` run-directory contract, and a refresh compares without a hand-passed directory
- **Sacrifice:** A default `--refresh` writes under `docs/links/<selection>-links/`, including when `--output-root` is set

**Trade-off 6**

- **Gain:** `unchanged` means the document is the same, including when a host reorders rows or regenerates timestamps
- **Sacrifice:** A reorder-only or timestamp-only edit is reported as `unchanged`

## Implementation Note

`--refresh` ships in `src/cli/commands/setup-and-utilities/links/define-links-command.ts`. Run directory selection for plain and refresh runs lives in `src/cli/commands/setup-and-utilities/links/links-output.ts`. Curated `models` sections live in `src/cli/commands/setup-and-utilities/links/model-links/`. User-facing behavior is documented in `docs/commands/00-setup-and-utilities/links.md`.

## API / Type Impact

- `links` accepts `--refresh` as a command-specific boolean flag. `--refresh-only` is an unknown flag.
- A plain run creates a timestamped directory and accepts `--output-root` and `--output-dir`. A `--refresh` run without `--output-dir` reuses `docs/links/<selection>-links/`, including when `--output-root` is set. `--output-dir` overrides that directory.
- Beside `<selection>-links.md`, `--refresh` writes `<selection>-links.refresh.json`. From the second comparison on it also writes `<selection>-links.changes.md`.
- Each sidecar link records fetch status, change status, `contentHash`, `changeHash`, a reference token count, `startLine`, `lineCount`, timestamps, and previous successful values when a fetch fails. The sidecar records `findings` and `totals.attentionCount`.
- `models` is a global section and a provider-scoped section wherever model-reference URLs exist.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/links-refresh-metadata.test.ts
bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/links-input-modes.test.ts
bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/links-output-directory.test.ts
bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/links-refresh-findings.test.ts
bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/links-refresh-changes.test.ts
bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/links-conversion-check.test.ts
bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/links-model-sources.test.ts
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

1. First refresh, unchanged second refresh, hash and token-count changes, reorder and timestamp edits treated as unchanged, older sidecars that predate `changeHash`, and a failed fetch preserving previous successful metadata.
2. Direct URL mode, input file mode, and URL deduplication.
3. Help, usage errors, and option resolution for `--refresh`, including rejection of `--refresh-only`.
4. Timestamped run directories under `--output-root`, pinned `--output-dir`, and `--refresh` without `--output-dir` reusing one directory per selection.
5. Findings, the changes diff, HTML conversion loss, and model-registry source pages.

Verification is local and no-cost.

## References

- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md)
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- Related ADR: [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md)
- `docs/commands/00-setup-and-utilities/links.md`
- `src/cli/commands/setup-and-utilities/links/define-links-command.ts`
- `src/cli/commands/setup-and-utilities/links/links-output.ts`
- `src/cli/commands/setup-and-utilities/links/model-links/`
