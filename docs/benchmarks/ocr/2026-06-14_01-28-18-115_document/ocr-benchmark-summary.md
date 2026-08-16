# OCR Consensus Benchmark Summary

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-06-14_01-28-18-115_document`
- Providers with page result files: 8
- Pages: 1
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider                 | Pages |
| --------------------------------- | ----: |
| `deepinfra/google/gemma-3-27b-it` |     1 |

## Outlier Signals

| Signal                | Page Count |
| --------------------- | ---------: |
| blankOutputPages      |          0 |
| repeatedTextPages     |          0 |
| majorLengthDriftPages |          0 |
| highDisagreementPages |          0 |
| werCerDivergencePages |          0 |
| lowConfidencePages    |          0 |

## Selective Adjudication

- Candidate pages: 0
- Low-confidence threshold: 0.72
- High-disagreement threshold: 0.18

## Variant Distances

| Reference              | Candidate           |   WER |   CER | Word Edits |
| ---------------------- | ------------------- | ----: | ----: | ---------: |
| `status-quo-consensus` | `page-level-hybrid` | 2.35% | 0.73% |          5 |
