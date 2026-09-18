# ADR-025: Master TTS Delivery Audio Outside Paid Slot Identity

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-09-18
- **Date Updated:** 2026-09-18
- **Verification Status:** Passed

## Context

Standalone `tts` lost audio quality after synthesis rather than during it. Every hosted single-voice run was re-encoded to 16 kHz mono PCM regardless of what the provider returned (ElevenLabs 44.1 kHz, Hume and Inworld 48 kHz, OpenAI, Cartesia, and Grok 24 kHz). Long text was split at the last newline or space before the provider limit, chunks were concatenated with whatever edge silence each provider happened to return, and there was no loudness normalization, no export format other than WAV, no tags, and no way to assemble a directory of chapters into one book file.

Two constraints shaped the fix. The local output format was an input to the paid speech slot hash (`computePaidSpeechSlotHash` received `requestedOutput(options)` as `outputFormat`), so changing the default output profile through the existing mastering profile would have made every previously purchased `slots/<hash>.wav` unreachable and repurchased on the next run. And ElevenLabs documents that request stitching (`previous_text`, `next_text`, `previous_request_ids`) is not available for `eleven_v3`, the only ElevenLabs model in the registry, so cross-chunk continuity could not come from a provider request field.

Retained slots already hold the provider's original bytes, so higher-quality output was recoverable from existing output directories without new provider requests, provided slot identity stayed fixed.

Why now: a review of ElevenLabs audiobook production against this CLI found the 16 kHz re-encode to be the largest fidelity loss in the pipeline, ahead of anything a provider control could recover.

## Options Considered

**Option 1 (selected)**

- **Option:** Freeze the slot hash's output-format input at its historical value, carry final-audio settings in a separate delivery profile that enters render identity only, master once from retained native slot audio, and treat encoding, tags, cover art, and book assembly as a derived export layer outside render identity.
- **Pros:** No previously purchased audio is orphaned; a render under a new profile reuses retained slot audio instead of purchasing it; one mastering function serves normal finalize and recovery, so recovered runs are identical by construction; applies to all eight hosted providers.
- **Cons:** The slot hash input named `outputFormat` no longer describes the delivered audio; two output vocabularies exist (the comic/soundscape mastering profile and the TTS delivery profile).
- **Quantitative Notes:** Rendering under the `audiobook` profile against a retained legacy render made zero provider requests in the mocked contract test, which drives `runTtsForTargets` with retained provider state directly. Mastering the same inputs twice produced identical bytes, and measured loudness landed within 0.5 LU of the `-19` LUFS target.

**Option 2**

- **Option:** Thread the existing `TtsMasteringProfile` through the hosted chunk pipeline and change its default.
- **Pros:** Smallest code change; reuses one vocabulary.
- **Cons:** The profile feeds the slot hash, so every existing output directory would repurchase its audio on the next run; mastering would still run on a 16 kHz intermediate in the normal path.
- **Quantitative Notes:** A 300,000-character book on `eleven_v3` is about $30 of retained audio per directory that this option would orphan.

**Option 3**

- **Option:** Use provider continuity fields (ElevenLabs request stitching, Hume `generation_id`) for seams and leave assembly unchanged.
- **Pros:** Prosody carry-over is handled by the provider where supported.
- **Cons:** Unavailable on `eleven_v3`; `previous_request_ids` needs ordered dispatch, which the chunk scheduler does not model, and produces request bodies that differ between fresh and resumed runs, conflicting with the retry fingerprint rule; does nothing for the other six providers or for the 16 kHz re-encode.
- **Quantitative Notes:** One of eight providers (Hume, native utterances only) implements continuity today.

## Decision

The paid speech slot hash takes its output-format input from `paidSlotOutputFormat`, which returns the historical value and never the delivery profile. Final audio is described by `TtsOptions.ttsDelivery`, recorded on the render plan as `requestedOutput.delivery`, and produced by one mastering step that reads retained native slot audio.

This applies to:

- Standalone `tts` and `resume` for all hosted providers, single-voice, segmented multi-speaker, and native dialogue strategies.
- Chunk planning: `smart` boundary-aware balanced chunking is the default; `legacy` reproduces the earlier splitter byte for byte.
- Seam mastering: measured edge-silence trimming, a fixed pause per boundary kind, lead-in and lead-out, optional two-pass linear EBU R128 normalization with a limiter.
- The export layer: `flac`, `mp3`, `m4a`, and `m4b` beside the WAV master, tags, cover art, and a per-directory book file with one chapter per input.
- Provider-general text handling: a local pronunciation lexicon applied before chunking, and a text preflight that rejects speech markup a provider documents as unsupported.

It does not apply to:

- Comic and soundscape audio, which keep `TtsMasteringProfile` and the mix profile owned by [ADR-017](ADR-017-sound-effects-and-multi-track-soundscape-pipeline.md). Comic segmented planning stays on the legacy splitter.
- The admission journal, retry fingerprint, and ambiguous-redispatch rules owned by [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md).
- Provider continuity fields. Hume native utterances keep their existing `generation_id` chain; no stitching field is sent to ElevenLabs.

## Rationale

- Double billing is the most expensive failure this pipeline can have, so slot identity is frozen first and guarded by tests before any default changes.
- A delivery profile that changes the delivered bytes is a different render, so it belongs in render identity; tags and containers do not change the master, so they stay outside it and can be rebuilt freely.
- Chunk seam kinds are re-derived from the same planner that produced the slot texts, so they never enter slot or plan identity, and a chunk re-planned on its own yields itself, which partial recovery depends on.
- Fixes that live in shared assembly and planning code reach every provider; only source-format selection needed provider-scoped controls, and those follow [ADR-024](ADR-024-derive-cli-help-from-registries-and-generalize-provider-flags.md).

## Consequences

Positive outcomes:

- Default output keeps the provider's sample rate instead of 16 kHz mono.
- Purchased audio stays reachable under any delivery profile, and directory reruns rebuild exports and the book without provider requests.
- Inserted pauses appear as `pause` operations in the transform ledger, and provider timing offsets account for trims and gaps.
- `resume` adopts a retained run's legacy chunking and 16 kHz output when no chunking or mastering flag is explicit, so directories created before this change finish without repurchase.

Negative outcomes:

- New runs produce different render identities than the same command produced before, because both the default splitter and the default profile changed.
- Resuming a run that used non-default mastering overrides or a pronunciation lexicon needs the same flags again; a mismatch fails closed with no spend.
- No CLI path re-masters a completed run. Rerunning a completed directory with different mastering flags is a silent no-op: it purchases nothing and changes nothing, because completed chapters are skipped.
- Bit-exact output holds per ffmpeg build, not across builds.
- Wall-time estimates still model the legacy splitter; cost estimates are per character and unaffected.

## Trade-offs

**Trade-off 1**

- **Gain:** Zero repurchase for every existing output directory.
- **Sacrifice:** The slot hash carries a frozen legacy value whose name no longer matches its meaning.

**Trade-off 2**

- **Gain:** Deterministic pacing at seams that does not depend on provider edge silence.
- **Sacrifice:** Silence trimming can clip a breath at a chunk edge; a 30 ms guard pad and `--tts-trim-silence off` bound that risk.

**Trade-off 3**

- **Gain:** Tags, cover art, bitrate, and containers change without creating renders.
- **Sacrifice:** Exports are not covered by render evidence; they are recorded in the manifest only.

## Follow-up Actions

- [ ] Listening pass on the paid `eleven_v3` pilot — Pending
  A 625-character, three-chunk pilot was purchased once on 2026-09-18 for an estimated 6.25¢ (`output/2026-09-18_tts-delivery-pilot`, git-ignored). Decoded artifact integrity: slots retained as 44.1 kHz mono MP3, master 44.1 kHz mono at -19.01 LUFS and -3.30 dBTP, `speech.m4b` AAC with its title tag. Spoken-text correctness: a local Whisperfile `tiny` transcript matched the source across both seams apart from the model writing "Martha" and "11". Perceptual quality is not established: seam naturalness, pause lengths, and cross-chunk prosody drift still need a human listen.
- [ ] Re-master a completed run from retained slots — Pending
  The identity model already supports it; `tts` and `resume` skip completed items, so no command invokes it. Until then a rerun with different mastering flags should at least warn that they were ignored.
- [ ] Model wall-time estimates on the smart splitter — Pending
- [ ] Re-export for single-file runs in an existing directory — Pending
  Directory batches rebuild exports and the book on rerun; single-file runs do not attach to an existing directory.

## References

- Related ADR: [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md)
- Related ADR: [ADR-017](ADR-017-sound-effects-and-multi-track-soundscape-pipeline.md)
- Related ADR: [ADR-024](ADR-024-derive-cli-help-from-registries-and-generalize-provider-flags.md)
- `src/cli/commands/audio/tts/script-to-audio/tts-slot-output-format.ts`
- `src/cli/commands/audio/tts/script-to-audio/tts-delivery-assembly.ts`
- `src/cli/commands/audio/tts/tts-utils/tts-chunk-planner.ts`
- `src/cli/commands/audio/tts/tts-utils/tts-delivery-mastering.ts`
- `src/cli/commands/audio/tts/tts-utils/tts-delivery-encode.ts`
- `src/cli/commands/audio/tts/tts-book-assembly.ts`
- `test/test-cases/validation/audio/tts/tts-delivery-render-contracts.test.ts`
- <https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/request-stitching>
