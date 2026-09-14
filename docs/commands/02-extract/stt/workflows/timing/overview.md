# Local Timing and Speaker Workflows

See the [STT overview](../../overview.md) for provider selection and shared options.

These `extract` operations work with local audio and saved `result.json` files. They never submit a hosted provider request. Each operation supports `--json`, `--output-dir`, and zero-provider-cost `--price`; run operations separately and use a fresh output directory. Provider and caption options are rejected on timing operations. Failed operations preserve completed artifacts and working files for inspection.

### Compare saved word timing

```bash
bun autoshow extract output/candidate/result.json --timing-reference output/reference/result.json --output-dir output/timing-comparison --json
```

`timing-comparison.json` records ordered lexical matches, reference and candidate coverage, unmatched word indices, absolute start/end differences (median, p95, maximum), the fraction of matched words with both boundaries within 50/100/250 ms, signed drift by minute, timing provenance, and exact canonical speaker-label agreement. Coverage uses all words; boundary statistics use matched words. These tolerance bands are evaluation settings, not accuracy promises. Empty or invalid word intervals are rejected rather than interpolated for measurement.

Compare matching excerpts when transcripts diverge substantially. Lexical matching preserves order and repeated words but does not infer where an excerpt belongs in a longer candidate. Divergent comparisons are bounded to 20 million alignment cells. Speaker scores require matching canonical labels, so reconcile reviewed identities first when providers or chunks use different labels.

The report preserves the reference's provenance and identifies references lacking provenance as unverified. It measures agreement with that reference. Automatic alignment, provider confidence, or millisecond timestamp storage cannot independently establish acoustic accuracy. A manually verified reference is still needed for a defensible acoustic accuracy claim.

### Force-align supplied text locally

Alignment uses a local English Wav2Vec2 CTC ONNX model on CPU. It stays offline and accepts mono 16 kHz audio. The extract command never installs packages, downloads models, or executes model-supplied code. See the [ONNX model repository](https://huggingface.co/onnx-community/wav2vec2-base-960h-ONNX/tree/729c1a6730fb549c20a1c73a3d3f96f11020225e).

Install the optional runtime and English model once from the repository root:

```bash
bun --no-env-file install --cwd config/stt-alignment --frozen-lockfile --ignore-scripts
bun --no-env-file src/tools/install-alignment-model.ts
```

The installer downloads approximately 378 MB, verifies SHA-256 hashes, reuses matching files, and leaves conflicting files in place. A model directory must contain `config.json`, `preprocessor_config.json`, `vocab.json`, and one self-contained `model.onnx`. PyTorch weights, adapters, and symlinks are rejected; keep an existing PyTorch folder separate from the ONNX directory.

The runtime is in `config/stt-alignment/` for macOS and Linux on x64 and ARM64. The default Docker image omits it; the optional `alignment` target installs the runtime graph. A compiled CLI also needs Bun on PATH, `config/stt-alignment/node_modules/`, and `src/cli/commands/stt/workflows/timing/stt-onnx-worker.js` beside the project root.

Supply a saved transcript whose segments cover its complete text. Each segment must have a positive, non-overlapping range of at most 30 seconds in the input audio's timeline. A minimal transcript has this shape:

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

Each supplied segment is decoded from the first audio stream to mono 16 kHz. Original spelling and punctuation remain display text, including standalone punctuation attached to an adjacent word. Unsupported letters or numerals fail explicitly; spell numbers as spoken when the vocabulary cannot represent digits. Do not omit unheard or unsupported words merely to obtain a successful alignment. Other languages need an installed character-vocabulary CTC model and their own validation; this setup establishes English support only.

The aligner cannot restore missing transcript content, adjudicate wording, separate overlapping mono speech, or infer speakers. Edit the transcript from the recording when needed; separate channels before alignment when different voices have isolated channels. Speaker labels are inherited from the supplied segments. Timing is relative to the supplied audio, with each segment offset applied once. A source video's additional audio offset must be handled separately when exporting captions.

`--alignment-min-confidence` defaults to `0.1`. A word below the requested threshold prevents publication of `result.json`; `alignment.json` and `alignment-work/` remain available. Confidence summarizes model emission scores and is not a calibrated probability that the word or boundary is correct. Exploratory automatic references can explicitly lower the threshold; all words below `0.1` remain listed as low-confidence even when accepted. A high score does not turn an automatic reference into verified ground truth.

Successful output contains `result.json`, `alignment.json`, and retained working files under `alignment-work/`. Source transcript and audio SHA-256 fingerprints, model-file hashes, runtime version, and confidence decisions are recorded. Original provider evidence is retained as chunk evidence. New timing is marked `aligned`, with `hasNativeWordTiming: false` and `referenceProvenance.manuallyVerified: false`.

### Calibrate installed whisperfile timing

```bash
bun autoshow extract audio.wav --calibrate-whisper --timing-reference output/aligned/result.json --whisper-engine whisperfile --whisper-calibration-model tiny --output-dir output/whisperfile-calibration --json
```

`--whisper-engine` accepts only `whisperfile` (the default) and `--whisper-calibration-model` defaults to `tiny`. The selected bundle must already be installed. Calibration runs standard timing and, when the executable supports it, the model's DTW preset. The reference audio fingerprint must match the input. Each variant keeps its raw JSON, normalized results, native subtitles the executable supports, and command/model provenance. Unsupported DTW is recorded without failing a successful standard run. Invalid word boundaries exclude that variant from ranking (`rejectedVariants`); remaining variants can still be measured. If none can be measured, diagnostics are saved and the command fails. Invalid standard intervals are not repaired to produce a score.

DTW word boundaries are derived, not native measured start/end pairs, and are marked `repaired`. `calibration.json` ranks variants by lexical coverage, then combined median start/end difference, and records elapsed local runtime. Calibration never changes transcription defaults and makes no recommendation when no words match. A result applies only to the selected reference, engine, model, and executable version.

### Preserve and transcribe separate channels

```bash
bun autoshow extract stereo.wav --split-channels --output-dir output/channels --json
```

Every audio stream is inspected. Inputs must contain at least two channels in total, with at most 16 channels per stream. Each channel is saved as float32 PCM WAV at its original sample rate. Decoded sample SHA-256 verification checks that extraction preserved that channel exactly. `channels.json` records stream/channel identity, source offsets, and hashes; `channel-results.json` is a template for associating completed transcripts with those channels.

Audio channel identity is not speaker identity. Stereo channels may contain the same mix and cannot then separate people. No general mono speaker-clustering capability is implied.

Transcribe the separated files with an already installed local engine:

```bash
bun autoshow extract output/channels/stream-0-channel-1.wav --provider whisperfile=tiny --output-dir output/channel-1 --json
bun autoshow extract output/channels/stream-0-channel-2.wav --provider whisperfile=tiny --output-dir output/channel-2 --json
```

Fill each template entry's `result` with that channel's saved `result.json` path. Absolute paths are accepted; relative paths resolve from the manifest directory. Keep `offsetSeconds` from extraction unless you have independently established another source timeline. Then merge:

```bash
bun autoshow extract output/channels/channel-results.json --merge-channel-results --output-dir output/channel-merge --json
```

The merge validates full text coverage and usable timing, applies each channel's source offset once, sorts events chronologically while preserving overlaps, and scopes speaker labels by channel. Original raw evidence, per-channel source fingerprints, and applied offsets remain available. Already merged channel results are rejected to prevent accidental repeated offset application. Each original channel should appear only once; duplicate audio or cross-talk is not automatically deduplicated.

### Reconcile speakers across chunks or channels

```bash
bun autoshow extract output/channel-merge/result.json --speaker-map-template --output-dir output/speaker-review --json
```

Edit the generated `speaker-map.json`: keep `schemaVersion` and `sourceSha256`, give `reason` a nonempty review explanation, and map exact existing labels to canonical labels. For example, reviewed evidence may justify mapping `chunk-1/speaker-0` and `chunk-2/speaker-1` to the same `Host` label. Matching numeric IDs, chronology, or similar wording alone does not establish that identity. Leave uncertain labels separate.

```bash
bun autoshow extract output/channel-merge/result.json --speaker-map output/speaker-review/speaker-map.json --output-dir output/reconciled --json
```

The source fingerprint prevents applying a map to a different result. Unknown source labels and empty targets are rejected. Only explicitly mapped labels change in normalized words, segments, and applicable chunk evidence; original raw responses and the source file remain unchanged. `speaker-reconciliation.json` records the map, source, and review reason. This is explicit reconciliation, not automatic acoustic speaker identification.

Use [caption export](../captions/overview.md#export-aligned-or-reconciled-captions) to turn the aligned or reconciled result into subtitle files.
