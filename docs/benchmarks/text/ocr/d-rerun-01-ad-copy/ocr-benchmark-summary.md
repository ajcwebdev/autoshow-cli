# OCR Consensus Benchmark Summary

## Summary

- Run directory: `input/examples/document/ocr-category-d-run/benchmark-runs/d-rerun-01-ad-copy`
- Providers with page result files: 10
- Pages: 1
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider            | Pages |
| ---------------------------- | ----: |
| `anthropic/claude-haiku-5-5` | 1     |

## Outlier Signals

| Signal                | Page Count |
| --------------------- | ---------: |
| blankOutputPages      | 0          |
| repeatedTextPages     | 0          |
| majorLengthDriftPages | 1          |
| highDisagreementPages | 1          |
| werCerDivergencePages | 0          |
| lowConfidencePages    | 1          |

## Selective Adjudication

- Candidate pages: 1
- Low-confidence threshold: 0.72
- High-disagreement threshold: 0.30988

## Variant Distances

| Reference              | Candidate           | WER   | CER   | Word Edits |
| ---------------------- | ------------------- | ----: | ----: | ---------: |
| `status-quo-consensus` | `page-level-hybrid` | 7.94% | 4.87% | 5          |
