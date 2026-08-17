# OCR Consensus Benchmark Summary

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-06-14_01-28-15-914_document`
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
| repeatedTextPages     |          1 |
| majorLengthDriftPages |          1 |
| highDisagreementPages |          1 |
| werCerDivergencePages |          1 |
| lowConfidencePages    |          1 |

## Selective Adjudication

- Candidate pages: 1
- Low-confidence threshold: 0.72
- High-disagreement threshold: 0.444484

## Variant Distances

| Reference              | Candidate           |   WER |   CER | Word Edits |
| ---------------------- | ------------------- | ----: | ----: | ---------: |
| `status-quo-consensus` | `page-level-hybrid` | 0.00% | 0.00% |          0 |
