# OCR Consensus Benchmark Summary

## Summary

- Run directory: `docs/benchmarks/ocr/05-pages-the-odyssey`
- Providers with page result files: 23
- Pages: 5
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider | Pages |
| --- | ---: |
| `gemini/gemini-3.5-flash` | 2 |
| `deepinfra/deepseek-ai/DeepSeek-V4.1-Flash` | 1 |
| `kimi/kimi-k2.6` | 1 |
| `kimi/kimi-k3` | 1 |

## Outlier Signals

| Signal | Page Count |
| --- | ---: |
| blankOutputPages | 0 |
| repeatedTextPages | 0 |
| majorLengthDriftPages | 0 |
| highDisagreementPages | 0 |
| werCerDivergencePages | 5 |
| lowConfidencePages | 0 |

## Selective Adjudication

- Candidate pages: 5
- Low-confidence threshold: 0.72
- High-disagreement threshold: 0.18

## Variant Distances

| Reference | Candidate | WER | CER | Word Edits |
| --- | --- | ---: | ---: | ---: |
| `status-quo-consensus` | `page-level-hybrid` | 2.55% | 0.48% | 29 |
