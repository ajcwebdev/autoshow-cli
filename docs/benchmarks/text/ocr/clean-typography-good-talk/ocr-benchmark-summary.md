# OCR Canonical Reference Benchmark Summary

## Summary

- Run directory: `input/examples/document/ocr-clean-typography/benchmark-runs/clean-typography-good-talk`
- Providers with page result files: 10
- Pages: 1
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- The publisher canonical reference is immutable; provider agreement diagnostics guide output review only.

## Page-Level Hybrid Sources

| Selected Provider          | Pages |
| -------------------------- | ----: |
| `anthropic/claude-fable-5` | 1     |

## Outlier Signals

| Signal                | Page Count |
| --------------------- | ---------: |
| blankOutputPages      | 0          |
| repeatedTextPages     | 0          |
| majorLengthDriftPages | 1          |
| highDisagreementPages | 0          |
| werCerDivergencePages | 0          |
| lowConfidencePages    | 0          |

## Selective Adjudication

- Candidate pages: 1
- Low-confidence threshold: 0.72
- High-disagreement threshold: 0.18

## Variant Distances

| Reference             | Candidate           | WER   | CER   | Word Edits |
| --------------------- | ------------------- | ----: | ----: | ---------: |
| `publisher-canonical` | `page-level-hybrid` | 0.00% | 0.00% | 0          |
