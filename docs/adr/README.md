# Architecture Decision Records

Compact index for the current ADR-001 through ADR-021 sequence: 19 records are Accepted · Passed, ADR-012 is Superseded · Passed following the removal of the CLI benchmark command, and ADR-017 is Proposed · Pending. The sequence is kept contiguous: when records are consolidated, the remaining ADRs are renumbered to close the gap and every reference is updated with them, so an ADR number identifies a record only as of the current index. The next new ADR is 022. Use [ADR_TEMPLATE.md](ADR_TEMPLATE.md) for new records and material updates. Open each ADR for full context, options considered, implementation notes, trade-offs, follow-up work, and verification details.

## Authoring and Maintenance

- Copy `ADR_TEMPLATE.md` to `ADR-XXX-<kebab-case-title>.md`, assign the next zero-padded number, and replace every placeholder.
- Create a new ADR for a new architectural decision. Update an existing ADR when implementation evidence, verification, or follow-up state changes without changing the decision's architectural scope.
- Keep the four required Status fields exactly as written: `Decision Status`, `Date Created`, `Date Updated`, and `Verification Status`.
- Preserve the original `Date Created`; change `Date Updated` only for a material ADR update.
- Use `Proposed`, `Accepted`, `Deprecated`, or `Superseded` for Decision Status and `Pending`, `Passed`, or `Failed` for Verification Status.
- Keep Follow-up Actions only for pending, blocked, ongoing, or deliberately deferred work. Record completed implementation in an Implementation Note and verification commands/results in a Test Plan.
- Do not use Markdown tables in ADRs or this index. Represent alternatives, trade-offs, overview entries, and other repeated structured information as named records with bold field labels, following the template.
- Keep the required Options Considered and Trade-offs field labels exactly as defined by the template. Record Follow-up Actions as the template's todo checklist: a checkbox per item with an action title, an em dash current state, and an optional indented explanation line.
- Update this index in the same change whenever an ADR is added, renamed, renumbered, consolidated, superseded, or materially changes status, scope, relationships, or next steps. Keep the sequence summary, next-number pointer, overview entries, consolidation analysis, and priorities mutually consistent.
- When records are consolidated or split and regrouped, reframe each surviving record around its resulting authority, carry every substantive claim to a clear owner, add a `Supersession` status field naming absorbed records by title, and delete the retired files.
- After a consolidation or reorganization, renumber the later ADRs so the sequence stays contiguous, renaming each file and rewriting every cross-reference in the same change.
- Confirm every Markdown link resolves, every overview status matches its ADR, every Related ADR appears in the source record's References section, and no retired filename or number remains anywhere in the repository.
- Write prose and list items without hard wrapping. Preserve line-oriented Markdown for fenced code blocks.
- Run `bun run check` and `git diff --check` after ADR edits. Use only targeted local/no-cost tests; do not invoke paid or quota-limited providers for documentation verification.

## ADR Overview

Each Status field summarizes its ADR's `Decision Status` and `Verification Status`.

**ADR 1: [ADR-001](ADR-001-source-ingestion-and-normalization.md)**

- **ADR:** [ADR-001](ADR-001-source-ingestion-and-normalization.md)
- **Status:** Accepted · Passed
- **Decision:** Owns source identity, Step 0 classification and expansion, correctness-preserving discovery caches, supported ebook normalization, unsupported ACSM policy, conversion metadata, and the normalized handoff to execution.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md), [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)

**ADR 2: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)**

- **ADR:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- **Status:** Accepted · Passed
- **Decision:** Owns the command-neutral batch work plan, sole unversioned canonical pipeline manifest including the pooled OCR page ledger, canonical execution-to-resume selection parity, the narrow immutable completed-legacy-TTS additive bridge, provider-neutral non-mutating `resume --price`, and clean-ramp no-cost price verification.
- **Related ADRs:** [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-006](ADR-006-unify-error-handling-vocabulary.md), [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md), [ADR-016](ADR-016-distribute-ocr-pages-across-a-multi-provider-work-pool.md)

**ADR 3: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md)**

- **ADR:** [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md)
- **Status:** Accepted · Passed
- **Decision:** Removes strict single-use type indirection and the former `migrated/` namespace, keeps workflow-oriented type ownership, and preserves `src/types/index.ts` as the sole public `~/types` barrel.
- **Related ADRs:** [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)

**ADR 4: [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md)**

- **ADR:** [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md)
- **Status:** Accepted · Passed
- **Decision:** Owns the host setup lifecycle: managed tools, resumable integrity-checked acquisition, transfer admission, provenance, staging, promotion, truthful health/reporting, cleanup, and performance evidence. MuPDF and qpdf remain hermetic source builds.
- **Related ADRs:** [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-005](ADR-005-reduce-environment-variable-surface-area.md), [ADR-006](ADR-006-unify-error-handling-vocabulary.md), [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md), [ADR-015](ADR-015-distribute-the-cli-as-a-docker-image.md)

**ADR 5: [ADR-005](ADR-005-reduce-environment-variable-surface-area.md)**

- **ADR:** [ADR-005](ADR-005-reduce-environment-variable-surface-area.md)
- **Status:** Accepted · Passed
- **Decision:** Reduces the environment-variable surface by deleting dead overrides, moving test/config seams to typed parameters, and consolidating binary override behavior; ADR-015 owns the extracted container-detection flag and runtime consequences.
- **Related ADRs:** [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md), [ADR-015](ADR-015-distribute-the-cli-as-a-docker-image.md)

**ADR 6: [ADR-006](ADR-006-unify-error-handling-vocabulary.md)**

- **ADR:** [ADR-006](ADR-006-unify-error-handling-vocabulary.md)
- **Status:** Accepted · Passed
- **Decision:** Unifies error classes, CLI usage detection, retry helper failures, provider-failure classifiers, normalized exact-request rate-limit recovery, explicit bounded TTS ambiguous-redispatch authorization, timestamps, and concise diagnostic rendering across `src/` and `test/`.
- **Related ADRs:** [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md), [ADR-005](ADR-005-reduce-environment-variable-surface-area.md), [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-014](ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md), [ADR-018](ADR-018-sound-effects-and-multi-track-soundscape-pipeline.md), [ADR-020](ADR-020-quiet-passing-test-console-output.md)

**ADR 7: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md)**

- **ADR:** [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md)
- **Status:** Accepted · Passed
- **Decision:** Integrates comic with the central model infrastructure, native command tree, and shared hosted coordinator for LLM/image/QA/dialogue/SFX work; retires comic's parallel model/parser/dispatcher/help stacks and moves links selection onto the native parse boundary.
- **Related ADRs:** [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md), [ADR-005](ADR-005-reduce-environment-variable-surface-area.md), [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-011](ADR-011-add-refresh-metadata-to-links.md)

**ADR 8: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)**

- **ADR:** [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)
- **Status:** Accepted · Passed
- **Decision:** Owns the cross-command work-unit inventory and run-scoped hosted admission policy: default five-second provider/account ramps, immediate mode, class and lane caps, exact-token 429 recovery, additive telemetry, clean-ramp price modeling, domain-specific selector fairness, and separation of lane pressure from explicit TTS duplicate-spend authorization.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-006](ADR-006-unify-error-handling-vocabulary.md), [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-014](ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md), [ADR-016](ADR-016-distribute-ocr-pages-across-a-multi-provider-work-pool.md)

**ADR 9: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)**

- **ADR:** [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- **Status:** Accepted · Passed
- **Decision:** Owns Step 2 URL and OCR execution plus artifacts: explicit article/X-Space routing, canonical-map-derived route-aware provider selection/resume, Tesseract-only local OCR, retry-aware hosted failures, fan-out and composite pool artifacts, page attribution, cache/profile qualification, `auto|fixed` OCR ceilings approached through shared hosted lanes, calibrated pricing/diagnostics, and shared chapter filenames.
- **Related ADRs:** [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md), [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md), [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-016](ADR-016-distribute-ocr-pages-across-a-multi-provider-work-pool.md)

**ADR 10: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)**

- **ADR:** [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- **Status:** Accepted · Passed
- **Decision:** Owns durable cross-modality hosted-model policy: fixed selector identity, lifecycle/default/all eligibility, typed canonical provider/model descriptors shared with resume, complete capability validation and routing, normalized reasoning, pricing provenance, calibration promotion, historical readability, and no silent substitution or coercion.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md), [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md), [ADR-011](ADR-011-add-refresh-metadata-to-links.md), [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md), [ADR-013](ADR-013-2026-hosted-model-refresh-ledger.md), [ADR-014](ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md), [ADR-018](ADR-018-sound-effects-and-multi-track-soundscape-pipeline.md)

**ADR 11: [ADR-011](ADR-011-add-refresh-metadata-to-links.md)**

- **ADR:** [ADR-011](ADR-011-add-refresh-metadata-to-links.md)
- **Status:** Accepted · Passed
- **Decision:** Adds direct URL and input-file `links` modes, model reference selections, and optional `--refresh` metadata sidecars with token/hash change tracking.
- **Related ADRs:** [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md), [ADR-013](ADR-013-2026-hosted-model-refresh-ledger.md)

**ADR 12: [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md)**

- **ADR:** [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md)
- **Status:** Superseded · Passed
- **Decision:** Owns benchmark evidence from primary-source refresh through local checks, price-only preflight, exact paid approval, validation, repair, compaction, and regeneration, including the retained four-run TTS cohort's `$1.09022` initial preflight, 34 successful first-pass outputs, 17 successful corrected follow-up outputs, preserved DeepInfra hard-input failure, and final 51-of-52 current-model result, plus self-contained JSON/Markdown/offline-HTML reports with weighted rankings and deterministic quality-cost terciles. Retained as historical authority after CLI benchmark command removal.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-011](ADR-011-add-refresh-metadata-to-links.md), [ADR-013](ADR-013-2026-hosted-model-refresh-ledger.md), [ADR-018](ADR-018-sound-effects-and-multi-track-soundscape-pipeline.md)

**ADR 13: [ADR-013](ADR-013-2026-hosted-model-refresh-ledger.md)**

- **ADR:** [ADR-013](ADR-013-2026-hosted-model-refresh-ledger.md)
- **Status:** Accepted · Passed
- **Decision:** Records the dated 2026 hosted-model additions, replacements, retirements, exclusions, provider transport corrections, compatibility branches, and final selector counts across write, OCR, STT, TTS, music, image, and video, including the implemented 2026-08-16 reductions to 3 music, 22 image, and 16 video selectors while `grok-imagine-image-2.0` and direct `MiniMax-H3` remain unavailable.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md), [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-011](ADR-011-add-refresh-metadata-to-links.md), [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md), [ADR-014](ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md), [ADR-018](ADR-018-sound-effects-and-multi-track-soundscape-pipeline.md)

**ADR 14: [ADR-014](ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md)**

- **ADR:** [ADR-014](ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md)
- **Status:** Accepted · Passed
- **Decision:** Establishes shared character-voice, provisioning, capability, native/segmented rendering, timing, compact scene-run output retention, hosted dialogue scheduling, and ambiguous-redispatch contracts; requires truthful capability behavior across all 16 TTS providers; and provides durable voice management for ElevenLabs `eleven_v3`, Inworld `realtime-tts-2`, Fish `s2.1-pro`, Cartesia `sonic-3.5-2026-05-04`, and Speechify `simba-3.2`.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md), [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md), [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-013](ADR-013-2026-hosted-model-refresh-ledger.md), [ADR-018](ADR-018-sound-effects-and-multi-track-soundscape-pipeline.md), [ADR-019](ADR-019-synchronize-comic-panels-with-manifest-backed-audio.md)

**ADR 15: [ADR-015](ADR-015-distribute-the-cli-as-a-docker-image.md)**

- **ADR:** [ADR-015](ADR-015-distribute-the-cli-as-a-docker-image.md)
- **Status:** Accepted · Passed
- **Decision:** Owns the additive Debian slim local-lite Docker image, build context, non-root runtime, tool and Tesseract contracts, direct image invocation and mount behavior, credential boundary, and multi-architecture GHCR publication with OCI provenance.
- **Related ADRs:** [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md), [ADR-005](ADR-005-reduce-environment-variable-surface-area.md), [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)

**ADR 16: [ADR-016](ADR-016-distribute-ocr-pages-across-a-multi-provider-work-pool.md)**

- **ADR:** [ADR-016](ADR-016-distribute-ocr-pages-across-a-multi-provider-work-pool.md)
- **Status:** Accepted · Passed
- **Decision:** Adds explicit `fanout|pool` OCR execution while retaining fan-out by default; pool mode uses one dynamically claimed page queue, exactly-once canonical acceptance, run-scoped provider/account ramps, composite artifacts, page-level resume, attributed actual usage, and heuristic unfinished-page pricing.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)

**ADR 17: [ADR-017](ADR-017-govern-readme-command-examples-as-executable-contracts.md)**

- **ADR:** [ADR-017](ADR-017-govern-readme-command-examples-as-executable-contracts.md)
- **Status:** Proposed · Pending
- **Decision:** Governs every shell-like command occurrence in the root README and all Markdown beneath `docs/` through exhaustive classification, policy-aware local verification, stable fixtures, provider/network/state safety, and occurrence-based evidence and cost reporting.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md), [ADR-006](ADR-006-unify-error-handling-vocabulary.md), [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md), [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md), [ADR-014](ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md), [ADR-015](ADR-015-distribute-the-cli-as-a-docker-image.md)

**ADR 18: [ADR-018](ADR-018-sound-effects-and-multi-track-soundscape-pipeline.md)**

- **ADR:** [ADR-018](ADR-018-sound-effects-and-multi-track-soundscape-pipeline.md)
- **Status:** Accepted · Passed
- **Decision:** Adds provider-neutral sound intent, strict cue-to-dialogue timeline resolution, reusable sound-effect generation with durable admission and shared hosted lane recovery, a deterministic four-bus mixer, and evidence-gated seven-phase delivery across ElevenLabs, Cartesia/Hume/MiniMax, Inworld, DeepInfra, Replicate, Fish Audio, and Meta AudioGen.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md), [ADR-006](ADR-006-unify-error-handling-vocabulary.md), [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md), [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md), [ADR-013](ADR-013-2026-hosted-model-refresh-ledger.md), [ADR-014](ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md), [ADR-019](ADR-019-synchronize-comic-panels-with-manifest-backed-audio.md)

**ADR 19: [ADR-019](ADR-019-synchronize-comic-panels-with-manifest-backed-audio.md)**

- **ADR:** [ADR-019](ADR-019-synchronize-comic-panels-with-manifest-backed-audio.md)
- **Status:** Accepted · Passed
- **Decision:** Adds the local manifest-backed still-panel presentation layer: exact source reconciliation, panel-owned dialogue and effects, sequential timing, derived audio recomposition, immutable resume, and same-size H.264/AAC hard-cut rendering without provider calls or source-run mutation.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md), [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md), [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md), [ADR-014](ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md), [ADR-018](ADR-018-sound-effects-and-multi-track-soundscape-pipeline.md)

**ADR 20: [ADR-020](ADR-020-quiet-passing-test-console-output.md)**

- **ADR:** [ADR-020](ADR-020-quiet-passing-test-console-output.md)
- **Status:** Accepted · Passed
- **Decision:** Passing tests print only the result line; failing tests keep that line plus the captured console output from that test. JUnit remains a post-run sidecar.
- **Related ADRs:** [ADR-006](ADR-006-unify-error-handling-vocabulary.md)

**ADR 21: [ADR-021](ADR-021-end-the-write-pipeline-at-step-3.md)**

- **ADR:** [ADR-021](ADR-021-end-the-write-pipeline-at-step-3.md)
- **Status:** Accepted · Passed
- **Decision:** Binds the `write` command strictly to steps 0–3 (metadata, download, extract, LLM text writing), severing all TTS, image, video, and music generation execution, pricing, flags, selectors, and options from `write` in favor of standalone follow-on commands (`tts`, `image`, `video`, `music`).
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md)

## Consolidation Analysis

The remaining analysis covers the current set of 21 records. Durable hosted-model policy belongs to ADR-010, benchmark proof belongs to ADR-012, dated provider/model changes belongs to ADR-013, voice-resource/runtime architecture remains independently findable in ADR-014, Docker distribution belongs to ADR-015 rather than the host setup authority, pooled OCR policy belongs to ADR-016 while persistence, scheduling mechanics, and artifact contracts remain in ADR-002, ADR-008, and ADR-009, whole-documentation command governance belongs to ADR-017 as a cross-command verification contract, provider-neutral soundscape intent and source mixes belong to ADR-018, derived panel synchronization and still-image presentation belongs to ADR-019, test-console quiet-on-pass policy belongs to ADR-020, and write pipeline boundaries at step 3 belong to ADR-021.

### Remaining Boundaries

**ADR set 1: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) + [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md) + [ADR-013](ADR-013-2026-hosted-model-refresh-ledger.md)**

- **ADRs:** [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) + [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md) + [ADR-013](ADR-013-2026-hosted-model-refresh-ledger.md)
- **Recommendation:** Keep separate.
- **Current rationale:** Durable policy, proof, and dated history are independently discoverable authorities; combining any pair would mix concerns with different maintenance lifecycles.

**ADR set 2: [ADR-013](ADR-013-2026-hosted-model-refresh-ledger.md) + [ADR-014](ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md)**

- **ADRs:** [ADR-013](ADR-013-2026-hosted-model-refresh-ledger.md) + [ADR-014](ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md)
- **Recommendation:** Keep separate.
- **Current rationale:** Selector/catalog history and provider compatibility belong to the dated ledger; voice identity, protected resources, immutable snapshots, dialogue planning, rendering, timing, and operation-scoped artifacts are durable audio architecture.

**ADR set 3: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) + [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)**

- **ADRs:** [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) + [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- **Recommendation:** Keep separate after the completed shared-code alignment.
- **Current rationale:** ADR-008 is the cross-command lane inventory and ADR-009 is extract execution policy. A pairwise merge would bury TTS and STT scheduling inside extract.

**ADR set 4: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) + [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) + [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md) + [ADR-016](ADR-016-distribute-ocr-pages-across-a-multi-provider-work-pool.md)**

- **ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) + [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) + [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md) + [ADR-016](ADR-016-distribute-ocr-pages-across-a-multi-provider-work-pool.md)
- **Recommendation:** Keep separate.
- **Current rationale:** ADR-016 records the product-level choice between full-document fan-out and a composite page pool; ADR-002 remains the sole persistence/resume/price authority, ADR-008 owns cross-command work selection and lanes, and ADR-009 owns OCR execution, failures, cache/profile qualification, usage, diagnostics, and artifacts.

**ADR set 5: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md) + [ADR-011](ADR-011-add-refresh-metadata-to-links.md)**

- **ADRs:** [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md) + [ADR-011](ADR-011-add-refresh-metadata-to-links.md)
- **Recommendation:** Keep separate pairwise.
- **Current rationale:** `links` reuses URL acquisition internals, but curated documentation capture, selection, tokenization, and refresh sidecars are not pipeline extraction.

**ADR set 6: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) + [ADR-005](ADR-005-reduce-environment-variable-surface-area.md) + [ADR-006](ADR-006-unify-error-handling-vocabulary.md)**

- **ADRs:** [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) + [ADR-005](ADR-005-reduce-environment-variable-surface-area.md) + [ADR-006](ADR-006-unify-error-handling-vocabulary.md)
- **Recommendation:** Keep separate.
- **Current rationale:** These records share a cleanup method, not an authority: type ownership, configuration channels, and error vocabulary remain independently discoverable contracts.

**ADR set 7: [ADR-006](ADR-006-unify-error-handling-vocabulary.md) + [ADR-020](ADR-020-quiet-passing-test-console-output.md)**

- **ADRs:** [ADR-006](ADR-006-unify-error-handling-vocabulary.md) + [ADR-020](ADR-020-quiet-passing-test-console-output.md)
- **Recommendation:** Keep separate.
- **Current rationale:** ADR-006 owns error vocabulary and timestamp rendering; ADR-020 owns the test-process console invert for pass versus fail.

**ADR set 8: [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md) + [ADR-015](ADR-015-distribute-the-cli-as-a-docker-image.md)**

- **ADRs:** [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md) + [ADR-015](ADR-015-distribute-the-cli-as-a-docker-image.md)
- **Recommendation:** Keep separate after the completed extraction.
- **Current rationale:** Host acquisition, managed source builds, and setup reporting have a different lifecycle from image contents, mount semantics, registry publication, architecture manifests, and provenance.

**ADR set 9: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) + [ADR-017](ADR-017-govern-readme-command-examples-as-executable-contracts.md)**

- **ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) + [ADR-017](ADR-017-govern-readme-command-examples-as-executable-contracts.md)
- **Recommendation:** Keep separate.
- **Current rationale:** ADR-002 owns command-neutral planning, persistence, resume, and dry-run architecture; ADR-017 owns the curated documentation surface, example classifications, fixtures, safety assertions, and aggregate evidence that exercise those contracts across commands.

**ADR set 10: [ADR-014](ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md) + [ADR-018](ADR-018-sound-effects-and-multi-track-soundscape-pipeline.md) + [ADR-019](ADR-019-synchronize-comic-panels-with-manifest-backed-audio.md)**

- **ADRs:** [ADR-014](ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md) + [ADR-018](ADR-018-sound-effects-and-multi-track-soundscape-pipeline.md) + [ADR-019](ADR-019-synchronize-comic-panels-with-manifest-backed-audio.md)
- **Recommendation:** Keep separate.
- **Current rationale:** ADR-014 owns voice identity, dialogue rendering, and the original dialogue clock; ADR-018 owns authored sound intent, retained effects, buses, and the original soundscape mix; ADR-019 is their read-only derived consumer for panel ownership, sequential presentation timing, presentation remixing, and still-image video output.

### Recommended Order of Work

No further consolidation is currently recommended. Preserve the ADR-010/ADR-012/ADR-013 boundary, keep host setup mechanics in ADR-004 and Docker distribution in ADR-015, keep source ingestion, extract execution, pipeline state, and the explicit pooled OCR decision in ADR-001/ADR-009/ADR-002/ADR-016 respectively, implement ADR-017 as a cross-command verification layer rather than absorbing it into any one workflow authority, keep ADR-018's soundscape authority downstream of ADR-014's durable voice and dialogue contracts, maintain ADR-018's seven-phase provider delivery without unverified capability expansion, and keep ADR-019 as the derived presentation consumer of both audio authorities.

## Next Steps

This section lists every ADR with unfinished work: pending or reopened implementation, partial phase gates, work blocked on an explicit paid-run approval, and deliberately deferred follow-ups. Never-ending "Ongoing" and "Ongoing guardrail" maintenance items (ADR-002, ADR-008, ADR-009, ADR-010, ADR-012, ADR-013) are excluded because they have no completion state. Each row summarizes the source ADR's Follow-up Actions; the ADR remains the authority for exact scope and evidence requirements.

**ADR 1: [ADR-017](ADR-017-govern-readme-command-examples-as-executable-contracts.md)**

- **ADR:** [ADR-017](ADR-017-govern-readme-command-examples-as-executable-contracts.md)
- **Priority:** High
- **Next step:** Work the pending P0–P3 backlog in order: P0 fail-closed provider/network guards, filesystem/config isolation, and config-plus-price mutation rejection; P1 whole-docs occurrence inventory, structured price envelopes, offline fixtures, and quiet-price/end-of-options/EPUB-planning/article-route corrections; P2 static risk policies and parser/registry cross-checks; P3 occurrence/cost reports and gated documentation-example updates.

**ADR 2: [ADR-013](ADR-013-2026-hosted-model-refresh-ledger.md)**

- **ADR:** [ADR-013](ADR-013-2026-hosted-model-refresh-ledger.md)
- **Priority:** Medium
- **Next step:** With the 2026-08-18 write additions of `gemini-3.7-flash` and `grok-4.6` implemented, complete their P1 extract (OCR) registrations, then the remaining recommended selectors after adapter and pricing confirmation.

**ADR 3: [ADR-013](ADR-013-2026-hosted-model-refresh-ledger.md)**

- **ADR:** [ADR-013](ADR-013-2026-hosted-model-refresh-ledger.md)
- **Priority:** Medium
- **Next step:** Promote the implemented 2026-08-14 OCR expansion's provisional token-billed page heuristics and the benchmark-calibrated Florence compute-second estimate through approved ADR-012 calibration; blocked on immediate approval for each exact paid calibration run.

**ADR 4: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)**

- **ADR:** [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- **Priority:** Medium
- **Next step:** Collect reasoning-qualified token samples so provisional OCR registry shapes can become promotion-eligible; blocked on explicit approval for each paid provider run.

**ADR 5: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)**

- **ADR:** [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- **Priority:** Medium
- **Next step:** Calibrate materially different reasoning levels and provisional model heuristics; deferred pending immediate approval for each exact paid run.

**ADR 6: [ADR-013](ADR-013-2026-hosted-model-refresh-ledger.md)**

- **ADR:** [ADR-013](ADR-013-2026-hosted-model-refresh-ledger.md)
- **Priority:** Low
- **Next step:** Watch Cartesia for a dated Sonic 3.6 snapshot; do not register `sonic-preview`.

**ADR 7: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)**

- **ADR:** [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- **Priority:** Low
- **Next step:** Evaluate provider-specific `xhigh` only through an explicit public-enum expansion, and take deAPI/OpenAI STT (deAPI diarization lives on unimplemented `WhisperLargeV3Ct2`, not `WhisperLargeV3`), streaming/dedicated STT, realtime/cover/reference-audio music, SkyReels V4, and Helios through separate architecture decisions (the matching ADR-013 recheck row defers to the same future decisions).

**ADR 8: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md)**

- **ADR:** [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md)
- **Priority:** Low
- **Next step:** Run the two deferred cleanup reviews: the excluded exported buckets (257 one-file multiple-use, 155 internal-reference) and the 39 multi-reference non-exported declarations.

ADR-013 image, music, and video removals are implemented. Current active counts are 22 image, 3 music, and 16 video selectors; `grok-imagine-image-2.0` is unavailable and was not added.
