# ADR-011: Links Selection and Refresh

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-14
- **Date Updated:** 2026-11-14
- **Verification Status:** Passed

## Context

Documentation snapshots need repeatable selection, comparable content, and freshness evidence without adding metadata to ordinary Markdown bundles.

## Decision

`links` uses the shared native parser for curated sections, direct URLs, and input-file lists, deduplicating overlapping URLs. Leading positionals select global sections; positionals after `--provider <name>` belong to that provider until the next provider. Inline `provider=section` values and unknown flags fail locally. Model-reference URLs belong in `models` sections; usage guides remain in their operational sections.

Plain runs write Markdown in a timestamped directory under `output/` or `--output-root`. `--output-dir` pins either run mode. `--refresh` otherwise reuses `docs/links/<selection>-links/`, even when `--output-root` is set.

A refresh fetches every selected link, rewrites the bundle, and writes `<selection>-links.refresh.json` with converted-content hashes, estimated reference tokens, and `new`, `unchanged`, `changed`, or `failed` status. Comparison ignores line order and ISO timestamps. Failed fetches preserve previous successful comparison metadata. When the prior bundle and sidecar exist, `<selection>-links.changes.md` records diffs and added/removed links.

Findings identify failed, empty, redirected, duplicate, shrunken, or incomplete captures. They produce warnings and sidecar entries but still exit 0. Whole-provider refreshes also fetch registry pricing/catalog sources and check documented model coverage, with explicit exemptions. Scoped, URL, and file selections fetch only requested pages. Refresh never changes registry check dates, creates a pipeline manifest, or participates in `resume`.

## Trade-offs

Opt-in sidecars keep plain output simple and stable refresh directories make comparison convenient. Every refresh still incurs remote latency; successful exit means the operation completed, not that every capture is healthy. Ignoring order and timestamps reduces noise but deliberately hides those changes.

## Verification

```bash
bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/
```

Local mocked contracts cover selection/placement, deduplication, refresh comparison and findings, failed-fetch preservation, and output-directory precedence.

## References

- [Links guide](../commands/00-setup-and-utilities/links.md)
- [Evidence lifecycle](ADR-015-govern-documentation-examples-and-verification-evidence.md)
- `src/cli/commands/setup-and-utilities/links/`
