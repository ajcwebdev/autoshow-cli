# OCR Consensus Benchmark Summary

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/05-pages-the-odyssey`
- Providers with page result files: 27
- Pages: 5
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider | Pages |
| --- | ---: |
| `gemini/gemini-3.5-flash-lite` | 1 |
| `gemini/gemini-3.6-flash` | 1 |
| `grok/grok-4.20-0309-non-reasoning` | 1 |
| `grok/grok-4.3` | 1 |
| `mistral/mistral-ocr-4-0` | 1 |

## Outlier Signals

| Signal | Page Count |
| --- | ---: |
| blankOutputPages | 4 |
| repeatedTextPages | 0 |
| majorLengthDriftPages | 5 |
| highDisagreementPages | 0 |
| werCerDivergencePages | 5 |
| lowConfidencePages | 0 |

## Selective Adjudication

- Candidate pages: 5
- Low-confidence threshold: 0.72
- High-disagreement threshold: 0.243287

## Variant Distances

| Reference | Candidate | WER | CER | Word Edits |
| --- | --- | ---: | ---: | ---: |
| `status-quo-consensus` | `page-level-hybrid` | 6.87% | 1.41% | 78 |
