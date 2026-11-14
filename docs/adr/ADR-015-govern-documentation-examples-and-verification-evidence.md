# ADR-015: Documentation and Verification Evidence

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-13
- **Date Updated:** 2026-11-14
- **Verification Status:** Passed

## Context

Maintained CLI examples must stay valid without executing paid or stateful commands. Provider evidence requires documented identity, meaningful local tests, cost authorization, and validated artifacts rather than transport success alone.

## Decision

Validate concrete `bun autoshow` and `bun as` examples in `README.md`, `docs/docker.md`, and Markdown recursively under `docs/commands/`. `bun run check:docs` checks registered commands/flags and explicit provider-model selectors, handling fences, inline commands, and shell continuations. It excludes templates, shell expressions, external-tool commands, and historical/internal documents, including ADRs and benchmark reports. It neither executes examples nor proves input existence or runtime success.

### Evidence lifecycle

1. Establish dated identity, capabilities, limits, and prices from primary sources using [refreshed links](ADR-011-links-selection-grammar-and-refresh-metadata.md). Moving aliases and secondary catalogs do not override primary evidence.
2. Update [registry contracts](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) and command guides; verify with static checks and targeted no-network behavioral tests.
3. Preflight the exact intended command with `--price` or `resume --price`, without provider calls or manifest/artifact mutation.
4. When live evidence is necessary, estimate the complete related batch, including minimum billing, add-ons, and billable retries. Under [repository spending rules](../../AGENTS.md), a known total below $1 USD is automatically authorized for the requested task. An unknown total or a total of $1 or more requires explicit approval naming commands and cost/risk. Track related commands and reruns cumulatively; never split batches to reset the threshold.
5. Validate provider/model identity, source coverage, page/duration counts, attempts, usage/cost, artifact integrity, and uniqueness. Successful responses do not excuse contradictory checkpoints, paths, checksums, or normalized results. Transport, decoded integrity, spoken/text correctness, and perceptual quality are distinct evidence claims.
6. Compact only trustworthy results, preserving canonical records, historical identities, receipts, and reusable purchased outputs. Remove only regenerable material, then regenerate benchmark reports/dashboard. Interrupted or failed TTS outputs and working directories retain paid audio for recovery.

Published billing outranks estimates; recorded charges outrank reconstructed rates. [Benchmark documentation](../benchmarks/README.md) owns combined-report formats and rankings, while [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) owns individual manifests and dry-run planning.

## Trade-offs

Parsing maintained examples avoids execution risk and generated inventories but leaves historical examples, input existence, and behavior to separate checks. One evidence lifecycle adds estimation and validation work while preventing unsupported quality claims and duplicate purchases.

## Verification

```bash
bun run check:docs
```

The documentation contract tests valid/invalid syntax, selectors, continuations, aliases, and shell/template exclusions without dispatch. Provider changes additionally require their own targeted behavioral contracts and exact price preflight.

## References

- `test/test-cases/validation/cli/documentation-examples.test.ts`
- [Command guides](../commands/)
- [Benchmark conventions](../benchmarks/README.md)
