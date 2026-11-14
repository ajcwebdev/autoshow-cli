# Architecture Decision Records

All 19 records are Accepted. Verification is Pending for ADR-002, ADR-012, and ADR-017; the others are Passed within their stated verification limits. Passing local contracts does not establish live-provider or subjective media quality. The next ADR is **020**.

## Records

- [ADR-001: Source Ingestion and Normalization](ADR-001-source-ingestion-and-normalization.md)
- [ADR-002: Pipeline State, Resume, and Dry-Run Planning](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- [ADR-003: Type Surface and Subsystem Ownership](ADR-003-type-surface-cleanup-and-architecture-mirroring.md)
- [ADR-004: Setup, Toolchain, and Runtime Configuration](ADR-004-setup-toolchain-and-runtime-configuration.md)
- [ADR-005: CLI Errors, Results, and Retries](ADR-005-cli-error-result-and-retry-contract.md)
- [ADR-006: Command Boundaries and Deprecations](ADR-006-top-level-command-boundaries-and-deprecations.md)
- [ADR-007: Work Units and Concurrency Lanes](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md)
- [ADR-008: OCR Execution, Pooling, and Artifacts](ADR-008-ocr-execution-pooling-and-artifacts.md)
- [ADR-009: STT Timing, Captions, and Alignment](ADR-009-stt-timing-captions-and-alignment.md)
- [ADR-010: Hosted Model Registry Policy](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- [ADR-011: Links Selection and Refresh](ADR-011-links-selection-grammar-and-refresh-metadata.md)
- [ADR-012: TTS, Voice Management, and Delivery](ADR-012-tts-synthesis-voice-management-and-delivery.md)
- [ADR-013: Comic Audio and Presentation](ADR-013-comic-scene-audio-and-presentation.md)
- [ADR-014: Docker Distribution](ADR-014-distribute-the-cli-as-a-docker-image.md)
- [ADR-015: Documentation and Verification Evidence](ADR-015-govern-documentation-examples-and-verification-evidence.md)
- [ADR-016: Quiet Passing Tests](ADR-016-quiet-passing-test-console-output.md)
- [ADR-017: Comic Script and Scene Authoring](ADR-017-comic-script-and-scene-authoring.md)
- [ADR-018: Registry-Derived Help and Shared Flags](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md)
- [ADR-019: Whole HTTP Bodies and Payload Ceilings](ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md)

## Open Work

- [Resume settings and content hashes](ADR-002-pipeline-state-resume-and-dry-run-planning.md#follow-up-actions)
- [Type cleanup reviews](ADR-003-type-surface-cleanup-and-architecture-mirroring.md#follow-up-actions)
- [Deprecated alias removal](ADR-006-top-level-command-boundaries-and-deprecations.md#follow-up-actions)
- [TTS listening review and delivery tools](ADR-012-tts-synthesis-voice-management-and-delivery.md#follow-up-actions)
- [Comic validation and design decisions](ADR-017-comic-script-and-scene-authoring.md#follow-up-actions)

## Maintenance

Use the [template](ADR_TEMPLATE.md) for new records. Keep existing records focused on current decisions; Git retains their history. Preserve IDs and creation dates, update status and open-work links together, and check local links after edits. Operational instructions belong in [command guides](../commands/) and the [Docker guide](../docker.md).

Shared verification:

```bash
bun run check
bun t --price
git diff --check
```

Run focused local behavioral checks when the decision requires them. Paid execution and full-suite authorization follow [repository rules](../../AGENTS.md).
