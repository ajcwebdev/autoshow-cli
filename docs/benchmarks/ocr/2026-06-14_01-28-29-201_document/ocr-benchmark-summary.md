# OCR Consensus Benchmark Summary

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-06-14_01-28-29-201_document`
- Providers tracked in merged page metrics: 22
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
| lowConfidencePages | 1 |

## Selective Adjudication

- Candidate pages: 2
- Low-confidence threshold: 0.72
- High-disagreement threshold: 0.357957

## Variant Distances

| Reference | Candidate | WER | CER | Word Edits |
| --- | --- | ---: | ---: | ---: |
| `status-quo-consensus` | `page-level-hybrid` | 120.00% | 108.16% | 162 |
| `status-quo-consensus` | `page-level-hybrid-new-provider-files` | 25.93% | 3.21% | 35 |
