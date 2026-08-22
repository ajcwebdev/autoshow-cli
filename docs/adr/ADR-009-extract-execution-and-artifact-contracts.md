# ADR-009: Extract Execution and Artifact Contracts

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-11
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed
- **Supersession:** Absorbs OCR architecture, ordinal-first chapter filenames, and URL extraction contracts from former individual records. This record remains accepted authority for Step 2 URL, OCR, and STT execution plus public extract artifacts.

## Context

Step 2 executes extraction after [ADR-001](ADR-001-source-ingestion-and-normalization.md) has classified and normalized a source and [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) has supplied the work plan. Provider identity is shared, but URL, OCR, and STT each own their adapters, retries, response handling, and artifacts. Canonical progress belongs in [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)'s manifest; raw responses and derived files cannot become resume authority.

URL extraction mixed route identity with runtime rules. `article` and `x-space` must stay explicit extract routes: articles are resumable URL extraction, X Spaces are a separate non-resumable route, and neither is inferred from the other, the input family, or provider metadata.

OCR is the widest extract surface: local engine choice, hosted failure handling, page scheduling, cost estimation, and multi-provider execution. Fan-out gives every selected target the full document and keeps independent provider results. Pool mode shares one page queue and produces one composite result. Failure classification decides whether resume may retry a provider, scheduling changes observed throughput, and throughput feeds cost estimates.

Public chapter paths also disagreed. Native EPUB export used logical order, such as `chapters/01-title.txt`, while PDF chapter detection used the source page, such as `chapters/011-title.txt`. A shared artifact contract must sort by reading order while retaining the source locator and split-part behavior.

Why now: hosted OCR estimates were drifting against billed usage, repeated deterministic blockers were only visible per item, and chapter producers emitted incompatible public paths.

## Options Considered

### Local OCR engine

**Option 1 (selected)**

- **Option:** Tesseract as the only local OCR engine, with source grouped by input type
- **Pros:** Fastest and highest-mean engine in local comparison; smallest provisioning and maintenance surface; mirrors runtime classification
- **Cons:** No local fallback for difficult inputs
- **Quantitative Notes:** 1 engine; 4 input-type areas (ebook, image, PDF, office/native)

**Option 2**

- **Option:** Keep OCRmyPDF and PaddleOCR alongside Tesseract
- **Pros:** Local engine diversity for hard inputs
- **Cons:** Duplicate provisioning, slower defaults, ongoing dependency maintenance
- **Quantitative Notes:** Rejected; extra engines add maintenance without a better default

### Token-priced OCR estimates

**Option 1 (selected)**

- **Option:** Evidence-gated token shapes with `costMultiplier: 1`
- **Pros:** Preserves published rate and tier semantics; keeps profile estimates from being multiplied twice; makes the wrong component visible
- **Cons:** Requires an audit helper and a migration-aware profile store
- **Quantitative Notes:** Promotion needs ≥3 matching healthy samples and >20% median absolute percentage error

**Option 2**

- **Option:** Tune `costMultiplier` until total estimate matches a benchmark
- **Pros:** Small metadata change
- **Cons:** Hides which token component is wrong, distorts tier selection, and double-adjusts profile estimates
- **Quantitative Notes:** Rejected for token-priced OCR

**Option 3**

- **Option:** Replace registry values from one paid or historical run
- **Pros:** Fast calibration
- **Cons:** Overfits document mode, page band, reasoning policy, and provider variance
- **Quantitative Notes:** Rejected; one run is not a promotion sample

### Batch diagnostics

**Option 1 (selected)**

- **Option:** Derive batch diagnostics from the final canonical manifest
- **Pros:** Deterministic, sanitized rollup of repeated blockers and cost gaps; no second source of authority
- **Cons:** Another regenerable artifact schema to version
- **Quantitative Notes:** Emitted only for actionable batches

**Option 2**

- **Option:** Add blocker and cost aggregates as mutable top-level manifest state
- **Pros:** Easy for readers to find
- **Cons:** Duplicates child provider authority and can drift during partial writes or resume
- **Quantitative Notes:** Rejected; derived reports must not become resume authority

### Multi-provider OCR artifacts

**Option 1 (selected)**

- **Option:** Retain full-document fan-out by default and add an explicit composite page pool
- **Pros:** Preserves comparison artifacts; avoids charging every target for every page when pooling; supports dynamic handoff
- **Cons:** Two execution and artifact contracts must remain distinct
- **Quantitative Notes:** `fanout` default; `pool` selected by `--ocr-provider-mode pool`

**Option 2**

- **Option:** Replace fan-out whenever multiple OCR targets are selected
- **Pros:** Simpler public interface
- **Cons:** Breaks provider-comparison artifacts, pricing, resume, and `--primary-ocr`
- **Quantitative Notes:** Rejected; comparison runs remain the default

### Chapter filenames

**Option 1 (selected)**

- **Option:** Ordinal-first plus source-locator chapter names: `NN-PPP-title` / `NN-III-title`
- **Pros:** Sorts every chapter producer by reading order; preserves source traceability; one documented contract
- **Cons:** Changes public artifact paths
- **Quantitative Notes:** Applies to the 2 direct `chapters/` producers

**Option 2**

- **Option:** Keep source-page-first PDF names beside EPUB `NN-title`
- **Pros:** Avoids path churn
- **Cons:** Preserves inconsistent first-token meaning and sorting
- **Quantitative Notes:** n/a

## Decision

Step 2 execution is domain-owned above shared provider identity. URL, OCR, and STT own adapters, retries, response handling, normalized output, and artifacts. Canonical progress and resume eligibility stay in [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)'s manifest.

This applies to:

- URL, OCR, and STT execution, retries, response handling, normalized domain output, and Step 2 artifact writes.
- Native EPUB and ebook chapter files, PDF chapter-detection files, and split parts produced by `--length <n>`.
- Routes that write chapter files or extract artifacts; reruns recreate files under the current names.

It does not apply to:

- Source identity, classification, and normalization ([ADR-001](ADR-001-source-ingestion-and-normalization.md)).
- Canonical pipeline state, resume authority, and price dry runs ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).
- Local OCR toolchain provisioning ([ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md)).
- Shared hosted admission, ramps, and lane pressure ([ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)).
- Hosted model identity, lifecycle, reasoning, and pricing provenance ([ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)).
- Queue claims, handoff, and the product choice of fan-out versus pooled page execution ([ADR-015](ADR-015-distribute-ocr-pages-across-a-multi-provider-work-pool.md)).

### Extract domain ownership

Shared registries own provider identity, hosted/local grouping, shortcuts, and the canonical STT and OCR provider-target maps. Public `extract --provider` normalization and route-aware resume derive from those maps; they do not keep a second list of provider spellings.

URL execution remains under `step-2-url`. `article` is a first-class route and is never inferred from `x-space`, input family, or provider metadata. X Spaces retain their separate route and explicit non-resumable behavior. URL adapters normalize article content and write domain artifacts; provider progress is recorded only in the canonical manifest.

### OCR execution

Use Tesseract as the sole local OCR engine. Source-specific OCR follows ebook, image, PDF, and office/native inputs.

Hosted failures carry retryability, blocker classification, and redacted diagnostics. Automatic resume skips deterministic provider blockers such as quota, billing, account, and policy failures. Explicit provider resume re-includes a blocked target after repair or an explicit retry.

Hosted page work uses the shared provider/account lanes in [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md). Batch extract and write share one coordinator across documents so batch concurrency does not multiply remote admission. `--ocr-concurrency auto` sizes hosted limits from document size and qualified profiles, up to a ceiling of `48` or an explicit user cap. `--ocr-concurrency <n>` is a hard ceiling. `--concurrency-mode ramp|immediate` controls startup. Local Tesseract, page rendering, and normalization start immediately.

Token-priced OCR keeps published rates and prompt/completion shapes explicit, with `costMultiplier: 1`. Canonical usage follows each provider's billed prompt and completion components, including thought tokens when the provider bills them. Calibrate components only from healthy samples bucketed by provider, concrete model, OCR mode, page-count band, and effective reasoning policy. Promotion requires at least three matching samples, a consistent direction, and median absolute percentage error above 20%.

Profiles store privacy-preserving throughput, timing, and token evidence. Healthy full-target samples may become trusted warm starts; failed, partial, or incomplete work may not. Pool and fan-out evidence are not interchangeable.

Emit `ocr-batch-diagnostics.json` and a human summary table only when a deterministic blocker affects multiple items, partial provider usage exists, actual cost is missing for attempted hosted work, or absolute estimate error exceeds 20%. The report is sanitized, deterministically ordered, tied to the source manifest by SHA-256, regenerable after resume, and never resume authority. Clean reruns remove a stale report.

### Fan-out and pool artifacts

Retain `fanout` as the default multi-provider OCR contract. Explicit `--ocr-provider-mode fanout` is equivalent to omitting the mode flag. Each selected target receives the full document, writes a complete result under its provider directory, and may be selected by `--primary-ocr` for the top-level artifact.

With `--ocr-provider-mode pool` ([ADR-015](ADR-015-distribute-ocr-pages-across-a-multi-provider-work-pool.md)), produce one top-level composite extraction with `extractionMethod: "ocr-pool"`, assembled in original page order. Reject `--primary-ocr` before credential lookup or dispatch. Provider directories hold attributed page attempts, raw responses, errors, fragments, and usage, never a second complete extraction.

Every accepted page records provider, concrete model, requested and effective reasoning policy, attempt, usage, cost, timing, and artifact path. Failed and ambiguous attempts keep the same attribution and any reported paid usage without becoming accepted output. The extraction succeeds when every page is accepted, even if some workers failed, and is incomplete when any page exhausts all eligible targets.

Hosted response-cache identity includes provider mode, provider, concrete model, requested and effective reasoning, input SHA-256, normalized format, original page number, and DPI. Pooled page attempts must not reuse fan-out responses or responses produced under a different model, reasoning, input, or render.

Pool price mode allocates the page set once across independent lanes and labels the allocation as heuristic. Actual usage and cost include paid failed or ambiguous attempts when available.

### Chapter artifact filenames

Every direct chapter producer writes `chapters/<ordinal>-<source-locator>-<slug>.txt`. PDF uses `pdfStartPage` as the source locator. EPUB uses the first original source/spine section index when available, otherwise the logical section index.

Ordinal and split-part fields use dynamic width: two digits below 100 generated files and three digits at 100 or more. Source locators are padded to at least three digits and never truncated. Split files append `-part-NN` to the same base. Exact generated-path collisions receive deterministic disambiguation.

## Rationale

- Tesseract provided the best performance-to-complexity ratio in local testing while avoiding multi-engine dependency and maintenance costs.
- Retry-aware blockers prevent automatic resume from repeating quota, billing, account, policy, and other deterministic failures while preserving useful mixed-provider output.
- Provider/account lanes give a fair pressure boundary for multiple models sharing credentials, and adaptive caps improve large-document throughput without weakening retry backoff or explicit limits.
- Separate fan-out and pool artifacts preserve independent comparison results while allowing selected targets to collaborate on one composite extraction.
- Page-level attribution makes accepted output, remote ambiguity, worker failure, and paid usage independently auditable.
- Behavior-complete hosted cache identity prevents model, reasoning, mode, input, and DPI changes from reusing incompatible page responses.
- Privacy-preserving profiles improve future timing and token estimates without storing input or account history.
- Explicit token components preserve pricing-tier semantics and prevent profile-derived usage from being multiplied a second time.
- A derived batch report exposes repeated blockers and cost gaps without duplicating mutable provider state.
- Explicit URL routes preserve domain-specific runtime behavior without duplicating provider identity or canonical state.
- Deriving public and resume selectors from the canonical STT/OCR maps keeps a newly added extract provider selectable on both fresh execution and resume.
- Logical ordinal first makes EPUB and PDF chapter paths sort by reading order, while a real source locator preserves debugging traceability.

## Consequences

Positive outcomes:

- URL article execution has one explicit domain owner, and X Spaces cannot be conflated with it during execution or resume.
- Local OCR has one routing and execution path supplied by the toolchain that [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md) provisions.
- Hosted OCR preserves useful partial results, produces actionable resume guidance, and avoids known deterministic retry loops.
- Large clean runs can use available throughput, while pressured lanes fall back conservatively.
- Estimates and summaries explain wall time, gating targets, retry pressure, actual partial usage, and token-shape drift.
- Actionable OCR batches emit one deterministic, sanitized blocker/cost diagnostic; clean batches remain quiet.
- Pool mode can finish when healthy workers complete every page, and top-level output remains in original page order.
- Actual pooled cost includes failed and ambiguous paid attempts rather than underreporting provider spend.
- EPUB and PDF chapters share one public path shape that sorts by reading order and retains source position.

Negative outcomes:

- URL, OCR, and STT retain different execution structures even though identity and pipeline state are shared.
- There is no non-Tesseract local fallback for difficult inputs.
- Provider failure classifiers and profile schemas require maintenance as hosted APIs change.
- Clean profiles can become stale as provider routing, limits, models, account tiers, or reasoning defaults change.
- Pool mode does not provide complete per-provider outputs, and its page allocation estimates remain heuristic because runtime throughput and failures determine final shares.

## Trade-offs

**Trade-off 1**

- **Gain:** One local engine and a smaller dependency surface
- **Sacrifice:** Local engine diversity

**Trade-off 2**

- **Gain:** Deterministic blocker handling and auditable fallback
- **Sacrifice:** More provider-state metadata

**Trade-off 3**

- **Gain:** Faster bounded large-document defaults
- **Sacrifice:** More scheduler and profile logic

**Trade-off 4**

- **Gain:** Explicit evidence-gated token shapes
- **Sacrifice:** Profile lifecycle and periodic evidence review

**Trade-off 5**

- **Gain:** One derived batch diagnostic
- **Sacrifice:** Another regenerable artifact schema

**Trade-off 6**

- **Gain:** Composite multi-provider OCR with dynamic handoff
- **Sacrifice:** No complete per-provider result in pool mode

**Trade-off 7**

- **Gain:** Attempt-level cost and failure attribution
- **Sacrifice:** More provider artifact and telemetry records

## Implementation Note

- URL runtime: `src/cli/commands/process-steps/step-2-extract/step-2-url/`
- OCR stage: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/`
- Extract public and resume selector projection: `src/cli/flags/service-selector-normalization/extract-selectors.ts` and `src/cli/flags/service-selector-normalization/provider-targets.ts`
- Chapter filenames: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/chapter-artifact-filenames.ts`, used by the EPUB and PDF chapter producers
- OCR batch diagnostics: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-batch-diagnostics.ts`
- Token-shape audit: `src/tools/audit-ocr-token-shapes.ts`

## API / Type Impact

- `--ocr-concurrency auto` selects adaptive hosted behavior; `--ocr-concurrency <n>` is a hard maximum for runtime scheduling and estimates.
- `--ocr-provider-mode fanout|pool` defaults to `fanout`. Pool mode produces one composite top-level extraction and rejects `--primary-ocr`.
- Composite metadata carries `extractionMethod: "ocr-pool"`, page-attributed target usage, reasoning, attempts, timing, and actual costs. Provider attempt artifacts live below `providers/<target>/attempts/page-<number>/attempt-<number>/`.
- Automatic resume skips deterministic provider blockers; explicit provider selection overrides that skip.
- `ocr-batch-diagnostics.json` is a versioned, regenerable projection of the final canonical batch manifest, not resume authority.
- Chapter naming adds no CLI flag. The public path shape is `NN-PPP-title` for PDF and `NN-III-title` for EPUB, with dynamic widths and split suffixes.
- Extract public and resume provider normalization is a projection of the canonical STT/OCR target maps and remains route-qualified after normalization.

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/extract-ocr/chapter-artifact-filenames.test.ts
bun test test/test-cases/validation/extract-ocr/ocr-batch-diagnostics.test.ts
bun test test/test-cases/validation/extract-ocr/ocr-page-pool-contracts.test.ts
bun test test/test-cases/validation/extract-ocr/ocr-resilience-contracts/
bun test test/test-cases/validation/extract-ocr/ocr-resume-failure-target-contracts.test.ts
bun test test/test-cases/validation/extract-ocr/ocr-resume-provider-state-contracts.test.ts
bun test test/test-cases/validation/reports-pricing/price-mode-contracts/ocr-token-usage-profiles.test.ts
bun test test/test-cases/validation/providers/provider-selection-contracts/selection-inventory-contracts.test.ts
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

1. Typecheck and unique-source check pass.
2. Mapped price commands stay no-cost and do not dispatch providers.
3. Chapter producers emit ordinal-first, source-locator paths with dynamic widths, split suffixes, and collision handling.
4. Batch diagnostics emit only for actionable blocker or cost gaps, stay regenerable, and never become resume authority.
5. Pool artifacts stay composite, isolate attempts, reject `--primary-ocr`, and leave default fan-out unchanged.
6. Hosted failure classification, `auto` versus fixed OCR caps, and automatic versus explicit resume skip deterministic blockers.
7. Token profiles reject identifying data and unhealthy samples, and token-priced OCR keeps `costMultiplier: 1`.
8. Extract public and resume selectors stay equal to the canonical STT/OCR target maps.
9. Help and usage contracts keep OCR mode and concurrency flags stable.

Do not run hosted OCR providers, paid-provider, smoke, e2e, or full-suite tests for this ADR.

## Follow-up Actions

- [ ] Collect reasoning-qualified token samples so registry shapes can become promotion-eligible — Blocked on explicit approval for paid provider runs

## References

- Related ADR: [ADR-001](ADR-001-source-ingestion-and-normalization.md)
- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md)
- Related ADR: [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md)
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- Related ADR: [ADR-015](ADR-015-distribute-ocr-pages-across-a-multi-provider-work-pool.md)
- Extract command documentation: [`docs/commands/process-steps/step-2-extract/01-extract.md`](../commands/process-steps/step-2-extract/01-extract.md)
- OCR command documentation: [`docs/commands/process-steps/step-2-extract/03-extract-ocr.md`](../commands/process-steps/step-2-extract/03-extract-ocr.md)
- Resume command documentation: [`docs/commands/setup-and-utilities/resume/resume.md`](../commands/setup-and-utilities/resume/resume.md)
- `src/cli/commands/process-steps/step-2-extract/step-2-url/`
- `src/cli/commands/process-steps/step-2-extract/step-2-ocr/`
- `src/cli/flags/service-selector-normalization/extract-selectors.ts`
- `src/cli/commands/process-steps/step-2-extract/step-2-ocr/chapter-artifact-filenames.ts`
- `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ebook/epub/export.ts`
- `src/cli/commands/process-steps/step-2-extract/step-2-ocr/pdf/ocr-chapters/ocr-chapter-artifacts.ts`
- `test/test-cases/validation/extract-ocr/chapter-artifact-filenames.test.ts`
