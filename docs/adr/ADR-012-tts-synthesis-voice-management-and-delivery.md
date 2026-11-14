# ADR-012: TTS, Voice Management, and Delivery

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-10
- **Date Updated:** 2026-11-14
- **Verification Status:** Pending

## Context

Standalone narration and comic dialogue need the same explicit voice dispatch, capability checks, consent, and recoverable paid audio. Mastering and export changes must reuse purchased speech rather than buy it again.

## Decision

One provider-neutral subsystem beneath `tts` and comic owns voice capabilities/lifecycle, native and segmented synthesis, timing, paid slots, and delivery. Comic owns its scene plans and mixes under [ADR-013](ADR-013-comic-scene-audio-and-presentation.md). Models and management capabilities come from registries; eligibility follows [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md#subscription-free-api-eligibility).

### Voice lifecycle and preflight

`tts` uses existing voices; `voice` manages registration, discovery, design, clone, import, consent, approval, audition, retirement, and deletion. Each synthesis request receives its resolved voice explicitly, including a documented single-voice default. Speaker mappings never silently fall back to another voice. Provider-specific expression controls have no shared tag language.

Declared capability, implemented adapter, and current-account access are separate requirements. Preflight proceeds through local validation, authorized read-only readiness checks, then explicitly selected provisioning/synthesis. `--price` is entirely local and non-mutating. Credentials alone never prove access to gated operations.

Synthesis, configuration, resume, and cleanup cannot implicitly create or delete remote voices. Cloning requires recorded provenance and consent; deletion requires an explicit management action. Candidate creation, saving, audition, approval, retirement, and deletion remain distinct because their costs, permissions, and effects differ. Protected voice assets and consent records live outside output roots and the visual character catalog.

### Rendering and recovery

Standalone TTS selects native dialogue when model and speaker constraints permit, otherwise independent turn synthesis and local assembly. Native dialogue supports eligible ElevenLabs Text-to-Dialogue models and Gemini two-stock-voice synthesis. Authored overlaps and local voice effects require segmented rendering; explicit `--mode` belongs to comic. Provider continuity/stitching fields remain unused.

Work joins the shared hosted lanes of [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md). Ambiguous paid admissions stop automatic replay; later repurchase requires [explicit redispatch authorization](ADR-005-cli-error-result-and-retry-contract.md). Failures preserve successful audio and identify reusable and unresolved slots.

Reuse requires matching provider, model, voice, and speech-request identity plus verified retained evidence. A changed voice snapshot changes render identity without invalidating unrelated slots. `--price` subtracts reusable work, and fully reusable renders assemble without provider calls.

In-flight files are temporary only after successful publication. Incomplete/interrupted runs retain audio and reconciliation evidence. Completed standalone runs losslessly archive purchased clips in `slots/audio.zip` per item, alongside playable masters and compact render/timeline records. Price inspection validates the archive without extracting it; local assembly restores needed clips.

### Delivery and exports

Purchased-slot identity retains its historical output format. Mastering settings identify a separate render; container encoding, tags, cover art, and book assembly identify derived exports. Changing exports needs no new render or synthesis; changing pronunciation or chunked speech requests can require new purchases.

Smart chunking respects sentence boundaries, provider limits, and protected syntax. Dispatch, estimates, and joins use the same plan. Pronunciation lexicons apply before chunking; text preflight rejects documented unsupported markup.

The default `native` profile retains provider sample rate. `audiobook` uses 44.1 kHz mono, loudness normalization, and 500/1000 ms leading/trailing silence. Both preserve provider silence, with trimming off and zero join padding. Pause controls add only inter-chunk silence; opt-in trimming protects internal, ambiguous, and all-silent audio. `legacy-16k` preserves 16 kHz mono assembly without delivery mastering. Saved profiles retain their trim and gap values.

Exports derive from the WAV master as FLAC, MP3, M4A, or M4B, with optional metadata, cover art, and one book per directory with one chapter per input. They are recorded in the canonical manifest and rebuildable independently.

Resume restores saved delivery, chunking, and pronunciation settings. Canonical pre-mastering runs adopt their retained legacy plan when no override is explicit; incompatible explicit settings fail before spending. Completed directory reruns preserve existing chapters and can rebuild exports; single-file runs cannot attach to an existing directory. Pre-canonical manifests require rebuilding under [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md).

### Gemini transport and lifecycle

Unary, buffered streaming, and explicit remote Batch modes share delivery behavior. Native takes never acquire invented turn timestamps. Batch recovery reconciles purchased results before submitting missing work; ambiguous submission blocks recreation. Stopping local waiting does not cancel remote jobs.

Design creates persistent candidates; saving adopts the selected resource without recreating it. Replication requires consent, a reference recording, and separate consent audio. Expiry and project ownership constrain synthesis/deletion. Undocumented operation prices stay unknown.

## Trade-offs

Structured voice contracts add lifecycle state but make dispatch, consent, and reuse auditable. Native dialogue retains provider context while segmented synthesis preserves portability and local repair. Keeping purchased audio costs disk space and preserves historical identity, but separates new mastering/export choices from provider spending.

## Verification

```bash
bun test test/test-cases/validation/audio/tts/
bun test test/test-cases/validation/audio/voice/
bun test test/test-cases/validation/resume-manifests/tts-resume-delivery-adoption-contracts.test.ts
```

Local contracts cover voice dispatch/lifecycle, capability gating, paid-slot preservation, mastering/exports, and compatible resume. They establish neither spoken correctness nor perceptual quality.

## Follow-up Actions

- [ ] Review compatible retained audio for seam naturalness, pauses, and prosody — Pending
- [ ] Expose completed-run re-mastering through the CLI; directory reruns currently skip existing chapters — Pending
- [ ] Support re-exporting an existing single-file run in its directory — Pending

## References

- [TTS guide](../commands/04-audio/tts/overview.md)
- [Voice guide](../commands/04-audio/voice/00-voice-overview.md)
- `src/cli/commands/audio/tts/` and `src/cli/commands/audio/voice/`
