# ADR-015: Distribute OCR Pages Across a Multi-Provider Work Pool

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-13
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed

## Context

Multi-provider OCR historically executed as full-document fan-out: every selected provider or model processed the complete document independently and wrote its own result. That remains useful for comparison, but it charges every target for every page and prevents faster healthy targets from absorbing work from slower ones.

Pooled execution must reuse existing page preparation, admission, failure handling, resume, and pricing without a second checkpoint authority or a change to the default fan-out contract. The hard guarantee is exactly-once accepted page output under at-least-once remote execution: a provider request can fail after work has already started, so claims, attempts, and usage need distinct identities.

Model identity, lifecycle, capabilities, and pricing provenance remain [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md). Canonical persistence, resume, and price planning remain [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md). Shared hosted lanes remain [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md). Extract artifacts and cache identity remain [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md).

Why now: users need multiple independent OCR lanes to collaborate on one document without paying every selected target for the full page set, while keeping fan-out as the default comparison contract.

## Options Considered

**Option 1 (selected)**

- **Option:** Add an explicit shared page pool while retaining full-document fan-out as the default
- **Pros:** Backward compatible; faster targets claim more work; single composite result; account lanes retain concurrency limits; explicit page-level resume and usage attribution
- **Cons:** Requires a canonical page ledger, claim lifecycle, per-attempt artifacts, and scheduler telemetry
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
- **Cons:** Multiplies cost, remote load, and ambiguous executions; wastes valid responses
- **Quantitative Notes:** Up to `pages × targets` requests

**Option 5**

- **Option:** Store a separate pool checkpoint beside `manifest.json`
- **Pros:** Isolates pool scheduling from the canonical manifest
- **Cons:** Introduces competing completion and resume authorities forbidden by [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- **Quantitative Notes:** Two persistence authorities per run

## Decision

Add `--ocr-provider-mode fanout|pool`, defaulting to `fanout`. In `pool` mode, every eligible selected OCR target draws independent pages from a shared queue and the run produces one composite extraction. `--primary-ocr` is rejected because no complete per-provider result is generated.

This applies to:

- Supported PDF, CBZ, and image inputs that can be normalized locally into independent page work units.
- Fresh `extract` and document `write` execution, canonical resume, and side-effect-free price planning.
- Hosted and local OCR targets admitted by target-pool controls and provider/account lane identities.
- Page claims, accepted output, attempts, failures, usage, costs, artifacts, and diagnostics.
- Default fan-out: omitted or explicit `fanout` keeps existing full-document provider paths, pricing, resume, and optional `--primary-ocr` unchanged.

It does not apply to:

- Source classification or normalization ([ADR-001](ADR-001-source-ingestion-and-normalization.md)).
- Error taxonomies ([ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md)).
- Hosted-model catalog entries recorded in `docs/models/`.
- Treating benchmark reports as price or resume authorities.

### Queue and claims

The pool creates one page ledger in source order. A pending page has at most one active claim. Workers claim work dynamically, so faster targets process more pages. `--provider-concurrency` and `--local-concurrency` bound admitted targets. Each admitted target requests page work up to its OCR cap. Independent provider/account lanes run concurrently; targets that share a lane share that lane's cap. Explicit `--ocr-concurrency <n>` sets a fixed ceiling; omitting it uses adaptive `auto` sizing.

Hosted ramp versus immediate admission is the shared coordinator from [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md). The pool decides which page is claimed; the coordinator decides when a remote request may start. A successful attempt commits only if its claim is still active and the page has no accepted result.

### Failure and completion

A transient page failure releases the claim so another eligible target can take it. A target-specific blocker retires only that target; a provider/account blocker retires the lane. Accepted pages stay accepted. Each target gets one attempt per page unless resume explicitly re-enables a failed target. Interrupted in-flight claims return to unfinished work without consuming attempt eligibility. A page is exhausted when every eligible target fails terminally. The composite completes when every required page is accepted, and is incomplete if any page is exhausted.

### Artifacts and pricing

Top-level extraction is assembled from accepted pages in source order. Provider directories store per-attempt results, raw responses, errors, and usage. They are never a second complete extraction or resume authority.

Price preflights allocate the page set once across available lane capacity instead of charging every selected target for the full document. `resume --price` applies that allocation to unfinished pages only and does not mutate state or call providers. Actual cost includes every attempt that reports usage, including failed or ambiguous executions.

## Rationale

- Dynamic claims let fast, healthy targets absorb work instead of stalling behind static page ranges.
- Lane sharing keeps provider/account rate limits while independent accounts still run in parallel.
- Compare-before-commit gives exactly-once canonical output even when remote execution is at-least-once.
- Keeping the page ledger in `manifest.json` preserves [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)'s single authority.
- Per-attempt directories keep raw evidence and billable failure usage without letting provider artifacts decide completion.
- Explicit `--ocr-provider-mode` keeps comparison-oriented fan-out as the default.

## Consequences

Positive outcomes:

- Selected targets collaborate on one extraction, so faster healthy workers process more pages.
- Independent provider lanes use their full concurrency caps; same-account models share a lane.
- Worker or lane failures do not invalidate already-accepted pages.
- Resume recovers interrupted claims and keeps accepted pages in the canonical ledger.
- Price estimates reflect single-pass pooled allocation; actual costs still include billable failed attempts.
- Default fan-out workflows and provider-comparison artifacts remain unchanged.

Negative outcomes:

- Pool manifests carry additional page- and attempt-level state.
- Ambiguous network failures may produce redundant remote executions before one result commits.
- Heuristic price preflights cannot predict live throughput or rebalancing.
- Pool mode is rejected for inputs or target combinations that cannot be normalized into discrete page units.
- Provider attempt directories contain partial outputs and cannot be resumed as standalone extractions.

## Trade-offs

**Trade-off 1**

- **Gain:** Single composite extraction across multiple lanes
- **Sacrifice:** No complete standalone per-provider outputs in pool mode

**Trade-off 2**

- **Gain:** Dynamic throughput-sensitive page distribution
- **Sacrifice:** Additional scheduler, ledger, and telemetry state in manifests

**Trade-off 3**

- **Gain:** Exactly-once canonical page acceptance
- **Sacrifice:** Remote provider execution remains at-least-once under network ambiguity

**Trade-off 4**

- **Gain:** Deterministic crash recovery via the canonical manifest
- **Sacrifice:** More frequent atomic manifest updates during execution

**Trade-off 5**

- **Gain:** Backward-compatible explicit mode
- **Sacrifice:** Test coverage across both `fanout` and `pool` paths

## Implementation Note

Pool queue, claims, admission, retirement, and composite assembly live under `src/cli/commands/process-steps/step-2-extract/step-2-ocr/`. Canonical `ocrPool` ledger persistence is `src/cli/commands/process-steps/pipeline-manifest.ts`. `--ocr-provider-mode` is resolved for `extract`, `write`, `resume`, and configuration files. Resume keeps the stored mode, re-enables explicitly selected retired targets, and prices only unfinished pages.

Pooled price preflights are `src/cli/commands/process-steps/step-2-extract/extract-pricing/build-extract-estimates.ts`. Actual cost rollups are `src/cli/commands/pricing-orchestration/compute-actual-costs.ts`.

## API / Type Impact

- `--ocr-provider-mode fanout|pool` defaults to `fanout`.
- `--primary-ocr` with `pool` is a usage error before credential lookup or dispatch.
- Canonical item manifests may record `ocrProviderMode: "pool"` and an `ocrPool` page ledger.
- Composite extraction metadata records `extractionMethod: "ocr-pool"`.
- Attempt artifacts live under `providers/<target>/attempts/page-<six digits>/attempt-<three digits>/`.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/extract-ocr/ocr-page-pool-contracts.test.ts
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

These prove option defaults and `--primary-ocr` rejection, one-active-claim scheduling and handoff, composite `ocrPool` persistence, unfinished-page `resume --price`, and that fan-out estimates stay unchanged. Verification is local and no-cost.

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
