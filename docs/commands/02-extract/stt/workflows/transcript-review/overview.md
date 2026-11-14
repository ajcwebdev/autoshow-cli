# Transcript Review

Export a word-indexed packet and edit template, then apply reviewed changes to the same saved result. Both operations are offline and preserve existing source/output files.

```bash
bun autoshow extract input/examples/video/01-two-speaker-speech.transcript.json --transcript-review --output-dir runtime/examples/speech-workflows/review --json
```

This writes `transcript-review.json`, `edits.json`, and `transcription.txt`. Review the packet against the matching [recording](../../../../../../input/examples/video/README.md). Keep generated `schemaVersion`/`sourceSha256`; replace only `edits`, for example:

```json
[
  {
    "startWord": 4,
    "deleteCount": 1,
    "expectedText": "Look",
    "replacement": "Look,",
    "reason": "Add direct-address punctuation without changing the supplied words."
  }
]
```

```bash
bun autoshow extract input/examples/video/01-two-speaker-speech.transcript.json --transcript-edits runtime/examples/speech-workflows/review/edits.json --output-dir runtime/examples/speech-workflows/reviewed --json
```

Apply writes a new `result.json`, `transcription.txt`, and `transcript-edits.json`. This punctuation-only example preserves interpolated subtitle timing; it does not establish measured word boundaries. Empty edit lists are valid.

Indices are zero-based against the original packet. Stale hashes, mismatched expected text, overlapping edits, replacements crossing segments/speakers, and output collisions fail. Same-word-count replacements retain individual timing; changed counts redistribute the selected span. Unedited words retain timing. Empty replacements may delete across speakers/segments but cannot remove the whole transcript.

Inspect `invalidSourceWords`/`invalidReviewWordIndices` and explicitly repair affected words: apply rejects invalid timing remaining in the result. Contextual plausibility alone does not verify speech. Receipts retain the source hash and original boundaries. See [caption export](../captions/overview.md) and [local alignment](../timing/overview.md#force-align-supplied-text-locally) for downstream work.
