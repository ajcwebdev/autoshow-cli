> Evaluation scope: lexical recognition against the declared page/crop reference and its reading-order convention. Table structure, branch association and page geometry are unavailable from text-only outputs. Fidelity diagnostics are separate representation comparisons.

# OCR Canonical Reference Benchmark Summary

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/numeric-tables-synthetic-financial`
- Providers with page result files: 21
- Pages: 1
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- The publisher canonical reference is immutable; provider agreement diagnostics guide output review only.

## Page-Level Hybrid Sources

| Selected Provider | Pages |
| --- | ---: |
| `gemini/gemini-3.8-flash` | 1 |

## Outlier Signals

| Signal | Page Count |
| --- | ---: |
| blankOutputPages | 1 |
| repeatedTextPages | 0 |
| majorLengthDriftPages | 1 |
| highDisagreementPages | 0 |
| werCerDivergencePages | 0 |
| lowConfidencePages | 0 |

## Selective Adjudication

- Candidate pages: 1
- Low-confidence threshold: 0.72
- High-disagreement threshold: 0.18

## Variant Distances

| Reference | Candidate | WER | CER | Word Edits |
| --- | --- | ---: | ---: | ---: |
| `publisher-canonical` | `page-level-hybrid` | 0.00% | 0.00% | 0 |
