# ADR-011: Add Refresh Metadata to Links

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-14
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed

## Context

`links` is AutoShow's local documentation bundle command. It fetches curated provider documentation URLs, direct remote URLs, or input-file URL lists, converts HTML pages to Markdown as needed, and writes a combined Markdown artifact under `project/links/`.

The generated Markdown records no freshness metadata: when each source was fetched, whether content changed since prior runs, payload sizes, or reference token estimates. Provider manifests also mixed model-reference URLs into general or modality sections, leaving `links models` incomplete and permitting URLs to repeat across categories.

Why now: `links` is used as a repeatable documentation snapshot mechanism, requiring explicit refresh metadata and a clean model-documentation selection surface.

## Options Considered

**Option 1 (selected)**

- **Option:** Add opt-in `--refresh` / `--refresh-only` flags with a JSON sidecar, and promote model-reference URLs into first-class `Models` sections
- **Pros:** Makes refresh behavior explicit; preserves default markdown-only output; gives `models` a first-class global section; prevents duplicate URLs across manifest categories
- **Cons:** Adds command flags, a metadata schema, a sidecar artifact, and a reference tokenizer
- **Quantitative Notes:** 2 boolean flags, 1 JSON sidecar per refresh run, `Models` sections across 24 of the 43 curated providers

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

Add `--refresh` as an explicit boolean flag for `links`. When present, `links` fetches every unique selected link, records per-resource reference token counts and SHA-256 hashes of the normalized markdown bodies, compares the current refresh against prior metadata, and writes a JSON sidecar next to the generated markdown. `--refresh-only` implies `--refresh` but leaves an existing markdown bundle in place, updating sidecar metadata only.

Promote model-reference URLs into `Models` sections across curated provider manifests so `links models` and provider-scoped `models` selections work consistently.

This applies to:

- Curated `links` selections, including global sections, provider selectors, mixed selections, and deduplicated overlapping URLs.
- Direct URL mode and input file mode.
- Combined markdown under `project/links/` and refresh sidecars named from that artifact, for example `project/links/<selection>-links.refresh.json`.
- Provider manifest organization for first-class `models` coverage.

It does not apply to:

- Changing normal `links` behavior when `--refresh` is omitted.
- Paid or quota-limited provider APIs.
- Replacing the default fetch and Markdown conversion pipelines.

## Rationale

- Opt-in flags keep existing `links` usage stable while making comparison and sidecar writes intentional.
- A JSON sidecar keeps machine-readable refresh state separate from the combined markdown that users paste, diff, or archive.
- Hashing the normalized markdown body measures the content users actually receive, rather than transport-level HTTP details.
- Comparing both content hash and token count catches same-size text edits and tokenization-relevant edits.
- Tokenizer metadata makes token totals auditable and presents them as reference estimates, not exact billable counts.
- First-class `models` sections make `bun autoshow links models` complete and keep model pages from being duplicated across modality sections.

## Consequences

Positive outcomes:

- Users can tell whether refreshed documentation sources are new, unchanged, changed, or failed without manually diffing the combined markdown.
- Token totals make documentation bundles easier to size before using them as model context.
- Failed refreshes preserve previous successful hash, token count, and successful refresh timestamp when available.
- `links models` and provider-scoped `models` selections work across the curated registry.

Negative outcomes:

- Refresh runs can be slow because curated `bun autoshow links --refresh` fetches the full selected registry.
- The CLI gains command-specific flags and a metadata schema that must stay backward-compatible as it evolves.
- Token counts are reference estimates rather than exact billable counts for any specific provider or model.
- Sidecar files add another artifact that docs and cleanup workflows need to account for.

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

## Implementation Note

`--refresh` and `--refresh-only` are implemented in `src/cli/commands/setup-and-utilities/links/define-links-command.ts`. Reference token counts use the in-repository `o200k_base` tokenizer in `src/utils/reference-tokenizer.ts`. Curated `Models` sections live in `src/cli/commands/setup-and-utilities/links/model-links/`. User-facing behavior is documented in `docs/commands/setup-and-utilities/links/links.md`.

## API / Type Impact

- `links` accepts `--refresh` and `--refresh-only` as command-specific boolean flags.
- Sidecar path is derived from the markdown output by replacing a `.md`, `.markdown`, or `.txt` extension with `.refresh.json`, or appending `.refresh.json` when the output path has no such extension.
- Provider manifests expose `models` as a global section and as a provider-scoped section wherever model-reference URLs exist.
- The refresh sidecar (`schemaVersion: 1`) records selection details, `refreshedAt`, `markdownWritten`, `o200k_base` tokenizer identity, aggregate success/change/failure/token/byte/character counts, and per-link fetch status, change status (`new`, `unchanged`, `changed`, or `failed`), hash, token count, timestamps, previous successful values, and failure reason.
- Under `--refresh-only`, `markdownWritten` is `false` when a bundle already exists and the command warns if remote content has drifted from it; when no bundle exists yet, the markdown is written and `markdownWritten` is `true`.

## Test Plan

Run default verification (`bun run check`) and local, no-cost contract validation suites (with no paid or quota-limited provider calls):

```bash
bun run check
bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/links-refresh-metadata.test.ts
bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/links-input-modes.test.ts
bun test test/test-cases/validation/runtime-contracts/reference-tokenizer-contracts.test.ts
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts test/test-cases/validation/cli/cli-usage-errors/ test/test-cases/validation/cli/native-cli-parser-contracts.test.ts
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

1. First refresh, unchanged second refresh, hash-only and token-count changes, `--refresh-only` preserving an existing bundle, and failed fetch preserving previous successful metadata.
2. Direct URL mode, input file mode, and URL deduplication.
3. Help, usage errors, and option resolution for `--refresh` and `--refresh-only`.

Do not run paid-provider, smoke, e2e, or full-suite tests for this ADR.

## References

- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md)
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- Related ADR: [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md)
- `docs/commands/setup-and-utilities/links/links.md`
- `src/cli/commands/setup-and-utilities/links/define-links-command.ts`
- `src/cli/commands/setup-and-utilities/links/model-links/`
- `src/types/cli-surface/define-links-command-types.ts`
- `src/utils/reference-tokenizer.ts`
