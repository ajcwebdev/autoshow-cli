# OCR Consensus Benchmark Summary

## Summary

- Run directory: `docs/benchmarks/ocr/10-document`
- Providers with page result files: 23
- Pages: 10
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider | Pages |
| --- | ---: |
| `anthropic/claude-fable-5` | 2 |
| `gemini/gemini-3.5-flash` | 2 |
| `gemini/gemini-3.7-flash` | 2 |
| `anthropic/claude-fable-5-1` | 1 |
| `deepinfra/google/gemma-4-31B-it` | 1 |
| `gemini/gemini-3.8-flash` | 1 |
| `openai/gpt-5.6-terra` | 1 |

## Outlier Signals

| Signal | Page Count |
| --- | ---: |
| blankOutputPages | 0 |
| repeatedTextPages | 0 |
| majorLengthDriftPages | 1 |
| highDisagreementPages | 1 |
| werCerDivergencePages | 0 |
| lowConfidencePages | 1 |

## Selective Adjudication

- Candidate pages: 1
- Low-confidence threshold: 0.72
- High-disagreement threshold: 0.18

## Variant Distances

| Reference | Candidate | WER | CER | Word Edits |
| --- | --- | ---: | ---: | ---: |
| `status-quo-consensus` | `page-level-hybrid` | 0.00% | 0.00% | 0 |
