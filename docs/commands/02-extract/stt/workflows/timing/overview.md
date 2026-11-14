# Local Timing and Speaker Workflows

These `extract` operations use local audio and saved `result.json` files without hosted requests. Run one operation into a fresh directory; all support `--json`, `--output-dir`, and zero-provider-cost `--price`, while provider/caption options are rejected. Failures retain completed artifacts and working files.

The examples use the matching [24-second recording/transcript](../../../../../../input/examples/video/README.md). Complete [transcript review/apply](../transcript-review/overview.md) first. Its coarse subtitle spans are not an acoustic word reference.

### Force-align supplied text locally

Install the optional runtime and pinned English ONNX model once; these prerequisites need network access, while alignment itself never downloads anything:

```bash
bun --no-env-file install --cwd config/stt-alignment --frozen-lockfile --ignore-scripts
bun --no-env-file src/tools/install-alignment-model.ts
```

The installer verifies hashes, reuses matching files, and preserves conflicts. Supply the installed ONNX directory, not PyTorch weights. The runtime supports macOS/Linux x64/ARM64; Docker's optional `alignment` target includes it, the default image does not.

```bash
bun autoshow extract input/examples/audio/01-two-speaker-speech-stereo.wav --align-transcript runtime/examples/speech-workflows/reviewed/result.json --alignment-model runtime/models/alignment/wav2vec2-base-960h-onnx --output-dir runtime/examples/speech-workflows/aligned --json
```

Transcript segments must cover all text with positive, non-overlapping audio-relative spans of at most 30 seconds. Alignment reads the first stream as mono 16 kHz. Display spelling/punctuation remain; unsupported vocabulary characters or digits fail rather than changing wording. This installed model establishes English support only.

Alignment inherits supplied speaker labels and cannot recover omitted speech, choose wording, or separate overlapping voices. Segment offsets apply once; caption export may need a further source-video offset.

`--alignment-min-confidence` defaults to `0.1`, range `0–1`. Lower-scoring words block `result.json` while preserving `alignment.json` and `alignment-work/`. Confidence is emission strength, not correctness probability. Output is marked `aligned` and `manuallyVerified: false`; even high confidence does not verify text or boundaries.

For diagnostics, preserve the failed run and create a separate exploratory reference:

```bash
bun autoshow extract input/examples/audio/01-two-speaker-speech-stereo.wav --align-transcript runtime/examples/speech-workflows/reviewed/result.json --alignment-model runtime/models/alignment/wav2vec2-base-960h-onnx --alignment-min-confidence 0 --output-dir runtime/examples/speech-workflows/aligned-exploratory --json
```

Words below `0.1` remain flagged and `manuallyVerified` remains false. Review against the recording before trusting these boundaries.

### Compare saved word timing

Use a candidate/reference from the same recording or corresponding excerpt:

```bash
bun autoshow extract input/examples/audio/01-two-speaker-speech-stereo.wav --provider whisperfile=tiny --output-dir runtime/examples/speech-workflows/whisper --json
bun autoshow extract runtime/examples/speech-workflows/whisper/result.json --timing-reference runtime/examples/speech-workflows/aligned-exploratory/result.json --output-dir runtime/examples/speech-workflows/timing-comparison --json
```

Install Whisperfile first for offline operation; normal transcription may fetch a missing bundle. `timing-comparison.json` reports ordered word coverage, unmatched words, boundary differences, drift, speaker-label agreement, and reference provenance. Invalid/empty word intervals fail; coarse subtitle timing is unsuitable. Coverage uses all words, boundary statistics matched words. Exact label agreement is not person identification, and agreement with automatic timing is not acoustic accuracy.

### Calibrate installed whisperfile timing

```bash
bun autoshow extract input/examples/audio/01-two-speaker-speech-stereo.wav --calibrate-whisper --timing-reference runtime/examples/speech-workflows/aligned-exploratory/result.json --whisper-calibration-model tiny --output-dir runtime/examples/speech-workflows/calibration --json
```

Only installed Whisperfile models are supported; default `tiny`. The command compares standard timing and supported DTW, preserving diagnostics for unsupported/rejected variants. Reference audio fingerprints must match when present. Invalid boundaries exclude a variant; no measurable variants fail, and no lexical matches produce no recommendation.

`calibration.json` ranks lexical coverage, then combined median start/end differences, and records runtime/provenance. DTW estimates are marked `repaired`. Results apply only to that reference/model/executable and never alter transcription defaults. This is separate from [test-runner timeout calibration](../../../../testing.md#shared-runner-behavior).

### Preserve and transcribe separate channels

```bash
bun autoshow extract input/examples/audio/01-two-speaker-speech-stereo.wav --split-channels --output-dir runtime/examples/speech-workflows/channels --json
```

Input needs at least two total channels, at most 16 per stream. Each channel becomes verified float32 WAV at its original rate. `channels.json` retains stream/channel identities, offsets, and hashes; `channel-results.json` is the transcript attachment template.

Transcribe channel WAVs separately, then fill each template entry's `result` with its saved result path. Keep `id`, `audio`, and `offsetSeconds`; relative paths resolve beside the template, absolute paths also work, and null results fail.

```bash
bun autoshow extract runtime/examples/speech-workflows/channels/channel-results.json --merge-channel-results --output-dir runtime/examples/speech-workflows/channel-merge --json
```

Merge validates coverage/timing, applies offsets once, sorts events while retaining overlaps, and scopes labels by channel. Include each channel once; already merged results fail. A channel is not a person: this stereo fixture contains mixed dialogue, and merging neither separates speakers nor removes duplicate/cross-talk audio.

### Reconcile speakers across chunks or channels

```bash
bun autoshow extract runtime/examples/speech-workflows/channel-merge/result.json --speaker-map-template --output-dir runtime/examples/speech-workflows/speaker-review --json
bun autoshow extract runtime/examples/speech-workflows/channel-merge/result.json --speaker-map runtime/examples/speech-workflows/speaker-review/speaker-map.json --output-dir runtime/examples/speech-workflows/reconciled --json
```

Between commands, edit `speaker-map.json`: preserve `schemaVersion`/`sourceSha256`, add a nonempty review `reason`, and map exact existing labels to reviewed canonical labels. For the mixed-channel fixture, retain channel labels; it establishes no person assignments. Numeric IDs, chronology, and similar wording alone cannot verify identity.

Unknown labels, empty targets, or a stale source fingerprint fail. Only named labels change; the source stays intact and `speaker-reconciliation.json` records the review. Use [caption export](../captions/overview.md) on aligned or reconciled results.
