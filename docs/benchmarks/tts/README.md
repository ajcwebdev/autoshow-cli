# TTS benchmark storage

Git retains the benchmark measurements and provenance: manifests, render/timeline records, dialogue plans, input/control fixtures, assessment notes, and suite reports. The generated `../combined-comparison-dashboard.{html,json,css,js}` files retain the published dashboard and its metrics.

On 2026-10-29, the requested Eleven v4 pass completed all four narration inputs and both registered control cases through nine synthesis requests. The final WAVs fully decoded and matched their selected SHA-256 references. Recorded computed character costs total $2.88032 versus the $2.87944 preflight; the difference comes from raw source character counts, including final/interior newlines, rather than a provider invoice or a billable retry. The shared controls ledger conservatively reserves the recorded 4.880¢ for its two cases. No image generation ran. Both Grok Video Lite prompts also completed after the local xAI credential was configured: one 8-second/480p request each, $0.32 total provider-reported usage cost, with valid decoded MP4s and prior videos preserved. The combined TTS/video recorded cost is $3.20032; provider invoices remain unreconciled.

| V4 case    | Audio seconds | Generation/assembly seconds | Computed USD |
| ---------- | ------------- | --------------------------- | ------------ |
| Short      | 5.440         | 1.713                       | $0.00696     |
| Hard       | 36.240        | 7.333                       | $0.03624     |
| Harder     | 143.440       | 28.445                      | $0.12904     |
| Long       | 2219.840      | 127.578                     | $2.65928     |
| Emotion    | 21.280        | 5.094                       | $0.02360     |
| Pause tags | 27.040        | 5.381                       | $0.02520     |

The four narration additions live beneath each original run's `reruns/eleven-v4-2026-10-29/`, selected through additive `benchmarkReruns` metadata. Existing audio and provider projections were preserved; the original parent runs could not be resumed directly after the approved retirement of their WAV finals. The initial short-run readiness check stopped before synthesis until the saved CLI credential was loaded into the child environment; its subsequent successful resume purchased one request. New narration retains 44.1 kHz mono WAV delivery; the existing controls runner retains its 16 kHz mono delivery. No common perceptual-quality claim follows from these different conditions. The final no-cost narration resume plan and controls preflight both report zero additional spend, confirming the completed v4 artifacts are reusable.

Eleven v4 controls cases were registered on 2026-10-29 in both active suite plans and their tracked test fixtures. The emotion case uses five delivery/emotion lines. The speed/pause suite contains a separate five-line qualitative pause case using documented `[short pause]` and `[long pause]` tags; numeric speed, timed SSML and unverified slow/fast tag spellings are excluded. Tags remain inside submitted text, while canonical spoken words are stored separately. These choices follow the [v4 prompting guide](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices#prompting-eleven-v4), checked on that date. Registration and mocked dispatch establish local readiness, not audible control or spoken-text correctness.

Price only the two v4 cases with the command below. The current fresh-pass estimate is 4.864¢ (USD $0.04864): 2.352¢ for emotion and 2.512¢ for pauses, before retries. The shared ledger retains its historical cumulative spending, benchmark date and output base; v4 uses distinct case IDs and cannot reuse v3 synthesis as v4 output. Registration makes no provider request and does not create benchmark results.

```bash
bun src/tools/tts-controls-benchmark.ts --suite all --provider elevenlabs=eleven_v4 --price
```

The [offline assessment](assessment.md) retains the 42 original WAV recordings’ local Whisper small.en roundtrip ASR and ffmpeg signal measurements, and adds six new Eleven v4 WAV assessments from October 29 (48 total). The earlier WAVs were retired after user approval of their MP3 playback copies; their historical rows retain the original measured WAV hashes and do not claim to measure the MP3s. The byte-identical original evidence ZIP and report remain in the current archive’s history entries, with verified metadata-only parent-manifest rebindings. Only the six new v4 recordings received fresh ASR; their generated WAVs remain available. Subjective voice-quality ratings are excluded and unscored at the user's instruction. Its adjacent checksummed archive retains exact transcripts, source snapshots, identity bindings, and discrepancy/measurement records. Original synthesis costs remain recorded history, including the older OpenAI character-based estimates.

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

A fresh checkout can display or rebuild the dashboard over HTTP without ignored audio using the delivery catalog and preserved manifests/render records. Missing project input fixtures are verified against the assessment archive's exact checksummed input snapshots; locally present inputs must still match their recorded hashes. Audio links point to the approved MP3s. Existing `dashboard.evidence.zip` support is a separate optional metadata snapshot; this benchmark currently uses its delivery catalog and has no such snapshot. A future full-corpus assessment run selects and hashes the actual MP3s and creates separate ASR cache identities. The October 29 scoped extension preserves all earlier measured-WAV identities and adds only the six new v4 WAV measurements.

Original synthesis manifests, render/timeline records and assessment evidence retain their original WAV identities unchanged. Synthesis resume or canonical compaction may require restoring or locally recomposing the exact original WAVs from the preserved slot archives where supported; the MP3s do not satisfy those original final-artifact hashes. Do not treat playback availability as verified synthesis resumability. No provider resynthesis was performed for this storage migration.

To transfer a run between machines, copy the complete local run directory separately, preserving relative paths and including MP3 audio, `slots/audio.zip`, manifests, render/timeline records and dialogue plans. Retain the root delivery catalog and assessment archive. Include nested `reruns/` when transferring a benchmark that selects them. Git alone is not a backup of purchased audio. Keep failed or interrupted runs and their working files intact.

The CLI automatically compresses source clips after successful TTS completion. Inspect original synthesis compaction plans without provider calls from the repository root:

```bash
bun src/tools/compact-tts-benchmarks.ts docs/benchmarks/tts
```

The compactor's `--apply` mode validates the original synthesis artifact graph. Restore or locally recompose the original hash-matching final WAVs before applying it to these retired-final runs.

Before committing, use `git status --short --untracked-files=all -- docs/benchmarks/tts` to review eligible files. Audio bundles should be absent from that listing. Inspect a particular bundle's ignore rule with `git check-ignore -v <run-directory>/slots/audio.zip`.
