# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-bc-run/benchmark-runs/historical-print-frankenstein`
- Publisher canonical reference: `historical-print-frankenstein.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `95b0ff13f85c39104500f7ece603aab33dce93a0dba30fb3e5acf6140912d43d`.
- Publisher source: https://en.wikisource.org/w/index.php?title=Page%3AFrankenstein%2C%20or%20the%20Modern%20Prometheus%20(Revised%20Edition%2C%201831).djvu%2F11&oldid=8864833&action=raw (revision `8864833`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 97.88       | 2.12% | 0.31% | 0.96s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.96s | 97.88       | 2.12% | 0.31% | 0.96s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 97.88/100 quality score | 97.88       | 2.12% | 0.31% | 0.96s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0007 | 99.15       | 0.85% | 0.16% | 2.83s           | $0.0007        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0008 | 99.15       | 0.85% | 0.16% | 11.44s          | $0.0008        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 99.15       | 0.85% | 0.16% | 3.14s           | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0045 | 98.31       | 1.69% | 0.23% | 7.27s           | $0.0045        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0106 | 98.31       | 1.69% | 0.23% | 6.38s           | $0.0106        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0136 | 99.15       | 0.85% | 0.16% | 4.10s           | $0.0136        |
| 7    | <code>grok/grok-4.7</code>               | $0.0192 | 99.15       | 0.85% | 0.16% | 19.60s          | $0.0192        |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.0273 | 99.15       | 0.85% | 0.16% | 4.41s           | $0.0273        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0681 | 99.15       | 0.85% | 0.16% | 8.49s           | $0.0681        |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | 2.83s  | 99.15       | 0.85% | 0.16% | 2.83s           | $0.0007        |
| 2    | <code>mistral/mistral-ocr-4-1</code>     | 3.14s  | 99.15       | 0.85% | 0.16% | 3.14s           | $0.0040        |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 4.10s  | 99.15       | 0.85% | 0.16% | 4.10s           | $0.0136        |
| 4    | <code>anthropic/claude-opus-5-5</code>   | 4.41s  | 99.15       | 0.85% | 0.16% | 4.41s           | $0.0273        |
| 5    | <code>openai/gpt-6.1-sol</code>          | 6.38s  | 98.31       | 1.69% | 0.23% | 6.38s           | $0.0106        |
| 6    | <code>gemini/gemini-3.8-flash</code>     | 7.27s  | 98.31       | 1.69% | 0.23% | 7.27s           | $0.0045        |
| 7    | <code>anthropic/claude-fable-5</code>    | 8.49s  | 99.15       | 0.85% | 0.16% | 8.49s           | $0.0681        |
| 8    | <code>openai/gpt-6-luna</code>           | 11.44s | 99.15       | 0.85% | 0.16% | 11.44s          | $0.0008        |
| 9    | <code>grok/grok-4.7</code>               | 19.60s | 99.15       | 0.85% | 0.16% | 19.60s          | $0.0192        |

#### Quality Score

| Rank | Provider                                 | Value                   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-fable-5</code>    | 99.15/100 quality score | 99.15       | 0.85% | 0.16% | 8.49s           | $0.0681        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 99.15/100 quality score | 99.15       | 0.85% | 0.16% | 2.83s           | $0.0007        |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 99.15/100 quality score | 99.15       | 0.85% | 0.16% | 4.41s           | $0.0273        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 99.15/100 quality score | 99.15       | 0.85% | 0.16% | 4.10s           | $0.0136        |
| 5    | <code>grok/grok-4.7</code>               | 99.15/100 quality score | 99.15       | 0.85% | 0.16% | 19.60s          | $0.0192        |
| 6    | <code>mistral/mistral-ocr-4-1</code>     | 99.15/100 quality score | 99.15       | 0.85% | 0.16% | 3.14s           | $0.0040        |
| 7    | <code>openai/gpt-6-luna</code>           | 99.15/100 quality score | 99.15       | 0.85% | 0.16% | 11.44s          | $0.0008        |
| 8    | <code>gemini/gemini-3.8-flash</code>     | 98.31/100 quality score | 98.31       | 1.69% | 0.23% | 7.27s           | $0.0045        |
| 9    | <code>openai/gpt-6.1-sol</code>          | 98.31/100 quality score | 98.31       | 1.69% | 0.23% | 6.38s           | $0.0106        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | ----: | ----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 97.88       | 2.12% | 0.31% | 0.96s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 99.15       | 0.85% | 0.16% | 8.49s           | $0.0681        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 99.15       | 0.85% | 0.16% | 2.83s           | $0.0007        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 99.15       | 0.85% | 0.16% | 4.41s           | $0.0273        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 99.15       | 0.85% | 0.16% | 4.10s           | $0.0136        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 98.31       | 1.69% | 0.23% | 7.27s           | $0.0045        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 99.15       | 0.85% | 0.16% | 19.60s          | $0.0192        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 99.15       | 0.85% | 0.16% | 3.14s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 99.15       | 0.85% | 0.16% | 11.44s          | $0.0008        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 98.31       | 1.69% | 0.23% | 6.38s           | $0.0106        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 3             | 1         | 1          | 236        |
| <code>anthropic/claude-fable-5</code>    | 1             | 1         | 0          | 236        |
| <code>anthropic/claude-haiku-5-5</code>  | 1             | 1         | 0          | 236        |
| <code>anthropic/claude-opus-5-5</code>   | 1             | 1         | 0          | 236        |
| <code>anthropic/claude-sonnet-5-5</code> | 1             | 1         | 0          | 236        |
| <code>gemini/gemini-3.8-flash</code>     | 2             | 1         | 1          | 236        |
| <code>grok/grok-4.7</code>               | 1             | 1         | 0          | 236        |
| <code>mistral/mistral-ocr-4-1</code>     | 1             | 1         | 0          | 236        |
| <code>openai/gpt-6-luna</code>           | 1             | 1         | 0          | 236        |
| <code>openai/gpt-6.1-sol</code>          | 2             | 1         | 1          | 236        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 97.88/100.
- Best cloud service: `anthropic/claude-fable-5` scored 99.15/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.0712¢ ($0.0007).
- Fastest local model: `tesseract/tesseract` at 0.96s.
- Fastest cloud service: `anthropic/claude-haiku-5-5` at 2.83s.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- The protocol uses pinned page PNGs for every provider, including rendered baseline PDFs. Archived original runs remain separate.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental fidelity-metrics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
