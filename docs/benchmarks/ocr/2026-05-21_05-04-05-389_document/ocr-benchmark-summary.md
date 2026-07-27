# OCR Consensus Benchmark Summary

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-05-21_05-04-05-389_document`
- Providers: 7
- Pages: 2
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider | Pages |
| --- | ---: |
| `anthropic/claude-haiku-4-5` | 1 |
| `mistral/mistral-ocr-4-0` | 1 |

## Outlier Signals

| Signal | Page Count |
| --- | ---: |
| blankOutputPages | 2 |
| repeatedTextPages | 0 |
| majorLengthDriftPages | 2 |
| highDisagreementPages | 0 |
| werCerDivergencePages | 0 |
| lowConfidencePages | 2 |

## Selective Adjudication

- Candidate pages: 2
- Low-confidence threshold: 0.72
- High-disagreement threshold: 2.055237

## Variant Distances

| Reference | Candidate | WER | CER | Word Edits |
| --- | --- | ---: | ---: | ---: |
| `status-quo-consensus` | `page-level-hybrid` | 40.44% | 29.01% | 954 |
