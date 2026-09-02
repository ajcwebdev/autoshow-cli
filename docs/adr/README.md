# Architecture Decision Records

Compact index for ADR-001 through ADR-022. Twenty records are Accepted · Passed, ADR-012 is Superseded · Passed after CLI `benchmark` removal, and ADR-016 is Proposed · Pending. Dated hosted-model catalogs live in [docs/models](../models/). ADR numbers are current-index identities: consolidations and moves renumber the sequence so it stays contiguous. The next new ADR is 023. Use [ADR_TEMPLATE.md](ADR_TEMPLATE.md) for new records and material updates.

## Authoring and Maintenance

- Copy `ADR_TEMPLATE.md` to `ADR-XXX-<kebab-case-title>.md`, assign the next zero-padded number, and replace every placeholder. Follow that template for record structure, required sections, status fields, Follow-up Actions, and Options Considered / Trade-offs labels.
- Create a new ADR for a new architectural decision. Update an existing ADR when implementation evidence, verification, or follow-up state changes without changing the decision's architectural scope.
- Do not use Markdown tables in ADRs or this index. Represent alternatives, trade-offs, overview entries, and other repeated structured information as named records with bold field labels.
- Update this index in the same change whenever an ADR is added, renamed, renumbered, consolidated, superseded, or materially changes status, scope, relationships, or next steps. Keep the sequence summary, next-number pointer, overview entries, consolidation analysis, and priorities mutually consistent.
- When records are consolidated or split and regrouped, reframe each surviving record around its resulting authority, carry every substantive claim to a clear owner, add a `Supersession` status field naming absorbed records by title, and delete the retired files. Then renumber later ADRs so the sequence stays contiguous, renaming each file and rewriting every cross-reference in the same change.
- Confirm every Markdown link resolves, every overview status matches its ADR, every Related ADR appears in the source record's References section, and no retired filename or number remains anywhere in the repository.
- Write prose and list items without hard wrapping. Preserve line-oriented Markdown for fenced code blocks.
- Run `bun run check` and `git diff --check` after ADR edits. Use only targeted local/no-cost tests; do not invoke paid or quota-limited providers for documentation verification.

## ADR Overview

Each Status field summarizes its ADR's `Decision Status` and `Verification Status`.

**ADR 1: [ADR-001](ADR-001-source-ingestion-and-normalization.md)**

- **Status:** Accepted · Passed
- **Decision:** Owns source identity, Step 0 classification and expansion, discovery caches that cannot change results, supported ebook normalization, unsupported ACSM policy, conversion metadata, and the normalized handoff to execution.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md), [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)

**ADR 2: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)**

- **Status:** Accepted · Passed
- **Decision:** Owns the command-neutral batch work plan, the canonical pipeline `manifest.json` including the pooled OCR page ledger, execution-to-resume selection parity, non-mutating `resume --price`, and rejection of superseded manifest formats.
- **Related ADRs:** [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md), [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md), [ADR-015](ADR-015-distribute-ocr-pages-across-a-multi-provider-work-pool.md), [ADR-020](ADR-020-end-the-write-pipeline-at-step-3.md)

**ADR 3: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md)**

- **Status:** Accepted · Passed
- **Decision:** Removes strict single-use type indirection, keeps workflow-oriented type ownership, and preserves `src/types/index.ts` as the sole public `~/types` barrel.
- **Related ADRs:** [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)

**ADR 4: [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md)**

- **Status:** Accepted · Passed
- **Decision:** Owns the host setup lifecycle: managed macOS tools under `runtime/`, resumable integrity-checked downloads, bounded transfer concurrency, truthful setup and doctor reporting, cleanup, and hermetic MuPDF and qpdf source builds.
- **Related ADRs:** [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-005](ADR-005-reduce-environment-variable-surface-area.md), [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md), [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md), [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)

**ADR 5: [ADR-005](ADR-005-reduce-environment-variable-surface-area.md)**

- **Status:** Accepted · Passed
- **Decision:** Reduces the environment-variable surface to credentials, standard system variables, and unavoidable child-process seams. Config that is not a credential is a CLI flag, typed parameter, or trusted default. Missing credentials share one error shape and exit code 2. `setup --doctor --strict` is the fail-closed readiness gate. Spawned children do not inherit the parent credential set. ADR-014 owns container credential delivery.
- **Related ADRs:** [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md), [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md), [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)

**ADR 6: [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md)**

- **Status:** Accepted · Passed
- **Decision:** Unifies the diagnostic vocabulary across `src/` and `test/`: typed `AppError` as the throw contract, `src/utils/app-logger/` as the output channel, shared CLI usage and provider-failure classification, rate-limit recovery, TTS ambiguous-redispatch authorization, and concise diagnostic rendering, all enforced by standing source-scan tests with documented allowlists.
- **Related ADRs:** [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md), [ADR-005](ADR-005-reduce-environment-variable-surface-area.md), [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md), [ADR-016](ADR-016-govern-readme-command-examples-as-executable-contracts.md), [ADR-017](ADR-017-sound-effects-and-multi-track-soundscape-pipeline.md), [ADR-019](ADR-019-quiet-passing-test-console-output.md), [ADR-021](ADR-021-adopt-table-free-text-json-results-and-safe-retry-ownership.md)

**ADR 7: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md)**

- **Status:** Accepted · Passed
- **Decision:** Integrates comic with the central model infrastructure, native command tree, and shared hosted coordinator for LLM/image/QA/dialogue/SFX work; retires comic's parallel model, parser, dispatcher, and help stacks and moves links selection onto the native parse boundary.
- **Related ADRs:** [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md), [ADR-005](ADR-005-reduce-environment-variable-surface-area.md), [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-011](ADR-011-add-refresh-metadata-to-links.md)

**ADR 8: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)**

- **Status:** Accepted · Passed
- **Decision:** Owns the cross-command work-unit inventory and run-scoped hosted admission policy: default five-second provider/account ramps, immediate mode, class and lane caps, exact-token 429 recovery, and separation of lane pressure from explicit TTS duplicate-spend authorization.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md), [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md), [ADR-015](ADR-015-distribute-ocr-pages-across-a-multi-provider-work-pool.md)

**ADR 9: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)**

- **Status:** Accepted · Passed
- **Decision:** Owns Step 2 URL and OCR execution plus artifacts: explicit article/X-Space routing, route-aware provider selection and resume, Tesseract-only local OCR, retry-aware hosted failures, fan-out and composite pool artifacts, page attribution, `auto|fixed` OCR ceilings, calibrated pricing and diagnostics, and shared chapter filenames.
- **Related ADRs:** [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md), [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md), [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-015](ADR-015-distribute-ocr-pages-across-a-multi-provider-work-pool.md), [ADR-020](ADR-020-end-the-write-pipeline-at-step-3.md)

**ADR 10: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)**

- **Status:** Accepted · Passed
- **Decision:** Owns durable cross-modality hosted-model policy: fixed selector identity, lifecycle/default/all eligibility, typed provider/model descriptors shared with resume, complete capability validation and routing, normalized reasoning, pricing provenance, calibration promotion, historical readability, and no silent substitution or coercion. Dated refresh chronology lives in the 2026 hosted-model refresh reports under [docs/models](../models/).
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md), [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md), [ADR-011](ADR-011-add-refresh-metadata-to-links.md), [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md), [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md), [ADR-017](ADR-017-sound-effects-and-multi-track-soundscape-pipeline.md)

**ADR 11: [ADR-011](ADR-011-add-refresh-metadata-to-links.md)**

- **Status:** Accepted · Passed
- **Decision:** Adds direct URL and input-file `links` modes, model reference selections, optional `--refresh` metadata sidecars with token/hash change tracking, and standard `output/` run-directory writes via `--output-root` and `--output-dir`.
- **Related ADRs:** [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md)

**ADR 12: [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md)**

- **Status:** Superseded · Passed
- **Decision:** Owns historical benchmark evidence from primary-source refresh through local checks, price-only preflight, exact paid approval, validation, repair, compaction, and regeneration, plus self-contained JSON, Markdown, and offline HTML combined reports with per-metric cost, speed, and quality rankings. Retained as historical authority after CLI `benchmark` command removal. The later consensus-skill ranking contract dropped weighted composites and quality-cost terciles.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-011](ADR-011-add-refresh-metadata-to-links.md), [ADR-017](ADR-017-sound-effects-and-multi-track-soundscape-pipeline.md)

**ADR 13: [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md)**

- **Status:** Accepted · Passed
- **Decision:** Establishes shared character-voice, provisioning, capability, native/segmented rendering, timing, compact scene-run output retention, hosted dialogue scheduling, and ambiguous-redispatch contracts; requires truthful capability behavior across TTS providers; and provides durable voice management contracts. Fish examples in the decision are historical because Fish support was removed on 2026-09-01.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md), [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md), [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-017](ADR-017-sound-effects-and-multi-track-soundscape-pipeline.md), [ADR-018](ADR-018-synchronize-comic-panels-with-manifest-backed-audio.md)

**ADR 14: [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)**

- **Status:** Accepted · Passed
- **Decision:** Owns the additive Debian slim local-lite Docker image, build context, non-root runtime, tool and Tesseract contracts, direct image invocation and mount behavior, credential boundary, and multi-architecture GHCR publication with OCI provenance.
- **Related ADRs:** [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md), [ADR-005](ADR-005-reduce-environment-variable-surface-area.md), [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)

**ADR 15: [ADR-015](ADR-015-distribute-ocr-pages-across-a-multi-provider-work-pool.md)**

- **Status:** Accepted · Passed
- **Decision:** Adds explicit `fanout|pool` OCR execution while retaining fan-out by default; pool mode uses one dynamically claimed page queue, exactly-once canonical acceptance, run-scoped provider/account ramps, composite artifacts, page-level resume, attributed actual usage, and heuristic unfinished-page pricing.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)

**ADR 16: [ADR-016](ADR-016-govern-readme-command-examples-as-executable-contracts.md)**

- **Status:** Proposed · Pending
- **Decision:** Governs every shell-like command in the root README and all Markdown beneath `docs/` through classification, local no-spend verification, committed fixtures, and documented cost reporting.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md), [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md), [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md), [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md), [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md), [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md), [ADR-020](ADR-020-end-the-write-pipeline-at-step-3.md)

**ADR 17: [ADR-017](ADR-017-sound-effects-and-multi-track-soundscape-pipeline.md)**

- **Status:** Accepted · Passed
- **Decision:** Adds provider-neutral sound intent, strict cue-to-dialogue timeline resolution, reusable dedicated sound-effect generation, a deterministic four-bus mixer, and three dedicated SFX targets (ElevenLabs, pinned Replicate AudioGen, and Stability `stable-audio-3`).
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md), [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md), [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md), [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md), [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md), [ADR-018](ADR-018-synchronize-comic-panels-with-manifest-backed-audio.md)

**ADR 18: [ADR-018](ADR-018-synchronize-comic-panels-with-manifest-backed-audio.md)**

- **Status:** Accepted · Passed
- **Decision:** Adds the local manifest-backed still-panel presentation layer: exact source reconciliation, panel-owned dialogue and effects, sequential timing, derived audio recomposition, immutable resume, and same-size H.264/AAC hard-cut rendering without provider calls or source-run mutation.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md), [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md), [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md), [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md), [ADR-017](ADR-017-sound-effects-and-multi-track-soundscape-pipeline.md)

**ADR 19: [ADR-019](ADR-019-quiet-passing-test-console-output.md)**

- **Status:** Accepted · Passed
- **Decision:** Passing tests print only the result line; failing tests keep that line plus the captured console output from that test. JUnit remains a post-run sidecar.
- **Related ADRs:** [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md), [ADR-021](ADR-021-adopt-table-free-text-json-results-and-safe-retry-ownership.md)

**ADR 20: [ADR-020](ADR-020-end-the-write-pipeline-at-step-3.md)**

- **Status:** Accepted · Passed
- **Decision:** Confines `write` to LLM text generation over `.md` / `.txt` input. Extract is the prior command for URLs, media, documents, and X Spaces. TTS, image, video, and music remain standalone follow-on commands. `write` does not run, price, or flag extract or generation work.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md), [ADR-016](ADR-016-govern-readme-command-examples-as-executable-contracts.md)

**ADR 21: [ADR-021](ADR-021-adopt-table-free-text-json-results-and-safe-retry-ownership.md)**

- **Status:** Accepted · Passed
- **Decision:** Deletes terminal tables and `--log-format`, makes one-line text and versioned `--json` results the two `bun autoshow` output modes, requires exactly one staged terminal result, and centralizes retry and polling ownership with conservative paid-create semantics.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md), [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-019](ADR-019-quiet-passing-test-console-output.md)

**ADR 22: [ADR-022](ADR-022-compile-a-text-first-blocking-plan-into-a-panel-ledger.md)**

- **Status:** Accepted · Passed
- **Decision:** Authors scene staging as a validated `metadata/blocking-plan.json`, compiles it deterministically into a per-panel ledger that is the single source of truth for the image prompt and the page judge, adds an advisory blocking audit behind a per-key hard policy with a blocking-class restart lane, and records per-location geometry separately from the location specification hash.
- **Related ADRs:** [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md), [ADR-016](ADR-016-govern-readme-command-examples-as-executable-contracts.md), [ADR-021](ADR-021-adopt-table-free-text-json-results-and-safe-retry-ownership.md)

## Consolidation Analysis

No further consolidation is currently recommended. The current 22 records stay separate because they own different authorities and maintenance lifecycles.

### Remaining Boundaries

**ADR set 1: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) + [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md)**

- **Recommendation:** Keep separate.
- **Current rationale:** Durable hosted-model policy and benchmark proof have different maintenance lifecycles. Dated refresh history lives in the per-modality reports under `docs/models/`.

**ADR set 2: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) + [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)**

- **Recommendation:** Keep separate.
- **Current rationale:** ADR-008 is the cross-command lane inventory and ADR-009 is extract execution policy. A pairwise merge would bury TTS and STT scheduling inside extract.

**ADR set 3: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) + [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) + [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md) + [ADR-015](ADR-015-distribute-ocr-pages-across-a-multi-provider-work-pool.md)**

- **Recommendation:** Keep separate.
- **Current rationale:** ADR-015 records the product-level choice between full-document fan-out and a composite page pool. ADR-002 remains the persistence, resume, and price authority, ADR-008 owns cross-command work selection and lanes, and ADR-009 owns OCR execution, failures, usage, diagnostics, and artifacts.

**ADR set 4: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md) + [ADR-011](ADR-011-add-refresh-metadata-to-links.md)**

- **Recommendation:** Keep separate.
- **Current rationale:** `links` reuses URL acquisition, but curated documentation capture, selection, tokenization, and refresh sidecars are not pipeline extraction.

**ADR set 5: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) + [ADR-005](ADR-005-reduce-environment-variable-surface-area.md) + [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md)**

- **Recommendation:** Keep separate.
- **Current rationale:** These records share a cleanup method, not an authority: type ownership, configuration channels, and the diagnostic vocabulary remain independently discoverable contracts.

**ADR set 6: [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md) + [ADR-019](ADR-019-quiet-passing-test-console-output.md)**

- **Recommendation:** Keep separate.
- **Current rationale:** ADR-006 owns the error and logging vocabulary and the standing contracts that enforce it. ADR-019 owns quiet-on-pass versus captured-on-fail test console output.

**ADR set 7: [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md) + [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)**

- **Recommendation:** Keep separate.
- **Current rationale:** Host acquisition, managed source builds, and setup reporting have a different lifecycle from image contents, mount semantics, registry publication, and provenance.

**ADR set 8: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) + [ADR-016](ADR-016-govern-readme-command-examples-as-executable-contracts.md)**

- **Recommendation:** Keep separate.
- **Current rationale:** ADR-002 owns command-neutral planning, persistence, resume, and dry-run architecture. ADR-016 owns the curated documentation surface, example classifications, fixtures, and aggregate evidence that exercise those contracts across commands.

**ADR set 9: [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md) + [ADR-017](ADR-017-sound-effects-and-multi-track-soundscape-pipeline.md) + [ADR-018](ADR-018-synchronize-comic-panels-with-manifest-backed-audio.md)**

- **Recommendation:** Keep separate.
- **Current rationale:** ADR-013 owns voice identity, dialogue rendering, and the original dialogue clock. ADR-017 owns authored sound intent, retained effects, buses, and the original soundscape mix. ADR-018 is their read-only derived consumer for panel ownership, sequential presentation timing, and still-image video output.

## Next Steps

Open follow-up work from ADRs and refresh reports, excluding never-ending refresh-report maintenance. Each item summarizes the source record's Follow-up Actions; that record remains the authority for scope and evidence.

**Item 1: [ADR-016](ADR-016-govern-readme-command-examples-as-executable-contracts.md)**

- **Priority:** High
- **Next step:** Isolate documentation verification from providers, network, and user configuration, then inventory every documented command, make `--price` results consistent, commit offline fixtures, classify unsafe commands as parse-only, cross-check flags and models, and publish documentation cost reports.

**Item 2: [ADR-022](ADR-022-compile-a-text-first-blocking-plan-into-a-panel-ledger.md)**

- **Priority:** High
- **Next step:** Run the Phase 0 continuity baseline and the ten-panel prompt ablation as owner-run paid commands, then use their per-key precision to decide which blocking audit statuses `--blocking-hard-keys` promotes from advisory to hard; reviewed location geometry records and the deferred Phase 5 rendered blocking card remain pending behind that measurement.

**Item 3: [2026 Hosted-Model Refresh Report: LLMs](../models/04-llm-model-report.md)**

- **Priority:** Medium
- **Next step:** Implement the remaining 2026-08-16 recommended selectors after confirming adapter fit and published pricing.

**Item 4: [2026 Hosted-Model Refresh Report: OCR](../models/02-ocr-model-report.md)**

- **Priority:** Medium
- **Next step:** Promote provisional token-billed page heuristics and the benchmark-calibrated Florence compute-second estimate through approved ADR-012 calibration; blocked on immediate approval for each exact paid calibration run.

**Item 5: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)**

- **Priority:** Medium
- **Next step:** Collect reasoning-qualified token samples so OCR registry shapes can become promotion-eligible; blocked on explicit approval for paid provider runs.

**Item 6: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)**

- **Priority:** Medium
- **Next step:** Calibrate materially different reasoning levels and provisional model heuristics; deferred pending immediate approval for each exact paid run.

**Item 7: [2026 Hosted-Model Refresh Report: TTS](../models/05-tts-model-report.md)**

- **Priority:** Low
- **Next step:** Watch Cartesia for a dated Sonic 3.6 snapshot; do not register `sonic-preview`.

**Item 8: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)**

- **Priority:** Low
- **Next step:** Evaluate provider-specific reasoning levels outside the seven-value surface through explicit public-enum expansion.

**Item 9: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md)**

- **Priority:** Low
- **Next step:** Run the two deferred cleanup reviews: remaining multi-use exported declarations, and remaining multi-reference non-exported declarations.
