# ADR-009: Unify OCR Extraction Architecture and Reliability Guardrails

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-11
- **Date Updated:** 2026-07-23
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

Schedule hosted page work through fair provider/API-key lanes. `auto` concurrency adapts to document size and observed lane health, backs off under retry pressure, and accelerates clean large-document lanes. Explicit concurrency values are hard caps. Healthy clean profiles may raise a lane above the generic maximum, but never beyond the global ceiling of `48` or an explicit user cap.

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

The architecture is implemented. Tesseract is the sole local engine; source-specific code is grouped by ebook, image, PDF, and office/native input; provider failures are classified and sanitized before durable reporting; automatic resume filters `blockedProviders`; and explicit provider resume can opt back in. Hosted work uses fair provider/API-key lanes, adaptive `auto` concurrency, retry-pressure backoff, clean-lane acceleration, explicit hard caps, and a profile-raised ceiling of `48`.

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

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Maintain provider error classifiers as hosted response formats drift | OCR maintainers | Ongoing |
| Consider a batch-level blocked-provider and cost-diagnostic rollup beyond per-child summaries and resume reporting | OCR maintainers | Deferred |
| Review Kimi and Gemini Pro token heuristics so total-cost accuracy does not depend on token-shape or multiplier quirks | OCR maintainers | Ongoing |
| Relocate `ocr-utils/doc-prompt-utils.ts` next to its sole step-1 consumer | Extract maintainers | Deferred |
| Consider moving `ocr-utils/extract-pricing.ts` toward `src/utils/pricing/` | Extract maintainers | Deferred |

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
