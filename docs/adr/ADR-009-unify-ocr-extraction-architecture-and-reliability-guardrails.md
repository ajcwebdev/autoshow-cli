# ADR-009: Unify OCR Extraction Architecture and Reliability Guardrails

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-11
- **Date Updated:** 2026-08-12
- **Verification Status:** Passed

## Context

OCR extraction evolved through five implemented decisions: local-engine consolidation, input-type-oriented source layout, retry-aware hosted failures, adaptive hosted concurrency, and calibrated large-document throughput. Keeping those decisions as separate trade studies now obscures the current architecture and repeats contracts that must remain consistent across failure handling, scheduling, estimates, usage reporting, and resume.

Decision history: June 14 established Tesseract as the sole local engine and grouped input-specific code by ebook, image, PDF, and office/native source; July 11–12 established hosted reliability, scheduling, and calibration guardrails; July 16 confirmed that genuinely shared utilities should remain in `ocr-utils/`; July 23 consolidated those implemented decisions into this current-state record.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **One current-state OCR architecture ADR (selected)** | Gives maintainers one authoritative description of the implemented engine, layout, failure, scheduling, telemetry, and privacy contracts | Removes the detailed chronology of five separate trade studies from the live ADR set | Replaces 5 live records with 1 |
| Keep five implemented OCR ADRs | Preserves every original trade study in the live sequence | Repeats overlapping contracts and makes the current architecture harder to discover | Retains 5 records and a 21-record sequence |
| Split local architecture from hosted reliability | Reduces the record count while retaining two narrower topics | Leaves cross-cutting orchestration, shared utilities, and metadata contracts duplicated | Replaces 5 records with 2 |

## Decision

Use Tesseract as the only local OCR engine. Organize source-specific OCR code under ebook, image, PDF, and office/native input-type areas. Keep orchestration, hosted provider clients, and genuinely shared utilities—including the shared `ocr-utils/` directory—outside those input-specific areas.

Hosted failures carry retryability, blocker classification, redacted diagnostics, fallback-audit state, and run-level `blockedProviders`. Automatic resume skips deterministic provider blockers; an explicit provider resume overrides that filter after the user repairs or intentionally re-attempts the provider context.

Schedule hosted page work through fair provider/API-key lanes. Extract and write document batches share one run-scoped coordinator with per-document queue adapters, so outer batch concurrency cannot multiply remote admission; standalone extraction retains a document-scoped coordinator. `auto` concurrency adapts to run/document size and observed lane health, backs off under retry pressure, and accelerates clean large-document lanes. Explicit concurrency values are hard caps. Healthy clean profiles may raise a lane above the generic maximum, but never beyond the global ceiling of `48` or an explicit user cap.

Persist privacy-preserving throughput, timing, partial-provider usage, and token profiles. Telemetry distinguishes healthy full target samples from failed, partial, retry-heavy, or incomplete work so unhealthy samples cannot become trusted warm starts.

## Rationale

- Tesseract was the fastest and highest-mean local engine in the recorded local comparison while avoiding OCRmyPDF and PaddleOCR dependency and maintenance costs.
- Input-type directories mirror runtime classification without forcing shared orchestration, providers, or utilities into artificial ownership.
- Retry-aware blockers prevent automatic resume from repeating quota, billing, account, policy, and other deterministic failures while preserving useful mixed-provider output.
- Provider/API-key lanes provide a fair pressure boundary for multiple models sharing credentials, and adaptive caps improve large-document throughput without weakening retry backoff or explicit limits.
- Privacy-preserving profiles improve future timing and token estimates without turning local calibration data into input or account history.

## Consequences

Positive outcomes:

- Local OCR has one setup, routing, and execution path.
- Maintainers can find input-specific code by source type while shared concerns retain a shared home.
- Hosted OCR preserves useful partial results, produces actionable resume guidance, and avoids known deterministic retry loops.
- Large clean runs can use available throughput, while pressured lanes fall back conservatively.
- Estimates and summaries can explain wall time, gating targets, retry pressure, actual partial usage, and token-shape drift.

Negative outcomes:

- There is no non-Tesseract local fallback for difficult inputs.
- Provider failure classifiers and profile schemas require ongoing maintenance as hosted APIs change.
- Adaptive scheduling, fallback audit data, and migration-tolerant profile readers add implementation and test surface.
- Clean profiles can become stale as provider routing, limits, models, or account tiers change.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| One local engine and a smaller dependency surface | Local engine diversity |
| Navigable input-type ownership with shared plumbing retained | A perfectly partitioned OCR directory tree |
| Deterministic blocker handling and auditable fallback | More provider-state metadata |
| Faster bounded large-document defaults | More scheduler and profile logic |
| Better estimates from local evidence | Profile lifecycle and privacy maintenance |

## Implementation Note

The architecture is implemented. Tesseract is the sole local engine; source-specific code is grouped by ebook, image, PDF, and office/native input; provider failures are classified and sanitized before durable reporting; automatic resume filters `blockedProviders`; and explicit provider resume can opt back in. Hosted work uses fair provider/API-key lanes, run-scoped batch admission, adaptive `auto` concurrency, retry-pressure backoff, clean-lane acceleration, explicit hard caps, and a profile-raised ceiling of `48`.

Scheduler telemetry records lane activity, cap changes, pause/retry pressure, throughput, target shares, and likely gating targets. Timing metadata separates wall-clock/gating time from summed provider processing time. Full clean target samples may inform throughput profiles, while failed or incomplete targets remain ineligible as healthy samples. Partial failed-provider artifacts and usage remain reportable without being treated as successful extraction.

## API / Type Impact

This consolidation adds no runtime API change. It records the existing public contracts:

- `--ocr-concurrency auto` selects adaptive hosted behavior; `--ocr-concurrency <n>` is a hard maximum for runtime scheduling and estimates.
- Provider failure metadata includes retryability, failure/blocker classification, redacted diagnostics, retry details, and fallback audit state.
- Run metadata uses `blockedProviders` so automatic resume skips deterministic blockers; explicit provider selection overrides that skip.
- `partialStep2` records failed providers with usable cached artifacts and sanitized failure/usage aggregates.
- `partial_provider_usage` contributes actual cost and token usage without marking a failed provider successful.
- Scheduler telemetry reports provider/API-key lane caps, active peaks, retry pressure, pause time, throughput, target shares, and gating-target information.
- Throughput and token profiles exclude filenames, paths, titles, output directories, document content, page images, prompts, credentials, account/request identifiers, and raw provider diagnostics; only healthy full samples qualify as trusted profile evidence.

## Remaining Work Recommendation: Make Token Shape Explicit, Derive Batch Diagnostics, and Correct Ownership Incrementally

This subordinate mini-ADR covers the cost-accuracy, batch-diagnostic, and source-placement work left after the unified OCR architecture was implemented.

- **Recommendation Status:** Recommended, pending implementation
- **Scope:** Kimi and Gemini Pro token estimates, batch-wide blocker/cost diagnosis, `doc-prompt-utils.ts`, and the OCR pricing boundary
- **Constraint:** No heuristic may be changed from speculation, and no provider run may occur without immediate explicit approval of the exact paid command and cost or quota risk

| Current State | Recommended Next Step | Target Transition |
|---|---|---|
| The OCR architecture is implemented. Kimi/Gemini Pro token-shape evidence, a batch diagnostic rollup, and two source-ownership cleanups remain. | Audit token components through an evidence gate, add a derived batch rollup, move the Step 1 prompt helper, and split pure pricing primitives from Step 2 orchestration. | Keep this ADR accepted with more accurate costs, actionable batch diagnostics, and corrected dependency ownership. |

### Context and gap analysis

Token-priced OCR has two independent estimation mechanisms. Registry metadata supplies prompt and completion tokens per page plus a `costMultiplier`; local privacy-preserving profiles can override or blend those shapes by provider, model, OCR mode, and page-count band. Actual cost uses provider usage when available. Gemini complicates the output shape because billed output can include both candidate tokens and thinking tokens; its adapter already sums `candidatesTokenCount` and `thoughtsTokenCount`, including schema-retry usage. Kimi's OpenAI-compatible response exposes prompt and completion totals, and Kimi K3's always-on reasoning can make a K2.6-derived completion estimate optimistic.

A multiplier is the wrong place to correct a token-shape error. It scales input and output cost together even when only completion/thinking tokens drift, obscures context-tier boundaries that depend on input tokens, and makes a profile-derived token count get adjusted a second time. For token-priced OCR, the durable invariant should be `costMultiplier: 1`; observed differences belong in prompt/completion token shape, provider-specific billed-component normalization, or published rates. The present Kimi and Gemini Pro entries already use multiplier 1, but that invariant is not expressed as a contract and future calibration could regress into multiplier tuning.

Per-child OCR summaries preserve detail, but a batch operator must inspect many child records to answer three run-level questions: whether the same deterministic provider blocker affected multiple documents, how much provider work produced partial billable usage, and where estimated versus actual cost is missing or materially divergent. The final generic batch summary counts completed, partial, and failed items, while the STT path has a provider-by-item table. OCR needs a derived view of existing child authority, not another mutable source of provider state.

The two placement follow-ups have different answers. `ocr-utils/doc-prompt-utils.ts` has one production consumer in Step 1 document writing, so its current OCR ownership is false and a direct move is warranted. `ocr-utils/extract-pricing.ts` is not merely a generic math helper: it validates OCR models, determines PDF/image input mode and page count, reads OCR token profiles, and returns provider-specific estimate shapes. Moving it wholesale into `src/utils/pricing/` would make generic utilities depend on CLI model validation and document processing. The right move is to split pure pricing primitives from step-owned orchestration and eliminate the current reverse import from generic pricing into a deep command utility.

### Recommendation

For Kimi and Gemini Pro, build a local token-shape audit over existing canonical run metadata and the versioned hosted OCR token-profile store. Compare registry estimates, selected profile estimates, and actual billed prompt/completion totals separately by provider, concrete model, OCR mode, reasoning policy, and page-count band. Require at least three healthy full samples in a matching bucket before promoting a local profile shape into registry defaults. Use median tokens per page and median absolute percentage error rather than a single mean. Change registry shape only when the median error for prompt or completion tokens exceeds 20% and the direction is consistent across the samples; otherwise retain the current value and record that evidence was insufficient or within tolerance.

Encode and test the invariant that token-priced OCR registry entries use `costMultiplier: 1`. Gemini billed completion remains candidate plus thought tokens, and retry usage remains included exactly once. If provider fixtures reveal additional separately billed components, normalize them explicitly and retain their component projection in usage details while keeping canonical prompt/completion totals for the common pricing path. Do not infer Kimi hidden-reasoning tokens that the provider does not report; use the reported completion total and label the profile confidence accordingly.

Implement an OCR batch diagnostic rollup as a pure derivation from the final canonical batch manifest and child provider records. Group deterministic blockers by concrete provider/model target and sanitized blocker category, count affected items, summarize retry/429 pressure where already recorded, and reconcile estimated, actual, partial-provider, and unknown cost by target. Emit a human table and a versioned, regenerable `ocr-batch-diagnostics.json` beside the batch manifest only when there is actionable batch-wide information: a blocker affects more than one item, partial provider usage exists, actual cost is missing for attempted paid work, or estimate error crosses a documented threshold. The rollup must never become resume authority; resume continues to read canonical child state and `blockedProviders`.

Move `doc-prompt-utils.ts` next to `step-1-download/download-targets/single/document-write.ts`, naming it for the document-write prompt boundary and retaining its existing tests. For pricing, extract only provider-neutral token-cost, profile-selection, and estimate-projection primitives to `src/utils/pricing/`. Move input classification, page-count resolution, model validation, profile persistence from extraction metadata, and provider-specific OCR estimate orchestration to a step-level `step-2-extract/pricing/` boundary rather than a deep `ocr-utils/` path. Step-level callers may combine adapter outputs with the pure primitives; generic aggregate pricing must receive prepared OCR estimate inputs or import only the pure module, and `src/utils/pricing/` must not import from `src/cli/commands/**`.

### Alternatives considered

| Option | Advantages | Disadvantages | Recommendation |
|---|---|---|---|
| **Audit prompt/output shapes separately, keep multiplier 1, derive an OCR batch report, and split ownership at pure boundaries** | Preserves rate and tier semantics, uses existing local evidence, avoids duplicate authority, and fixes dependency direction incrementally | Requires an audit helper, derived report schema, and a staged move | Recommended |
| Tune `costMultiplier` until total estimate matches a benchmark | Very small metadata change | Hides which token component is wrong, distorts tier selection, and double-adjusts profile estimates | Reject for token-priced OCR |
| Replace registry values from one paid or historical run | Fast calibration | Overfits document mode, page band, reasoning policy, and provider variance | Reject |
| Trust local token profiles indefinitely and never refresh registry defaults | Personalized estimates improve automatically | Fresh installs retain stale defaults and profile drift stays invisible | Reject; use qualified profiles as evidence for periodic registry updates |
| Add blocker/cost aggregates directly as mutable top-level manifest state | Easy for readers to find | Duplicates child authority and can drift during partial writes or resume | Reject |
| Emit no batch rollup | No new report surface | Forces operators to correlate the same blocker and cost gap across many child records | Reject once the actionable trigger is met |
| Move all of `extract-pricing.ts` to `src/utils/pricing/` | Removes the deep import path in one move | Inverts dependencies by pulling CLI validation and document inspection into generic utilities | Reject |
| Leave both utility paths unchanged | No churn | Preserves one demonstrably false owner and one generic-to-command dependency | Reject |

### Implementation plan

#### Phase 1: Token-shape audit and invariants

1. Add a local read-only audit helper that accepts explicit run directories and/or an explicit token-profile path. It must not scan arbitrary home directories by default or persist source filenames, content, account IDs, prompts, or raw responses.
2. Normalize samples by provider, model, OCR mode, page-count band, and effective reasoning policy. Exclude failed, partial, incomplete, missing-usage, and schema-invalid samples from registry calibration, while retaining them in cost diagnostics.
3. Report registry and profile prompt/completion tokens per page, sample count, median, dispersion, median absolute percentage error, and whether the 20%/three-sample promotion gate is met.
4. Add registry validation and pricing contracts requiring multiplier 1 for token-priced OCR. Update prompt or completion defaults only for qualified buckets and document the evidence date/sample scope beside the metadata.
5. Extend mocked Gemini contracts to pin candidate-plus-thought aggregation and schema-retry inclusion. Extend Kimi contracts to pin reported prompt/completion totals without invented hidden components.

#### Phase 2: Derived batch diagnostics

1. Define a strict versioned report type containing run identity, per-target affected-item counts, sanitized blocker categories, retry/rate-limit aggregates already present in canonical records, estimated/actual/partial/unknown cost, and source manifest checksums or timestamps sufficient to identify the derivation input.
2. Build the rollup after final canonical batch manifest write, using the same child record readers used by final summaries. Sort targets and categories deterministically.
3. Emit the human table and JSON only when an actionable trigger fires; otherwise keep the ordinary completion summary quiet.
4. Add a read/regenerate path for resume/report tooling if useful, but always recompute from canonical child state after a resume changes outcomes.
5. Test mixed success, repeated deterministic blocker, partial billed usage, missing usage, redaction, deterministic ordering, and no-report clean batches.

#### Phase 3: Prompt ownership cleanup

1. Move `doc-prompt-utils.ts` beside `document-write.ts` with a document-write-specific filename.
2. Update its sole production import and focused tests without introducing a compatibility re-export from the retired OCR path.
3. Search the repository for the retired path and confirm Step 2 no longer appears to own a Step 1 prompt builder.

#### Phase 4: Pricing boundary cleanup

1. Inventory each export of `extract-pricing.ts` and classify it as pure token/rate math, input/page-count adapter, provider registry orchestration, or presentation note.
2. Move pure math, profile selection over already parsed records, and common estimate projections to `src/utils/pricing/` with inputs that contain no CLI command types or model validators; keep extraction-metadata-to-profile persistence in Step 2.
3. Move provider-specific OCR orchestration and page-count resolution to `step-2-extract/pricing/`, change generic aggregate-pricing interfaces to receive prepared inputs or use only the pure module, update runtime callers, and delete the deep `ocr-utils/extract-pricing.ts` path after all imports migrate.
4. Keep pricing notes beside the provider estimate adapter or registry metadata rather than turning generic utilities into a catalog of provider prose.
5. Add an import-boundary contract or repository check that prevents `src/utils/pricing/**` from importing `src/cli/commands/**`.

### Acceptance and verification criteria

- Token-priced OCR models use published rates, explicit prompt/completion shapes, and multiplier 1; profile estimates are not multiplied a second time.
- Gemini actual output cost includes candidates, thoughts, and schema-retry usage exactly once; Kimi uses reported totals without fabricated components.
- No registry heuristic changes without at least three matching healthy samples and a documented consistent error above 20%, unless a separate ADR records a different evidence basis.
- The batch rollup is deterministic, sanitized, regenerable, and never consulted as resume authority.
- A clean batch emits no diagnostic noise; repeated blockers, partial usage, missing paid usage, and material estimate drift produce one actionable rollup.
- `doc-prompt-utils.ts` no longer lives under OCR, and generic pricing utilities no longer import deep command implementation modules.
- Verification uses `bun run check`, `bun t --price`, targeted OCR pricing/profile/provider contracts, batch manifest/report contracts, and repository import/path checks. No hosted OCR call is required; if local evidence is insufficient, the implementation records that result and reports an exact paid calibration command for separate approval rather than running it.

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Maintain provider error classifiers as hosted response formats drift | OCR maintainers | Ongoing |
| Add a derived batch-level blocked-provider and cost-diagnostic rollup beyond per-child summaries and resume reporting | OCR maintainers | Pending — implement the triggered, regenerable report in Remaining Work Phase 2 |
| Audit Kimi and Gemini Pro prompt/completion token shapes, enforce multiplier 1 for token-priced OCR, and update heuristics only through the documented evidence gate | OCR maintainers | Pending — Remaining Work Phase 1; paid calibration remains separately approval-gated |
| Relocate `ocr-utils/doc-prompt-utils.ts` next to its sole Step 1 document-write consumer without a compatibility re-export | Extract maintainers | Pending — Remaining Work Phase 3 |
| Split `ocr-utils/extract-pricing.ts` into pure generic pricing primitives and a Step 2 extraction-pricing adapter; do not move CLI/document orchestration wholesale into `src/utils/pricing/` | Extract and pricing maintainers | Pending — Remaining Work Phase 4 |

## Test Plan

- Verify local engine resolution exposes only Tesseract and input-type routing still reaches ebook, image, PDF, and office/native implementations.
- Use mocked/local tests for failure classification, redaction, provider-wide cancellation, fallback audit state, `blockedProviders`, and automatic versus explicit resume.
- Test scheduler fairness, shared provider/API-key lanes, adaptive `auto` caps, clean-lane acceleration, retry-pressure backoff, explicit hard caps, and the global ceiling of `48`.
- Test timing, gating-target, `partialStep2`, `partial_provider_usage`, throughput-profile, and token-profile behavior, including rejection of identifying data and unhealthy samples.
- Run `bun run check` and targeted local/no-cost contract tests only. Do not run hosted OCR providers or paid/quota-limited tests.

## References

- Related ADR: [ADR-001](ADR-001-book-like-document-ingestion.md) — ebook normalization and ACSM fulfillment into OCR-supported inputs
- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) — architecture-oriented source layout
- Related ADR: [ADR-012](ADR-012-add-price-preflight-to-resume.md) — resume price preflight over existing OCR metadata
- OCR stage: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/`
- OCR workflow types: `src/types/ocr-workflow/`
- Resume command: `src/cli/commands/setup-and-utilities/resume/`
- OCR command documentation: `docs/commands/process-steps/step-2-extract/03-extract-ocr.md`
- Resume command documentation: `docs/commands/setup-and-utilities/resume/resume.md`
