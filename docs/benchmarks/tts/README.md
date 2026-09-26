# TTS benchmark storage

Git retains the benchmark measurements and provenance: manifests, render/timeline records, dialogue plans, input/control fixtures, assessment notes, and suite reports. The generated `../combined-comparison-dashboard.{html,json,css,js}` files retain the published dashboard and its metrics.

Purchased audio stays local. Final WAVs are ignored by the repository's existing media rules; source bundles named `slots/audio.zip` are now ignored too. All `slots/` directories beneath this benchmark root are excluded from Git. ZIP compression preserves source bytes for resume but does not make these large audio files suitable for a commit. Do not force-add them.

A fresh checkout can display the saved dashboard over HTTP without audio. Its audio links require the original local recordings. Rebuilding the dashboard from these run manifests requires the referenced final audio for hash verification and duration/format probing. Existing `dashboard.evidence.zip` support is a separate optional metadata snapshot; this benchmark currently uses its saved dashboard JSON and has no such snapshot.

To transfer a resumable run between machines, copy the complete local run directory separately, preserving relative paths and including final audio, `slots/audio.zip`, manifests, render/timeline records, and dialogue plans. Include nested `reruns/` when transferring a benchmark that selects them. Git alone is not a backup of purchased audio. Keep failed or interrupted runs and their working files intact.

The CLI automatically compresses source clips after successful TTS completion. To inspect or compact existing benchmarks without provider calls, run these commands from the repository root:

```bash
bun src/tools/compact-tts-benchmarks.ts docs/benchmarks/tts
bun src/tools/compact-tts-benchmarks.ts docs/benchmarks/tts --apply
```

Before committing, use `git status --short --untracked-files=all -- docs/benchmarks/tts` to review eligible files. Audio bundles should be absent from that listing. Inspect a particular bundle's ignore rule with `git check-ignore -v <run-directory>/slots/audio.zip`.
