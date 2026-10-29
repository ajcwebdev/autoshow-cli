# Transcript Review

See the [STT overview](../../overview.md) for provider selection and shared options.

Export a word-indexed review packet and an empty edit template from a saved `result.json`, then apply approved edits to that same source. Review and apply run offline and do not call a provider.

```bash
bun autoshow extract input/examples/video/01-two-speaker-speech.transcript.json --transcript-review --output-dir runtime/examples/speech-workflows/review --json
```

`--transcript-review` writes `transcript-review.json`, `edits.json`, and `transcription.txt`. Use a fresh output directory; the command keeps existing files intact.

The bundled transcript covers the exact 24-second recording with nine coarse subtitle segments and named characters. Review `runtime/examples/speech-workflows/review/transcript-review.json` alongside that recording. Keep its generated `schemaVersion` and `sourceSha256`; replace only `edits` in the template with this punctuation-only demonstration before the apply command:

```json
[
  {
    "startWord": 4,
    "deleteCount": 1,
    "expectedText": "Look",
    "replacement": "Look,",
    "reason": "Add direct-address punctuation without changing the supplied subtitle words."
  }
]
```

Apply the edited template to the original source:

```bash
bun autoshow extract input/examples/video/01-two-speaker-speech.transcript.json --transcript-edits runtime/examples/speech-workflows/review/edits.json --output-dir runtime/examples/speech-workflows/reviewed --json
```

This writes a new `result.json`, `transcription.txt`, and `transcript-edits.json`; the source result stays unchanged. The example changes punctuation only and preserves the source's interpolated timing, which supports export but does not establish acoustic word boundaries. The edit receipt records the source hash and original boundaries. An empty edit list is valid when no changes are approved.

Indices are zero-based and always address the original review packet. The CLI rejects a stale source hash, text that does not match the original words, overlapping edits, a replacement that crosses a source segment or speaker, and an output directory that already contains the files it would write. A replacement with the same word count keeps each word's original timing; a different word count redistributes the selected span. Words outside the edit keep their original timing. An empty `replacement` deletes the selected words and may span speakers or remove entire segments, but cannot remove the entire transcript.

The review packet reports `invalidSourceWords` and lists any remaining invalid timing in `invalidReviewWordIndices`. Explicitly delete or replace affected words through the edit template; apply rejects invalid word timing left in the result. Review uncertain wording against the recording; contextual plausibility alone does not establish what was spoken.

See [Caption Export](../captions/overview.md) to format or embed captions from the reviewed result.
