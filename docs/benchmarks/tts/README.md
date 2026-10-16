# TTS benchmark storage

Git retains the benchmark measurements and provenance: manifests, render/timeline records, dialogue plans, input/control fixtures, assessment notes, and suite reports. The generated `../combined-comparison-dashboard.{html,json,css,js}` files retain the published dashboard and its metrics.

The [offline assessment](assessment.md) covers all 42 selected recordings with local Whisper small.en roundtrip ASR and ffmpeg signal measurements. Subjective voice-quality ratings are excluded and unscored at the user's instruction. Its adjacent checksummed archive retains exact transcripts, source snapshots, identity bindings, and discrepancy/measurement records. Original synthesis costs remain recorded history, including the older OpenAI character-based estimates.

Emotion/delivery cases retain descriptive silence measurements; only speed/pause cases interpret pause conditions. Failed benchmark targets stay visible without an audio assessment and remain excluded from rankings requiring complete coverage.

Inspect the selected corpus without writes, or update the same assessment from installed local tools and hash-bound cached transcripts:

```bash
bun src/tools/assess-tts-benchmarks.ts
bun src/tools/assess-tts-benchmarks.ts --run
bun .codex/skills/consensus/scripts/run.ts build-combined-dashboard
```

Assessment requires the installed small.en whisperfile model and ffmpeg; it never downloads models or calls providers. Cached assessment work stays under `runtime/tts-benchmark-assessment/`. Diagnostic limits cannot publish a partial corpus over the complete assessment.

Purchased audio stays local. Final WAVs are ignored by the repository's existing media rules; source bundles named `slots/audio.zip` are now ignored too. All `slots/` directories beneath this benchmark root are excluded from Git. ZIP compression preserves source bytes for resume but does not make these large audio files suitable for a commit. Do not force-add them.

A fresh checkout can display the saved dashboard over HTTP without audio. Its audio links require the original local recordings. Rebuilding the dashboard from these run manifests requires the referenced final audio for hash verification and duration/format probing. Existing `dashboard.evidence.zip` support is a separate optional metadata snapshot; this benchmark currently uses its saved dashboard JSON and has no such snapshot.

To transfer a resumable run between machines, copy the complete local run directory separately, preserving relative paths and including final audio, `slots/audio.zip`, manifests, render/timeline records, and dialogue plans. Include nested `reruns/` when transferring a benchmark that selects them. Git alone is not a backup of purchased audio. Keep failed or interrupted runs and their working files intact.

The CLI automatically compresses source clips after successful TTS completion. To inspect or compact existing benchmarks without provider calls, run these commands from the repository root:

```bash
bun src/tools/compact-tts-benchmarks.ts docs/benchmarks/tts
bun src/tools/compact-tts-benchmarks.ts docs/benchmarks/tts --apply
```

Before committing, use `git status --short --untracked-files=all -- docs/benchmarks/tts` to review eligible files. Audio bundles should be absent from that listing. Inspect a particular bundle's ignore rule with `git check-ignore -v <run-directory>/slots/audio.zip`.
