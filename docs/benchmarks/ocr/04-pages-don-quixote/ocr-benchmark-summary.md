# OCR Consensus Benchmark Summary

## Summary

- Run directory: `docs/benchmarks/ocr/04-pages-don-quixote`
- Providers with page result files: 30
- Pages: 4
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider          | Pages |
| -------------------------- | ----: |
| `anthropic/claude-opus-5`  | 2     |
| `anthropic/claude-fable-5` | 1     |
| `mistral/mistral-ocr-4-1`  | 1     |

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

| Reference              | Candidate           | WER   | CER   | Word Edits |
| ---------------------- | ------------------- | ----: | ----: | ---------: |
| `status-quo-consensus` | `page-level-hybrid` | 0.15% | 0.19% | 2          |
