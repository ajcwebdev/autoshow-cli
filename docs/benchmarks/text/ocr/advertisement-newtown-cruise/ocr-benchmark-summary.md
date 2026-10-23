> Evaluation scope: Primary word-region recognition/localization accuracy is unavailable: outputs contain text without coordinates, and the publisher annotations are not an exhaustive full-image transcription. Text presence can match incidental duplicates outside annotated regions.

# OCR Canonical Reference Benchmark Summary

## Summary

- Run directory: `input/examples/document/ocr-category-d-run/benchmark-runs/advertisement-newtown-cruise`
- Providers with page result files: 10
- Pages: 1
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- The publisher canonical reference is immutable; provider agreement diagnostics guide output review only.

## Page-Level Hybrid Sources

| Selected Provider           | Pages |
| --------------------------- | ----: |
| `anthropic/claude-opus-5-5` | 1     |

## Outlier Signals

| Signal                | Page Count |
| --------------------- | ---------: |
| blankOutputPages      | 0          |
| repeatedTextPages     | 0          |
| majorLengthDriftPages | 0          |
| highDisagreementPages | 1          |
| werCerDivergencePages | 0          |
| lowConfidencePages    | 0          |

## Selective Adjudication

- Candidate pages: 1
- Low-confidence threshold: 0.72
- High-disagreement threshold: 0.224499

## Variant Distances

| Reference             | Candidate           | WER    | CER    | Word Edits |
| --------------------- | ------------------- | -----: | -----: | ---------: |
| `publisher-canonical` | `page-level-hybrid` | 19.44% | 20.00% | 14         |


Annotated-token coverage and ordered-reference comparisons are diagnostics only; they do not establish localized or exhaustive full-image accuracy.
