# OCR Consensus Benchmark Summary

## Summary

- Run directory: `input/examples/document/ocr-categories-bc-run/benchmark-runs/bc-rerun-05-pages-the-odyssey`
- Providers with page result files: 21
- Pages: 5
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider | Pages |
| --- | ---: |
| `grok/grok-4.7` | 2 |
| `deepinfra/deepseek-ai/DeepSeek-V4.1-Flash` | 1 |
| `gemini/gemini-3.6-flash` | 1 |
| `gemini/gemini-3.8-flash` | 1 |

## Outlier Signals

| Signal | Page Count |
| --- | ---: |
| blankOutputPages | 0 |
| repeatedTextPages | 0 |
| majorLengthDriftPages | 0 |
| highDisagreementPages | 0 |
| werCerDivergencePages | 4 |
| lowConfidencePages | 0 |

## Selective Adjudication

- Candidate pages: 4
- Low-confidence threshold: 0.72
- High-disagreement threshold: 0.216907

## Variant Distances

| Reference | Candidate | WER | CER | Word Edits |
| --- | --- | ---: | ---: | ---: |
| `status-quo-consensus` | `page-level-hybrid` | 2.29% | 0.36% | 26 |
