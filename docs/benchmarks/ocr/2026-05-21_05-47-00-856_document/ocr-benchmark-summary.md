# OCR Consensus Benchmark Summary

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-05-21_05-47-00-856_document`
- Providers: 7
- Pages: 5
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider | Pages |
| --- | ---: |
| `mistral/mistral-ocr-4-0` | 2 |
| `anthropic/claude-haiku-4-5` | 1 |
| `anthropic/claude-sonnet-5` | 1 |
| `grok/grok-4.20-0309-non-reasoning` | 1 |

## Outlier Signals

| Signal | Page Count |
| --- | ---: |
| blankOutputPages | 5 |
| repeatedTextPages | 0 |
| majorLengthDriftPages | 5 |
| highDisagreementPages | 0 |
| werCerDivergencePages | 3 |
| lowConfidencePages | 2 |

## Selective Adjudication

- Candidate pages: 5
- Low-confidence threshold: 0.72
- High-disagreement threshold: 1.606098

## Variant Distances

| Reference | Candidate | WER | CER | Word Edits |
| --- | --- | ---: | ---: | ---: |
| `status-quo-consensus` | `page-level-hybrid` | 59.63% | 48.73% | 796 |
