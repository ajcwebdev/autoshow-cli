> Evaluation scope: lexical recognition against the declared page/crop reference and its reading-order convention. Table structure, branch association and page geometry are unavailable from text-only outputs. Fidelity diagnostics are separate representation comparisons.

# OCR Consensus Benchmark Summary

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/efg-rerun-1-page-newspaper`
- Providers with page result files: 20
- Pages: 1
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider | Pages |
| --- | ---: |
| `anthropic/claude-opus-5-5` | 1 |

## Outlier Signals

| Signal | Page Count |
| --- | ---: |
| blankOutputPages | 0 |
| repeatedTextPages | 0 |
| majorLengthDriftPages | 1 |
| highDisagreementPages | 1 |
| werCerDivergencePages | 0 |
| lowConfidencePages | 0 |

## Selective Adjudication

- Candidate pages: 1
- Low-confidence threshold: 0.72
- High-disagreement threshold: 0.347251

## Variant Distances

| Reference | Candidate | WER | CER | Word Edits |
| --- | --- | ---: | ---: | ---: |
| `status-quo-consensus` | `page-level-hybrid` | 0.80% | 0.16% | 19 |
