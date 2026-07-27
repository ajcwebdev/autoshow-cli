# OCR Consensus Benchmark Summary

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/output/2026-06-14_01-28-15-914_document`
- Providers: 16
- Pages: 2
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider | Pages |
| --- | ---: |
| `anthropic/claude-opus-4-8` | 2 |

## Outlier Signals

| Signal | Page Count |
| --- | ---: |
| blankOutputPages | 2 |
| repeatedTextPages | 2 |
| majorLengthDriftPages | 2 |
| highDisagreementPages | 0 |
| werCerDivergencePages | 0 |
| lowConfidencePages | 1 |

## Selective Adjudication

- Candidate pages: 2
- Low-confidence threshold: 0.72
- High-disagreement threshold: 0.18

## Variant Distances

| Reference | Candidate | WER | CER | Word Edits |
| --- | --- | ---: | ---: | ---: |
| `status-quo-consensus` | `page-level-hybrid` | 0.00% | 0.00% | 0 |
