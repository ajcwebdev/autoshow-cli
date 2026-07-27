# OCR Consensus Benchmark Summary

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/output/2026-06-14_01-22-42-930_document`
- Providers: 19
- Pages: 2
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider | Pages |
| --- | ---: |
| `anthropic/claude-opus-4-8` | 1 |
| `mistral/mistral-ocr-2512` | 1 |

## Outlier Signals

| Signal | Page Count |
| --- | ---: |
| blankOutputPages | 2 |
| repeatedTextPages | 0 |
| majorLengthDriftPages | 2 |
| highDisagreementPages | 0 |
| werCerDivergencePages | 1 |
| lowConfidencePages | 2 |

## Selective Adjudication

- Candidate pages: 2
- Low-confidence threshold: 0.72
- High-disagreement threshold: 1.002028

## Variant Distances

| Reference | Candidate | WER | CER | Word Edits |
| --- | --- | ---: | ---: | ---: |
| `status-quo-consensus` | `page-level-hybrid` | 106.69% | 106.17% | 367 |
