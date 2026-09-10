# Reproducible transcription, review, and caption workflow

See the [STT overview](../../overview.md) for provider selection and shared options.

Use the CLI for audio preparation, provider execution, review packets, applying approved edits, caption generation, and container verification. Human or agent review supplies editorial decisions by editing JSON data; no custom executable script is needed. The review/apply commands are entirely offline and do not invoke an LLM or STT provider.

```bash
# Paid transcription: run once after approving the provider and estimate.
bun autoshow extract "input/video.mp4" --provider assemblyai=universal-3-5-pro --diarization --stt-audio-profile lossless --output-dir output/episode/raw --json

# Offline: export words with stable indices and a source-bound edit template.
bun autoshow extract output/episode/raw/result.json --transcript-review --output-dir output/episode/review --json

# Review transcript-review.json and edit only the edits array in edits.json.
bun autoshow extract output/episode/raw/result.json --transcript-edits output/episode/review/edits.json --output-dir output/episode/reviewed --json

# Offline: use audioToVideoOffsetSeconds from raw/source-timeline.json (0 in this example).
bun autoshow extract "input/video.mp4" --captions --transcript-result output/episode/reviewed/result.json --caption-offset 0 --no-caption-speakers --embed-captions --caption-container both --output-dir output/episode/final --json
```

`--stt-audio-profile lossless` decodes the first audio stream to float32 PCM WAV at its original sample rate and channel count. Before submission, the CLI verifies that the source and prepared audio decode to identical samples. It retains the prepared audio and `source-timeline.json`, including the original audio start offset. This preserves decoded audio; it cannot recover information already lost in the source codec. The default profile continues to use the existing provider-oriented audio preparation. The profile can also be configured as `defaults.extract.stt.audioProfile`.

Each entry in the template's `edits` array has this shape (indices and text below are illustrative):

```json
{
  "startWord": 12,
  "deleteCount": 1,
  "expectedText": "Helo,",
  "replacement": "Hello,",
  "reason": "Correct a spelling error without changing the spoken word."
}
```

Keep the template's `schemaVersion` and `sourceSha256`. Indices are zero-based and always address the original review packet. The CLI rejects stale source hashes, unexpected original text, overlapping edits, replacements crossing source segments or speakers, and existing output artifacts. Equal-count substitutions retain each original word's boundaries; changed word counts interpolate explicitly within the selected span. Unselected words retain their timing. An empty replacement explicitly deletes the selected words and may span speakers or remove entire segments; removed segments are retained in the provenance sidecar. Review packets expose invalid source timing and invalid review word indices so malformed repetition can be inspected and explicitly removed offline. Apply rejects any invalid word timing remaining in the reviewed result. `transcript-edits.json` records reasons, original and replacement words, timing decisions, removed segments, and the source evidence path. The source result remains unmodified. Review uncertain wording against the recording; contextual plausibility alone does not establish what was spoken.

For multiple videos, repeat these commands with a distinct episode directory. Embedding currently takes one local video per invocation. If caption formatting or embedding fails, use the saved result in an offline command; do not resubmit transcription. A failed or ambiguous provider submission requires reconciliation before any paid retry.

Embedding validates the extracted subtitle text and millisecond cue timings, audio/video stream payload hashes, every audio/video packet's presentation time within container precision, and retained chapters before publishing each completed video. `caption-embedding.json` records the checks. These automated checks establish faithful packaging, not acoustic alignment accuracy or visual playback quality; playback remains a separate review step.
