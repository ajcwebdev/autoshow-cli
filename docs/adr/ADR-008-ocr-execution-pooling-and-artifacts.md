# ADR-008: OCR Execution, Pooling, and Artifacts

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-11
- **Date Updated:** 2026-11-14
- **Verification Status:** Passed

## Context

OCR needs consistent page scheduling, cost evidence, recovery, and artifacts. Multi-provider comparison and collaboration serve different purposes and must share page preparation and canonical state without confusing their outputs.

## Decision

`extract --ocr-provider-mode fanout|pool` defaults to `fanout`. Both modes use the [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) manifest for progress and resume; raw responses and derived artifacts never replace it. Execution and resume share route-qualified OCR selectors, and OCR runs cannot resume as STT.

### Execution and evidence

- Tesseract is the sole local OCR engine. TIFF follows direct-provider or ImageMagick routing rather than Bun.Image; Linux requires ImageMagick for TIFF normalization.
- Hosted failures retain retryability and redacted diagnostics. Automatic resume skips deterministic quota, billing, account, or policy blockers; explicitly reselecting the repaired provider includes it again.
- Hosted pages use [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md) admission. Omitted `--step-concurrency ocr-page` selects adaptive `auto`, capped at 32 or up to 48 with a qualified throughput profile. An explicit value bounds scheduling and estimates. Local OCR, rendering, and normalization start immediately.
- Token estimates keep published prices, tiers, and billable thought tokens separate from usage heuristics. Promote components only from at least three healthy samples matched on provider, model, OCR mode, page-count band, and effective reasoning policy, agreeing in direction with median absolute percentage error above 20%. Failed, partial, retried, or text-incorrect evidence cannot qualify; pool and fan-out samples are not interchangeable.
- Emit sanitized `ocr-batch-diagnostics.json` only for a repeated deterministic blocker, partial provider usage, missing actual cost for attempted hosted work, or absolute estimate error above 20%. Derive it from the final manifest and remove stale diagnostics on clean reruns; it is never recovery state.

### Fan-out and pool

In `fanout`, each target processes the entire document. A single target writes top-level extraction; multiple targets write independent results under provider directories, with top-level output only when `--primary-ocr` selects one.

In `pool`, targets share discrete PDF, CBZ, or image pages and produce one top-level composite in source order. Reject unsplittable inputs and `--primary-ocr` before credential lookup or dispatch. Provider directories contain attempts, raw responses, errors, and usage under `providers/<target>/attempts/`, not standalone resumable extractions.

Queue pages in source order with at most one active target per pending page. Faster targets claim more work. Provider/local concurrency caps admit targets; each target uses its page cap, independent lanes run concurrently, and same-account targets share a lane cap.

Transient failures return a page to eligible targets. Target-specific blockers retire the target; provider/account blockers retire the lane. A target gets one attempt per page unless resume re-enables it. Interrupted in-flight pages remain unfinished. Accept one result per page; completion requires every required page. Preserve provider/cost attribution and reported paid usage from failed or ambiguous attempts without accepting those attempts as output.

Store page progress and attempts in `manifest.json`. Resume preserves the mode, rejects an explicit mismatch, and runs only unfinished pages. Reselecting blocked targets never invalidates accepted pages. Pool `--price` allocates the page set once across lane capacity; `resume --price` allocates only unfinished pages, without calls or writes. Actual cost includes all reported attempt usage.

### Chapter artifact filenames

Both chapter producers use `chapters/<ordinal>-<source-locator>-<slug>.txt`. PDF locators are starting source pages; EPUB locators are original spine indices when available, otherwise logical section indices. Ordinals and split-part fields use two digits below 100 generated files and three at 100 or more; source locators use at least three digits without truncation. Splits append `-part-NN`. Resolve collisions with `-02`, `-03`, etc. before the part suffix. Reruns recreate files under current names.

## Trade-offs

Fan-out preserves complete provider comparisons at multiplied cost; pooling uses healthy capacity for one composite and page-level recovery but grows attempt state and loses complete per-provider outputs. One local engine reduces provisioning at the cost of fallback diversity. Qualified adaptive profiles improve throughput while requiring maintenance; preflight cannot predict live rebalancing.

## Verification

```bash
bun test test/test-cases/validation/text/ocr/chapter-artifact-filenames.test.ts test/test-cases/validation/text/ocr/ocr-batch-diagnostics.test.ts
bun test test/test-cases/validation/text/ocr/ocr-page-pool-state-contracts.test.ts test/test-cases/validation/text/ocr/ocr-page-pool-scheduling-contracts.test.ts test/test-cases/validation/text/ocr/ocr-page-pool-resume-contracts.test.ts test/test-cases/validation/text/ocr/ocr-page-pool-artifact-price-contracts.test.ts
bun test test/test-cases/validation/text/ocr/ocr-resume-provider-state-contracts.test.ts
```

Local/mocked contracts cover names, diagnostics, unique page acceptance, failure handoffs, blockers, preserved pages, and price-only behavior. They do not establish extraction quality or live throughput.

## References

- [OCR guide](../commands/02-extract/ocr/overview.md), [resume guide](../commands/00-setup-and-utilities/resume.md)
- Modes: `src/cli/commands/text/ocr/ocr-multi-provider-batch.ts`, `src/cli/commands/text/ocr/ocr-pooled-batch.ts`; names: `src/cli/commands/text/ocr/chapter-artifact-filenames.ts`
- [ADR-001](ADR-001-source-ingestion-and-normalization.md): normalized inputs; [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md): registry/pricing; [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md): evidence and paid approval
