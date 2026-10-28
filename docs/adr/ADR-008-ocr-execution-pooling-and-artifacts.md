# ADR-008: OCR Execution, Pooling, and Artifacts

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-11
- **Date Updated:** 2026-10-28
- **Verification Status:** Passed
- **Supersession:** Absorbs the OCR execution, token-priced estimate, batch-diagnostic, chapter-filename, and Bun 1.4 image-routing authority of "Extract Execution and Artifact Contracts", all of "Distribute OCR Pages Across a Multi-Provider Work Pool", and the pooled OCR page-state detail formerly recorded in "Define Pipeline State, Resume, and Dry-Run Planning". URL execution moved to [ADR-001](ADR-001-source-ingestion-and-normalization.md) and STT execution to [ADR-009](ADR-009-stt-timing-captions-and-alignment.md). This record is the accepted authority for Step 2 OCR execution, fan-out and pooled provider modes, and the public OCR and chapter artifacts.

## Context

Step 2 OCR runs after [ADR-001](ADR-001-source-ingestion-and-normalization.md) has classified and normalized a source and [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) has supplied the work plan. OCR chooses the local engine, classifies hosted failures, sizes page concurrency, estimates cost, and names the files a multi-provider run writes. Canonical progress stays in the ADR-002 manifest; raw responses and derived files are not resume authority. Token-priced estimates were drifting from billed usage, and a repeated deterministic blocker was visible only on the item that hit it.

Chapter paths disagreed across producers: EPUB export used reading order, such as `chapters/01-title.txt`, while PDF chapter detection used the source page, such as `chapters/011-title.txt`.

Multi-provider OCR defaults to full-document fan-out, where every selected target processes the whole document. That is useful for comparison, but it charges every target for every page and stops faster healthy targets from absorbing work from slower ones. A pooled mode has to reuse page preparation, admission, failure handling, resume, and pricing, must not add a second state file, and must keep only one accepted result per page even when a request is retried.

Why now: hosted OCR estimates, incompatible chapter paths, and the need for independent OCR lanes to collaborate on one document required one execution and artifact contract with fan-out as the default comparison contract.

## Options Considered

### Local OCR engine

**Option 1 (selected)**

- **Option:** Tesseract as the only local OCR engine
- **Pros:** Best performance-to-complexity ratio in the original local comparison; smallest provisioning surface
- **Cons:** No local fallback for difficult inputs
- **Quantitative Notes:** 1 engine

**Option 2**

- **Option:** Keep OCRmyPDF and PaddleOCR alongside Tesseract
- **Pros:** Local engine diversity for hard inputs
- **Cons:** Duplicate provisioning and slower defaults without a better default
- **Quantitative Notes:** Rejected

### Token-priced OCR estimates

**Option 1 (selected)**

- **Option:** Evidence-gated token estimates with unchanged published rates
- **Pros:** Preserves published rate and tier semantics; makes the wrong component visible
- **Cons:** Requires ongoing evidence collection
- **Quantitative Notes:** Promotion needs at least 3 matching healthy samples

**Option 2**

- **Option:** Apply a cost multiplier until the total estimate matches a benchmark
- **Pros:** Small metadata change
- **Cons:** Hides which token component is wrong and distorts tier selection
- **Quantitative Notes:** Rejected

**Option 3**

- **Option:** Replace registry values from one paid run
- **Pros:** Fast calibration
- **Cons:** Overfits document mode, page band, reasoning policy, and provider variance
- **Quantitative Notes:** Rejected; one run is not a promotion sample

### Batch diagnostics

**Option 1 (selected)**

- **Option:** Derive batch diagnostics from the final canonical manifest
- **Pros:** Deterministic rollup of repeated blockers and cost gaps; no second source of authority
- **Cons:** Another regenerable artifact
- **Quantitative Notes:** Emitted only for an actionable batch

**Option 2**

- **Option:** Add blocker and cost aggregates as mutable top-level manifest state
- **Pros:** Easy to find
- **Cons:** Duplicates provider authority and can drift during partial writes or resume
- **Quantitative Notes:** Rejected

### Chapter filenames

**Option 1 (selected)**

- **Option:** Ordinal-first plus source-locator chapter names: `NN-PPP-title` / `NN-III-title`
- **Pros:** Sorts every chapter producer by reading order and keeps source traceability
- **Cons:** Changes public artifact paths
- **Quantitative Notes:** 2 chapter producers

**Option 2**

- **Option:** Keep source-page-first PDF names beside EPUB `NN-title`
- **Pros:** Avoids path churn
- **Cons:** Inconsistent first-token meaning and sorting
- **Quantitative Notes:** n/a

### Pooled execution

**Option 1 (selected)**

- **Option:** Add an explicit shared page pool while retaining full-document fan-out as the default
- **Pros:** Backward compatible; faster targets process more work; one composite result with page-level resume and usage attribution
- **Cons:** Page-level run state and per-attempt artifacts
- **Quantitative Notes:** Three independent hosted lanes at `--step-concurrency ocr-page=10` allow up to 30 remote page requests; same-account targets share one cap of 10

**Option 2**

- **Option:** Replace fan-out with pooled execution whenever multiple targets are selected
- **Pros:** Simpler public interface
- **Cons:** Breaks provider-comparison artifacts, pricing, resume, and `--primary-ocr`
- **Quantitative Notes:** Changes every existing multi-provider run

**Option 3**

- **Option:** Divide pages into static target ranges
- **Pros:** Deterministic planning
- **Cons:** Slow or failed targets stall completion
- **Quantitative Notes:** n/a

**Option 4**

- **Option:** Race every page across every target and accept the first response
- **Pros:** Lowest latency per page
- **Cons:** Multiplies cost and duplicate work
- **Quantitative Notes:** Up to `pages × targets` requests

**Option 5**

- **Option:** Store a separate pool checkpoint beside `manifest.json`
- **Pros:** Isolates pool scheduling from the canonical manifest
- **Cons:** A second completion and resume authority, forbidden by [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- **Quantitative Notes:** Rejected

## Decision

OCR offers full-document comparison or a shared page pool through `--ocr-provider-mode fanout|pool`, defaulting to `fanout`. Pool mode produces one composite extraction; canonical progress and resume eligibility for both modes stay in the [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) manifest.

This applies to:

- OCR execution and Step 2 artifacts for ebook, image, PDF, and office/native inputs, on fresh `extract` runs, resume, and side-effect-free `--price` planning.
- Both provider modes, including the pooled page ledger and what resume reads from it, for PDF, CBZ, and image inputs that can be split into independent pages.
- Native EPUB and ebook chapter files, PDF chapter-detection files, and split parts produced by `--length <n>`. A rerun recreates files under the current names.

It does not apply to:

- Source identity, classification, and normalization ([ADR-001](ADR-001-source-ingestion-and-normalization.md)).
- Canonical pipeline state, resume authority, and price dry runs in general ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).
- Local OCR toolchain provisioning ([ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md)).
- Shared hosted admission, ramps, and provider/account lane policy ([ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md)). Pool mode uses those lanes as they exist.
- Hosted model identity, lifecycle, reasoning, and pricing provenance ([ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)).
- STT execution, timing, captions, and alignment ([ADR-009](ADR-009-stt-timing-captions-and-alignment.md)).

### OCR execution

`extract --provider` and `resume` use the same route-qualified OCR names, and a stored OCR run cannot resume as STT. Tesseract is the only local OCR engine.

A hosted failure carries retryability and redacted diagnostics. Automatic resume skips a deterministic provider blocker such as quota, billing, account, or policy; naming that provider again on resume includes the blocked target after repair or an explicit retry.

Hosted page work uses the [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md) provider and account lanes. Omitting `--step-concurrency ocr-page` selects adaptive `auto` sizing from document size, capped at `32` unless a qualified throughput profile raises it, up to `48`. An explicit `--step-concurrency ocr-page=<n>` sets the scheduling and estimate ceiling ([ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md) owns the spelling). `--concurrency-mode ramp|immediate` controls hosted startup. Local Tesseract, page rendering, and normalization start immediately.

Token-priced OCR keeps published rates separate from estimated usage, including thought tokens when the provider bills them. Registry token estimates are promoted only from at least three healthy samples matched on provider, model, OCR mode, page-count band, and reasoning policy that agree in direction and show median error above 20%. Failed or partial work is excluded, and pool and fan-out evidence are not interchangeable.

`ocr-batch-diagnostics.json` is written only when a deterministic blocker affects multiple items, partial provider usage exists, actual cost is missing for attempted hosted work, or absolute estimate error exceeds 20%. It is a sanitized, regenerable projection of the final manifest, never resume authority, and a clean rerun removes a stale file.

### Fan-out and pool

In `fanout`, the default, every selected target receives the full document. A single target writes the top-level extraction without a `providers/` directory. With multiple targets, complete independent results go under their provider directories; top-level extraction is written only when `--primary-ocr` selects one of them.

In `pool`, the run writes one top-level composite extraction assembled from accepted pages in original page order. `--primary-ocr` is rejected before credential lookup or dispatch because no complete per-provider result exists. Provider directories hold per-attempt results, raw responses, errors, and usage under `providers/<target>/attempts/`; they are not complete extractions and cannot be resumed on their own. Accepted pages retain provider and cost attribution; failed or ambiguous attempts retain reported paid usage without becoming accepted output.

Pages are queued in source order and at most one target works on a pending page at a time, so faster targets process more pages. `--provider-concurrency` and `--local-concurrency` bound how many targets are admitted, each admitted target requests pages up to its OCR cap, independent provider/account lanes run concurrently, and targets that share a lane share that lane's cap.

A transient page failure returns the page for another eligible target. A target-specific blocker retires only that target; a provider/account blocker retires the lane. Each target gets one attempt per page unless resume explicitly re-enables it; interrupted in-flight work remains unfinished and eligible for retry. The composite is complete only when every required page is accepted.

Page progress and attempts live in `manifest.json`. Resume preserves the stored mode, continues only unfinished pages, and never re-executes accepted pages. An explicit `--ocr-provider-mode` mismatch is rejected. Explicitly selecting a previously blocked target re-enables it without invalidating accepted pages.

`--price` allocates the page set once across available lane capacity instead of charging every selected target for the full document. `resume --price` applies that allocation to unfinished pages only, with no state mutation, artifact write, or provider call. Actual cost includes every attempt that reports usage, including failed or ambiguous executions.

### Chapter artifact filenames

Every direct chapter producer writes `chapters/<ordinal>-<source-locator>-<slug>.txt`. PDF uses the starting source page; EPUB uses the original spine section index when available, otherwise the logical section index. Ordinal and split-part fields use two digits below 100 generated files and three digits at 100 or more. A source locator is padded to at least three digits and never truncated. A split file appends `-part-NN` to the same base.

## Rationale

- Tesseract gave the best performance-to-complexity ratio in local testing and avoids a second engine to provision.
- Retry-aware blockers stop automatic resume from repeating quota, billing, account, and policy failures.
- Adaptive caps raise large-document throughput while an explicit ceiling and the shared lanes still bind the run.
- Separating token estimates from published rates preserves pricing-tier meaning, and a derived batch report shows repeated blockers and cost gaps without duplicating canonical state.
- Dynamic page assignment lets fast, healthy targets absorb work, lane sharing keeps account rate limits, and page state in `manifest.json` gives resume and pricing one authority.
- Separate fan-out and pool artifacts keep a per-provider comparison result from being read as the composite, and an ordinal-first chapter name sorts by reading order while keeping the source position.

## Consequences

Positive outcomes:

- Hosted OCR keeps useful partial results, tells the operator what resume can safely retry, and skips a known deterministic failure.
- A clean large run can use available throughput, and an actionable batch writes one sanitized diagnostic while a clean batch stays quiet.
- Pool targets collaborate on one extraction, accepted pages survive worker or lane failures, and resume prices only remaining work.
- Default fan-out workflows and provider-comparison artifacts remain unchanged, and EPUB and PDF chapters share one path shape.

Negative outcomes:

- Difficult inputs have no local OCR engine other than Tesseract.
- A calibrated profile can go stale when provider routing, limits, models, account tiers, or reasoning defaults change.
- Pool mode writes no complete extraction per provider, grows the manifest with page count, may run a page more than once under network ambiguity, and is rejected for inputs that cannot be split into discrete pages.
- Price preflights cannot predict live throughput or rebalancing.

## Trade-offs

**Trade-off 1**

- **Gain:** One local engine and a smaller dependency surface
- **Sacrifice:** Local engine diversity

**Trade-off 2**

- **Gain:** `auto` page sizing can use available throughput
- **Sacrifice:** Adaptive caps depend on profile quality and can fall back conservatively

**Trade-off 3**

- **Gain:** Comparison artifacts in fan-out and one composite in pool
- **Sacrifice:** Two public execution modes and artifact shapes, with no standalone per-provider output in pool mode

**Trade-off 4**

- **Gain:** Attempt-level cost and failure attribution recovered from the same `manifest.json` other commands use
- **Sacrifice:** More provider records and larger manifests on long documents

## Implementation Note

`extract` implements the two modes in `src/cli/commands/text/ocr/ocr-multi-provider-batch.ts` and `src/cli/commands/text/ocr/ocr-pooled-batch.ts`. The command guides under References document flags, artifacts, and examples.

### Bun 1.4 Image Routing

TIFF routing stays on the direct-provider or ImageMagick path rather than Bun.Image, preserving cross-platform behavior. Linux and the Docker image require ImageMagick for TIFF normalization.

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/text/ocr/chapter-artifact-filenames.test.ts
bun test test/test-cases/validation/text/ocr/ocr-batch-diagnostics.test.ts
bun test test/test-cases/validation/text/ocr/ocr-page-pool-state-contracts.test.ts test/test-cases/validation/text/ocr/ocr-page-pool-scheduling-contracts.test.ts test/test-cases/validation/text/ocr/ocr-page-pool-resume-contracts.test.ts test/test-cases/validation/text/ocr/ocr-page-pool-artifact-price-contracts.test.ts
bun test test/test-cases/validation/text/ocr/ocr-resume-provider-state-contracts.test.ts
```

1. The default checks validate repository, types, documentation, and price planning without provider calls.
2. Chapter filename contracts cover source-locator padding, ordinal-first paths, and collision handling.
3. Batch diagnostic contracts cover actionable triggers and derivation from the canonical manifest.
4. Mocked pool contracts cover one accepted result per page, failure handoffs, `--primary-ocr` rejection, unfinished-page resume, and price planning.
5. Resume selection contracts cover deterministic blockers and explicit retries.

## References

- Related ADR: [ADR-001](ADR-001-source-ingestion-and-normalization.md) — source classification, normalization, and URL routes
- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — canonical pipeline manifest, resume, and unfinished-page price planning
- Related ADR: [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md) — Tesseract and document toolchain provisioning
- Related ADR: [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md) — shared queue, work selection, target admission, and lane policy
- Related ADR: [ADR-009](ADR-009-stt-timing-captions-and-alignment.md) — STT execution and artifacts
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — model identity, lifecycle, capabilities, reasoning, and pricing provenance
- Related ADR: [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md) — paid-approval and calibration evidence lifecycle
- Related ADR: [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md) — `--step-concurrency ocr-page` and retired flag spellings
- Extract command guide: [`docs/commands/02-extract/overview.md`](../commands/02-extract/overview.md)
- OCR command guide: [`docs/commands/02-extract/ocr/overview.md`](../commands/02-extract/ocr/overview.md)
- Resume command guide: [`docs/commands/00-setup-and-utilities/resume.md`](../commands/00-setup-and-utilities/resume.md)
