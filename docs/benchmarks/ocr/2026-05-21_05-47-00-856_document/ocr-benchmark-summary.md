# OCR Consensus Benchmark Summary

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-05-21_05-47-00-856_document`
- Providers with page result files: 8
- Pages: 4
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider                                         | Pages |
| --------------------------------------------------------- | ----: |
| `deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct`     |     3 |
| `deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506` |     1 |

## Outlier Signals

| Signal                | Page Count |
| --------------------- | ---------: |
| blankOutputPages      |          3 |
| repeatedTextPages     |          0 |
| majorLengthDriftPages |          4 |
| highDisagreementPages |          1 |
| werCerDivergencePages |          0 |
| lowConfidencePages    |          1 |

## Selective Adjudication

- Candidate pages: 4
- Low-confidence threshold: 0.72
- High-disagreement threshold: 0.629265

## Variant Distances

| Reference              | Candidate           |   WER |   CER | Word Edits |
| ---------------------- | ------------------- | ----: | ----: | ---------: |
| `status-quo-consensus` | `page-level-hybrid` | 0.90% | 0.83% |         12 |
