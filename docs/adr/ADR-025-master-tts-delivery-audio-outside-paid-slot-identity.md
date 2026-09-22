# ADR-025: Master TTS Delivery Audio Outside Paid Slot Identity

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-09-18
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed

## Context

Standalone `tts` reduced audio quality after the provider returned it. Every hosted single-voice run was stored as 16 kHz mono PCM even when the provider returned 24–48 kHz audio. Long text was split at the last newline or space before the provider limit, chunks were joined with whatever silence the provider left at each edge, and the command offered no loudness normalization, no container other than WAV, no tags, and no way to assemble a directory of chapters into one book file.

Purchased audio is identified separately from the file the user receives. That identity included the output format, so changing the format through the existing mastering settings would have made every previously purchased file unreachable and caused the next run to buy it again. ElevenLabs request stitching is unavailable for `eleven_v3`, the only ElevenLabs model in the registry, so cross-chunk continuity could not be requested from that provider.

Audio already on disk still holds what the provider returned, so a better file can be produced from an existing directory without a new provider request, as long as purchased-audio identity stays fixed.

Why now: a review of ElevenLabs audiobook production against this CLI found the 16 kHz re-encode to be the largest fidelity loss in the pipeline, ahead of anything a provider control could recover.

## Options Considered

**Option 1 (selected)**

- **Option:** Keep purchased-audio identity on its historical output format, describe final audio with a separate delivery profile that identifies the render only, master once from the retained provider audio, and treat encoding, tags, cover art, and book assembly as exports that do not identify the render.
- **Pros:** Previously purchased audio stays usable under a new profile; a recovered run matches a normal run; the same behavior applies to every hosted provider.
- **Cons:** Purchased-audio identity still records the historical output format when the user receives a mastered file; TTS delivery settings are separate from comic and soundscape mastering.
- **Quantitative Notes:** Re-rendering a retained legacy run under the `audiobook` profile made zero provider requests. Mastering the same inputs twice produced identical bytes, and measured loudness landed within 0.5 LU of the `-19` LUFS target.

**Option 2**

- **Option:** Change the default of the existing mastering settings and send that profile through the hosted chunk pipeline.
- **Pros:** Smallest change; one vocabulary for mastered audio.
- **Cons:** Those settings identify purchased audio, so every existing output directory would buy its audio again on the next run. The normal path would still master a 16 kHz intermediate.
- **Quantitative Notes:** A 300,000-character book on `eleven_v3` is about $30 of retained audio per directory this option would orphan.

**Option 3**

- **Option:** Use provider continuity fields for chunk seams and leave assembly unchanged.
- **Pros:** Prosody carry-over is handled by the provider where the provider supports it.
- **Cons:** Unavailable on `eleven_v3`. Where a provider can stitch requests, the request would differ between a fresh run and a resume, which conflicts with safe retry. The other hosted providers and the 16 kHz re-encode would be unchanged.
- **Quantitative Notes:** Only Hume native utterances implement continuity today.

## Decision

Purchased speech keeps the historical output format in its identity. The delivery profile identifies the render, and one mastering step produces the file the user receives from the provider audio already stored for that purchase. Users select it with `--tts-audio-profile` and the related mastering flags.

This applies to:

- Standalone `tts` and `resume` for every hosted provider: single-voice, segmented multi-speaker, and native dialogue.
- Chunk planning: `--tts-chunk-boundary smart` is the default; `legacy` reproduces the earlier splitter.
- Seam mastering: trim measured silence at chunk edges, insert a fixed pause for each boundary kind, add lead-in and lead-out, and optionally normalize loudness to the profile target.
- Exports beside the WAV master: `flac`, `mp3`, `m4a`, and `m4b`, plus tags, cover art, and one book file per directory with one chapter per input.
- A pronunciation lexicon applied before chunking, and a text preflight that rejects speech markup the provider documents as unsupported.

It does not apply to:

- Comic and soundscape audio, which keep their own mastering and mix settings ([ADR-017](ADR-017-sound-effects-and-multi-track-soundscape-pipeline.md)). Comic segmented planning stays on the legacy splitter.
- Retry, resume admission, and ambiguous-redispatch rules ([ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md)).
- Provider continuity fields. Hume native utterances keep their existing continuity chain. ElevenLabs stitching stays unused.

## Rationale

- Buying the same speech twice is the most expensive failure this pipeline can have, so purchased-audio identity stays fixed before any default changes.
- A delivery profile changes the audio the user receives, so it identifies the render. Tags and containers leave that master unchanged, so they can be rebuilt without a new render or a new purchase.
- Chunk seams follow the plan that produced the purchased text, so recovery keeps the original purchase and reproduces that chunk.
- The same assembly and planning behavior applies to every hosted provider. Provider-specific controls stay on the registry-backed flags from [ADR-024](ADR-024-derive-cli-help-from-registries-and-generalize-provider-flags.md).

## Consequences

Positive outcomes:

- Default output keeps the provider's sample rate.
- Purchased audio stays usable under any delivery profile. Rerunning a directory rebuilds exports and the book without provider requests.
- `resume` keeps a retained run's legacy chunking and 16 kHz output when no chunking or mastering flag is explicit, so directories created before this change finish without buying audio again.

Negative outcomes:

- New runs identify a different render than the same command produced before, because the default splitter and the default profile both changed.
- Resuming a run that used non-default mastering or a pronunciation lexicon requires the same flags again. A mismatch stops with no spend.
- A completed run stays as mastered. Rerunning that directory with different mastering flags stops with no spend and leaves completed chapters unchanged.
- Byte-identical output is guaranteed within a single ffmpeg build.
- Wall-time estimates still assume the legacy splitter. Cost estimates are per character and stay as they are.

## Trade-offs

**Trade-off 1**

- **Gain:** Existing output directories keep their purchased audio.
- **Sacrifice:** Purchased-audio identity remains the historical output format when the delivered file uses a newer profile.

**Trade-off 2**

- **Gain:** Pauses at seams are fixed and independent of the silence a provider left on each chunk.
- **Sacrifice:** Silence trimming can clip a breath at a chunk edge. A 30 ms guard pad and `--tts-trim-silence off` bound that risk.

**Trade-off 3**

- **Gain:** Tags, cover art, bitrate, and containers can change without a new render or a new purchase.
- **Sacrifice:** Those exports are omitted from synthesis evidence. The manifest records them.

## Follow-up Actions

- [ ] Listening pass on the paid `eleven_v3` pilot — Pending
  A 625-character, three-chunk pilot was purchased once on 2026-09-18 for an estimated 6.25¢ (`output/2026-09-18_tts-delivery-pilot`). Decoded integrity passed, and a local transcript matched the source across both seams apart from the recognizer writing "Martha" and "11". Seam naturalness, pause lengths, and cross-chunk prosody still need a human listen.
- [ ] Re-master a completed run from audio already purchased — Pending
  A mastering mismatch stops with no spend and leaves the completed files unchanged.
- [ ] Model wall-time estimates on the smart splitter — Pending
- [ ] Re-export a single-file run that already exists in a directory — Pending
  Directory batches rebuild exports and the book on rerun. A single-file run does not attach to an existing directory.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
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
