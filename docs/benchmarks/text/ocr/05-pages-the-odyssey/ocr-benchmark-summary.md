# OCR Consensus Benchmark Summary

## Summary

- Run directory: `docs/benchmarks/text/ocr/05-pages-the-odyssey`
- Providers with page result files: 9
- Pages: 5
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider             | Pages |
| ----------------------------- | ----: |
| `anthropic/claude-haiku-5-5`  | 1     |
| `anthropic/claude-sonnet-5-5` | 1     |
| `gemini/gemini-3.8-flash`     | 1     |
| `mistral/mistral-ocr-4-1`     | 1     |
| `openai/gpt-6-luna`           | 1     |

## Outlier Signals

| Signal                | Page Count |
| --------------------- | ---------: |
| blankOutputPages      | 0          |
| repeatedTextPages     | 0          |
| majorLengthDriftPages | 0          |
| highDisagreementPages | 0          |
| werCerDivergencePages | 4          |
| lowConfidencePages    | 0          |

## Selective Adjudication

- Candidate pages: 4
- Low-confidence threshold: 0.72
- High-disagreement threshold: 0.211984

## Variant Distances

| Reference              | Candidate           | WER   | CER   | Word Edits |
| ---------------------- | ------------------- | ----: | ----: | ---------: |
| `status-quo-consensus` | `page-level-hybrid` | 5.55% | 0.98% | 63         |
