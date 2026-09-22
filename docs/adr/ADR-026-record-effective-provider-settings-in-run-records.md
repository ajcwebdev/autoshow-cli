# ADR-026: Record Effective Provider Settings in Run Records

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-09-18
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed

## Context

A run's `manifest.json` named each provider by service and model, but not the settings sent to it. Most commands left `providers[].options` empty. TTS kept its resolved controls in `render-plan.json`, which compact archiving deletes; `render.json` keeps output paths and slot metadata, not those controls. Image, video, and music stored some request values in item metadata, differently for each provider. `write` wrote no provider entries. STT and OCR recorded most of their options; URL recorded none.

Two constraints limited where the record could live. `options` is frozen for audio targets after the first write, so adding TTS settings there would break resume of every existing TTS directory. STT resume reads flat keys from `options`, so nesting settings inside it would break STT resume.

The record must also stay outside every identity hash. [ADR-025](ADR-025-master-tts-delivery-audio-outside-paid-slot-identity.md) freezes paid slot identity so purchased audio is never repurchased; a record that fed any hash would reintroduce that risk.

Why now: comparing nine audiobook runs across Speechify, ElevenLabs, and Inworld, there was no way to confirm from the output that `--tts-stability 0.8`, `--tts-seed`, or `--tts-speed 0.9` reached the provider.

## Options Considered

**Option 1 (selected)**

- **Option:** Add one optional `settings` field to every provider entry: a versioned envelope `{ schemaVersion, settingsSchema, request, local?, ignored? }`, derived from the values each command already resolves, and excluded from identity checks and hashes.
- **Pros:** One predictable location for every command; no change to `options`, so audio and STT resume are untouched; the record can be refreshed on finalize and resume.
- **Cons:** Only a command that supplies its resolved request gets a record; older run directories have none.
- **Quantitative Notes:** Identity hashes for all eight hosted TTS providers stayed byte-identical.

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

Each provider entry may carry `settings`. `request` holds the effective values sent to the provider, with defaults filled in. `local` holds local processing that shapes the output. `ignored` lists flags a model accepts but does not apply. Empty values are omitted. Paths inside the project are stored relative to the project root. Secret-like values are redacted. Lexicons and prompt files are recorded by path and sha256.

This applies to:

- `tts` and comic audio: the resolved voice, and the delivery, chunking, export, and lexicon options sent to the provider.
- `image`, `video`, and `music`: the request sent to the provider.
- `write`: one provider entry per successful LLM target.
- `extract` STT, OCR, and URL, plus comic images and sound effects.
- Generation and TTS resume: the stored record is kept, and refreshed for targets that run again.

It does not apply to:

- Paid-slot identity, render identity, or the audio immutability check. `settings` is ignored by all of them.
- Measured outputs such as observed loudness or duration, which belong to render evidence.
- Run directories created before this change. They stay without `settings`.

## Rationale

- A dedicated field avoids both resume constraints from Context without migrating existing manifests.
- Recording the values already checked against what was sent means a fresh run, a recovered run, and a reused render show the same settings.
- The same redaction and path rules apply to every command, so the record cannot contain an API key, a PDF password, or a checkout path.

## Consequences

Positive outcomes:

- A run record shows which provider controls and local settings produced its output.
- Existing audio and STT directories still resume, because `options` is unchanged.

Negative outcomes:

- Free-text instructions, descriptions, and voice preview text are stored verbatim.
- Lyrics files are recorded by path only, without a hash.
- Failed LLM targets in `write` are omitted from provider entries.

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
