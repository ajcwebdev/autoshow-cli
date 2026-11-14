# TTS Benchmark Storage

Retain manifests, render/timeline records, dialogue plans, fixtures, measurements, and assessment evidence in Git. Purchased audio and `slots/audio.zip` remain local and ignored; Git is not their backup. Preserve complete run directories, nested `reruns/`, the [delivery catalog](audio-delivery.json), and assessment archive when transferring a benchmark.

## Selected recordings and evidence

Narration may select additive runs through `benchmarkReruns` metadata. The Eleven v4 additions use each original run's `reruns/eleven-v4-2026-10-29/`; delivery is 44.1 kHz mono for narration and 16 kHz mono for controls. These different conditions do not establish comparable perceptual quality.

The generated [offline assessment](assessment.md) retains 42 original WAV assessments and six later v4 WAV assessments. Its checksummed evidence archive preserves exact transcripts, inputs, hashes, and measurement provenance. The earlier WAVs were replaced by approved MP3 playback derivatives; their recorded ASR/signal results still describe the original WAVs. The MP3s have not been reassessed. Subjective pronunciation, identity, emotion, seams/prosody, audible control, and perceptual ratings remain excluded and unscored.

Historical costs retain their recorded basis, including older character-based estimates. Computed character costs and provider-reported usage are distinct from invoices. HTTP success, decoding, hashes, and ASR differences alone prove neither spoken-text correctness nor audible-control effectiveness. Failed cases remain visible without fabricated audio assessments.

## Controls

Fixtures and documented model/control pairs live under `input/examples/tts/controls/{emotion,speed-pauses}/`. The shared `benchmark-plan.json` pins cumulative spending, output base, and first-run date. Suites stay separate beneath this root as `<YYYY-MM-DD>_05-tts-emotion/` and `<YYYY-MM-DD>_06-tts-speed-pauses/`; preserve earlier directories. Exclude controls fixtures from all-provider directory batches.

Use five self-describing lines per case, keeping emotion/delivery/instruction separate from speed/pause controls. Skip unsupported or unverified pairs; never substitute plain-text fallback, nonverbal cues, or sound effects. Spoken words, inline tags, and request instructions remain distinct. The v4 pause case uses qualitative pause tags, not numeric speed or exact timed silence.

Review both suites, or a documented explicit selection, without dispatch:

```bash
bun src/tools/tts-controls-benchmark.ts --suite all --price
bun src/tools/tts-controls-benchmark.ts --suite all --provider elevenlabs=eleven_v4 --price
```

Completed compatible audio is reused. Incomplete or ambiguous slots require reconciliation before repurchase; estimates include cumulative related spending and potential duplicate charges. Paid runs follow [repository rules](../../../AGENTS.md) and the runner's saved budget constraints.

## Playback and recovery

The delivery catalog binds approved MP3s to original WAV paths/hashes, decoded properties, and byte counts. The dashboard validates locally present derivatives; missing media retains catalogued metadata and restore links. Source fixtures missing from a checkout can be validated against exact archived snapshots; locally present inputs must match their hashes.

Playback MP3s do not satisfy original synthesis WAV hashes. Resume or canonical compaction can require restoring/recomposing the original hash-matching WAVs from retained slots. Never infer synthesis resumability from playback availability or automatically resynthesize speech to replace a missing playback file.

Inspect selected assessment inputs or a compaction plan without writes:

```bash
bun src/tools/assess-tts-benchmarks.ts
bun src/tools/compact-tts-benchmarks.ts docs/benchmarks/tts
```

Assessment requires installed Whisper small.en and FFmpeg. `--run` updates the fixed assessment/evidence archive using hash-bound offline caches under `runtime/tts-benchmark-assessment/`; it neither downloads models nor calls providers. A limited queue cannot publish over the full assessment. Compactor `--apply` validates completed synthesis artifacts before mutation; interrupted/failed runs remain intact.

Rebuild the generated dashboard after valid evidence changes:

```bash
bun .codex/skills/consensus/scripts/run.ts build-combined-dashboard
```

A checkout can display/rebuild metadata over HTTP without ignored audio. Playback, fresh assessment, and full synthesis recovery still require their matching media. Do not force-add audio or source bundles.
