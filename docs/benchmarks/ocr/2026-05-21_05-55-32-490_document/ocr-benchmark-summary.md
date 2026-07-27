# OCR Consensus Benchmark Summary

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-05-21_05-55-32-490_document`
- Providers: 7 page-level extraction artifacts
- Provider comparison rows: 22 (3 local, 19 third-party service)
- Pages: 5
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider | Pages |
| --- | ---: |
| `anthropic/claude-haiku-4-5` | 2 |
| `anthropic/claude-opus-4-8` | 1 |
| `mistral/mistral-ocr-4-0` | 2 |

## Outlier Signals

| Signal | Page Count |
| --- | ---: |
| blankOutputPages | 4 |
| repeatedTextPages | 0 |
| majorLengthDriftPages | 5 |
| highDisagreementPages | 1 |
| werCerDivergencePages | 1 |
| lowConfidencePages | 5 |

## Selective Adjudication

- Candidate pages: 5
- Low-confidence threshold: 0.72
- High-disagreement threshold: 0.295044

## Variant Distances

| Reference | Candidate | WER | CER | Word Edits |
| --- | --- | ---: | ---: | ---: |
| `status-quo-consensus` | `page-level-hybrid` | 10.63% | 2.27% | 114 |
