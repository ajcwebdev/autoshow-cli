# OCR Consensus Benchmark Summary

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-05-21_06-13-18-792_document`
- Providers: 7
- Pages: 10
- Paid provider reruns: not run by this skill artifact; existing provider outputs only.
- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.

## Page-Level Hybrid Sources

| Selected Provider | Pages |
| --- | ---: |
| `anthropic/claude-opus-4-8` | 4 |
| `gemini/gemini-3.5-flash` | 3 |
| `anthropic/claude-sonnet-5` | 1 |
| `mistral/mistral-ocr-4-0` | 1 |
| `openai/gpt-5.4-mini` | 1 |

## Outlier Signals

| Signal | Page Count |
| --- | ---: |
| blankOutputPages | 0 |
| repeatedTextPages | 0 |
| majorLengthDriftPages | 6 |
| highDisagreementPages | 1 |
| werCerDivergencePages | 10 |
| lowConfidencePages | 7 |

## Selective Adjudication

- Candidate pages: 10
- Low-confidence threshold: 0.72
- High-disagreement threshold: 1.19607

## Variant Distances

| Reference | Candidate | WER | CER | Word Edits |
| --- | --- | ---: | ---: | ---: |
| `status-quo-consensus` | `page-level-hybrid` | 16.46% | 16.38% | 287 |
