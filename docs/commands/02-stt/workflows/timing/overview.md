# Local Timing and Speaker Workflows

See the [STT overview](../../overview.md) for provider selection and shared options.

These `extract` operations work with local audio and saved `result.json` files. They never submit a hosted provider request. Each operation supports `--json`, `--output-dir`, and zero-provider-cost `--price`; run operations separately and use a fresh output directory. Provider and caption options are rejected on timing operations. Failed operations preserve completed artifacts and working files for inspection.

### Compare saved word timing

```bash
bun autoshow extract output/candidate/result.json --timing-reference output/reference/result.json --output-dir output/timing-comparison --json
```

`timing-comparison.json` records ordered lexical matches, reference and candidate coverage, unmatched word indices, absolute start/end differences (median, p95, maximum), the fraction of matched words with both boundaries within 50/100/250 ms, signed drift by minute, timing provenance, and exact canonical speaker-label agreement. Coverage uses all words; boundary statistics use matched words. These tolerance bands are evaluation settings, not accuracy promises. Empty or invalid word intervals are rejected rather than interpolated for measurement.

Compare matching excerpts when transcripts diverge substantially. Lexical matching preserves order and repeated words but does not infer where an excerpt belongs in a longer candidate. Divergent comparisons are bounded to 20 million alignment cells; identical text uses a linear path. Speaker scores require matching canonical labels, so reconcile reviewed identities first when providers or chunks use different labels.

The report preserves the reference's provenance and identifies references lacking provenance as unverified. It measures agreement with that reference. Automatic alignment, provider confidence, or millisecond timestamp storage cannot independently establish acoustic accuracy. A manually verified reference is still needed for a defensible acoustic accuracy claim.

### Force-align supplied text locally

The optional backend runs a local Wav2Vec2 CTC ONNX model through TypeScript and ONNX Runtime 1.29.0 on the CPU. It accepts mono 16 kHz audio. Model inference and alignment stay offline; explicit setup downloads the frozen runtime graph and pinned public model assets. The extraction command never installs packages, downloads models, or executes model-supplied code. See the [ONNX Runtime JavaScript binding](https://onnxruntime.ai/docs/get-started/with-javascript/node.html) and [ONNX model repository](https://huggingface.co/onnx-community/wav2vec2-base-960h-ONNX/tree/729c1a6730fb549c20a1c73a3d3f96f11020225e).

Install the optional runtime and English model once from the repository root:

```bash
bun --no-env-file install --cwd config/stt-alignment --frozen-lockfile --ignore-scripts
bun --no-env-file src/tools/install-alignment-model.ts
```

The installer downloads approximately 378 MB, verifies fixed SHA-256 hashes, reuses matching files, and preserves conflicting files. A model directory must contain `config.json`, `preprocessor_config.json`, `vocab.json`, and one self-contained `model.onnx`. Symlinks, duplicate JSON keys, executable dispatch metadata, PyTorch weights, and models with adapters are rejected. Existing PyTorch model folders require a separate ONNX model directory. The retired `--alignment-python` option is no longer accepted.

The frozen runtime graph is in `config/stt-alignment/`; CPU binaries are available for macOS and Linux on x64 and ARM64. The optional Docker `alignment` target installs this graph. The default image omits the optional runtime and model weights. A compiled CLI requires Bun on PATH, the installed native package under `config/stt-alignment/node_modules/`, and the bundled `src/cli/commands/stt/workflows/timing/stt-onnx-worker.js` beside its project root. The compiled Docker target includes the worker and frozen package manifest; install the optional graph before aligning. To package the worker locally, run `bun build src/cli/commands/stt/workflows/timing/stt-onnx-worker.ts --target=bun --outfile=<distribution>/src/cli/commands/stt/workflows/timing/stt-onnx-worker.js`. The worker avoids the standalone executable’s external-package resolution limitation. Run the synthetic offline backend checks with `bun test test/test-cases/validation/stt/workflows/timing/stt-onnx-alignment.test.ts` after installing the optional graph.

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

The command decodes each supplied segment from the first audio stream to mono PCM16 at 16 kHz, computes CTC log probabilities, and finds a monotonic alignment with blank transitions between repeated labels. Word ranges derive from occupied acoustic frames. Original spelling and punctuation remain display text, including standalone punctuation attached to an adjacent word; unsupported letters or numerals fail explicitly. Spell numbers as spoken in the supplied text when the vocabulary cannot represent digits. Do not omit unheard or unsupported words merely to obtain a successful alignment. Other languages require an appropriate locally installed character-vocabulary CTC model and their own validation; this setup establishes English support only. [CTC alignment method](https://github.com/pytorch/audio/blob/main/examples/tutorials/forced_alignment_tutorial.py).

The aligner cannot restore missing transcript content, adjudicate wording, separate overlapping mono speech, or infer speakers. Edit the transcript from the recording when needed; separate channels before alignment when different voices have isolated channels. Speaker labels are inherited from the supplied segments. Timing is relative to the supplied audio, with each segment offset applied once. A source video's additional audio offset must be handled separately when exporting captions.

`--alignment-min-confidence` defaults to `0.1`. A word below the requested threshold prevents publication of `result.json`; `alignment.json` and `alignment-work/` remain available. Confidence summarizes model emission scores and is not a calibrated probability that the word or boundary is correct. Exploratory automatic references can explicitly lower the threshold; all words below `0.1` remain listed as low-confidence even when accepted. A high score does not turn an automatic reference into verified ground truth.

Successful output contains `result.json`, `alignment.json`, and retained clips/emissions under `alignment-work/`. Source transcript and audio SHA-256 fingerprints, model-file hashes, runtime version, preprocessing, and confidence decisions are recorded. Original provider evidence is retained as chunk evidence. New timing is marked `aligned`, with `hasNativeWordTiming: false` and `referenceProvenance.manuallyVerified: false`.

### Calibrate installed whisperfile timing

```bash
bun autoshow extract audio.wav --calibrate-whisper --timing-reference output/aligned/result.json --whisper-engine whisperfile --whisper-calibration-model tiny --output-dir output/whisperfile-calibration --json
```

The engine flag accepts only `whisperfile` and defaults to it and the model to `tiny`. The selected bundle must already be installed. The removed `whisper` engine is rejected. Calibration runs standard timing and, when the executable advertises support, the model's DTW preset. A recorded reference audio fingerprint must match the input. Each variant retains raw JSON, normalized results, native subtitle artifacts supported by that executable, and command/model/help provenance. Unsupported DTW is recorded without turning a successful standard run into a failure. Invalid word boundaries or DTW centers exclude that variant from ranking and are recorded under `rejectedVariants`; remaining variants can still be measured. If none can be measured, the command saves its diagnostics and fails. It never repairs an invalid standard interval merely to produce a score.

Whisper DTW returns token centers, expressed in native centiseconds. The comparison derives intervals from adjacent-center midpoints and marks those word boundaries `repaired`; they are not native measured word start/end pairs. `calibration.json` ranks variants by lexical coverage, then combined median start/end difference, and records elapsed local runtime. It never changes transcription defaults, and it makes no recommendation when no words match. A result applies only to the selected reference, engine, model, and executable version. [Whisper CLI implementation](https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/cli.cpp).

### Preserve and transcribe separate channels

```bash
bun autoshow extract stereo.wav --split-channels --output-dir output/channels --json
```

Every audio stream is inspected. Inputs must contain at least two channels in total, with at most 16 channels per stream. Each channel is saved as float32 PCM WAV at its original sample rate. Decoded sample SHA-256 verification checks that extraction preserved that channel exactly. `channels.json` records stream/channel identity, source offsets, and hashes; `channel-results.json` is a template for associating completed transcripts with those channels.

Audio channel identity is not speaker identity. Stereo channels may contain the same mix, as in the existing one-minute example recording, and cannot then separate people. No general mono speaker-clustering capability is implied.

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
