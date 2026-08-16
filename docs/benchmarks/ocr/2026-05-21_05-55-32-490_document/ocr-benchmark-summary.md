# OCR Consensus Benchmark Summary

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-05-21_05-55-32-490_document`
- Providers with page result files: 8
- Pages: 5
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider                                         | Pages |
| --------------------------------------------------------- | ----: |
| `deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506` |     4 |
| `deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct`     |     1 |

## Outlier Signals

| Signal                | Page Count |
| --------------------- | ---------: |
| blankOutputPages      |          4 |
| repeatedTextPages     |          0 |
| majorLengthDriftPages |          5 |
| highDisagreementPages |          1 |
| werCerDivergencePages |          1 |
| lowConfidencePages    |          1 |

## Selective Adjudication

- Candidate pages: 5
- Low-confidence threshold: 0.72
- High-disagreement threshold: 0.368332

## Variant Distances

| Reference              | Candidate           |    WER |   CER | Word Edits |
| ---------------------- | ------------------- | -----: | ----: | ---------: |
| `status-quo-consensus` | `page-level-hybrid` | 12.91% | 3.89% |        144 |
