# OCR Consensus Benchmark Summary

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-05-21_06-03-14-635_document`
- Providers with page result files: 7
- Pages: 10
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider | Pages |
| --- | ---: |
| `anthropic/claude-opus-4-8` | 3 |
| `openai/gpt-5.4-mini` | 3 |
| `anthropic/claude-haiku-4-5` | 1 |
| `anthropic/claude-sonnet-5` | 1 |
| `gemini/gemini-3.5-flash` | 1 |
| `grok/grok-4.20-0309-non-reasoning` | 1 |

## Outlier Signals

| Signal | Page Count |
| --- | ---: |
| blankOutputPages | 1 |
| repeatedTextPages | 0 |
| majorLengthDriftPages | 8 |
| highDisagreementPages | 1 |
| werCerDivergencePages | 9 |
| lowConfidencePages | 8 |

## Selective Adjudication

- Candidate pages: 10
- Low-confidence threshold: 0.72
- High-disagreement threshold: 1.506595

## Variant Distances

| Reference | Candidate | WER | CER | Word Edits |
| --- | --- | ---: | ---: | ---: |
| `status-quo-consensus` | `page-level-hybrid` | 37.12% | 61.23% | 487 |
