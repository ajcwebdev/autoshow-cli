# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-bc-run/benchmark-runs/bc-rerun-04-pages-don-quixote`
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 96.41       | 3.59% | 1.80% | 4.65s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 4.65s | 96.41       | 3.59% | 1.80% | 4.65s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 96.41/100 quality score | 96.41       | 3.59% | 1.80% | 4.65s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0033 | 99.40       | 0.60% | 0.64% | 11.51s          | $0.0033        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0038 | 98.80       | 1.20% | 0.31% | 45.65s          | $0.0038        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0160 | 99.85       | 0.15% | 0.19% | 16.82s          | $0.0160        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0218 | 98.28       | 1.72% | 0.19% | 24.70s          | $0.0218        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0490 | 98.35       | 1.65% | 0.34% | 40.43s          | $0.0490        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0679 | 98.43       | 1.57% | 0.33% | 22.47s          | $0.0679        |
| 7    | <code>grok/grok-4.7</code>               | $0.0836 | 99.70       | 0.30% | 0.38% | 92.73s          | $0.0836        |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.1321 | 99.78       | 0.22% | 0.18% | 24.12s          | $0.1321        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.3453 | 98.35       | 1.65% | 0.34% | 47.45s          | $0.3453        |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | 11.51s | 99.40       | 0.60% | 0.64% | 11.51s          | $0.0033        |
| 2    | <code>mistral/mistral-ocr-4-1</code>     | 16.82s | 99.85       | 0.15% | 0.19% | 16.82s          | $0.0160        |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 22.47s | 98.43       | 1.57% | 0.33% | 22.47s          | $0.0679        |
| 4    | <code>anthropic/claude-opus-5-5</code>   | 24.12s | 99.78       | 0.22% | 0.18% | 24.12s          | $0.1321        |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 24.70s | 98.28       | 1.72% | 0.19% | 24.70s          | $0.0218        |
| 6    | <code>openai/gpt-6.1-sol</code>          | 40.43s | 98.35       | 1.65% | 0.34% | 40.43s          | $0.0490        |
| 7    | <code>openai/gpt-6-luna</code>           | 45.65s | 98.80       | 1.20% | 0.31% | 45.65s          | $0.0038        |
| 8    | <code>anthropic/claude-fable-5</code>    | 47.45s | 98.35       | 1.65% | 0.34% | 47.45s          | $0.3453        |
| 9    | <code>grok/grok-4.7</code>               | 92.73s | 99.70       | 0.30% | 0.38% | 92.73s          | $0.0836        |

#### Quality Score

| Rank | Provider                                 | Value                   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 99.85/100 quality score | 99.85       | 0.15% | 0.19% | 16.82s          | $0.0160        |
| 2    | <code>anthropic/claude-opus-5-5</code>   | 99.78/100 quality score | 99.78       | 0.22% | 0.18% | 24.12s          | $0.1321        |
| 3    | <code>grok/grok-4.7</code>               | 99.70/100 quality score | 99.70       | 0.30% | 0.38% | 92.73s          | $0.0836        |
| 4    | <code>anthropic/claude-haiku-5-5</code>  | 99.40/100 quality score | 99.40       | 0.60% | 0.64% | 11.51s          | $0.0033        |
| 5    | <code>openai/gpt-6-luna</code>           | 98.80/100 quality score | 98.80       | 1.20% | 0.31% | 45.65s          | $0.0038        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | 98.43/100 quality score | 98.43       | 1.57% | 0.33% | 22.47s          | $0.0679        |
| 7    | <code>anthropic/claude-fable-5</code>    | 98.35/100 quality score | 98.35       | 1.65% | 0.34% | 47.45s          | $0.3453        |
| 8    | <code>openai/gpt-6.1-sol</code>          | 98.35/100 quality score | 98.35       | 1.65% | 0.34% | 40.43s          | $0.0490        |
| 9    | <code>gemini/gemini-3.8-flash</code>     | 98.28/100 quality score | 98.28       | 1.72% | 0.19% | 24.70s          | $0.0218        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | ----: | ----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 96.41       | 3.59% | 1.80% | 4.65s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 98.35       | 1.65% | 0.34% | 47.45s          | $0.3453        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 99.40       | 0.60% | 0.64% | 11.51s          | $0.0033        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 99.78       | 0.22% | 0.18% | 24.12s          | $0.1321        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 98.43       | 1.57% | 0.33% | 22.47s          | $0.0679        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 98.28       | 1.72% | 0.19% | 24.70s          | $0.0218        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 99.70       | 0.30% | 0.38% | 92.73s          | $0.0836        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 99.85       | 0.15% | 0.19% | 16.82s          | $0.0160        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 98.80       | 1.20% | 0.31% | 45.65s          | $0.0038        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 98.35       | 1.65% | 0.34% | 40.43s          | $0.0490        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 17            | 13        | 18         | 1337       |
| <code>anthropic/claude-fable-5</code>    | 10            | 2         | 10         | 1337       |
| <code>anthropic/claude-haiku-5-5</code>  | 0             | 8         | 0          | 1337       |
| <code>anthropic/claude-opus-5-5</code>   | 2             | 1         | 0          | 1337       |
| <code>anthropic/claude-sonnet-5-5</code> | 11            | 1         | 9          | 1337       |
| <code>gemini/gemini-3.8-flash</code>     | 12            | 0         | 11         | 1337       |
| <code>grok/grok-4.7</code>               | 0             | 4         | 0          | 1337       |
| <code>mistral/mistral-ocr-4-1</code>     | 0             | 2         | 0          | 1337       |
| <code>openai/gpt-6-luna</code>           | 8             | 2         | 6          | 1337       |
| <code>openai/gpt-6.1-sol</code>          | 10            | 2         | 10         | 1337       |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 96.41/100.
- Best cloud service: `mistral/mistral-ocr-4-1` scored 99.85/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.3284¢ ($0.0033).
- Fastest local model: `tesseract/tesseract` at 4.65s.
- Fastest cloud service: `anthropic/claude-haiku-5-5` at 11.51s.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: the existing archived multi-provider consensus is reused byte for byte; it is not independent publisher gold.
- The protocol uses pinned page PNGs for every provider, including rendered baseline PDFs. Archived original runs remain separate.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental fidelity-metrics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
