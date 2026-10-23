# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-bc-run/benchmark-runs/bc-rerun-10-document`
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
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 90.08       | 9.92% | 8.87% | 9.08s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 9.08s | 90.08       | 9.92% | 8.87% | 9.08s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 90.08/100 quality score | 90.08       | 9.92% | 8.87% | 9.08s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>openai/gpt-6-luna</code>           | $0.0066 | 100.00      | 0.00% | 0.00% | 63.59s          | $0.0066        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | $0.0086 | 99.89       | 0.11% | 0.02% | 32.67s          | $0.0086        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0400 | 99.71       | 0.29% | 0.27% | 28.15s          | $0.0400        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0521 | 100.00      | 0.00% | 0.00% | 68.20s          | $0.0521        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.1089 | 100.00      | 0.00% | 0.00% | 72.70s          | $0.1089        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.1727 | 100.00      | 0.00% | 0.00% | 59.49s          | $0.1727        |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.3452 | 100.00      | 0.00% | 0.00% | 65.76s          | $0.3452        |
| 8    | <code>grok/grok-4.7</code>               | $0.5021 | 100.00      | 0.00% | 0.00% | 111.21s         | $0.5021        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.8622 | 99.83       | 0.17% | 0.02% | 86.15s          | $0.8622        |

#### Speed

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 28.15s  | 99.71       | 0.29% | 0.27% | 28.15s          | $0.0400        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 32.67s  | 99.89       | 0.11% | 0.02% | 32.67s          | $0.0086        |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 59.49s  | 100.00      | 0.00% | 0.00% | 59.49s          | $0.1727        |
| 4    | <code>openai/gpt-6-luna</code>           | 63.59s  | 100.00      | 0.00% | 0.00% | 63.59s          | $0.0066        |
| 5    | <code>anthropic/claude-opus-5-5</code>   | 65.76s  | 100.00      | 0.00% | 0.00% | 65.76s          | $0.3452        |
| 6    | <code>gemini/gemini-3.8-flash</code>     | 68.20s  | 100.00      | 0.00% | 0.00% | 68.20s          | $0.0521        |
| 7    | <code>openai/gpt-6.1-sol</code>          | 72.70s  | 100.00      | 0.00% | 0.00% | 72.70s          | $0.1089        |
| 8    | <code>anthropic/claude-fable-5</code>    | 86.15s  | 99.83       | 0.17% | 0.02% | 86.15s          | $0.8622        |
| 9    | <code>grok/grok-4.7</code>               | 111.21s | 100.00      | 0.00% | 0.00% | 111.21s         | $0.5021        |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-opus-5-5</code>   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 65.76s          | $0.3452        |
| 2    | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 59.49s          | $0.1727        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 68.20s          | $0.0521        |
| 4    | <code>grok/grok-4.7</code>               | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 111.21s         | $0.5021        |
| 5    | <code>openai/gpt-6-luna</code>           | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 63.59s          | $0.0066        |
| 6    | <code>openai/gpt-6.1-sol</code>          | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 72.70s          | $0.1089        |
| 7    | <code>anthropic/claude-haiku-5-5</code>  | 99.89/100 quality score  | 99.89       | 0.11% | 0.02% | 32.67s          | $0.0086        |
| 8    | <code>anthropic/claude-fable-5</code>    | 99.83/100 quality score  | 99.83       | 0.17% | 0.02% | 86.15s          | $0.8622        |
| 9    | <code>mistral/mistral-ocr-4-1</code>     | 99.71/100 quality score  | 99.71       | 0.29% | 0.27% | 28.15s          | $0.0400        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | ----: | ----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 90.08       | 9.92% | 8.87% | 9.08s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 99.83       | 0.17% | 0.02% | 86.15s          | $0.8622        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 99.89       | 0.11% | 0.02% | 32.67s          | $0.0086        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 100.00      | 0.00% | 0.00% | 65.76s          | $0.3452        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00      | 0.00% | 0.00% | 59.49s          | $0.1727        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 100.00      | 0.00% | 0.00% | 68.20s          | $0.0521        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 100.00      | 0.00% | 0.00% | 111.21s         | $0.5021        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 99.71       | 0.29% | 0.27% | 28.15s          | $0.0400        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 100.00      | 0.00% | 0.00% | 63.59s          | $0.0066        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 100.00      | 0.00% | 0.00% | 72.70s          | $0.1089        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 102           | 43        | 28         | 1744       |
| <code>anthropic/claude-fable-5</code>    | 3             | 0         | 0          | 1744       |
| <code>anthropic/claude-haiku-5-5</code>  | 2             | 0         | 0          | 1744       |
| <code>anthropic/claude-opus-5-5</code>   | 0             | 0         | 0          | 1744       |
| <code>anthropic/claude-sonnet-5-5</code> | 0             | 0         | 0          | 1744       |
| <code>gemini/gemini-3.8-flash</code>     | 0             | 0         | 0          | 1744       |
| <code>grok/grok-4.7</code>               | 0             | 0         | 0          | 1744       |
| <code>mistral/mistral-ocr-4-1</code>     | 0             | 0         | 5          | 1744       |
| <code>openai/gpt-6-luna</code>           | 0             | 0         | 0          | 1744       |
| <code>openai/gpt-6.1-sol</code>          | 0             | 0         | 0          | 1744       |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 90.08/100.
- Best cloud service: `anthropic/claude-opus-5-5` scored 100.00/100.
- The cheapest cloud provider was `openai/gpt-6-luna` at 0.6622¢ ($0.0066).
- Fastest local model: `tesseract/tesseract` at 9.08s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 28.15s.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: the existing archived multi-provider consensus is reused byte for byte; it is not independent publisher gold.
- The protocol uses pinned page PNGs for every provider, including rendered baseline PDFs. Archived original runs remain separate.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental fidelity-metrics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
