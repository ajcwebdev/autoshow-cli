# Transcript Review

See the [STT overview](../../overview.md) for provider selection and shared options.

Export a word-indexed review packet and an empty edit template from a saved `result.json`, then apply approved edits to that same source. Review and apply run offline and do not call a provider.

```bash
bun autoshow extract output/episode/raw/result.json --transcript-review --output-dir output/episode/review --json

bun autoshow extract output/episode/raw/result.json --transcript-edits output/episode/review/edits.json --output-dir output/episode/reviewed --json
```
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

Keep the template's `schemaVersion` and `sourceSha256`. Indices are zero-based and always address the original review packet. The CLI rejects a stale source hash, text that does not match the original words, overlapping edits, a replacement that crosses a source segment or speaker, and an output directory that already contains these files. A replacement with the same word count keeps each word's original timing. A different word count redistributes that span. Words outside the edit keep their original timing. An empty `replacement` deletes the selected words and may span speakers or remove entire segments. The review packet lists `invalidSourceWords` and `invalidReviewWordIndices`; remove that timing before apply, which rejects any invalid word timing still present. Review uncertain wording against the recording; contextual plausibility alone does not establish what was spoken.

See [Caption Export](../captions/overview.md) to format or embed captions from the reviewed result.
