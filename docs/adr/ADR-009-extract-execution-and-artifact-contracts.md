# ADR-009: Extract Execution and Artifact Contracts

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-11
- **Date Updated:** 2026-08-13
- **Verification Status:** Passed
- **Supersession:** Absorbs OCR architecture, ordinal-first chapter filenames, and URL extraction contracts from former individual records. Source identity belongs to [ADR-001](ADR-001-source-ingestion-and-normalization.md); pipeline state and resume belong to [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md).

## Context

Step 2 owns domain execution after [ADR-001](ADR-001-source-ingestion-and-normalization.md) has classified and normalized a source and [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) has supplied the work plan. Shared registries provide provider identity, but URL, OCR, and STT retain domain-specific adapters, retry and response policy, orchestration, and artifacts. Canonical provider progress belongs in [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)'s manifest; raw responses and derived artifacts belong to the executing domain and cannot become resume authority.

URL execution historically mixed identity, discovery, persistence, and runtime rules. This record narrows that concern: `article` is an explicit extract route with domain-owned adapters, retries, response handling, content normalization, and artifact writes under `step-2-url`; `x-space` is a separate explicit route with its own non-resumable behavior. Neither route is inferred from the other, the input family, or provider metadata.

OCR carries the widest execution surface: local engine choice, input-type source layout, hosted failure handling, page scheduling, throughput and token telemetry, and cost estimation. Those contracts must stay consistent with each other, because failure classification decides resume eligibility, scheduling decisions change observed throughput, and observed throughput feeds cost estimates.

OCR also had inconsistent public chapter paths. Native EPUB export started with logical order, such as `chapters/01-title.txt`, while PDF chapter detection started with the source page, such as `chapters/011-title.txt`. A shared artifact contract must sort by reading order while retaining the source locator and split-part behavior.

Why now: hosted OCR estimates were drifting against actual billed usage, repeated deterministic blockers were only visible per item, and chapter producers emitted incompatible public paths — all execution and artifact concerns with no single owning record.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Tesseract as the only local OCR engine, with source grouped by input type** | Fastest and highest-mean engine in local comparison; smallest provisioning and maintenance surface; mirrors runtime classification | No local fallback for difficult inputs | 1 engine; 4 input-type areas (ebook, image, PDF, office/native) |
| Keep OCRmyPDF and PaddleOCR alongside Tesseract | Local engine diversity for hard inputs | Duplicate provisioning, slower defaults, ongoing dependency maintenance | Rejected |
| **Evidence-gated token shapes with `costMultiplier: 1`** | Preserves published rate and tier semantics; keeps profile estimates from being multiplied twice; makes wrong component visible | Requires an audit helper and a migration-aware profile store | Promotion needs ≥3 matching healthy samples and >20% median absolute percentage error |
| Tune `costMultiplier` until total estimate matches benchmark | Small metadata change | Hides which token component is wrong, distorts tier selection, and double-adjusts profile estimates | Rejected for token-priced OCR |
| Replace registry values from one paid or historical run | Fast calibration | Overfits document mode, page band, reasoning policy, and provider variance | Rejected |
| **Derive batch diagnostics from final canonical manifest** | Deterministic, sanitized rollup of repeated blockers and cost gaps; no second source of authority | Another regenerable artifact schema to version | Emitted only for actionable batches |
| Add blocker/cost aggregates as mutable top-level manifest state | Easy for readers to find | Duplicates child provider authority and can drift during partial writes or resume | Rejected |
| **Ordinal-first plus source-locator chapter names: `NN-PPP-title` / `NN-III-title`** | Sorts every chapter producer by reading order; preserves source traceability; one documented contract | Changes public artifact paths and requires docs/tests updates | Applies to the 2 direct `chapters/` producers |
| Keep source-page-first PDF names beside EPUB `NN-title` | Avoids path churn | Preserves inconsistent first-token meaning and sorting | No implementation work |

## Decision

Step 2 execution is domain-owned above shared provider identity: extraction domains own adapters, retries, response handling, normalized output, and artifacts, while canonical progress stays in [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)'s manifest.

### Extract domain ownership

Shared Step 2 registries own provider identity, hosted/local grouping, configuration paths, shortcuts, provider specs, and target identity. Each extraction domain owns its execution adapters, retry and cleanup behavior, provider response handling, normalized output, and artifact writing.

URL execution remains under `step-2-url`. `article` is a first-class route and is never inferred from `x-space`, input family, or provider metadata. X Spaces retain their separate route and explicit non-resumable behavior. URL adapters normalize article content and write domain artifacts, while provider progress and resume eligibility are recorded only in [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)'s canonical manifest.

### OCR architecture and reliability

Use Tesseract as the sole local OCR engine. Organize source-specific OCR code under ebook, image, PDF, and office/native input-type areas. Keep orchestration, hosted provider clients, and shared utilities—including `ocr-utils/`—outside those input-specific areas.

Hosted failures carry retryability, blocker classification, redacted diagnostics, fallback-audit state, and run-level `blockedProviders`. Automatic resume skips deterministic provider blockers; explicit provider resume overrides that filter after user repair or explicit re-attempt.

Schedule hosted page work through fair provider/API-key lanes. Extract and write document batches share one run-scoped coordinator with per-document queue adapters, preventing outer batch concurrency from multiplying remote admission; standalone extraction retains a document-scoped coordinator. `auto` concurrency adapts to run/document size and observed lane health, backing off under retry pressure and accelerating clean large-document lanes. Explicit concurrency values act as hard caps. Clean profiles may raise a lane above the generic maximum, up to the global ceiling of `48` or an explicit user cap.

Persist privacy-preserving throughput, timing, partial-provider usage, and token profiles. Telemetry distinguishes healthy full target samples from failed, partial, or incomplete work so unhealthy samples cannot become trusted warm starts.

For token-priced OCR, keep published rates and prompt/completion shapes explicit and require `costMultiplier: 1`. Calibrate components only through healthy evidence bucketed by provider, concrete model, OCR mode, page-count band, and effective reasoning policy. Require at least three matching samples, a consistent direction, and median absolute percentage error above 20% before a registry shape is eligible for promotion. Gemini canonical completion usage includes candidate plus thought tokens (counting schema-retry usage once); Kimi canonical usage uses provider-reported prompt and completion totals.

Derive actionable OCR batch diagnostics from the final canonical manifest and child provider records. Emit `ocr-batch-diagnostics.json` and a human summary table only when a deterministic blocker affects multiple items, partial provider usage exists, actual cost is missing for attempted hosted work, or absolute estimate error exceeds 20%. The report is sanitized, deterministically ordered, tied to the exact source manifest by SHA-256, regenerable after resume, and never resume authority.

Keep provider-neutral pricing primitives under `src/utils/pricing/`, command-wide pricing orchestration under `src/cli/commands/pricing-orchestration/`, extraction-specific estimate orchestration under `src/cli/commands/process-steps/step-2-extract/extract-pricing/`, and the Step 1 document-write prompt helper beside its sole consumer.

### Chapter artifact filenames

Every direct chapter producer writes `chapters/<ordinal>-<source-locator>-<slug>.txt`. PDF uses `pdfStartPage` as the source locator. EPUB uses the first original source/spine section index when available and otherwise the logical section index.

Ordinal and split-part fields use dynamic width: two digits below 100 generated files and three digits at 100 or more. Source locators are padded to at least three digits and never truncated. Split files append `-part-NN` to the same base. Exact generated-path collisions receive deterministic disambiguation through the shared filename helper.

This applies to:

- URL, OCR, and STT execution adapters, retry and response policy, normalized domain output, and artifact writes under Step 2.
- Native EPUB/ebook chapter files, PDF chapter-detection files, and split parts produced by `--length <n>`.
- Routes that directly create chapter files or generate output artifacts; reruns recreate artifacts under the current names.
- Scope explicitly excluded: source identity, normalization, canonical state, resume authority, or price dry runs, which belong to [ADR-001](ADR-001-source-ingestion-and-normalization.md) and [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md).

## Rationale

- Tesseract provided the best performance-to-complexity ratio in local testing while avoiding multi-engine dependency and maintenance costs.
- Input-type directories mirror runtime classification without forcing shared orchestration, providers, or utilities into artificial ownership.
- Retry-aware blockers prevent automatic resume from repeating quota, billing, account, policy, and other deterministic failures while preserving useful mixed-provider output.
- Provider/API-key lanes provide a fair pressure boundary for multiple models sharing credentials, and adaptive caps improve large-document throughput without weakening retry backoff or explicit limits.
- Privacy-preserving profiles improve future timing and token estimates without turning local calibration data into input or account history.
- Explicit token components preserve pricing-tier semantics and prevent profile-derived usage from being multiplied a second time.
- A derived batch report exposes repeated blockers and cost gaps without duplicating mutable child provider state.
- Source placement follows dependency ownership: pure calculations remain reusable, while command and document orchestration remain above them.
- Explicit URL routes preserve domain-specific runtime behavior without duplicating provider identity or canonical state.
- Logical ordinal first makes EPUB and PDF chapter paths sort by reading order, while a real source locator preserves debugging traceability.

## Consequences

Positive outcomes:

- URL article execution has one explicit domain owner, and X Spaces cannot be conflated with it during execution or resume.
- Local OCR has one routing and execution path supplied by the toolchain that [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md) provisions.
- Maintainers can find input-specific code by source type while shared concerns retain a shared home.
- Hosted OCR preserves useful partial results, produces actionable resume guidance, and avoids known deterministic retry loops.
- Large clean runs can use available throughput, while pressured lanes fall back conservatively.
- Estimates and summaries explain wall time, gating targets, retry pressure, actual partial usage, and token-shape drift.
- Actionable OCR batches emit one deterministic, sanitized blocker/cost diagnostic rollup; clean batches remain quiet.
- Pricing dependencies point from command orchestration to pure utilities rather than from generic utilities into command implementations.
- EPUB and PDF chapters share one public path shape that sorts by reading order and retains source position.

Negative outcomes:

- URL, OCR, and STT deliberately retain different execution structures even though identity and pipeline state are shared.
- There is no non-Tesseract local fallback for difficult inputs.
- Provider failure classifiers and profile schemas require ongoing maintenance as hosted APIs change.
- Adaptive scheduling, fallback audit data, migration-tolerant profile readers, audit rules, and derived diagnostics add implementation and test surface.
- Clean profiles can become stale as provider routing, limits, models, account tiers, or reasoning defaults change.
- Historical token profiles without an effective reasoning policy remain usable as low-confidence estimates but cannot qualify registry promotion.
- Scripts expecting older EPUB `NN-title` or PDF `PPP-title` chapter paths must be updated; existing outputs are not migrated.

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

Hosted OCR token profiles are stored as reasoning-aware, migration-tolerant version 2 records, audited by `audit:ocr-tokens`, which compares registry, selected-profile, and observed prompt/completion tokens independently. Token-priced OCR model validation enforces `costMultiplier: 1`, and registry promotion requires reasoning-qualified evidence above error thresholds.

Final document OCR and resumed batches derive `ocr-batch-diagnostics.json` after the canonical manifest write, aggregating provider targets, blocker categories, item counts, attempts, retries, rate limits, costs, and partial provider usage. Clean reruns clear stale diagnostic files.

Pure token-cost, profile-selection, and projection logic lives in `src/utils/pricing/ocr-token-pricing.ts`; OCR page/model/profile orchestration lives in `src/cli/commands/process-steps/step-2-extract/extract-pricing/`; command-aware aggregate, preflight, actual-cost, timing, and provider pricing orchestration lives in `src/cli/commands/pricing-orchestration/`; and the Step 1 prompt helper lives at `src/cli/commands/process-steps/step-1-download/download-targets/single/document-write-prompt.ts`.

Chapter filename construction is centralized in `chapter-artifact-filenames.ts` and used by the EPUB and PDF builders. Each producer preserves its existing slug cleanup and fallback behavior; the shared helper owns dynamic ordinal widths, source-locator padding, split suffixes, and collision handling. The shared OCR artifact writer only persists each supplied `TextArtifactFile.relativePath` and is not another naming authority.

## API / Type Impact

The extraction CLI surface is preserved; the internal, profile, and report contracts are:

- `--ocr-concurrency auto` selects adaptive hosted behavior; `--ocr-concurrency <n>` is a hard maximum for runtime scheduling and estimates.
- Provider failure metadata includes retryability, failure/blocker classification, redacted diagnostics, retry details, and fallback audit state.
- Run metadata uses `blockedProviders` so automatic resume skips deterministic blockers; explicit provider selection overrides that skip.
- `partialStep2` records failed providers with usable cached artifacts and sanitized failure/usage aggregates, and `partial_provider_usage` contributes actual cost and token usage without marking a failed provider successful.
- Scheduler telemetry reports provider/API-key lane caps, active peaks, retry pressure, pause time, throughput, target shares, and gating-target information.
- Throughput and token profiles exclude filenames, paths, titles, output directories, document content, page images, prompts, credentials, account/request identifiers, and raw provider diagnostics; only healthy full samples qualify as trusted evidence. Legacy version 1 profile records are assigned `unspecified` reasoning policy in memory and cannot qualify registry promotion.
- `ocr-batch-diagnostics.json` is a versioned, regenerable projection of the final canonical batch manifest, not provider or resume authority.
- `bun run audit:ocr-tokens -- --run-dir <path>` audits explicitly named local run directories; `--profile <path>` and `--all-token-providers` extend its explicit input scope, and the command never searches the home directory implicitly.
- Chapter naming adds no CLI flag or metadata schema; the public path shape is `NN-PPP-title` for PDF and `NN-III-title` for EPUB, with dynamic widths and split suffixes.
- URL provider identity remains registry-owned, while URL response, normalized article, and artifact types remain under `step-2-url`.

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Maintain provider error classifiers and billed-component normalizers as hosted response formats drift | OCR maintainers | Ongoing |
| Keep every direct chapter producer on the shared ordinal/source-locator helper | Extract maintainers | Ongoing guardrail |
| Collect reasoning-qualified token samples so registry shapes can become promotion-eligible | OCR & pricing maintainers | Pending (requires explicit approval for paid provider runs) |

## Test Plan

- Verify local engine resolution exposes only Tesseract and input-type routing still reaches ebook, image, PDF, and office/native implementations.
- Use mocked/local tests for failure classification, redaction, provider-wide cancellation, fallback audit state, `blockedProviders`, and automatic versus explicit resume.
- Test scheduler fairness, shared provider/API-key lanes, adaptive `auto` caps, clean-lane acceleration, retry-pressure backoff, explicit hard caps, and global ceiling of `48`.
- Test timing, gating-target, `partialStep2`, `partial_provider_usage`, throughput-profile, token-profile, audit-gate, and batch-diagnostic behavior, including rejection of identifying data and unhealthy samples.
- Test URL registry ordering and selection separately from explicit article-vs-X-Space runtime routing.
- Test PDF and EPUB chapter names, 100+ dynamic widths, split sorting, source locators, and collision behavior with local fixtures.
- Run `bun run check`, `bun t --price`, focused mocked Kimi/Gemini provider contracts, focused OCR pricing/profile/audit/report contracts, CLI help/usage contracts, repository import/path checks, and `git diff --check`. Do not run hosted OCR providers or full provider suite.
- Verification passed on 2026-08-13, covering `bun run check`, 165 mapped `bun t --price` commands, and 282 targeted local/mock tests across CLI, provider, pricing, profile, audit, report, and ownership contracts.

## References

- Related ADR: [ADR-001](ADR-001-source-ingestion-and-normalization.md) — source identity, normalization, ebook conversion, and ACSM fulfillment into extractable inputs
- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — command-neutral work plans, canonical state, resume, and price dry runs
- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) — architecture-oriented source layout
- Related ADR: [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md) — exclusive authority for toolchain setup and local OCR provisioning
- Extract command documentation: [`docs/commands/process-steps/step-2-extract/01-extract.md`](../commands/process-steps/step-2-extract/01-extract.md)
- OCR command documentation: [`docs/commands/process-steps/step-2-extract/03-extract-ocr.md`](../commands/process-steps/step-2-extract/03-extract-ocr.md)
- Resume command documentation: [`docs/commands/setup-and-utilities/resume/resume.md`](../commands/setup-and-utilities/resume/resume.md)
- URL runtime: `src/cli/commands/process-steps/step-2-extract/step-2-url/`
- OCR stage: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/`
- OCR estimate orchestration: `src/cli/commands/process-steps/step-2-extract/extract-pricing/`
- Command pricing orchestration: `src/cli/commands/pricing-orchestration/`
- Pure pricing primitives: `src/utils/pricing/`
- OCR workflow types: `src/types/ocr-workflow/`
- Token-shape audit entry point: `scripts/audit-ocr-token-shapes.ts`
- Resume command: `src/cli/commands/setup-and-utilities/resume/`
- Shared chapter filename helper: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/chapter-artifact-filenames.ts`
- EPUB chapter producer: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ebook/epub/export.ts`
- PDF chapter producer: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/pdf/ocr-chapters/ocr-chapter-artifacts.ts`
- Chapter artifact contracts: `test/test-cases/validation/extract-ocr/chapter-artifact-filenames.test.ts`
