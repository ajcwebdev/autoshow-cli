# OCR Consensus Benchmark Summary

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/output/2026-06-14_01-22-40-317_document`
- Providers: 19
- Pages: 2
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider | Pages |
| --- | ---: |
| `grok/grok-4.3` | 1 |
| `mistral/mistral-ocr-2512` | 1 |

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
- High-disagreement threshold: 0.71582

## Variant Distances

| Reference | Candidate | WER | CER | Word Edits |
| --- | --- | ---: | ---: | ---: |
| `status-quo-consensus` | `page-level-hybrid` | 107.94% | 102.05% | 68 |
