# Local Timing and Speaker Workflows

See the [STT overview](../../overview.md) for provider selection and shared options.

These `extract` operations work with local audio and saved `result.json` files. They never submit a hosted provider request. Each operation supports `--json`, `--output-dir`, and zero-provider-cost `--price`. Run one operation at a time into a fresh output directory. Provider and caption options are rejected. A failed operation keeps completed artifacts and working files for inspection.

The following chain uses the licensed 24-second recording and its matching [published-subtitle transcript](../../../../../../input/examples/video/README.md). Complete the [review/apply steps](../transcript-review/overview.md) first to create `runtime/examples/speech-workflows/reviewed/result.json`. Its coarse subtitle segments cannot be used directly as an acoustic word reference. Alignment supplies word evidence, while installed Whisperfile produces the candidate.

### Force-align supplied text locally

Alignment uses a local English Wav2Vec2 ONNX model and stays offline. `extract` reads the first audio stream and prepares it as mono 16 kHz. The command does not install packages or download models. See the [ONNX model repository](https://huggingface.co/onnx-community/wav2vec2-base-960h-ONNX/tree/729c1a6730fb549c20a1c73a3d3f96f11020225e).

Install the optional runtime and English model once from the repository root:

```bash
bun --no-env-file install --cwd config/stt-alignment --frozen-lockfile --ignore-scripts
bun --no-env-file src/tools/install-alignment-model.ts
```

These commands are one-time network prerequisites; alignment never downloads the runtime or model. The installer downloads about 378 MB, verifies SHA-256 hashes, reuses matching files, and leaves conflicting files in place. Pass the installed ONNX directory to `--alignment-model`. PyTorch weights are rejected; keep them separate from the ONNX directory.

The runtime supports macOS and Linux on x64 and ARM64. The default Docker image omits it; the optional `alignment` image target includes it.

Supply a saved transcript whose segments cover its complete text. Each segment needs a positive, non-overlapping range of at most 30 seconds on the input audio timeline. The matching reviewed fixture already supplies these spans; do not replace it with an unrelated transcript.

```bash
bun autoshow extract input/examples/audio/01-two-speaker-speech-stereo.wav --align-transcript runtime/examples/speech-workflows/reviewed/result.json --alignment-model runtime/models/alignment/wav2vec2-base-960h-onnx --output-dir runtime/examples/speech-workflows/aligned --json
```

Original spelling and punctuation stay as display text. Unsupported letters or numerals fail; review the text against the recording and spell numbers as spoken when the vocabulary cannot represent digits. This install establishes English support only. Another language needs its own installed model and validation.

The aligner cannot restore missing transcript text, choose wording, separate overlapping speech on one channel, or infer speakers. Separate channels before alignment when each voice has its own channel. Speaker labels come from the supplied segments. Timing is relative to the supplied audio, and each segment offset is applied once. Apply a source video's additional audio offset when exporting captions.

`--alignment-min-confidence` defaults to `0.1` and must be between 0 and 1. A word below the requested threshold blocks `result.json`. `alignment.json` and `alignment-work/` remain for review. The score summarizes model emission strength. It is not a probability that the word or boundary is correct. Lowering the threshold can publish an exploratory reference; words below `0.1` stay listed as low-confidence. A high score leaves an automatic reference unverified.

A successful run writes `result.json` and `alignment.json`, and keeps working files under `alignment-work/`. New timing is marked `aligned` and `manuallyVerified: false`.

If the default run rejects low-confidence words, preserve its diagnostics. The following separate diagnostic run deliberately accepts those ranges so comparison and calibration can be exercised:

```bash
bun autoshow extract input/examples/audio/01-two-speaker-speech-stereo.wav --align-transcript runtime/examples/speech-workflows/reviewed/result.json --alignment-model runtime/models/alignment/wav2vec2-base-960h-onnx --alignment-min-confidence 0 --output-dir runtime/examples/speech-workflows/aligned-exploratory --json
```

The diagnostic result retains low-confidence flags and `manuallyVerified: false`. Review its ranges against the recording before relying on their boundaries.

### Compare saved word timing

Create the candidate from the same recording with an already installed tiny bundle, then compare it to the diagnostic reference above. [Setup](../../../../00-setup-and-utilities/setup.md) documents the separate one-time Whisperfile installation; this command may download a missing bundle, so finish installation first when an offline run is required.

```bash
bun autoshow extract input/examples/audio/01-two-speaker-speech-stereo.wav --provider whisperfile=tiny --output-dir runtime/examples/speech-workflows/whisper --json
bun autoshow extract runtime/examples/speech-workflows/whisper/result.json --timing-reference runtime/examples/speech-workflows/aligned-exploratory/result.json --output-dir runtime/examples/speech-workflows/timing-comparison --json
```

`timing-comparison.json` reports word coverage, unmatched words, boundary differences, drift, timing provenance, and exact speaker-label agreement. Coverage counts every word; boundary statistics count matched words. Invalid or empty word intervals are rejected. The original coarse subtitle fixture has no acoustic word evidence and is rejected as a direct reference.

Compare excerpts that already correspond. Matching keeps word order and repeated words. Split a substantially divergent comparison into shorter matching excerpts. Speaker scores require the same canonical labels; this Whisperfile candidate has no reviewed character identities, so its speaker score is not an identity assessment.

The report retains the reference's provenance and marks a reference without provenance as unverified. It measures agreement with that reference; acoustic accuracy requires an independently verified acoustic reference.

### Calibrate installed whisperfile timing

```bash
bun autoshow extract input/examples/audio/01-two-speaker-speech-stereo.wav --calibrate-whisper --timing-reference runtime/examples/speech-workflows/aligned-exploratory/result.json --whisper-calibration-model tiny --output-dir runtime/examples/speech-workflows/calibration --json
```

Whisperfile is the only calibration engine. `--whisper-calibration-model` defaults to `tiny`, and that bundle must already be installed. Calibration runs standard timing and, when the executable supports it, the model's DTW preset. When the reference records an audio fingerprint, it must match the input. Unsupported DTW is recorded and does not fail a successful standard run. Invalid word boundaries leave that variant out of the ranking (`rejectedVariants`). If no variant can be measured, diagnostics are saved and the command fails.

DTW word boundaries are estimated from token centers and marked `repaired`. `calibration.json` ranks measurable variants by lexical coverage, then by combined median start and end difference, and records local runtime. Calibration leaves transcription defaults unchanged. It makes no recommendation when no words match. A result applies only to the selected reference, engine, model, and executable version.

Inspect `referenceProvenance`, `unsupportedVariants`, and `rejectedVariants` before interpreting a recommendation. With the diagnostic reference above, it measures agreement with automatic, low-confidence timing. This is separate from the shared test runner's [model timeout calibration](../../../../testing.md#shared-runner-behavior).

### Preserve and transcribe separate channels

```bash
bun autoshow extract input/examples/audio/01-two-speaker-speech-stereo.wav --split-channels --output-dir runtime/examples/speech-workflows/channels --json
```

Every audio stream is inspected. The input needs at least two channels in total and at most 16 channels per stream. Each channel is saved as float32 PCM WAV at its original sample rate. `channels.json` records stream and channel identity, source offsets, and hashes. `channel-results.json` is the template for attaching completed transcripts to those channels.

A channel is not a speaker. The maintained stereo fixture carries mixed dialogue and demonstrates channel splitting, not speaker isolation. Stereo channels can carry the same mix, and then they cannot separate people. Speaker separation here requires isolated channels.

Transcribe the separated files with an already installed local engine:

```bash
bun autoshow extract runtime/examples/speech-workflows/channels/stream-0-channel-1.wav --provider whisperfile=tiny --output-dir runtime/examples/speech-workflows/channel-1 --json
bun autoshow extract runtime/examples/speech-workflows/channels/stream-0-channel-2.wav --provider whisperfile=tiny --output-dir runtime/examples/speech-workflows/channel-2 --json
```

Set the first entry's `result` in `channels/channel-results.json` to `../channel-1/result.json`, and the second to `../channel-2/result.json`. Keep each entry's `id`, `audio`, and `offsetSeconds` from extraction. Absolute paths are also accepted; relative paths resolve from the manifest directory. A template with `result: null` is rejected. Then merge:

```bash
bun autoshow extract runtime/examples/speech-workflows/channels/channel-results.json --merge-channel-results --output-dir runtime/examples/speech-workflows/channel-merge --json
```

The merge checks full text coverage and usable timing, applies each channel's source offset once, sorts events in time while keeping overlaps, and scopes speaker labels by channel. An already merged result is rejected so the offset is not applied again. Include each original channel once. Duplicate audio and cross-talk stay in the merge.

### Reconcile speakers across chunks or channels

```bash
bun autoshow extract runtime/examples/speech-workflows/channel-merge/result.json --speaker-map-template --output-dir runtime/examples/speech-workflows/speaker-review --json
```

Edit the generated `speaker-map.json`. Keep `schemaVersion` and `sourceSha256`, set `reason` to a nonempty review explanation, and map exact existing labels to canonical labels. For this mixed-channel fixture, keep `stream-0-channel-1` and `stream-0-channel-2` unchanged and set the reason to `Retain channel identities: both channels contain mixed dialogue; no person assignment is established.` Applying this map records the review without inventing speaker separation. Other recordings may justify mapping `chunk-1/speaker-0` and `chunk-2/speaker-1` to the same reviewed person. Matching numeric IDs, chronology, or similar wording leave identity unproven.

```bash
bun autoshow extract runtime/examples/speech-workflows/channel-merge/result.json --speaker-map runtime/examples/speech-workflows/speaker-review/speaker-map.json --output-dir runtime/examples/speech-workflows/reconciled --json
```

The source fingerprint rejects a map for a different result. Unknown source labels and empty targets are rejected. Only labels named in the map change. The source result file stays unchanged. `speaker-reconciliation.json` records the map, source, and review reason. This applies a reviewed label map. It does not identify speakers from the audio.

Use [caption export](../captions/overview.md) to turn the aligned or reconciled result into subtitle files.
