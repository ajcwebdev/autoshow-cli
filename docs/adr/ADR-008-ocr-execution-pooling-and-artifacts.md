# ADR-008: OCR Execution, Pooling, and Artifacts

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-11
- **Date Updated:** 2026-09-23
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
- **Pros:** Fastest and highest-mean engine in local comparison; smallest provisioning surface
- **Cons:** No local fallback for difficult inputs
- **Quantitative Notes:** 1 engine

**Option 2**

- **Option:** Keep OCRmyPDF and PaddleOCR alongside Tesseract
- **Pros:** Local engine diversity for hard inputs
- **Cons:** Duplicate provisioning and slower defaults without a better default
- **Quantitative Notes:** Rejected

### Token-priced OCR estimates

**Option 1 (selected)**

- **Option:** Evidence-gated token shapes with `costMultiplier: 1`
- **Pros:** Preserves published rate and tier semantics; makes the wrong component visible
- **Cons:** Requires ongoing evidence collection
- **Quantitative Notes:** Promotion needs at least 3 matching healthy samples

**Option 2**

- **Option:** Tune `costMultiplier` until the total estimate matches a benchmark
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

OCR owns its adapters, retries, response handling, normalized output, and artifacts, above the provider identity shared with URL and STT extraction. It offers two provider modes through `--ocr-provider-mode fanout|pool`, defaulting to `fanout`. In `pool` mode every eligible selected target draws independent pages from a shared queue and the run produces one composite extraction. Canonical progress and resume eligibility, including pooled page state, stay in the [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) manifest.

This applies to:

- OCR execution and Step 2 artifacts for ebook, image, PDF, and office/native inputs, on fresh `extract` runs, resume, and side-effect-free `--price` planning.
- Both provider modes, including the pooled page ledger and what resume reads from it, for PDF, CBZ, and image inputs that can be split into independent pages.
- Native EPUB and ebook chapter files, PDF chapter-detection files, and split parts produced by `--length <n>`. A rerun recreates files under the current names.

It does not apply to:

- Source identity, classification, and normalization ([ADR-001](ADR-001-source-ingestion-and-normalization.md)).
- Canonical pipeline state, resume authority, and price dry runs in general ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).
- Local OCR toolchain provisioning ([ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md)).
- Shared hosted admission, ramps, and provider/account lane policy ([ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md)). Pool mode uses those lanes as they exist.
- OCR under `write`, which no longer exists ([ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md)).
- Hosted model identity, lifecycle, reasoning, and pricing provenance ([ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)).
- STT execution, timing, captions, and alignment ([ADR-009](ADR-009-stt-timing-captions-and-alignment.md)).

### OCR execution

`extract --provider` and `resume` use the same route-qualified OCR names, and a stored OCR run cannot resume as STT. Tesseract is the only local OCR engine.

A hosted failure carries retryability and redacted diagnostics. Automatic resume skips a deterministic provider blocker such as quota, billing, account, or policy; naming that provider again on resume includes the blocked target after repair or an explicit retry.

Hosted page work uses the [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md) provider and account lanes. Omitting `--step-concurrency ocr-page` selects adaptive `auto` sizing from document size and qualified profiles, up to `48` or an explicit user cap; `--step-concurrency ocr-page=<n>` is a hard ceiling for scheduling and estimates ([ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md) owns the spelling). `--concurrency-mode ramp|immediate` controls hosted startup. Local Tesseract, page rendering, and normalization start immediately.

Token-priced OCR keeps published rates and prompt and completion shapes explicit with `costMultiplier: 1`, and canonical usage follows each provider's billed components, including thought tokens when the provider bills them. A token shape is promoted only from at least three healthy samples matched on provider, model, OCR mode, page-count band, and reasoning policy that agree in direction and show median error above 20%; failed or partial work is never a warm start, and pool and fan-out evidence are not interchangeable.

`ocr-batch-diagnostics.json` is written only when a deterministic blocker affects multiple items, partial provider usage exists, actual cost is missing for attempted hosted work, or absolute estimate error exceeds 20%. It is a sanitized, regenerable projection of the final manifest, never resume authority, and a clean rerun removes a stale file.

### Fan-out and pool

In `fanout`, the default, every selected target receives the full document and writes a complete result under its provider directory, and `--primary-ocr` may copy one of those results to the top-level extraction.

In `pool`, the run writes one top-level composite extraction with `extractionMethod: "ocr-pool"`, assembled from accepted pages in original page order. `--primary-ocr` is rejected as a usage error before credential lookup or dispatch, because no complete per-provider result exists. Provider directories hold per-attempt results, raw responses, errors, and usage under `providers/<target>/attempts/`; they are not complete extractions and cannot be resumed on their own. Every accepted page records provider, model, reasoning, attempt, usage, cost, timing, and artifact path. A failed or ambiguous attempt keeps the same attribution and any reported paid usage but does not become accepted output, and a cached page response is never reused across a different mode, model, reasoning setting, input, page, or render.

Pages are queued in source order and at most one target works on a pending page at a time, so faster targets process more pages. `--provider-concurrency` and `--local-concurrency` bound how many targets are admitted, each admitted target requests pages up to its OCR cap, independent provider/account lanes run concurrently, and targets that share a lane share that lane's cap.

A transient page failure returns the page for another eligible target. A target-specific blocker retires only that target; a provider/account blocker retires the lane. Each target gets one attempt per page unless resume explicitly re-enables it, interrupted in-flight work returns as unfinished without counting as an attempt, a page is exhausted when no eligible target remains, and the composite is complete only when every required page is accepted.

Page progress, attempts, and accepted results live in the canonical item (`ocrProviderMode: "pool"` with an `ocrPool` ledger), so `manifest.json` grows with page count on long documents. Resume keeps the stored mode, continues only unfinished pages, and never re-executes accepted pages. A fan-out item cannot resume as a pool and a pool cannot resume as fan-out; `--ocr-provider-mode` on resume only detects an explicit mismatch, and omitting it preserves the stored setting. Explicitly selecting a previously retired target re-enables it without invalidating accepted pages.

`--price` allocates the page set once across available lane capacity instead of charging every selected target for the full document. `resume --price` applies that allocation to unfinished pages only, with no state mutation, artifact write, or provider call. Actual cost includes every attempt that reports usage, including failed or ambiguous executions.

### Chapter artifact filenames

Every direct chapter producer writes `chapters/<ordinal>-<source-locator>-<slug>.txt`. PDF uses the starting source page; EPUB uses the original spine section index when available, otherwise the logical section index. Ordinal and split-part fields use two digits below 100 generated files and three digits at 100 or more. A source locator is padded to at least three digits and never truncated. A split file appends `-part-NN` to the same base.

## Rationale

- Tesseract gave the best performance-to-complexity ratio in local testing and avoids a second engine to provision.
- Retry-aware blockers stop automatic resume from repeating quota, billing, account, and policy failures.
- Adaptive caps raise large-document throughput while an explicit ceiling and the shared lanes still bind the run.
- Explicit token components keep pricing-tier meaning and stop a profile-derived usage figure from being multiplied twice, and a derived batch report shows repeated blockers and cost gaps without a second mutable copy of provider state.
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

`extract` ships this contract for OCR, with `--ocr-provider-mode`, `--primary-ocr`, `--step-concurrency ocr-page`, the composite and per-attempt artifacts, `ocr-batch-diagnostics.json`, and the chapter filename shape. The command guides under References are the operator surface for flags, artifact names, and examples.

### Bun 1.4 Image Routing

Bun 1.4 decodes TIFF on macOS and Windows only, so production TIFF routing stays on the direct-provider or ImageMagick path and Linux and the Docker image still require ImageMagick, which also remains the comic compositing engine. Removal of the redundant Bun.Image type declarations is recorded in [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md#bun-14-image-declarations).

### Token-shape evidence collected on 2026-09-23

The retained [OCR benchmark manifests](../benchmarks/ocr/) supply individual Kimi K2.6 samples with `effectiveReasoningEffort: disabled`. All 11 selected provider entries have full items, succeeded in one attempt, reported prompt and completion usage, and retained nonempty `result.json` and `extraction.txt` artifacts with matching page counts. The token-shape audit excludes incomplete entries and keeps image and PDF modes in separate buckets.

| Model     | OCR mode | Page band | Healthy samples | Eligible component | Registry tokens/page | Observed median tokens/page | Median absolute percentage error |
| --------- | -------- | --------- | --------------- | ------------------ | -------------------- | --------------------------- | -------------------------------- |
| kimi-k2.6 | image    | 1         | 8               | prompt             | 4,265                | 1,307                       | 226.798%                         |
| kimi-k2.6 | pdf      | 2-10      | 3               | completion         | 516                  | 341                         | 51.320%                          |

Both eligible components have every observation on the same side of the registry value. These archived samples complete the evidence-collection follow-up without another paid call. The registry still has one model-wide token shape, while the qualified image and PDF observations call for different components; changing that shared shape requires a mode-aware estimation decision under [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md). The audit tool's former static `--plan` suggested one-, three-, and four-page runs as one calibration set even though those span two page bands, so that obsolete paid-run plan was removed. The audit remains available through `bun run audit:ocr-tokens` with explicit `--run-dir` arguments.

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/text/ocr/
bun test test/test-cases/validation/resume-manifests/
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

1. Chapter producers emit ordinal-first, source-locator paths with dynamic widths and split suffixes.
2. Batch diagnostics are written only for an actionable batch and never become resume authority.
3. Pool runs keep one accepted result per page, hand failed pages to other targets, reject `--primary-ocr` before dispatch, resume only unfinished pages, and leave fan-out estimates unchanged.
4. Automatic resume skips deterministic blockers and includes them again when named explicitly.

## Follow-up Actions

- [x] Collect reasoning-qualified OCR token samples — Completed from retained benchmark manifests on 2026-09-23; no new paid run needed

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
