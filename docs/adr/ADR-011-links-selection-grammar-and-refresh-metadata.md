# ADR-011: Links Selection Grammar and Refresh Metadata

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-14
- **Date Updated:** 2026-10-28
- **Verification Status:** Passed
- **Supersession:** Absorbs the `links` parser and selection-grammar decision of "Integrate Comic with Shared Model and Native CLI Infrastructure".

## Context

`links` fetches curated provider documentation URLs, a direct remote URL, or an input-file URL list, converts HTML pages to Markdown as needed, and writes one combined Markdown file. That file recorded no freshness metadata: when each source was fetched, whether its content had changed, or how large it is in reference tokens. Model-reference URLs were mixed into general or modality sections, so `links models` was incomplete and one URL could appear in more than one category. Output ignored the run-directory conventions other artifact commands follow.

The provider-scoped selection grammar is legitimate, but a bespoke parser let unknown dashed tokens pass silently instead of failing as unknown flags the way they do on every other command.

Why now: `links` is used as a repeatable documentation snapshot and as the first step of the evidence lifecycle in [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md), so freshness metadata, a complete `models` selection, standard run directories, and shared unknown-flag diagnostics need to be first-class command behavior.

## Options Considered

### Refresh metadata and output directories

**Option 1 (selected)**

- **Option:** Opt-in `--refresh` that rewrites the bundle, writes a JSON sidecar and a changes diff, and reports links that need attention; plain runs write timestamped `output/` directories, and a refresh without `--output-dir` reuses `docs/links/<selection>-links/`
- **Pros:** Markdown-only output stays the default; a refresh compares against a stable directory without passing it every time; `--output-dir` still pins either kind of run
- **Cons:** Extra artifacts on refresh; attention findings still exit 0; a default refresh writes under `docs/links/` even when `--output-root` is set
- **Quantitative Notes:** One sidecar per refresh; a changes file when a previous bundle and refresh metadata are available

**Option 2**

- **Option:** Always write refresh metadata on every `links` run
- **Pros:** No extra flag
- **Cons:** Writes extra files when the user only wants combined markdown
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Store metadata inside the generated markdown
- **Pros:** One output file
- **Cons:** Mixes freshness data into the bundle users paste, diff, and archive
- **Quantitative Notes:** n/a

**Option 4**

- **Option:** Record token counts only, without hashes or a previous-refresh comparison
- **Pros:** Smaller sidecar
- **Cons:** Rejected; omits whether content changed and when a link last succeeded
- **Quantitative Notes:** n/a

**Option 5**

- **Option:** Write a stable overwrite file under `output/<stem>-links.md` without a run directory
- **Pros:** Refresh comparison stays on one path without pinning `--output-dir`
- **Cons:** Rejected; `--output-dir` would mean something different on `links` than on other commands
- **Quantitative Notes:** n/a

### Selection grammar

**Option 1 (selected)**

- **Option:** Parse `links` with the shared native command parser while keeping order-sensitive `--provider <name>` sections
- **Pros:** Unknown dashed selectors fail as unknown flags, and parse, help, and dispatch follow the same path as every other command
- **Cons:** `--provider` stays order-sensitive, and `provider=section` values are rejected
- **Quantitative Notes:** n/a

**Option 2**

- **Option:** Flatten the provider-scoped grammar into ordinary independent flags
- **Pros:** `links` would look like every other command
- **Cons:** Changes the meaning of ordered sections with no agreed replacement syntax
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Keep the bespoke parser
- **Pros:** No churn
- **Cons:** Rejected; unknown dashed selectors would still bypass unknown-flag errors
- **Quantitative Notes:** n/a

## Decision

Keep the order-sensitive provider selection grammar on the shared command parser, and make freshness comparison opt-in through `--refresh`. A refresh fetches every unique selected link, compares the converted Markdown with the previous refresh, writes hashes and reference token counts in a JSON sidecar, and always rewrites the bundle.

When both the previous bundle and refresh metadata are available, the refresh also writes `<selection>-links.changes.md` with diffs and lists of new or removed links. Change status is `new`, `unchanged`, `changed`, or `failed`; comparison ignores line order and ISO 8601 timestamps. A failed fetch preserves previous successful comparison metadata, and token counts are estimates for context sizing.

Findings flag failed, empty, redirected, duplicate, shrunken, or incomplete captures in the sidecar and warnings. These findings, including fetch failures, do not make the command exit unsuccessfully.

A whole-provider refresh also fetches documentation pages the model registry cites for prices and catalogs and reports configured model IDs missing from the fetched documentation, except documented exemptions. A section-scoped, direct-URL, or input-file refresh fetches only the requested selection. Refresh does not update registry check dates.

Model-reference URLs live in `models` sections, so `links models` and provider-scoped `models` selections stay complete and the same URL is not repeated across categories.

A plain `links` run writes a timestamped directory under `output/` or `--output-root` and honors `--output-dir`. A `--refresh` run without `--output-dir` reuses `docs/links/<selection>-links/`, including when `--output-root` is set, and `--output-dir` overrides that directory. The markdown filename stays selection-based, with `<selection>-links.refresh.json` and the changes file beside it.

This applies to:

- Curated selections, direct URL mode, and input file mode, with overlapping URLs deduplicated.
- `models` as a global and provider-scoped section wherever model-reference URLs exist.
- Global `--output-root` and `--output-dir` on `links`.
- The provider-scoped selection grammar and its unknown-flag diagnostics.

It does not apply to:

- Freshness comparison on plain runs, which write Markdown only.
- Choosing or editing curated documentation URLs, registry check dates, or the combined markdown format.
- Pipeline `manifest.json` or `resume` for `links`.
- The other command surfaces that adopted the native parser ([ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md)).
- The evidence lifecycle that consumes a refreshed bundle ([ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md)).

### Selection grammar

Positionals after `--provider <name>` belong to that provider until the next `--provider`, and leading positionals are global sections. Inline values such as `--provider openai=models` are invalid, and unknown dashed selectors fail as unknown flags. `links --help-topic providers` lists provider names and this scoping.

## Rationale

- A JSON sidecar keeps freshness data out of the markdown users paste, diff, or archive, and hashing the converted markdown measures the content users receive.
- Ignoring line order and timestamps keeps change status from firing on a host that serves the same document differently each request.
- The changes file is read from the bundle about to be overwritten, so a `changed` link stays readable after the rewrite.
- Reusing one directory per refresh selection makes comparison the default while `--output-dir` remains the pin.
- Findings reuse pages the refresh already fetched, so one command both refreshes the bundle and reports links that need attention.
- The provider-scoped grammar cannot be flattened without changing its meaning, and it does not need a private parser.

## Consequences

Positive outcomes:

- Users can tell whether a refreshed source is new, unchanged, changed, or failed, and can read the diff, without hand-diffing the bundle.
- Token totals size a bundle before it is used as model context, and `links models` is complete across the curated registry.
- A plain run uses the same `output/` layout as other artifact commands.

Negative outcomes:

- A refresh fetches every selected page, so runtime follows remote latency.
- Attention findings exit 0, so a successful exit still needs a reading of the findings.
- Scripts that relied on a silently ignored dashed selector now fail at parse time.

## Trade-offs

**Trade-off 1**

- **Gain:** Explicit source freshness and change status
- **Sacrifice:** A sidecar and a changes file, and metadata only when `--refresh` is passed

**Trade-off 2**

- **Gain:** A refresh compares without a hand-passed directory
- **Sacrifice:** A default `--refresh` writes under `docs/links/<selection>-links/`, including when `--output-root` is set

**Trade-off 3**

- **Gain:** `unchanged` means the document is the same, even when a host reorders rows or regenerates timestamps
- **Sacrifice:** A reorder-only or timestamp-only edit is reported as `unchanged`

**Trade-off 4**

- **Gain:** Registered provider names and the same unknown-flag validation as every other command
- **Sacrifice:** `--provider` stays order-sensitive, and `provider=section` values are rejected

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

1. First and repeated refreshes, hash and token-count changes, reorder and timestamp edits treated as unchanged, and a failed fetch preserving previous metadata.
2. Direct URL mode, input file mode, URL deduplication, findings, the changes diff, and model-registry source pages.
3. Run directories under `--output-root`, pinned `--output-dir`, and `--refresh` reusing one directory per selection.
4. Invalid inline `--provider` values and unknown-flag failures.

Verification is local and no-cost.

## References

- Related ADR: [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md)
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- Related ADR: [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md)
- `docs/commands/00-setup-and-utilities/links.md`
- `src/cli/commands/setup-and-utilities/links/define-links-command.ts`
