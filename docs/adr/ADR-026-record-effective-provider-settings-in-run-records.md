# ADR-026: Record Effective Provider Settings in Run Records

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-09-18
- **Date Updated:** 2026-09-18
- **Verification Status:** Passed

## Context

A run's `manifest.json` identified each provider target by service and model but did not record the settings sent to it. Every command builds its provider entries through `createProviderStatesFromRecord`, and most commands passed only `{ service, model }`, so `providers[].options` was `{}`. TTS kept its resolved controls in `render-plan.json`, which compact archiving deletes; `render.json` keeps only hashes. Image, video, and music recorded some request values in item metadata, inconsistently by provider. `write` wrote no provider entries at all. STT and OCR recorded most of their options; URL recorded none.

Two constraints limited where the record could live. `options` is frozen for audio targets after the first write (`assertAudioProviderIdentity`), so adding TTS settings there would break resume of every existing TTS directory. STT resume reads flat keys from `options`, so nesting settings inside it would break STT resume.

Recording must also stay outside every identity hash. [ADR-025](ADR-025-master-tts-delivery-audio-outside-paid-slot-identity.md) freezes paid slot identity so purchased audio is never repurchased; a record that fed any hash would reintroduce that risk.

Why now: comparing nine audiobook runs across Speechify, ElevenLabs, and Inworld, there was no way to confirm from the output that `--tts-stability 0.8`, `--tts-seed`, or `--tts-speed 0.9` reached the provider.

## Options Considered

**Option 1 (selected)**

- **Option:** Add one optional `settings` field to every provider entry: a versioned envelope `{ schemaVersion, settingsSchema, request, local?, ignored? }` built by one shared helper, derived from the values each command already resolves, and excluded from identity checks and hashes.
- **Pros:** One predictable location for every command; no change to `options`, so audio and STT resume are untouched; can be refreshed on finalize and resume.
- **Cons:** Each command still has to pass its resolved request to the helper; older run directories have no record.
- **Quantitative Notes:** Render identity, synthesis settings hash, output profile hash, voice context key, and per-slot request-control hashes were byte-identical between `HEAD` and this change for all eight hosted TTS providers.

**Option 2**

- **Option:** Put settings into `providers[].options`.
- **Pros:** No manifest schema change.
- **Cons:** Rejected; `options` is immutable for audio targets and parsed flat by STT resume.
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Stop compacting `render-plan.json` and per-request evidence for TTS.
- **Pros:** Keeps the exact serialized requests.
- **Cons:** TTS only; undoes the compact archive's file-count bound; still nothing for the other commands.
- **Quantitative Notes:** n/a

## Decision

Each provider entry may carry `settings`, built by `createProviderSettingsRecord` in `src/cli/commands/command-shared/pipeline-manifest/provider-settings-record.ts`. `request` holds the effective values sent to the provider with defaults filled in, `local` holds local processing that shapes the output, and `ignored` lists flags a model accepts but does not apply. The helper drops empty values, stores paths relative to the project root, and redacts secret-like keys with `sanitizeArtifactMetadata`. Content files such as lexicons and prompt files are recorded by path and sha256 where the caller can read them.

This applies to:

- `tts` and comic audio, where settings derive from the pure render plan (the serializer descriptor controls, which dispatch is already checked against, plus the resolved voice) and from the resolved delivery, chunking, export, and lexicon options.
- `image`, `video`, and `music`, where each provider collector exposes the request object it passes to the runner.
- `write`, which now writes one provider entry per successful LLM target.
- `extract` STT, OCR, and URL; comic images and sound effects.
- Generation and TTS resume, which keep the stored record and refresh it for targets they run again.

It does not apply to:

- Any identity or hash. `settings` never enters `purePlan`, request controls, slot hashes, or render identity, and the audio immutability check ignores it.
- Measured outputs such as observed loudness or duration, which belong to render evidence.
- Run directories created before this change; they are not backfilled.

## Rationale

- A dedicated field avoids both resume constraints from Context without migrating existing manifests.
- Deriving TTS settings from the plan rather than from runtime options makes fresh, recovered, and reused renders record the same values, and those values are the ones already verified against every dispatched request.
- One helper gives every command the same sanitizing and path rules, so no command can leak an API key, a PDF password, or a checkout path.

## Consequences

Positive outcomes:

- A run record shows exactly which provider controls and local settings produced its output.
- A non-wav Mistral `--tts-response-format` now plans the same format dispatch sends; previously the plan hard-coded `wav` and dispatch was blocked with "serializer controls differ".

Negative outcomes:

- Free-text instructions, descriptions, and voice preview text are stored verbatim.
- Lyrics files are recorded by path only, without a hash, because the music collectors are synchronous.
- Failed LLM targets in `write` still get no provider entry.

## Trade-offs

**Trade-off 1**

- **Gain:** Settings are recorded without touching paid slot identity or resume behavior.
- **Sacrifice:** Settings live in a new field, not in the `options` field that resume already reads, so resume cannot yet rebuild a run from them.

**Trade-off 2**

- **Gain:** One compact record per target instead of every serialized request.
- **Sacrifice:** Per-request detail, such as the exact text sent for each chunk, remains only in the slot audio and render evidence.

## Follow-up Actions

- [ ] Let resume rebuild generation and TTS options from `settings` instead of re-reading current flags — Pending
- [ ] Record provider entries for failed `write` targets — Pending
- [ ] Hash lyrics files in music settings — Pending

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Related ADR: [ADR-025](ADR-025-master-tts-delivery-audio-outside-paid-slot-identity.md)
- `src/cli/commands/command-shared/pipeline-manifest/provider-settings-record.ts`
- `src/cli/commands/command-shared/pipeline-manifest/manifest-record-projection.ts`
- `src/cli/commands/audio/tts/script-to-audio/tts-provider-settings.ts`
- `src/cli/commands/command-shared/generation-command-utils.ts`
- `test/test-cases/validation/audio/tts/tts-provider-settings-record.test.ts`
- `test/test-cases/validation/resume-manifests/generation-provider-settings-contracts.test.ts`
- `test/test-cases/validation/text/write/write-provider-settings-contracts.test.ts`
- `test/test-cases/validation/text/extract-provider-settings-contracts.test.ts`
