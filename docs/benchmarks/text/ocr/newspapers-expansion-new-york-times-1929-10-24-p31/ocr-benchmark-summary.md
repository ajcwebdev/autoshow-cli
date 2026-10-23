> Evaluation scope: lexical recognition against the declared page/crop reference and its reading-order convention. Table structure, branch association and page geometry are unavailable from text-only outputs. Fidelity diagnostics are separate representation comparisons.

# OCR Canonical Reference Benchmark Summary

## Summary

- Run directory: `input/examples/document/ocr-newspaper-expansion/benchmark-runs/newspapers-expansion-new-york-times-1929-10-24-p31`
- Providers with page result files: 8
- Pages: 1
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- The publisher canonical reference is immutable; provider agreement diagnostics guide output review only.

## Page-Level Hybrid Sources

| Selected Provider             | Pages |
| ----------------------------- | ----: |
| `anthropic/claude-sonnet-5-5` | 1     |

## Outlier Signals

| Signal                | Page Count |
| --------------------- | ---------: |
| blankOutputPages      | 0          |
| repeatedTextPages     | 1          |
| majorLengthDriftPages | 1          |
| highDisagreementPages | 1          |
| werCerDivergencePages | 1          |
| lowConfidencePages    | 1          |

## Selective Adjudication

- Candidate pages: 1
- Low-confidence threshold: 0.72
- High-disagreement threshold: 3.578515

## Variant Distances

| Reference             | Candidate           | WER    | CER    | Word Edits |
| --------------------- | ------------------- | -----: | -----: | ---------: |
| `publisher-canonical` | `page-level-hybrid` | 95.18% | 97.98% | 7026       |
