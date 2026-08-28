# OCR Consensus Benchmark Summary

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/10-document`
- Providers with page result files: 30
- Pages: 10
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider | Pages |
| --- | ---: |
| `anthropic/claude-opus-4-8` | 3 |
| `anthropic/claude-fable-5` | 2 |
| `gemini/gemini-3.5-flash` | 2 |
| `openai/gpt-5.5` | 2 |
| `grok/grok-4.20-0309-non-reasoning` | 1 |

## Outlier Signals

| Signal | Page Count |
| --- | ---: |
| blankOutputPages | 1 |
| repeatedTextPages | 0 |
| majorLengthDriftPages | 6 |
| highDisagreementPages | 1 |
| werCerDivergencePages | 5 |
| lowConfidencePages | 1 |

## Selective Adjudication

- Candidate pages: 6
- Low-confidence threshold: 0.72
- High-disagreement threshold: 0.376698

## Variant Distances

| Reference | Candidate | WER | CER | Word Edits |
| --- | --- | ---: | ---: | ---: |
| `status-quo-consensus` | `page-level-hybrid` | 4.42% | 4.99% | 77 |
