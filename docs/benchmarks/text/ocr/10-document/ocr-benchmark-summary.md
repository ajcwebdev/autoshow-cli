# OCR Consensus Benchmark Summary

## Summary

- Run directory: `docs/benchmarks/text/ocr/10-document`
- Providers with page result files: 9
- Pages: 10
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider             | Pages |
| ----------------------------- | ----: |
| `anthropic/claude-opus-5-5`   | 3     |
| `gemini/gemini-3.8-flash`     | 3     |
| `anthropic/claude-sonnet-5-5` | 2     |
| `anthropic/claude-fable-5`    | 1     |
| `grok/grok-4.7`               | 1     |

## Outlier Signals

| Signal                | Page Count |
| --------------------- | ---------: |
| blankOutputPages      | 0          |
| repeatedTextPages     | 0          |
| majorLengthDriftPages | 0          |
| highDisagreementPages | 0          |
| werCerDivergencePages | 0          |
| lowConfidencePages    | 0          |

## Selective Adjudication

- Candidate pages: 0
- Low-confidence threshold: 0.72
- High-disagreement threshold: 0.18

## Variant Distances

| Reference              | Candidate           | WER   | CER   | Word Edits |
| ---------------------- | ------------------- | ----: | ----: | ---------: |
| `status-quo-consensus` | `page-level-hybrid` | 0.00% | 0.00% | 0          |
