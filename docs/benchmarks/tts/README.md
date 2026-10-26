# TTS benchmark storage

Git retains the benchmark measurements and provenance: manifests, render/timeline records, dialogue plans, input/control fixtures, assessment notes, and suite reports. The generated `../combined-comparison-dashboard.{html,json,css,js}` files retain the published dashboard and its metrics.

The [offline assessment](assessment.md) covers the 42 original WAV recordings with local Whisper small.en roundtrip ASR and ffmpeg signal measurements. Those WAVs were retired after user approval of their MP3 playback copies. The assessment remains bound to the original WAV hashes; it does not claim to measure the MP3s. Subjective voice-quality ratings are excluded and unscored at the user's instruction. Its adjacent checksummed archive retains exact transcripts, source snapshots, identity bindings, and discrepancy/measurement records. Original synthesis costs remain recorded history, including the older OpenAI character-based estimates.

Emotion/delivery cases retain descriptive silence measurements; only speed/pause cases interpret pause conditions. Failed benchmark targets stay visible without an audio assessment and remain excluded from rankings requiring complete coverage.

Inspect the selected corpus without writes, or update the same assessment from installed local tools and hash-bound cached transcripts:

```bash
bun src/tools/assess-tts-benchmarks.ts
bun src/tools/assess-tts-benchmarks.ts --run
bun .codex/skills/consensus/scripts/run.ts build-combined-dashboard
```

Assessment requires the installed small.en whisperfile model and ffmpeg; it never downloads models or calls providers. Cached assessment work stays under `runtime/tts-benchmark-assessment/`. Diagnostic limits cannot publish a partial corpus over the complete assessment.

Purchased audio stays local. MP3s and source bundles named `slots/audio.zip` are ignored by the repository's existing media rules. All `slots/` directories beneath this benchmark root are excluded from Git. ZIP compression preserves source bytes for local reconstruction but does not make these large audio files suitable for a commit. Do not force-add them.

On 2026-10-26, the user approved replacing all 42 final WAVs, including nested reruns and control cases, with MP3 playback copies using the same basenames. FFmpeg's `libmp3lame -q:a 0` uses its highest VBR quality setting, retaining each source's sample rate and channel layout. The MP3s total 208.29 MB versus 934.29 MB for the removed WAVs, saving 726.00 MB (77.71%) compared with the original corpus. For example, `2026-09-25_04-tts-long/speech-elevenlabs-eleven_v3.mp3` is the retained playback file.

Before deletion, all 42 MP3s fully decoded with the exact sample count, sample rate and channel count of their original WAVs; their embedded `comment` tags matched the original repository-relative paths and SHA-256 values. [audio-delivery.json](audio-delivery.json) records both source and MP3 identities, byte counts and decoded properties. The dashboard validates this source binding and the hash and format of locally present MP3s. Missing MP3s retain catalogued metadata and a restore link; playback and fresh assessment require restoring the matching MP3 bytes.

A fresh checkout can display or rebuild the dashboard over HTTP without ignored audio using the delivery catalog and preserved manifests/render records. Missing project input fixtures are verified against the assessment archive's exact checksummed input snapshots; locally present inputs must still match their recorded hashes. Audio links point to the approved MP3s. Existing `dashboard.evidence.zip` support is a separate optional metadata snapshot; this benchmark currently uses its delivery catalog and has no such snapshot. A future assessment run selects and hashes the actual MP3s and creates separate ASR cache identities; the existing evidence archive continues to describe the original WAVs until such a run is explicitly performed.

Original synthesis manifests, render/timeline records and assessment evidence retain their original WAV identities unchanged. Synthesis resume or canonical compaction may require restoring or locally recomposing the exact original WAVs from the preserved slot archives where supported; the MP3s do not satisfy those original final-artifact hashes. Do not treat playback availability as verified synthesis resumability. No provider resynthesis was performed for this storage migration.

To transfer a run between machines, copy the complete local run directory separately, preserving relative paths and including MP3 audio, `slots/audio.zip`, manifests, render/timeline records and dialogue plans. Retain the root delivery catalog and assessment archive. Include nested `reruns/` when transferring a benchmark that selects them. Git alone is not a backup of purchased audio. Keep failed or interrupted runs and their working files intact.

The CLI automatically compresses source clips after successful TTS completion. Inspect original synthesis compaction plans without provider calls from the repository root:

```bash
bun src/tools/compact-tts-benchmarks.ts docs/benchmarks/tts
```

The compactor's `--apply` mode validates the original synthesis artifact graph. Restore or locally recompose the original hash-matching final WAVs before applying it to these retired-final runs.

Before committing, use `git status --short --untracked-files=all -- docs/benchmarks/tts` to review eligible files. Audio bundles should be absent from that listing. Inspect a particular bundle's ignore rule with `git check-ignore -v <run-directory>/slots/audio.zip`.
