# ADR-015: Distribute OCR Pages Across a Multi-Provider Work Pool

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-13
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed

## Context

By default, multi-provider OCR runs as full-document fan-out: every selected provider or model processes the complete document and writes its own result. That remains useful for comparison, but it charges every target for every page and prevents faster healthy targets from absorbing work from slower ones.

Pooled execution must reuse existing page preparation, admission, failure handling, resume, and pricing. It must not add a second checkpoint file, and it must not change the default fan-out contract. A provider request can fail after work has already started, so a page may be retried, but only one accepted result may be kept.

Why now: users need multiple independent OCR lanes to collaborate on one document without paying every selected target for the full page set, while keeping fan-out as the default comparison contract.

## Options Considered

**Option 1 (selected)**

- **Option:** Add an explicit shared page pool while retaining full-document fan-out as the default
- **Pros:** Backward compatible; faster targets process more work; single composite result; account lanes retain concurrency limits; page-level resume and usage attribution
- **Cons:** Adds page-level run state, per-attempt artifacts, and extra resume bookkeeping
- **Quantitative Notes:** With three independent hosted lanes and `--ocr-concurrency 10`, up to 30 remote page requests may run; same-account targets share one cap of 10

**Option 2**

- **Option:** Replace fan-out with pooled execution whenever multiple targets are selected
- **Pros:** Simple public interface; avoids duplicate document processing by default
- **Cons:** Breaks provider-comparison artifacts, pricing, resume, and top-level primary-result behavior
- **Quantitative Notes:** Changes every existing multi-provider run

**Option 3**

- **Option:** Divide pages into static target ranges
- **Pros:** Deterministic planning and attribution
- **Cons:** Slow or failed targets stall completion; cannot rebalance work dynamically
- **Quantitative Notes:** Each target receives approximately `pages / targets` regardless of throughput

**Option 4**

- **Option:** Race every page across every target and accept the first response
- **Pros:** Lowest latency per page; automatic failover
- **Cons:** Multiplies cost, remote load, and duplicate work; wastes valid responses
- **Quantitative Notes:** Up to `pages × targets` requests

**Option 5**

- **Option:** Store a separate pool checkpoint beside `manifest.json`
- **Pros:** Isolates pool scheduling from the canonical manifest
- **Cons:** Introduces a second completion and resume authority, forbidden by [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- **Quantitative Notes:** Two persistence authorities per run

## Decision

Add `--ocr-provider-mode fanout|pool`, defaulting to `fanout`. In `pool` mode, every eligible selected OCR target draws independent pages from a shared queue and the run produces one composite extraction. `--primary-ocr` is rejected because no complete per-provider result is generated.

This applies to:

- Supported PDF, CBZ, and image inputs that can be normalized locally into independent page work units.
- Fresh `extract` and document `write` runs, configuration of those commands, resume, and side-effect-free `--price` planning.
- Hosted and local OCR targets admitted by `--provider-concurrency` / `--local-concurrency` and provider/account lane identities.
- Default fan-out: omitting the flag or passing `fanout` keeps existing full-document provider paths, pricing, resume, and optional `--primary-ocr` unchanged.

It does not apply to:

- Source classification or normalization ([ADR-001](ADR-001-source-ingestion-and-normalization.md)).
- Changing hosted admission, ramp, or provider/account lane policy ([ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)). Pool mode uses those lanes as they already exist.
- Changing model catalog entries or pricing provenance ([ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)).

### Work assignment

Pages are queued in source order. At most one target works on a pending page at a time, and faster targets process more pages. `--provider-concurrency` and `--local-concurrency` bound how many targets are admitted. Each admitted target requests page work up to its OCR cap. Independent provider/account lanes run concurrently; targets that share a lane share that lane's cap. Explicit `--ocr-concurrency <n>` sets a fixed ceiling; omitting it uses adaptive `auto` sizing.

### Failure, resume, and completion

A transient page failure returns the page so another eligible target can take it. A target-specific blocker retires only that target; a provider/account blocker retires the lane. Accepted pages stay accepted. Each target gets one attempt per page unless resume explicitly re-enables a failed target. Interrupted in-flight work returns as unfinished without counting as a spent attempt. A page is exhausted when every eligible target fails terminally. The composite completes when every required page is accepted, and is incomplete if any page is exhausted.

### Artifacts and pricing

Top-level extraction is assembled from accepted pages in source order. Provider directories store per-attempt results, raw responses, errors, and usage. They are not complete extractions and cannot be resumed on their own.

`--price` allocates the page set once across available lane capacity instead of charging every selected target for the full document. `resume --price` applies that allocation to unfinished pages only and does not mutate state or call providers. Actual cost includes every attempt that reports usage, including failed or ambiguous executions.

## Rationale

- Dynamic assignment lets fast, healthy targets absorb work instead of stalling behind static page ranges.
- Lane sharing keeps provider/account rate limits while independent accounts still run in parallel.
- Only one accepted result is kept per page even if a remote request is retried after an ambiguous failure.
- Page state stays in `manifest.json`, so resume and pricing have a single authority.
- Per-attempt provider directories keep billed failure usage and raw evidence without becoming a second result.
- Explicit `--ocr-provider-mode` keeps comparison-oriented fan-out as the default.

## Consequences

Positive outcomes:

- Selected targets collaborate on one extraction, so faster healthy workers process more pages.
- Independent provider lanes use their full concurrency caps; same-account models share a lane.
- Worker or lane failures do not invalidate already-accepted pages.
- Resume continues unfinished pages and keeps accepted pages.
- Price estimates reflect single-pass pooled allocation; actual costs still include billable failed attempts.
- Default fan-out workflows and provider-comparison artifacts remain unchanged.

Negative outcomes:

- Pool runs store additional page- and attempt-level state in the manifest.
- Ambiguous network failures may produce redundant remote executions before one result is kept.
- Price preflights cannot predict live throughput or rebalancing.
- Pool mode is rejected for inputs or target combinations that cannot be split into discrete pages.
- Provider attempt directories contain partial outputs and cannot be resumed as standalone extractions.

## Trade-offs

**Trade-off 1**

- **Gain:** Single composite extraction across multiple lanes
- **Sacrifice:** No complete standalone per-provider outputs in pool mode

**Trade-off 2**

- **Gain:** Dynamic throughput-sensitive page distribution
- **Sacrifice:** Additional page-level state in manifests

**Trade-off 3**

- **Gain:** One accepted result per page
- **Sacrifice:** Remote provider execution can still run more than once under network ambiguity

**Trade-off 4**

- **Gain:** Crash recovery from the same `manifest.json` used by other pipeline commands
- **Sacrifice:** Larger manifests on long documents

**Trade-off 5**

- **Gain:** Backward-compatible explicit mode
- **Sacrifice:** Two public execution modes to document and support

## Implementation Note

Pool assignment, admission, retirement, and composite assembly live under `src/cli/commands/process-steps/step-2-extract/step-2-ocr/`. Canonical `ocrPool` persistence is `src/cli/commands/process-steps/pipeline-manifest.ts`. `--ocr-provider-mode` is resolved for `extract`, `write`, `resume`, and configuration files.

Pooled price preflights are `src/cli/commands/process-steps/step-2-extract/extract-pricing/build-extract-estimates.ts`. Actual cost rollups are `src/cli/commands/pricing-orchestration/compute-actual-costs.ts`.

## API / Type Impact

- `--ocr-provider-mode fanout|pool` defaults to `fanout`.
- `--primary-ocr` with `pool` is a usage error before any provider work.
- Canonical item manifests may record `ocrProviderMode: "pool"` and an `ocrPool` page ledger.
- Composite extraction metadata records `extractionMethod: "ocr-pool"`.
- Attempt artifacts live under `providers/<target>/attempts/`.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/extract-ocr/ocr-page-pool-contracts.test.ts
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

1. Typecheck and unique source check pass.
2. One-active-page assignment, failure handoff, composite persistence, and unfinished-page `resume --price` hold, and fan-out estimates stay unchanged.
3. Option defaults and `--primary-ocr` rejection are enforced before dispatch.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — canonical pipeline manifest, resume, and unfinished-page price planning
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) — shared queue, work selection, target admission, and lane policy
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md) — OCR execution, artifacts, failures, cache identity, and diagnostics
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — model identity, lifecycle, capabilities, reasoning, and pricing provenance
- `src/cli/commands/process-steps/step-2-extract/step-2-ocr/`
- `src/cli/commands/process-steps/pipeline-manifest.ts`
- `src/cli/commands/setup-and-utilities/resume/extract/ocr-resume.ts`
- `src/cli/commands/process-steps/step-2-extract/extract-pricing/build-extract-estimates.ts`
- `src/cli/commands/pricing-orchestration/compute-actual-costs.ts`
- `test/test-cases/validation/extract-ocr/ocr-page-pool-contracts.test.ts`
