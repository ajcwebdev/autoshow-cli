# ADR-015: Distribute OCR Pages Across a Multi-Provider Work Pool

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-13
- **Date Updated:** 2026-08-14
- **Verification Status:** Passed

## Context

Multi-provider OCR historically executed as full-document fan-out: every selected provider/model target processed the complete document independently, writing separate output under its provider directory. While useful for model comparison and redundancy, full-document fan-out charges every target for every page and prevents faster healthy targets from absorbing work from slower ones.

Document OCR provides page preparation, concurrency lanes, target admission, failure handling, manifest persistence, resume, pricing, and provider-attributed usage. Pooled execution must compose these capabilities without introducing a secondary checkpoint authority or altering existing fan-out contracts.

The critical boundary is ensuring exactly-once accepted output under at-least-once remote execution. Because remote provider requests may fail ambiguously after execution begins, claims, attempts, raw responses, and usage require distinct identities and durable attribution.

Model identity, lifecycle eligibility, capabilities, reasoning policy, and pricing provenance remain governed by [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md). Canonical persistence, resume selection, and price planning remain governed by [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md).

Why now: users need multiple independent OCR lanes to collaborate on a single document without paying every selected target to process the full page set, while preserving the default fan-out contract.

## Options Considered

**Option 1 (selected)**

- **Option:** Add an explicit shared page pool while retaining full-document fan-out as the default
- **Pros:** Backward compatible; faster targets claim more work; single composite result; account lanes retain concurrency limits; explicit page-level resume and usage attribution
- **Cons:** Requires canonical page ledger, claim lifecycle, per-attempt artifacts, and scheduler telemetry
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
- **Pros:** Isolates pool scheduling logic from canonical manifest
- **Cons:** Introduces competing completion and resume authorities forbidden by ADR-002
- **Quantitative Notes:** Two persistence authorities per run

## Decision

Add `--ocr-provider-mode fanout|pool`, defaulting to `fanout`. In `pool` mode, every eligible selected OCR target draws independent pages from a shared queue to produce a single composite extraction; `--primary-ocr` is rejected because no complete per-provider result is generated.

This applies to:

- Supported PDF, CBZ, and image inputs normalized locally into compatible independent page work units.
- Fresh `extract` and document `write` execution, canonical resume, and side-effect-free price planning.
- Hosted and local OCR targets admitted by target-pool controls and provider/account lane identities.
- Page claims, accepted outputs, attempts, failures, usage, costs, timing, artifacts, telemetry, and diagnostics.
- Fan-out preservation: absent or explicit `fanout` keeps existing full-document provider paths, provider state, pricing, resume, and optional primary-result behavior unchanged.
- Scope explicitly excluded: altering source classification or normalization under [ADR-001](ADR-001-source-ingestion-and-normalization.md), changing error taxonomies under [ADR-006](ADR-006-unify-error-handling-vocabulary.md), modifying model catalog entries recorded in the 2026 hosted-model refresh reports under `docs/reports/`, or treating benchmark reports as price or resume authorities.

### Queue, admission, and claims

The pool creates a single page ledger in source order. A pending page can have at most one active claim. Target workers claim work dynamically, allowing faster targets to process more pages without static partitioning. Page preparation is promise-cached per page for the run; retries and handoffs reuse the provider-neutral prepared page safely.

`--provider-concurrency` bounds admitted hosted targets and `--local-concurrency` bounds admitted local targets. Each admitted target requests page work up to its applicable OCR cap. Independent provider/account lanes run concurrently, while targets sharing a lane share that lane's cap. Explicit `--ocr-concurrency <n>` sets a fixed lane ceiling; omission defaults to adaptive `auto` sizing, pressure backoff, and qualified profile ceilings.

The run-scoped hosted concurrency mode operates orthogonally to pool allocation: `ramp` mode starts each provider/account lane with one slot and adds one slot every five seconds under queued demand; `immediate` mode starts at the resolved ceiling. The pool selector governs page claims, while the shared coordinator controls remote dispatch timing. Independent lanes ramp independently, same-lane targets share one ramp, local claims remain immediate, and 429 rate-limit recovery preserves accepted pages.

Every claim creates a unique attempt tracking page number, provider, concrete model, lane, requested and effective reasoning policy, start time, and an isolated artifact directory. A successful attempt commits only if its claim is active and the page has no accepted result. This compare-before-commit rule prevents duplicate canonical page commits when remote execution is ambiguous or delayed.

### Failure and completion

Transient page failures release the claim, making the page available to other eligible targets without immediate retry on the failing worker. Target-specific blockers retire only the affected target; provider/account blockers retire the entire lane. Accepted pages remain valid upon worker retirement, and unfinished pages are redistributed to healthy targets.

Ordinary execution limits each target to one attempt per page. Explicit resume re-enablement can reauthorize failed targets. Interrupted in-flight claims record `interrupted` evidence and return to unfinished work without consuming attempt eligibility. A page is exhausted when all eligible targets fail terminally. The composite result completes when all required pages are accepted, and marks incomplete if any page is exhausted.

### Artifacts, cache identity, and evidence

Top-level extraction artifacts are assembled from accepted pages in source order. Provider directories store only per-attempt results, raw responses, errors, and usage records, never serving as independent completion authorities or full extractions.

Hosted page response-cache identity incorporates provider mode, provider, concrete model, requested and effective reasoning policy, input SHA-256, normalized format, page number, and DPI. Provider-neutral page preparation remains independently reusable. Pool throughput and token telemetry are explicitly qualified by pool mode and isolated from fan-out profiles.

### Pricing and telemetry

Price preflights allocate the page set once across available lane capacity rather than charging every selected target for the full document. The deterministic heuristic weights independent lanes equally, divides shared lane capacity among co-tenant targets, and scales estimated page units, tokens, time, and cost per target. `resume --price` applies this allocation strictly to unfinished pages without mutating state or invoking providers.

Actual cost accounting records all attempts reporting usage, including failed or ambiguous executions, without treating failed work as accepted output. Scheduler telemetry logs queue depth, claim lifecycle events, retries, retirements, per-target throughput, and page distribution.

## Rationale

- Dynamic claims maximize throughput by allowing fast, healthy targets to absorb work without static range bottlenecks.
- Lane sharing maintains provider/account rate limits while enabling independent accounts or providers to scale concurrency.
- Compare-before-commit guarantees exactly-once canonical output despite at-least-once remote execution.
- Retaining the page ledger within `manifest.json` preserves ADR-002's single-authority model and ensures deterministic crash recovery.
- Isolated per-attempt directories preserve raw evidence and billable failure usage without allowing provider artifacts to govern completion.
- Explicit `--ocr-provider-mode` preserves full backward compatibility for comparison-oriented fan-out workflows.
- Model registry and reasoning validation before dispatch prevents silent behavioral drift across resume cycles.

## Consequences

Positive outcomes:

- Selected targets collaborate on a single extraction, allowing faster healthy workers to process more pages.
- Independent provider lanes utilize their full concurrency caps while same-account models safely share lane limits.
- Worker or lane failures do not invalidate already-accepted page results.
- Resuming recovers interrupted claims and preserves accepted pages via the canonical ledger.
- Price estimates reflect single-pass pooled allocation, while actual costs retain billable failed attempts.
- Default fan-out workflows and provider-comparison artifacts remain unchanged.

Negative outcomes:

- Pool manifests and diagnostics maintain additional page- and attempt-level state.
- Ambiguous network failures may produce redundant remote executions before a single result is committed.
- Heuristic price preflights cannot predict real-time throughput variances or dynamic rebalancing.
- Pool mode is rejected for input formats or target combinations that cannot be normalized into discrete page units.
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

- **Gain:** Deterministic crash recovery via canonical manifest
- **Sacrifice:** More frequent atomic manifest updates during execution

**Trade-off 5**

- **Gain:** Backward-compatible explicit mode
- **Sacrifice:** Maintained test coverage across both fanout and pool execution paths

## Implementation Note

The shared queue, claims, lane caps, retirement, handoff, exhaustion, and telemetry are implemented in `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-provider-pool.ts`. Compatible page preparation, isolated attempt execution, composite assembly, and canonical checkpoints are implemented in `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-pooled-batch.ts`. Canonical manifest persistence for Step 2 records and the `ocrPool` ledger is governed by `src/cli/commands/process-steps/pipeline-manifest.ts`.

Option resolution exposes `--ocr-provider-mode` across `extract`, `write`, `resume`, and configuration files. Resume preserves the recorded mode, admits additive or explicitly re-enabled targets following registry validation, converts interrupted claims to unfinished work, and prices only pending pages. Hosted response cache identity incorporates pool mode alongside model, format, and reasoning parameters.

Pooled price preflights and actual cost rollups are implemented in `src/cli/commands/process-steps/step-2-extract/extract-pricing/build-extract-estimates.ts` and `src/cli/commands/pricing-orchestration/compute-actual-costs.ts`. Preflights apply heuristic lane weighting, while actual usage accounts for billable failed or ambiguous attempts.

## API / Type Impact

- New CLI flag: `--ocr-provider-mode fanout|pool` (default: `fanout`).
- Specifying `--primary-ocr` alongside `pool` mode raises a structured usage validation error before credential lookup or dispatch.
- Extraction options include `ocrProviderMode`, explicit mode provenance, and original pooled page indices for provider attribution and cache keys.
- Canonical item manifests support `ocrProviderMode: "pool"` and the `ocrPool` ledger recording page, attempt, target, lane, and telemetry state.
- Composite extraction metadata records `extractionMethod: "ocr-pool"`, `ocrProviderMode: "pool"`, and per-target usage attribution.
- Attempt-specific artifacts are isolated under `providers/<target>/attempts/page-<six digits>/attempt-<three digits>/`.

## Test Plan

Validate pool scheduling, option resolution, and manifest contracts using local test suites:

```bash
bun run check
bun test test/test-cases/validation/extract-ocr/ocr-page-pool-contracts.test.ts
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

- **CLI and Option Resolution:** Verify option defaults, help text, invalid arguments, incompatible inputs, and structured error rejection when `--primary-ocr` is combined with `pool` mode.
- **Queue and Claims:** Verify dynamic work distribution, one-active-claim enforcement, hosted and local target admission, lane cap sharing, fixed versus adaptive OCR caps, and compare-before-commit deduplication.
- **Failures and Recovery:** Verify transient failure handoff, target and lane retirement, page exhaustion, interrupted-claim recovery, and explicit target re-enablement.
- **Manifest and Lineage:** Verify composite Step 2 persistence, `ocrPool` ledger round-tripping, resume continuity, attempt directory containment, and isolation from completion authority.
- **Pricing and Cache:** Verify single-pass pooled price estimates, failed-attempt actual cost accounting, cache key sensitivity to pool parameters, and fan-out estimate preservation.
- **Deterministic Verification:** Ensure all verification passes locally via `bun run check`, `bun t --price`, and mock contract suites without invoking paid network endpoints.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — Canonical pipeline manifest, atomic progress, mode-preserving resume, and unfinished-page price planning
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) — Shared queue, work selection, target admission, concurrency multiplication, and lane policy
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md) — OCR execution, attribution, artifacts, failures, cache identity, profiles, and diagnostics
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — Concrete model identity, lifecycle eligibility, capabilities, reasoning, pricing provenance, and hosted cache identity
- Pool scheduler: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-provider-pool.ts`
- Pool orchestration: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-pooled-batch.ts`
- Canonical manifest: `src/cli/commands/process-steps/pipeline-manifest.ts`
- Resume handlers: `src/cli/commands/setup-and-utilities/resume/extract/ocr-resume.ts`
- Pricing preflight: `src/cli/commands/process-steps/step-2-extract/extract-pricing/build-extract-estimates.ts`
- Actual cost computation: `src/cli/commands/pricing-orchestration/compute-actual-costs.ts`
- Pool contract tests: `test/test-cases/validation/extract-ocr/ocr-page-pool-contracts.test.ts`
