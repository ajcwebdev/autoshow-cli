# OCR Consensus Benchmark Summary

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/01-test-picture`
- Providers with page result files: 28
- Pages: 1
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider | Pages |
| --- | ---: |
| `anthropic/claude-fable-5` | 1 |

## Outlier Signals

| Signal | Page Count |
| --- | ---: |
| blankOutputPages | 0 |
| repeatedTextPages | 1 |
| majorLengthDriftPages | 0 |
| highDisagreementPages | 0 |
| werCerDivergencePages | 0 |
| lowConfidencePages | 0 |

## Selective Adjudication

- Candidate pages: 1
- Low-confidence threshold: 0.72
- High-disagreement threshold: 0.18

## Variant Distances

| Reference | Candidate | WER | CER | Word Edits |
| --- | --- | ---: | ---: | ---: |
| `status-quo-consensus` | `page-level-hybrid` | 0.00% | 0.00% | 0 |
