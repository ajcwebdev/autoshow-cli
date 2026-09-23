# Local Timing and Speaker Workflows

See the [STT overview](../../overview.md) for provider selection and shared options.

These `extract` operations work with local audio and saved `result.json` files. They never submit a hosted provider request. Each operation supports `--json`, `--output-dir`, and zero-provider-cost `--price`. Run one operation at a time into a fresh output directory. Provider and caption options are rejected. A failed operation keeps completed artifacts and working files for inspection.

### Compare saved word timing

```bash
bun autoshow extract output/candidate/result.json --timing-reference output/reference/result.json --output-dir output/timing-comparison --json
```

`timing-comparison.json` reports ordered word matches, reference and candidate coverage, unmatched words, absolute start and end differences (median, p95, and maximum), how many matched words fall inside 50, 100, and 250 ms on both boundaries, drift by minute, timing provenance, and canonical speaker-label agreement. Coverage counts every word. Boundary statistics count matched words. The millisecond bands are fixed report settings. Invalid or empty word intervals are rejected.

Compare excerpts that already correspond. Matching keeps word order and repeated words. Split a substantially divergent comparison into shorter matching excerpts. Speaker scores require the same canonical labels, so reconcile reviewed identities first when providers or chunks use different labels.

The report keeps the reference's provenance and marks a reference without provenance as unverified. It measures agreement with that reference. A defensible acoustic accuracy claim needs a manually verified reference. Automatic alignment, provider confidence, and stored millisecond timestamps are agreement evidence only.

### Force-align supplied text locally

Alignment uses a local English Wav2Vec2 ONNX model and stays offline. `extract` reads the first audio stream and prepares it as mono 16 kHz. The command does not install packages or download models. See the [ONNX model repository](https://huggingface.co/onnx-community/wav2vec2-base-960h-ONNX/tree/729c1a6730fb549c20a1c73a3d3f96f11020225e).

Install the optional runtime and English model once from the repository root:

```bash
bun --no-env-file install --cwd config/stt-alignment --frozen-lockfile --ignore-scripts
bun --no-env-file src/tools/install-alignment-model.ts
```

The installer downloads about 378 MB, verifies SHA-256 hashes, reuses matching files, and leaves conflicting files in place. Pass that installed ONNX directory to `--alignment-model`. PyTorch weights are rejected; keep a PyTorch folder separate from the ONNX directory.

The runtime supports macOS and Linux on x64 and ARM64. The default Docker image omits it; the optional `alignment` image target includes it. A compiled CLI needs Bun on PATH and, under the project root, `config/stt-alignment/node_modules/` and `src/cli/commands/stt/workflows/timing/stt-onnx-worker.js`.

Supply a saved transcript whose segments cover its complete text. Each segment needs a positive, non-overlapping range of at most 30 seconds on the input audio timeline. A minimal transcript has this shape:

```json
{
  "text": "Hello there.",
  "segments": [
    { "start": "00:00:01.000", "end": "00:00:02.500", "text": "Hello there.", "speaker": "Host" }
  ]
}
```

```bash
bun autoshow extract audio.wav --align-transcript output/reviewed/result.json --alignment-model runtime/models/alignment/wav2vec2-base-960h-onnx --output-dir output/aligned --json
```

Original spelling and punctuation stay as display text. Unsupported letters or numerals fail. Spell numbers as spoken when the vocabulary cannot represent digits. Keep unheard or unsupported words in the transcript and fix the text from the recording. This install establishes English support only. Another language needs its own installed model and validation.

The aligner cannot restore missing transcript text, choose wording, separate overlapping speech on one channel, or infer speakers. Separate channels before alignment when each voice has its own channel. Speaker labels come from the supplied segments. Timing is relative to the supplied audio, and each segment offset is applied once. Apply a source video's additional audio offset when exporting captions.

`--alignment-min-confidence` defaults to `0.1` and must be between 0 and 1. A word below the requested threshold blocks `result.json`. `alignment.json` and `alignment-work/` remain for review. The score summarizes model emission strength. It is not a probability that the word or boundary is correct. Lowering the threshold can publish an exploratory reference; words below `0.1` stay listed as low-confidence. A high score leaves an automatic reference unverified.

A successful run writes `result.json` and `alignment.json`, and keeps working files under `alignment-work/`. New timing is marked `aligned` and `manuallyVerified: false`.

### Calibrate installed whisperfile timing

```bash
bun autoshow extract audio.wav --calibrate-whisper --timing-reference output/aligned/result.json --whisper-calibration-model tiny --output-dir output/whisperfile-calibration --json
```

Whisperfile is the only calibration engine. `--whisper-calibration-model` defaults to `tiny`, and that bundle must already be installed. Calibration runs standard timing and, when the executable supports it, the model's DTW preset. When the reference records an audio fingerprint, it must match the input. Unsupported DTW is recorded and does not fail a successful standard run. Invalid word boundaries leave that variant out of the ranking (`rejectedVariants`). If no variant can be measured, diagnostics are saved and the command fails.

DTW word boundaries are estimated from token centers and marked `repaired`. `calibration.json` ranks measurable variants by lexical coverage, then by combined median start and end difference, and records local runtime. Calibration leaves transcription defaults unchanged. It makes no recommendation when no words match. A result applies only to the selected reference, engine, model, and executable version.

### Preserve and transcribe separate channels

```bash
bun autoshow extract stereo.wav --split-channels --output-dir output/channels --json
```

Every audio stream is inspected. The input needs at least two channels in total and at most 16 channels per stream. Each channel is saved as float32 PCM WAV at its original sample rate. `channels.json` records stream and channel identity, source offsets, and hashes. `channel-results.json` is the template for attaching completed transcripts to those channels.

A channel is not a speaker. Stereo channels can carry the same mix, and then they cannot separate people. Speaker separation here requires isolated channels.

Transcribe the separated files with an already installed local engine:

```bash
bun autoshow extract output/channels/stream-0-channel-1.wav --provider whisperfile=tiny --output-dir output/channel-1 --json
bun autoshow extract output/channels/stream-0-channel-2.wav --provider whisperfile=tiny --output-dir output/channel-2 --json
```

Set each template entry's `result` to that channel's saved `result.json` path. Absolute paths are accepted. Relative paths resolve from the manifest directory. Keep `offsetSeconds` from extraction unless a different source timeline has been established independently. Then merge:

```bash
bun autoshow extract output/channels/channel-results.json --merge-channel-results --output-dir output/channel-merge --json
```

The merge checks full text coverage and usable timing, applies each channel's source offset once, sorts events in time while keeping overlaps, and scopes speaker labels by channel. An already merged result is rejected so the offset is not applied again. Include each original channel once. Duplicate audio and cross-talk stay in the merge.

### Reconcile speakers across chunks or channels

```bash
bun autoshow extract output/channel-merge/result.json --speaker-map-template --output-dir output/speaker-review --json
```

Edit the generated `speaker-map.json`. Keep `schemaVersion` and `sourceSha256`, set `reason` to a nonempty review explanation, and map exact existing labels to canonical labels. Reviewed evidence may justify mapping `chunk-1/speaker-0` and `chunk-2/speaker-1` to the same `Host` label. Matching numeric IDs, chronology, or similar wording leave identity unproven. Leave uncertain labels unchanged.

```bash
bun autoshow extract output/channel-merge/result.json --speaker-map output/speaker-review/speaker-map.json --output-dir output/reconciled --json
```

The source fingerprint rejects a map for a different result. Unknown source labels and empty targets are rejected. Only labels named in the map change. The source result file stays unchanged. `speaker-reconciliation.json` records the map, source, and review reason. This applies a reviewed label map. It does not identify speakers from the audio.

Use [caption export](../captions/overview.md) to turn the aligned or reconciled result into subtitle files.
