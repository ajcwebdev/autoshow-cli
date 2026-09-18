# Transcript Review

See the [STT overview](../../overview.md) for provider selection and shared options.

Export a word-indexed review packet and empty edit template from a saved `result.json`, then apply approved edits to that same source. Review and apply are offline and do not call an LLM or STT provider. Human or agent review supplies editorial decisions by editing JSON.

```bash
bun autoshow extract "input/video.mp4" --provider assemblyai=universal-3-5-pro --diarization --stt-audio-profile lossless --output-dir output/episode/raw --json

bun autoshow extract output/episode/raw/result.json --transcript-review --output-dir output/episode/review --json

bun autoshow extract output/episode/raw/result.json --transcript-edits output/episode/review/edits.json --output-dir output/episode/reviewed --json

bun autoshow extract "input/video.mp4" --captions --transcript-result output/episode/reviewed/result.json --caption-offset 0 --no-caption-speakers --embed-captions --caption-container both --output-dir output/episode/final --json
```
`--stt-audio-profile lossless` saves `source-timeline.json` with the original audio start offset for later `--caption-offset`. The default profile uses provider-oriented audio preparation.

`--transcript-review` writes `transcript-review.json`, `edits.json`, and `transcription.txt`. `--transcript-edits` writes a new `result.json`, `transcription.txt`, and `transcript-edits.json`. The source result is not modified.

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

Keep the template's `schemaVersion` and `sourceSha256`. Indices are zero-based and always address the original review packet. The CLI rejects stale source hashes, unexpected original text, overlapping edits, replacements that cross source segments or speakers, and existing output artifacts. Same-count replacements keep original word timings; a different word count redistributes timing across the selected span. Other words keep their original timing. An empty `replacement` deletes the selected words and may span speakers or remove entire segments. The review packet lists `invalidSourceWords` and `invalidReviewWordIndices` so malformed timing can be inspected and deleted offline. Apply rejects any invalid word timing still present in the reviewed result. Review uncertain wording against the recording; contextual plausibility alone does not establish what was spoken.

For multiple videos, repeat these commands with a distinct episode directory. If caption formatting or embedding fails, retry from the saved reviewed result; do not resubmit transcription. See [Caption Export](../captions/overview.md) for caption flags and embedding.
