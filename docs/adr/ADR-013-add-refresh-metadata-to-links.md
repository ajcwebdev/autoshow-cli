# ADR-013: Add Refresh Metadata to Links

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-14
- **Date Updated:** 2026-08-13
- **Verification Status:** Passed

## Context

`links` is AutoShow's local documentation bundle command. It reads curated provider documentation URLs from `src/cli/commands/setup-and-utilities/links/model-links/`, fetches the selected pages, converts HTML pages to markdown when needed, and writes one combined markdown artifact under `project/links/`.

The command also needs to support ad hoc documentation capture without requiring every URL to be added to the curated registry first. Direct URL mode handles a single remote documentation page, and input file mode reads remote URLs from a local `.md` or `.txt` file. Both modes share the normal fetch, retry, `blob:` normalization, HTML conversion, deduplication, and placeholder behavior.

Before this change, the generated markdown did not record when each source was last fetched, whether a source changed since the previous run, how large each fetched resource is, or which token-counting assumptions were used. At the same time, many provider manifests mixed model-reference pages into `general`, modality, or provider-specific sections. That made `links models` incomplete and made it easier for URLs to drift or repeat across categories.

Why now: `links` is being used as a repeatable documentation snapshot mechanism, so it needs explicit refresh metadata, ad hoc input modes, and a cleaner model-documentation selection surface.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Add `links --refresh` with sidecar metadata and align selector registry** | Makes refresh behavior explicit; preserves normal markdown behavior; supports direct URL and input file modes; gives `models` a first-class global section; prevents duplicate URLs across manifest categories | Adds a command flag, metadata schema, tokenizer dependency, sidecar artifact, and broader selector tests | Adds 1 boolean flag, 1 JSON sidecar per refresh run, 1 tokenizer utility, direct URL mode, input file mode, and model sections across curated providers |
| Always write refresh metadata on every `links` run | Users always get metadata after upgrading and the CLI surface stays smaller | Changes default behavior and writes extra files even when users only want combined markdown | Adds sidecar output to 100% of `links` runs |
| Store metadata inside the generated markdown | Keeps all output in one file and avoids sidecar discovery | Pollutes the source bundle, complicates downstream markdown use, and makes metadata updates harder to diff cleanly | Adds metadata blocks to every refreshed markdown artifact |
| Add token counts only, without hashes or previous-refresh comparison | Smaller implementation; gives rough context-size estimates | Does not answer whether content changed or when a link last succeeded | Omits change status, previous hash, and previous token count |
| Leave model pages in existing provider sections | Avoids registry churn and test fixture updates | Keeps `links models` incomplete and allows duplicates across provider categories | Adds no model-section coverage |
| Do nothing | No implementation or dependency work | Keeps refresh freshness, ad hoc URL capture, token-size checks, and model docs selection manual and inconsistent | Adds no metadata or selector coverage |

## Decision

Add `--refresh` as an explicit boolean flag for `links`. When present, `links` fetches every unique selected link, computes per-resource reference token counts, computes SHA-256 hashes over normalized markdown bodies, compares the current refresh against prior metadata, and writes a JSON sidecar next to the generated markdown.

Keep direct URL mode and input file mode as first-class `links` selection modes. Also promote model-reference URLs into `Models` sections across curated provider manifests so `links models` and provider-scoped `models` selections work consistently.

This applies to:

- Curated `links` selections, including global sections, provider selectors, mixed selections, and deduplicated overlapping URLs.
- Direct URL mode.
- Input file mode.
- Existing markdown output path behavior under `project/links/`.
- Refresh metadata sidecars named from the generated markdown artifact, for example `project/links/<selection>-links.refresh.json`.
- Provider manifest organization for first-class `models` coverage.

It does not apply to:

- Changing normal `links` behavior when `--refresh` is omitted.
- Adding a `--refresh-only` mode.
- Running paid or quota-limited provider APIs.
- Replacing the existing fetch, retry, `blob:`, HTML conversion, or placeholder behavior.

## Implementation Note

The implementation is complete:

- `src/cli/commands/setup-and-utilities/links/define-links-command.ts` parses `--refresh`, keeps provider selectors manual, supports direct URL and input file selection modes, enriches fetch results, writes the markdown artifact, and writes refresh sidecars only when requested.
- `src/utils/reference-tokenizer.ts` centralizes the reference tokenizer and uses `tiktoken` with `o200k_base`.
- `package.json` and `bun.lock` make `tiktoken@1.0.22` a direct runtime dependency.
- `src/cli/commands/setup-and-utilities/links/model-links/*.json` includes first-class `Models` sections for providers whose model docs were previously mixed into other sections, and duplicate manifest URLs were removed.
- `docs/commands/setup-and-utilities/links/links.md` documents direct URL mode, input file mode, `models`, `--refresh`, the sidecar path, summary counts, and tokenizer estimate semantics.
- Local/no-cost validation tests cover refresh metadata, parser/help behavior, direct URL mode, input file mode, fetch retry behavior, provider selector groups, model sections, and duplicate manifest protection.

## API / Type Impact

- `links` accepts `--refresh` as a command-specific boolean flag. Parser handling treats it as a real command flag, not as a provider selector. `--refresh=false` is accepted by the raw parser and disables sidecar writing.
- `parseLinksArgv(argv)` returns `refresh: boolean` with the existing service selection, global section, direct URL, and input file fields.
- `runLinksWithArgv(argv, { outputPath, fetchImpl })` remains the local/no-cost test seam and now returns `refreshMetadataPath` when refresh is requested.
- `getLinksRefreshMetadataPath(outputPath)` derives the sidecar path by replacing `.md` with `.refresh.json`.
- `ReferenceTokenizerMetadata` records `name: o200k_base`, `packageName: tiktoken`, and `packageVersion: 1.0.22`.
- Provider manifests now expose `models` as a global section and provider-scoped section where model-reference URLs exist.

The refresh sidecar schema starts at `schemaVersion: 1` and records:

- `command`, `selectionMode`, selected URLs, output path, sidecar path, and `refreshedAt`.
- Selection details for curated, direct URL, and input file modes.
- Aggregate counts for total links, successful links, empty responses, failed links, new links, unchanged links, changed links, failed refreshes, tokens, bytes, and characters.
- Tokenizer metadata.
- Per-link `sourceUrl`, `fetchUrl`, `finalUrl` when available, fetch status, change status, token count, tokenizer metadata, SHA-256 content hash, byte count, character count, `lastRefreshAt`, `lastSuccessfulRefreshAt`, previous hash/token count when available, and failure reason when applicable.

## Rationale

- `--refresh` makes comparison and sidecar behavior intentional while keeping existing `links` usage stable.
- A JSON sidecar keeps machine-readable refresh state separate from the combined markdown artifact that users may paste into tools, diff, or archive.
- Hashing the normalized markdown body after the existing fetch and conversion pipeline measures the content users actually receive rather than provider-specific transport details.
- Comparing both content hash and token count catches same-size text edits and tokenization-relevant edits.
- Persisting tokenizer metadata makes token totals auditable and avoids presenting them as exact counts for every downstream provider or model.
- Direct URL and input file modes let users capture ad hoc docs without expanding the curated registry for one-off sources.
- First-class `models` sections make `bun autoshow links models` useful and keep model pages from being duplicated across modality sections.

## Consequences

Positive outcomes:

- Users can tell whether refreshed documentation sources are new, unchanged, changed, or failed without manually diffing the combined markdown artifact.
- Token totals make documentation bundles easier to size before using them as model context.
- Failed refreshes preserve previous successful hash, token count, and successful refresh timestamp when available.
- `links models` and provider-scoped `models` selections work across the curated registry.
- Direct URL and input file modes make ad hoc documentation snapshots possible with the same local fetch pipeline.

Negative outcomes:

- Refresh runs can be slower because curated `bun autoshow links --refresh` fetches the full selected registry.
- The CLI gains another command-specific flag and a metadata schema that must remain backward-compatible.
- `tiktoken` adds runtime dependency surface and versioning responsibility.
- Sidecar files add another artifact that docs and cleanup workflows need to account for.
- The provider link registry and selector fixture tests have broader churn when model docs move between categories.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Explicit source freshness and change status | Additional JSON artifact per refreshed markdown file |
| Stable default `links` behavior | Users must opt in with `--refresh` |
| Per-link token audit data | Reference-tokenizer estimates are not exact for every provider/model |
| Reuse of existing fetch and conversion behavior | Refresh duration remains tied to selected link count |
| Direct and file-driven ad hoc capture | More selection-mode validation paths |
| Complete `models` selector coverage | Registry and fixture updates across many providers |

## Risks and Open Questions

- Refresh can be slow for `bun autoshow links --refresh` because it fetches the full curated registry.
- Token counts are reference estimates, not exact billable counts for every provider or model.
- Future schema changes need compatibility rules so existing sidecars do not become unusable.
- Open question for a future ADR or follow-up: whether to add `--refresh-only` to update metadata without rewriting the combined markdown.

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Decide whether to add `--refresh-only` for metadata-only updates | Links maintainers | Deferred to a future ADR |

## Test Plan

Verification completed with local/no-cost tests only:

- `bun run check`
- `bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/links-refresh-metadata.test.ts`
- `bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/links-input-modes.test.ts`
- `bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/links-fetching-retry.test.ts`
- `bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/provider-selector-groups/ test/test-cases/validation/content-output/metadata-links-lyrics-contracts/selector-validation.test.ts`
- `bun test test/test-cases/validation/cli/cli-help-contracts.test.ts`
- `bun test test/test-cases/validation/cli/cli-usage-errors.test.ts`
- `bun test test/test-cases/validation/cli/option-resolution-contracts/`
- `bun test test/test-cases/validation/cli/native-cli-parser-contracts.test.ts`

The refresh metadata tests cover first refresh, unchanged second refresh, token-count change, same-token hash change, failed fetch preserving previous successful metadata, direct URL mode, input file mode, and deduped curated links. No paid-provider, smoke, or e2e tests were run.

## References

- `docs/commands/setup-and-utilities/links/links.md`
- `src/cli/commands/setup-and-utilities/links/define-links-command.ts`
- `src/cli/commands/setup-and-utilities/links/model-links/`
- `src/utils/reference-tokenizer.ts`
- `package.json`
- `bun.lock`
- `test/test-cases/validation/cli/cli-help-contracts.test.ts`
- `test/test-cases/validation/cli/cli-usage-errors.test.ts`
- `test/test-cases/validation/cli/native-cli-parser-contracts.test.ts`
- `test/test-cases/validation/content-output/metadata-links-lyrics-contracts/links-refresh-metadata.test.ts`
- `test/test-cases/validation/content-output/metadata-links-lyrics-contracts/links-input-modes.test.ts`
- `test/test-cases/validation/content-output/metadata-links-lyrics-contracts/links-fetching-retry.test.ts`
- `test/test-cases/validation/content-output/metadata-links-lyrics-contracts/provider-selector-groups/`
- `test/test-cases/validation/content-output/metadata-links-lyrics-contracts/selector-validation.test.ts`
