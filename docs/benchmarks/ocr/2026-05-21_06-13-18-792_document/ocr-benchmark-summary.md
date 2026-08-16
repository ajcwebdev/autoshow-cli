# OCR Consensus Benchmark Summary

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-05-21_06-13-18-792_document`
- Providers with page result files: 7
- Pages: 10
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider                                         | Pages |
| --------------------------------------------------------- | ----: |
| `deepinfra/google/gemma-3-27b-it`                         |     4 |
| `deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct`     |     4 |
| `deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506` |     2 |

## Outlier Signals

| Signal                | Page Count |
| --------------------- | ---------: |
| blankOutputPages      |          9 |
| repeatedTextPages     |          0 |
| majorLengthDriftPages |         10 |
| highDisagreementPages |          2 |
| werCerDivergencePages |          4 |
| lowConfidencePages    |          3 |

## Selective Adjudication

- Candidate pages: 10
- Low-confidence threshold: 0.72
- High-disagreement threshold: 0.952704

## Variant Distances

| Reference              | Candidate           |   WER |   CER | Word Edits |
| ---------------------- | ------------------- | ----: | ----: | ---------: |
| `status-quo-consensus` | `page-level-hybrid` | 6.82% | 7.58% |        119 |
