# ADR-009: Unify OCR Extraction Architecture and Reliability Guardrails

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-11
- **Date Updated:** 2026-08-13
- **Verification Status:** Passed

## Context

OCR extraction evolved through five implemented decisions: local-engine consolidation, input-type-oriented source layout, retry-aware hosted failures, adaptive hosted concurrency, and calibrated large-document throughput. Keeping those decisions as separate trade studies obscured the current architecture and repeated contracts that must remain consistent across failure handling, scheduling, estimates, usage reporting, and resume.

Decision history: June 14 established Tesseract as the sole local engine and grouped input-specific code by ebook, image, PDF, and office/native source; July 11–12 established hosted reliability, scheduling, and calibration guardrails; July 16 confirmed that genuinely shared utilities should remain in `ocr-utils/`; July 23 consolidated those implemented decisions into this current-state record; August 13 completed explicit token-shape evidence, batch diagnostics, and source-ownership follow-up.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **One current-state OCR architecture ADR with evidence-gated cost and diagnostic contracts (selected)** | Gives maintainers one authoritative description of the implemented engine, layout, failure, scheduling, telemetry, token-pricing, diagnostic, and privacy contracts | Removes the detailed chronology of earlier OCR trade studies from the live ADR set | Replaces 5 earlier live records with 1 and completes 4 later follow-up areas |
| Keep five implemented OCR ADRs plus a separate follow-up record | Preserves every original trade study in the live sequence | Repeats overlapping contracts and splits current cost/diagnostic ownership from the architecture it governs | Retains at least 6 records for one subsystem |
| Split local architecture from hosted reliability and pricing | Produces narrower records | Leaves cross-cutting orchestration, shared utilities, metadata, resume, and derived-report contracts duplicated | Requires at least 3 current-state records |

## Decision

Use Tesseract as the only local OCR engine. Organize source-specific OCR code under ebook, image, PDF, and office/native input-type areas. Keep orchestration, hosted provider clients, and genuinely shared utilities—including the shared `ocr-utils/` directory—outside those input-specific areas.

Hosted failures carry retryability, blocker classification, redacted diagnostics, fallback-audit state, and run-level `blockedProviders`. Automatic resume skips deterministic provider blockers; an explicit provider resume overrides that filter after the user repairs or intentionally re-attempts the provider context.

Schedule hosted page work through fair provider/API-key lanes. Extract and write document batches share one run-scoped coordinator with per-document queue adapters, so outer batch concurrency cannot multiply remote admission; standalone extraction retains a document-scoped coordinator. `auto` concurrency adapts to run/document size and observed lane health, backs off under retry pressure, and accelerates clean large-document lanes. Explicit concurrency values are hard caps. Healthy clean profiles may raise a lane above the generic maximum, but never beyond the global ceiling of `48` or an explicit user cap.

Persist privacy-preserving throughput, timing, partial-provider usage, and token profiles. Telemetry distinguishes healthy full target samples from failed, partial, retry-heavy, or incomplete work so unhealthy samples cannot become trusted warm starts.

For token-priced OCR, keep published rates and prompt/completion shapes explicit and require `costMultiplier: 1`. Calibrate components only through healthy evidence bucketed by provider, concrete model, OCR mode, page-count band, and effective reasoning policy. Require at least three matching samples, a consistent direction, and median absolute percentage error above 20% before a registry shape is eligible for promotion. Gemini canonical completion usage is candidate plus thought tokens, including schema-retry usage exactly once; Kimi canonical usage is the provider-reported prompt and completion totals without inferred hidden components.

Derive actionable OCR batch diagnostics from the final canonical manifest and child provider records. Emit the versioned `ocr-batch-diagnostics.json` and a human table only when a deterministic blocker affects multiple items, partial provider usage exists, actual cost is missing for attempted hosted work, or absolute estimate error exceeds 20%. The report is sanitized, deterministically ordered, tied to the exact source manifest by SHA-256, regenerable after resume, and never resume authority.

Keep provider-neutral pricing primitives under `src/utils/pricing/`, command-wide pricing orchestration under `src/cli/commands/pricing-orchestration/`, extraction-specific estimate orchestration under `src/cli/commands/process-steps/step-2-extract/extract-pricing/`, and the Step 1 document-write prompt helper beside its sole consumer.

## Rationale

- Tesseract was the fastest and highest-mean local engine in the recorded local comparison while avoiding OCRmyPDF and PaddleOCR dependency and maintenance costs.
- Input-type directories mirror runtime classification without forcing shared orchestration, providers, or utilities into artificial ownership.
- Retry-aware blockers prevent automatic resume from repeating quota, billing, account, policy, and other deterministic failures while preserving useful mixed-provider output.
- Provider/API-key lanes provide a fair pressure boundary for multiple models sharing credentials, and adaptive caps improve large-document throughput without weakening retry backoff or explicit limits.
- Privacy-preserving profiles improve future timing and token estimates without turning local calibration data into input or account history.
- Explicit token components preserve pricing-tier semantics and prevent profile-derived usage from being multiplied a second time.
- A derived batch report exposes repeated blockers and cost gaps without duplicating mutable child provider state.
- Source placement follows dependency ownership: pure calculations remain reusable, while command and document orchestration remain above them.

## Consequences

Positive outcomes:

- Local OCR has one setup, routing, and execution path.
- Maintainers can find input-specific code by source type while shared concerns retain a shared home.
- Hosted OCR preserves useful partial results, produces actionable resume guidance, and avoids known deterministic retry loops.
- Large clean runs can use available throughput, while pressured lanes fall back conservatively.
- Estimates and summaries explain wall time, gating targets, retry pressure, actual partial usage, and token-shape drift.
- Actionable OCR batches emit one deterministic, sanitized blocker/cost diagnostic rollup; clean batches remain quiet.
- Pricing dependencies point from command orchestration to pure utilities rather than from generic utilities into command implementations.

Negative outcomes:

- There is no non-Tesseract local fallback for difficult inputs.
- Provider failure classifiers and profile schemas require ongoing maintenance as hosted APIs change.
- Adaptive scheduling, fallback audit data, migration-tolerant profile readers, audit rules, and derived diagnostics add implementation and test surface.
- Clean profiles can become stale as provider routing, limits, models, account tiers, or reasoning defaults change.
- Historical token profiles without an effective reasoning policy remain usable as low-confidence estimates but cannot qualify registry promotion.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| One local engine and a smaller dependency surface | Local engine diversity |
| Navigable input-type ownership with shared plumbing retained | A perfectly partitioned OCR directory tree |
| Deterministic blocker handling and auditable fallback | More provider-state metadata |
| Faster bounded large-document defaults | More scheduler and profile logic |
| Explicit evidence-gated token shapes | Profile lifecycle and periodic evidence review |
| One derived batch diagnostic | Another regenerable artifact schema |
| Correct pure/command dependency direction | A larger command-owned pricing directory |

## Implementation Note

The architecture is implemented. Tesseract is the sole local engine; source-specific code is grouped by ebook, image, PDF, and office/native input; provider failures are classified and sanitized before durable reporting; automatic resume filters `blockedProviders`; and explicit provider resume can opt back in. Hosted work uses fair provider/API-key lanes, run-scoped batch admission, adaptive `auto` concurrency, retry-pressure backoff, clean-lane acceleration, explicit hard caps, and a profile-raised ceiling of `48`.

Scheduler telemetry records lane activity, cap changes, pause/retry pressure, throughput, target shares, and likely gating targets. Timing metadata separates wall-clock/gating time from summed provider processing time. Full clean target samples may inform throughput profiles, while failed or incomplete targets remain ineligible as healthy samples. Partial failed-provider artifacts and usage remain reportable without being treated as successful extraction.

The 2026-08-13 follow-up added a reasoning-aware, migration-tolerant version 2 hosted OCR token-profile store and the local read-only `audit:ocr-tokens` command. The audit compares registry, selected-profile, and observed prompt/completion tokens independently. Token-priced OCR model validation now rejects any multiplier other than 1. Six previously calibrated token-priced entries were normalized to 1: DeepInfra `Qwen/Qwen3-VL-30B-A3B-Instruct`, Gemini `gemini-3.1-flash-lite`, Grok `grok-4.3`, and OpenAI `gpt-5.5`, `gpt-5.4-mini`, and `gpt-5.4-nano`.

The local Kimi/Gemini Pro evidence audit read 14 explicitly named canonical manifests. It found 22 healthy provider samples across four buckets and excluded six incomplete provider samples. All healthy historical samples predated effective-reasoning metadata and therefore landed in the `unspecified` reasoning bucket. No prompt or completion registry shape was promoted even where component error exceeded 20%, because the reasoning-policy gate was not met.

| Provider/model | OCR mode/page band | Healthy samples | Prompt MAPE | Completion MAPE | Decision |
|---|---|---:|---:|---:|---|
| Gemini `gemini-3.1-pro-preview` | image / 1 page | 7 | 0.425% | 52.163% | Keep registry shape; reasoning policy unqualified |
| Gemini `gemini-3.1-pro-preview` | PDF / 2–10 pages | 4 | 114.466% | 32.749% | Keep registry shape; reasoning policy unqualified |
| Kimi `kimi-k2.6` | image / 1 page | 7 | 214.296% | 47.508% | Keep registry shape; reasoning policy unqualified |
| Kimi `kimi-k2.6` | PDF / 2–10 pages | 4 | 0.176% | 50.598% | Keep registry shape; reasoning policy unqualified |

No paid or quota-limited provider run was executed. If a maintainer later wants the minimum three-sample reasoning-qualified calibration set, the following exact commands require immediate explicit approval before execution. The local `--price` dry run on 2026-08-13 estimated the Kimi set at 4.685¢, the Gemini set at 6.802¢, and both sets at 11.487¢ before retries, billing variance, taxes, credits, or quota effects.

```bash
bun autoshow extract input/examples/document/1-document.pdf --provider kimi=kimi-k2.6 --reasoning-effort disabled
bun autoshow extract input/examples/document/3-document.pdf --provider kimi=kimi-k2.6 --reasoning-effort disabled
bun autoshow extract input/examples/document/4-document.pdf --provider kimi=kimi-k2.6 --reasoning-effort disabled
bun autoshow extract input/examples/document/1-document.pdf --provider gemini=gemini-3.1-pro-preview --reasoning-effort low
bun autoshow extract input/examples/document/3-document.pdf --provider gemini=gemini-3.1-pro-preview --reasoning-effort low
bun autoshow extract input/examples/document/4-document.pdf --provider gemini=gemini-3.1-pro-preview --reasoning-effort low
```

Final write/document OCR batches and resumed OCR batches derive `ocr-batch-diagnostics.json` after the canonical manifest write. The derivation aggregates concrete provider/model targets, sanitized blocker categories, affected/attempted item counts, attempts, retries, rate-limit failures, retry-after delay, estimated cost, actual cost, partial-provider cost, partial-usage item count, and unknown actual-cost item count. A clean derivation removes a stale diagnostic left by an earlier actionable state.

The Step 1 prompt helper moved to `src/cli/commands/process-steps/step-1-download/download-targets/single/document-write-prompt.ts`. Pure token-cost, profile-selection, and projection logic moved to `src/utils/pricing/ocr-token-pricing.ts`; OCR page/model/profile orchestration moved to `src/cli/commands/process-steps/step-2-extract/extract-pricing/`; and command-aware aggregate, preflight, actual-cost, timing, and provider pricing orchestration moved from `src/utils/pricing/` to `src/cli/commands/pricing-orchestration/`. No retired-path compatibility re-export remains.

## API / Type Impact

The follow-up preserves the extraction CLI surface and adds internal/profile/report contracts:

- `--ocr-concurrency auto` selects adaptive hosted behavior; `--ocr-concurrency <n>` is a hard maximum for runtime scheduling and estimates.
- Provider failure metadata includes retryability, failure/blocker classification, redacted diagnostics, retry details, and fallback audit state.
- Run metadata uses `blockedProviders` so automatic resume skips deterministic blockers; explicit provider selection overrides that skip.
- `partialStep2` records failed providers with usable cached artifacts and sanitized failure/usage aggregates.
- `partial_provider_usage` contributes actual cost and token usage without marking a failed provider successful.
- Scheduler telemetry reports provider/API-key lane caps, active peaks, retry pressure, pause time, throughput, target shares, and gating-target information.
- Throughput and token profiles exclude filenames, paths, titles, output directories, document content, page images, prompts, credentials, account/request identifiers, and raw provider diagnostics; only healthy full samples qualify as trusted profile evidence.
- Hosted OCR token profiles are stored as version 2 records keyed by effective reasoning policy; version 1 records migrate in memory as `unspecified` and cannot independently qualify a registry promotion.
- `ocr-batch-diagnostics.json` is a versioned, regenerable projection of the final canonical batch manifest, not provider or resume authority.
- `bun run audit:ocr-tokens -- --run-dir <path>` audits explicitly named local run directories; `--profile <path>` and `--all-token-providers` extend its explicit input scope, and the command never searches the home directory implicitly.

## Completed Follow-up: Make Token Shape Explicit, Derive Batch Diagnostics, and Correct Ownership

- **Recommendation Status:** Implemented and verified
- **Scope:** Kimi and Gemini Pro token estimates, batch-wide blocker/cost diagnosis, the Step 1 document-write prompt helper, and the OCR/pricing dependency boundary
- **Constraint Result:** No heuristic changed from speculation, and no paid provider command ran

| Prior State | Completed Step | Target Transition |
|---|---|---|
| The OCR architecture was implemented, while Kimi/Gemini Pro token-shape evidence, a batch diagnostic rollup, and two source-ownership cleanups remained. | Added a reasoning-qualified evidence gate, enforced token multiplier 1, added a derived batch rollup, moved the Step 1 prompt helper, and separated pure pricing primitives from Step 2 and command orchestration. | ADR remains Accepted · Passed with more accurate pricing semantics, actionable batch diagnostics, and corrected dependency ownership. |

### Alternatives considered

| Option | Advantages | Disadvantages | Decision |
|---|---|---|---|
| **Audit prompt/output shapes separately, keep multiplier 1, derive an OCR batch report, and split ownership at pure boundaries** | Preserves rate and tier semantics, uses existing local evidence, avoids duplicate authority, and fixes dependency direction | Requires an audit helper, derived report schema, migration-aware profiles, and source moves | Selected and implemented |
| Tune `costMultiplier` until total estimate matches a benchmark | Very small metadata change | Hides which token component is wrong, distorts tier selection, and double-adjusts profile estimates | Rejected for token-priced OCR |
| Replace registry values from one paid or historical run | Fast calibration | Overfits document mode, page band, reasoning policy, and provider variance | Rejected |
| Trust local token profiles indefinitely and never audit registry defaults | Personalized estimates improve automatically | Fresh installs retain stale defaults and profile drift stays invisible | Rejected |
| Add blocker/cost aggregates as mutable top-level manifest state | Easy for readers to find | Duplicates child authority and can drift during partial writes or resume | Rejected |
| Emit no batch rollup | No new report surface | Forces operators to correlate the same blocker and cost gap across child records | Rejected for actionable batches |
| Move all OCR estimate orchestration to `src/utils/pricing/` | Removes a deep import path in one move | Pulls CLI validation, document inspection, and profile I/O into generic utilities | Rejected |
| Leave the utility paths unchanged | No churn | Preserves false ownership and generic-to-command dependencies | Rejected |

### Completed acceptance criteria

- Token-priced OCR models use explicit prompt/completion shapes and multiplier 1; profile estimates are not multiplied a second time.
- Gemini actual output usage includes candidates, thoughts, and schema-retry usage exactly once; Kimi uses reported totals without fabricated components.
- Registry heuristic promotion requires at least three matching healthy samples, documented error above 20%, consistent direction, and a qualified effective reasoning policy.
- The batch rollup is deterministic, sanitized, regenerable, and never consulted as resume authority.
- Clean batches emit no diagnostic noise; repeated blockers, partial usage, missing hosted-work cost, and material estimate drift produce one actionable rollup.
- The prompt helper no longer lives under OCR, the retired deep OCR pricing path is absent, and generic pricing utilities do not import command implementation modules.

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Maintain provider error classifiers and billed-component normalizers as hosted response formats drift | OCR maintainers | Ongoing |

## Test Plan

- Verify local engine resolution exposes only Tesseract and input-type routing still reaches ebook, image, PDF, and office/native implementations.
- Use mocked/local tests for failure classification, redaction, provider-wide cancellation, fallback audit state, `blockedProviders`, and automatic versus explicit resume.
- Test scheduler fairness, shared provider/API-key lanes, adaptive `auto` caps, clean-lane acceleration, retry-pressure backoff, explicit hard caps, and the global ceiling of `48`.
- Test timing, gating-target, `partialStep2`, `partial_provider_usage`, throughput-profile, token-profile, audit-gate, and batch-diagnostic behavior, including rejection of identifying data and unhealthy samples.
- Run `bun run check`, `bun t --price`, focused mocked Kimi/Gemini provider contracts, focused OCR pricing/profile/audit/report contracts, CLI help/usage contracts, repository import/path checks, and `git diff --check`. Do not run hosted OCR providers or the full provider suite.
- Verification on 2026-08-13 passed `bun run check`; `bun t --price` checked 165 mapped commands with 0 failures; and 282 targeted local/mock tests passed with 5,615 assertions across CLI help/usage/option-resolution, Kimi/Gemini provider, OCR pricing/profile/audit/report, and ownership contracts. Local ADR link and overview-status checks also passed. No hosted provider call ran.

## References

- Related ADR: [ADR-001](ADR-001-book-like-document-ingestion.md) — ebook normalization and ACSM fulfillment into OCR-supported inputs
- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) — architecture-oriented source layout
- Related ADR: [ADR-012](ADR-012-add-price-preflight-to-resume.md) — resume price preflight over existing OCR metadata
- OCR stage: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/`
- OCR estimate orchestration: `src/cli/commands/process-steps/step-2-extract/extract-pricing/`
- Command pricing orchestration: `src/cli/commands/pricing-orchestration/`
- Pure pricing primitives: `src/utils/pricing/`
- OCR workflow types: `src/types/ocr-workflow/`
- Token-shape audit entry point: `scripts/audit-ocr-token-shapes.ts`
- Resume command: `src/cli/commands/setup-and-utilities/resume/`
- OCR command documentation: `docs/commands/process-steps/step-2-extract/03-extract-ocr.md`
- Resume command documentation: `docs/commands/setup-and-utilities/resume/resume.md`
