# OCR Consensus Benchmark Summary

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-06-14_01-28-29-201_document`
- Providers with page result files: 8
- Pages: 1
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider                                     | Pages |
| ----------------------------------------------------- | ----: |
| `deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct` |     1 |

## Outlier Signals

| Signal                | Page Count |
| --------------------- | ---------: |
| blankOutputPages      |          0 |
| repeatedTextPages     |          0 |
| majorLengthDriftPages |          1 |
| highDisagreementPages |          1 |
| werCerDivergencePages |          1 |
| lowConfidencePages    |          1 |

## Selective Adjudication

- Candidate pages: 1
- Low-confidence threshold: 0.72
- High-disagreement threshold: 0.443802

## Variant Distances

| Reference              | Candidate           |    WER |   CER | Word Edits |
| ---------------------- | ------------------- | -----: | ----: | ---------: |
| `status-quo-consensus` | `page-level-hybrid` | 29.63% | 4.57% |         40 |
