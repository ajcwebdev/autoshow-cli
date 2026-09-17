# OCR Consensus Benchmark Summary

## Summary

- Run directory: `/Users/ajc/c/auto/autoshow-cli/docs/benchmarks/ocr/01-handwriting`
- Providers with page result files: 23
- Pages: 1
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider | Pages |
| --- | ---: |
| `mistral/mistral-ocr-4-1` | 1 |

## Outlier Signals

| Signal | Page Count |
| --- | ---: |
| blankOutputPages | 0 |
| repeatedTextPages | 0 |
| majorLengthDriftPages | 0 |
| highDisagreementPages | 1 |
| werCerDivergencePages | 1 |
| lowConfidencePages | 0 |

## Selective Adjudication

- Candidate pages: 1
- Low-confidence threshold: 0.72
- High-disagreement threshold: 0.190628

## Variant Distances

| Reference | Candidate | WER | CER | Word Edits |
| --- | --- | ---: | ---: | ---: |
| `status-quo-consensus` | `page-level-hybrid` | 9.85% | 3.29% | 20 |
