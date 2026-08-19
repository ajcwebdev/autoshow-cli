# ADR-011: Add Refresh Metadata to Links

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-14
- **Date Updated:** 2026-08-13
- **Verification Status:** Passed

## Context

`links` is AutoShow's local documentation bundle command. It fetches curated provider documentation URLs, direct remote URLs, or input-file URL lists, converts HTML pages to Markdown as needed, and writes a combined Markdown artifact under `project/links/`.

However, the generated Markdown records no freshness metadata: when each source was fetched, whether content changed since prior runs, payload sizes, or reference token estimates. In addition, provider manifests mixed model-reference URLs into general or modality sections, leaving `links models` incomplete and permitting URLs to repeat across categories.

Why now: `links` is used as a repeatable documentation snapshot mechanism, requiring explicit refresh metadata and a clean model-documentation selection surface.

## Options Considered

**Option 1 (selected)**

- **Option:** Add opt-in refresh flags with a sidecar metadata file and align the selector registry
- **Pros:** Makes refresh behavior explicit; preserves default markdown behavior; gives `models` a first-class global section; prevents duplicate URLs across manifest categories
- **Cons:** Adds command flags, a metadata schema, a tokenizer dependency, a sidecar artifact, and broader selector tests
- **Quantitative Notes:** 2 boolean flags, 1 JSON sidecar per refresh run, 1 tokenizer utility, model sections across curated providers

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
- **Pros:** Smaller implementation; gives rough context-size estimates
- **Cons:** Does not answer whether content changed or when a link last succeeded
- **Quantitative Notes:** Omits change status, previous hash, and previous token count

## Decision

Add `--refresh` as an explicit boolean flag for `links`. When present, `links` fetches every unique selected link, computes per-resource reference token counts, computes SHA-256 hashes over normalized markdown bodies, compares the current refresh against prior metadata, and writes a JSON sidecar next to the generated markdown. `--refresh-only` implies `--refresh` but leaves an existing markdown bundle in place, updating sidecar metadata only.

Also promote model-reference URLs into `Models` sections across curated provider manifests so `links models` and provider-scoped `models` selections work consistently.

This applies to:

- Curated `links` selections, including global sections, provider selectors, mixed selections, and deduplicated overlapping URLs.
- Direct URL mode and input file mode.
- Existing markdown output path behavior under `project/links/`.
- Refresh metadata sidecars named from the generated markdown artifact, for example `project/links/<selection>-links.refresh.json`.
- Provider manifest organization for first-class `models` coverage.

It does not apply to:

- Changing normal `links` behavior when `--refresh` is omitted.
- Running paid or quota-limited provider APIs.
- Replacing default fetch and Markdown conversion pipelines.

## Rationale

- Opt-in flags make comparison and sidecar behavior intentional while keeping existing `links` usage stable.
- A JSON sidecar keeps machine-readable refresh state separate from the combined markdown artifact that users may paste into tools, diff, or archive.
- Hashing the normalized markdown body after the existing fetch and conversion pipeline measures the content users actually receive rather than provider-specific transport details.
- Comparing both content hash and token count catches same-size text edits and tokenization-relevant edits.
- Persisting tokenizer metadata makes token totals auditable and avoids presenting them as exact counts for every downstream provider or model.
- Applying refresh metadata across curated, direct URL, and input-file modes provides uniform freshness auditing for both registry and ad hoc documentation.
- First-class `models` sections make `bun autoshow links models` useful and keep model pages from being duplicated across modality sections.

## Implementation Note

- `src/cli/commands/setup-and-utilities/links/define-links-command.ts` parses `--refresh` and `--refresh-only`, supports direct URL and input file selection modes, enriches fetch results, and writes sidecars when requested.
- `src/utils/reference-tokenizer.ts` centralizes the reference tokenizer using `tiktoken` with `o200k_base`.
- `src/cli/commands/setup-and-utilities/links/model-links/*.json` provides first-class `Models` sections across curated provider manifests.
- `docs/commands/setup-and-utilities/links/links.md` documents selection modes, `models`, `--refresh`, `--refresh-only`, sidecar paths, aggregate counts, and reference tokenizer semantics.

## API / Type Impact

- `links` accepts `--refresh` and `--refresh-only` as command-specific boolean flags.
- `parseLinksArgv(argv)` returns `refresh: boolean` and `refreshOnly: boolean` alongside selection fields.
- `runLinksWithArgv(argv, { outputPath, fetchImpl })` returns `refreshMetadataPath` when refresh is requested.
- `getLinksRefreshMetadataPath(outputPath)` derives the sidecar path by replacing `.md` with `.refresh.json`.
- `ReferenceTokenizerMetadata` records tokenizer name (`o200k_base`), package name (`tiktoken`), and package version.
- Provider manifests expose `models` as a global section and provider-scoped section where model-reference URLs exist.

The refresh sidecar schema (`schemaVersion: 1`) records:

- `command`, `selectionMode`, selection details per mode, selected URLs, output path, sidecar path, `refreshedAt`, and `markdownWritten`.
- Aggregate counts for total, successful, empty, failed, new, unchanged, and changed links, plus failed refreshes, tokens, bytes, and characters.
- Tokenizer metadata.
- Per-link `sourceUrl`, `fetchUrl`, `finalUrl` when available, fetch status, change status, token count, tokenizer metadata, SHA-256 content hash, byte count, character count, `lastRefreshAt`, `lastSuccessfulRefreshAt`, previous hash and token count when available, and failure reason when applicable.

Under `--refresh-only`, `markdownWritten` is `false` and the command warns when remote content has drifted from the existing bundle.

## Consequences

Positive outcomes:

- Users can tell whether refreshed documentation sources are new, unchanged, changed, or failed without manually diffing the combined markdown artifact.
- Token totals make documentation bundles easier to size before using them as model context.
- Failed refreshes preserve previous successful hash, token count, and successful refresh timestamp when available.
- `links models` and provider-scoped `models` selections work across the curated registry.
- Documentation snapshots across all selection modes (curated, direct URL, input file) gain uniform freshness tracking.

Negative outcomes:

- Refresh runs can be slow because curated `bun autoshow links --refresh` fetches the full selected registry.
- The CLI gains command-specific flags and a metadata schema that must stay backward-compatible as it evolves.
- `tiktoken` adds runtime dependency surface and versioning responsibility, and its counts are reference estimates rather than exact billable counts for any specific provider or model.
- Sidecar files add another artifact that docs and cleanup workflows need to account for.
- The provider link registry and selector fixture tests churn more broadly when model docs move between categories.

## Trade-offs

**Trade-off 1**

- **Gain:** Explicit source freshness and change status
- **Sacrifice:** Additional JSON sidecar artifact per refreshed Markdown file

**Trade-off 2**

- **Gain:** Stable default `links` bundle output
- **Sacrifice:** Users must opt in with `--refresh` or `--refresh-only`

**Trade-off 3**

- **Gain:** Per-link reference token audit data
- **Sacrifice:** Reference tokenizer estimates are not exact billable counts for every provider/model

**Trade-off 4**

- **Gain:** Reuse of existing fetch and conversion behavior
- **Sacrifice:** Refresh duration remains tied to remote fetch latency across selected links

## Test Plan

Run default verification (`bun run check`) and local, no-cost contract validation suites (with no paid or quota-limited provider calls):

```bash
bun run check
bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/links-refresh-metadata.test.ts
bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/links-input-modes.test.ts
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts test/test-cases/validation/cli/cli-usage-errors.test.ts test/test-cases/validation/cli/native-cli-parser-contracts.test.ts
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

The refresh metadata tests cover first refresh, unchanged second refresh, token-count change, same-token hash change, `--refresh-only` preserving an existing bundle, failed fetch preserving previous successful metadata, direct URL mode, input file mode, and deduped curated links. No paid-provider, smoke, or e2e tests were run.

## References

- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md)
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- Related ADR: [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md)
- Related reports: the 2026 hosted-model refresh reports under `docs/reports/`
- `docs/commands/setup-and-utilities/links/links.md`
- `src/cli/commands/setup-and-utilities/links/define-links-command.ts`
- `src/cli/commands/setup-and-utilities/links/model-links/`
- `src/types/cli-surface/define-links-command-types.ts`
- `src/utils/reference-tokenizer.ts`
- `test/test-cases/validation/content-output/metadata-links-lyrics-contracts/links-input-modes.test.ts`
- `test/test-cases/validation/content-output/metadata-links-lyrics-contracts/links-refresh-metadata.test.ts`
- `test/test-cases/validation/cli/native-cli-parser-contracts.test.ts`
