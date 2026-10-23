# OCR Consensus Benchmark Summary

## Summary

- Run directory: `input/examples/document/ocr-categories-bc-run/benchmark-runs/bc-rerun-05-pages-the-odyssey`
- Providers with page result files: 10
- Pages: 5
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider             | Pages |
| ----------------------------- | ----: |
| `anthropic/claude-sonnet-5-5` | 2     |
| `grok/grok-4.7`               | 2     |
| `gemini/gemini-3.8-flash`     | 1     |

## Outlier Signals

| Signal                | Page Count |
| --------------------- | ---------: |
| blankOutputPages      | 0          |
| repeatedTextPages     | 0          |
| majorLengthDriftPages | 0          |
| highDisagreementPages | 0          |
| werCerDivergencePages | 5          |
| lowConfidencePages    | 0          |

## Selective Adjudication

- Candidate pages: 5
- Low-confidence threshold: 0.72
- High-disagreement threshold: 0.191971

## Variant Distances

| Reference              | Candidate           | WER   | CER   | Word Edits |
| ---------------------- | ------------------- | ----: | ----: | ---------: |
| `status-quo-consensus` | `page-level-hybrid` | 2.38% | 0.38% | 27         |
