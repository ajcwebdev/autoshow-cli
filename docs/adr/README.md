# Architecture Decision Records

Index for ADR-001 through ADR-019. Nineteen records are Accepted · Passed. The next new ADR is 020. Use [ADR_TEMPLATE.md](ADR_TEMPLATE.md) for new records and material updates. Current model catalogs live under `src/cli/commands/setup-and-utilities/models/`, and CLI usage lives under `docs/commands/`.

## Authoring and Maintenance

- Copy the template's Markdown block to `ADR-XXX-<kebab-case-title>.md`, assign the next zero-padded number, and replace every placeholder. Follow the template for required sections, status fields, Follow-up Actions, and Options Considered / Trade-offs labels.
- Create a new ADR for a new architectural decision. Update an existing ADR when implementation evidence, verification, or follow-up state changes without changing the decision's architectural scope.
- Do not use Markdown tables in ADRs or this index. Represent alternatives, trade-offs, overview entries, and other repeated structured information as named records with bold field labels.
- Update this index in the same change whenever an ADR is added, renamed, renumbered, consolidated, superseded, or materially changes status, scope, relationships, or next steps. Keep the sequence summary, next-number pointer, overview entries, and next steps consistent.
- When records are consolidated or split and regrouped, reframe each surviving record around its resulting authority, carry every substantive claim to a clear owner, add a `Supersession` status field naming absorbed records by title, and delete the retired files. Then renumber later ADRs so the sequence stays contiguous, renaming each file and rewriting every cross-reference in the same change.
- Confirm every Markdown link resolves, every overview status matches its ADR, every Related ADR appears in the source record's References section, and no retired filename or number remains anywhere in the repository.
- Write prose and list items without hard wrapping. Preserve line-oriented Markdown for fenced code blocks.
- Run `bun run check` and `git diff --check` after ADR edits. Use only targeted local/no-cost tests; do not invoke paid or quota-limited providers for documentation verification.

## ADR Overview

Each Status field summarizes its ADR's `Decision Status` and `Verification Status`.

**ADR 1: [ADR-001](ADR-001-source-ingestion-and-normalization.md)**

- **Status:** Accepted · Passed
- **Decision:** Classify and normalize sources before execution, with explicit article and X Space routes, reusable discovery caches, supported ebook conversion, and local rejection of ACSM files.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md), [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md), [ADR-009](ADR-009-stt-timing-captions-and-alignment.md)

**ADR 2: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)**

- **Status:** Accepted · Passed
- **Decision:** Use one canonical pipeline manifest and shared selection rules for execution, resume, and non-mutating `resume --price`; record effective provider settings without changing purchased-work identity.
- **Related ADRs:** [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-005](ADR-005-cli-error-result-and-retry-contract.md), [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md), [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md), [ADR-009](ADR-009-stt-timing-captions-and-alignment.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md), [ADR-013](ADR-013-comic-scene-audio-and-presentation.md), [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md)

**ADR 3: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md)**

- **Status:** Accepted · Passed
- **Decision:** Remove strict single-use type indirection, organize types by workflow, and keep one public type export surface.
- **Related ADRs:** [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md), [ADR-009](ADR-009-stt-timing-captions-and-alignment.md)

**ADR 4: [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md)**

- **Status:** Accepted · Passed
- **Decision:** Manage host tools with verified downloads and explicit resolver precedence, keep credentials in the environment, expose runtime controls through CLI/configuration, and use `setup --doctor --strict` as the readiness gate.
- **Related ADRs:** [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-005](ADR-005-cli-error-result-and-retry-contract.md), [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md), [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md), [ADR-019](ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md)

**ADR 5: [ADR-005](ADR-005-cli-error-result-and-retry-contract.md)**

- **Status:** Accepted · Passed
- **Decision:** Provide consistent errors and exit codes, text diagnostics and versioned `--json` output with one terminal JSON result, and explicit retry ownership. Ambiguous TTS/comic-audio recovery requires reconciliation or `--allow-ambiguous-redispatch` before another paid attempt.
- **Related ADRs:** [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md), [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md), [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md), [ADR-013](ADR-013-comic-scene-audio-and-presentation.md), [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md), [ADR-016](ADR-016-quiet-passing-test-console-output.md)

**ADR 6: [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md)**

- **Status:** Accepted · Passed
- **Decision:** Separate extraction, text writing, and media generation; keep comic operations as subcommands, `voice` and `comic review` as canonical surfaces with temporary deprecated aliases, and `resume` as the recovery command.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-005](ADR-005-cli-error-result-and-retry-contract.md), [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md), [ADR-009](ADR-009-stt-timing-captions-and-alignment.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-011](ADR-011-links-selection-grammar-and-refresh-metadata.md), [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md), [ADR-013](ADR-013-comic-scene-audio-and-presentation.md), [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md), [ADR-017](ADR-017-comic-script-and-scene-authoring.md), [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md)

**ADR 7: [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md)**

- **Status:** Accepted · Passed
- **Decision:** Decompose work into schedulable units and apply shared provider admission, concurrency caps, and rate-limit recovery across commands, including comic.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-005](ADR-005-cli-error-result-and-retry-contract.md), [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md), [ADR-013](ADR-013-comic-scene-audio-and-presentation.md), [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md)

**ADR 8: [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md)**

- **Status:** Accepted · Passed
- **Decision:** Support local Tesseract and hosted OCR, evidence-qualified pricing, ordered chapter artifacts, default full-document fan-out, and an explicit shared page pool with page-level resume and attributed usage.
- **Related ADRs:** [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md), [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-009](ADR-009-stt-timing-captions-and-alignment.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md), [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md)

**ADR 9: [ADR-009](ADR-009-stt-timing-captions-and-alignment.md)**

- **Status:** Accepted · Passed
- **Decision:** Preserve STT timing provenance, validate caption coverage, export without repeating transcription, and support capability-checked diarization, local alignment, and reviewed transcript reconciliation.
- **Related ADRs:** [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md), [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md)

**ADR 10: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)**

- **Status:** Accepted · Passed
- **Decision:** Share fixed model identities, lifecycle/default policies, capability validation, reasoning controls, and pricing provenance across commands; reject unsupported or retired selections without silent substitution.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md), [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md), [ADR-009](ADR-009-stt-timing-captions-and-alignment.md), [ADR-011](ADR-011-links-selection-grammar-and-refresh-metadata.md), [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md), [ADR-013](ADR-013-comic-scene-audio-and-presentation.md), [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md), [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md)

**ADR 11: [ADR-011](ADR-011-links-selection-grammar-and-refresh-metadata.md)**

- **Status:** Accepted · Passed
- **Decision:** Keep order-sensitive provider/model selection for `links`, direct URL and input-file modes, optional refresh metadata and change findings, and standard run-directory output.
- **Related ADRs:** [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md)

**ADR 12: [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md)**

- **Status:** Accepted · Passed
- **Decision:** Keep standalone synthesis and voice management explicit, validate provider capabilities, reuse purchased audio, and separate synthesis identity from chunking, mastering, and delivery exports.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md), [ADR-005](ADR-005-cli-error-result-and-retry-contract.md), [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md), [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-013](ADR-013-comic-scene-audio-and-presentation.md), [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md), [ADR-019](ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md)

**ADR 13: [ADR-013](ADR-013-comic-scene-audio-and-presentation.md)**

- **Status:** Accepted · Passed
- **Decision:** Generate comic audio from approved voices, resolve dialogue and sound cues on one timeline, use ElevenLabs for hosted sound effects, render local still-panel slideshows, and recover recorded work through `resume`.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md), [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md), [ADR-005](ADR-005-cli-error-result-and-retry-contract.md), [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md), [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md), [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md), [ADR-017](ADR-017-comic-script-and-scene-authoring.md)

**ADR 14: [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)**

- **Status:** Accepted · Passed
- **Decision:** Distribute an optional Debian slim Docker image with a non-root runtime, explicit mount and credential contracts, and native acceptance gates before multi-architecture GHCR promotion.
- **Related ADRs:** [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md), [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md), [ADR-019](ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md)

**ADR 15: [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md)**

- **Status:** Accepted · Passed
- **Decision:** Validate documented CLI examples without executing them; require primary-source evidence, local contracts, price preflight, automatic authorization below $1 in cumulative related spending or explicit approval for unknown or higher costs, and artifact validation for provider benchmarks.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md), [ADR-005](ADR-005-cli-error-result-and-retry-contract.md), [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md), [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md), [ADR-009](ADR-009-stt-timing-captions-and-alignment.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-011](ADR-011-links-selection-grammar-and-refresh-metadata.md), [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md), [ADR-013](ADR-013-comic-scene-audio-and-presentation.md), [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)

**ADR 16: [ADR-016](ADR-016-quiet-passing-test-console-output.md)**

- **Status:** Accepted · Passed
- **Decision:** Buffer supported console output inside tests and reveal it for failures; keep `bun t` terminal output focused on failures while retaining logs and machine-readable reports.
- **Related ADRs:** [ADR-005](ADR-005-cli-error-result-and-retry-contract.md)

**ADR 17: [ADR-017](ADR-017-comic-script-and-scene-authoring.md)**

- **Status:** Accepted · Passed
- **Decision:** Turn treatments into validated comic scripts and scenes, share a blocking plan between image generation and QA, keep unmeasured blocking checks advisory, and support local review before further generation.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-005](ADR-005-cli-error-result-and-retry-contract.md), [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-013](ADR-013-comic-scene-audio-and-presentation.md), [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md), [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md)

**ADR 18: [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md)**

- **Status:** Accepted · Passed
- **Decision:** Derive help from capability registries and use shared provider-scoped controls, scoped concurrency flags, and comic role-provider selectors instead of separate provider-prefixed flag families.
- **Related ADRs:** [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md), [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md)

**ADR 19: [ADR-019](ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md)**

- **Status:** Accepted · Passed
- **Decision:** Accept successful HTTP payloads whole or fail with an actionable size error; apply payload-class limits and a validated environment override, preserve paid downloads streamed to disk, and avoid retrying oversize bodies.
- **Related ADRs:** [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md), [ADR-005](ADR-005-cli-error-result-and-retry-contract.md), [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md), [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)

## Consolidation Analysis

The 2026-09-22 consolidation regrouped twenty-seven records into nineteen by command family and shared policy. Each surviving record's Supersession field identifies its absorbed decisions. Source normalization and pipeline state remain separate; OCR and STT have separate extraction records; standalone TTS and comic audio have separate workflow records. Registry policy, CLI help, provider admission, retries, and HTTP payload limits retain distinct owners.

Relevant Bun 1.4 migration decisions remain with their owners: [type declarations](ADR-003-type-surface-cleanup-and-architecture-mirroring.md#bun-14-image-declarations), [image routing](ADR-008-ocr-execution-pooling-and-artifacts.md#bun-14-image-routing), and [Docker runtime and native release evidence](ADR-014-distribute-the-cli-as-a-docker-image.md#bun-14-migration-evidence). Current setup and Docker instructions live in the command documentation and [Docker guide](../docker.md).

## Next Steps

Five ADRs have open follow-up work. Each item summarizes the source record's Follow-up Actions; that record remains the authority for scope and evidence.

**Item 1: [ADR-017](ADR-017-comic-script-and-scene-authoring.md#follow-up-actions)**

- **Priority:** High
- **Next step:** Run the continuity baseline and the ten-panel prompt ablation as owner-run paid commands, then use their per-key precision to decide which blocking audit statuses `--blocking-hard-keys` promotes from advisory to hard. Reviewed location geometry, and the rendered blocking card and coverage keyframes, remain pending behind that measurement. Also decide how a first-try production should promote judge-retained originals when every hard failure is set-continuity, and whether a per-location style image should replace the catalog-wide `styleImage`.

**Item 2: [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md#follow-up-actions)**

- **Priority:** Medium
- **Next step:** Review the retained `eleven_v3` pilot audio before treating perceptual quality as established. Re-mastering completed runs from retained slots and re-export for single-file runs in an existing directory remain pending.

**Item 3: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md#follow-up-actions)**

- **Priority:** Low
- **Next step:** Run the two deferred cleanup reviews: remaining multi-use exported declarations, and remaining multi-reference non-exported declarations.

**Item 4: [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md#follow-up-actions)**

- **Priority:** Low
- **Next step:** After the compatibility release, remove deprecated `comic reference-voice`, `comic review-sheet`, and `comic review-notes` aliases in a later announced breaking CLI release.

**Item 5: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md#follow-up-actions)**

- **Priority:** Low
- **Next step:** Restore the remaining generation and TTS controls from saved settings, and hash lyrics files in music settings.
