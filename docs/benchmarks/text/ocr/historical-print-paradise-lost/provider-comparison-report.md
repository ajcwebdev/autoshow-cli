# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-bc-run/benchmark-runs/historical-print-paradise-lost`
- Publisher canonical reference: `historical-print-paradise-lost.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `33bee72da84b8d05a207b87e47a26570234d2039ca3921c454509dac534ac50b`.
- Publisher source: https://en.wikisource.org/w/index.php?title=Page%3AParadise%20Lost%20(1667).djvu%2F46&oldid=15859582&action=raw (revision `15859582`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 71.53       | 28.47% | 5.40% | 0.74s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.74s | 71.53       | 28.47% | 5.40% | 0.74s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 71.53/100 quality score | 71.53       | 28.47% | 5.40% | 0.74s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0007 | 73.56       | 26.44% | 4.11% | 3.62s           | $0.0007        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0014 | 71.86       | 28.14% | 4.68% | 21.49s          | $0.0014        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 97.97       | 2.03%  | 1.01% | 2.78s           | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0054 | 98.64       | 1.36%  | 0.14% | 104.00s         | $0.0054        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0124 | 99.66       | 0.34%  | 0.07% | 12.46s          | $0.0124        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0140 | 74.24       | 25.76% | 3.67% | 5.31s           | $0.0140        |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.0294 | 99.66       | 0.34%  | 0.07% | 10.83s          | $0.0294        |
| 8    | <code>anthropic/claude-fable-5</code>    | $0.0700 | 74.24       | 25.76% | 3.67% | 12.23s          | $0.0700        |
| 9    | <code>grok/grok-4.7</code>               | $0.2133 | 98.31       | 1.69%  | 0.43% | 93.16s          | $0.2133        |

#### Speed

| Rank | Provider                                 | Value   | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 2.78s   | 97.97       | 2.03%  | 1.01% | 2.78s           | $0.0040        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 3.62s   | 73.56       | 26.44% | 4.11% | 3.62s           | $0.0007        |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 5.31s   | 74.24       | 25.76% | 3.67% | 5.31s           | $0.0140        |
| 4    | <code>anthropic/claude-opus-5-5</code>   | 10.83s  | 99.66       | 0.34%  | 0.07% | 10.83s          | $0.0294        |
| 5    | <code>anthropic/claude-fable-5</code>    | 12.23s  | 74.24       | 25.76% | 3.67% | 12.23s          | $0.0700        |
| 6    | <code>openai/gpt-6.1-sol</code>          | 12.46s  | 99.66       | 0.34%  | 0.07% | 12.46s          | $0.0124        |
| 7    | <code>openai/gpt-6-luna</code>           | 21.49s  | 71.86       | 28.14% | 4.68% | 21.49s          | $0.0014        |
| 8    | <code>grok/grok-4.7</code>               | 93.16s  | 98.31       | 1.69%  | 0.43% | 93.16s          | $0.2133        |
| 9    | <code>gemini/gemini-3.8-flash</code>     | 104.00s | 98.64       | 1.36%  | 0.14% | 104.00s         | $0.0054        |

#### Quality Score

| Rank | Provider                                 | Value                   | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ----------------------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-opus-5-5</code>   | 99.66/100 quality score | 99.66       | 0.34%  | 0.07% | 10.83s          | $0.0294        |
| 2    | <code>openai/gpt-6.1-sol</code>          | 99.66/100 quality score | 99.66       | 0.34%  | 0.07% | 12.46s          | $0.0124        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | 98.64/100 quality score | 98.64       | 1.36%  | 0.14% | 104.00s         | $0.0054        |
| 4    | <code>grok/grok-4.7</code>               | 98.31/100 quality score | 98.31       | 1.69%  | 0.43% | 93.16s          | $0.2133        |
| 5    | <code>mistral/mistral-ocr-4-1</code>     | 97.97/100 quality score | 97.97       | 2.03%  | 1.01% | 2.78s           | $0.0040        |
| 6    | <code>anthropic/claude-fable-5</code>    | 74.24/100 quality score | 74.24       | 25.76% | 3.67% | 12.23s          | $0.0700        |
| 7    | <code>anthropic/claude-sonnet-5-5</code> | 74.24/100 quality score | 74.24       | 25.76% | 3.67% | 5.31s           | $0.0140        |
| 8    | <code>anthropic/claude-haiku-5-5</code>  | 73.56/100 quality score | 73.56       | 26.44% | 4.11% | 3.62s           | $0.0007        |
| 9    | <code>openai/gpt-6-luna</code>           | 71.86/100 quality score | 71.86       | 28.14% | 4.68% | 21.49s          | $0.0014        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | ----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 71.53       | 28.47% | 5.40% | 0.74s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 74.24       | 25.76% | 3.67% | 12.23s          | $0.0700        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 73.56       | 26.44% | 4.11% | 3.62s           | $0.0007        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 99.66       | 0.34%  | 0.07% | 10.83s          | $0.0294        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 74.24       | 25.76% | 3.67% | 5.31s           | $0.0140        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 98.64       | 1.36%  | 0.14% | 104.00s         | $0.0054        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 98.31       | 1.69%  | 0.43% | 93.16s          | $0.2133        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 97.97       | 2.03%  | 1.01% | 2.78s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 71.86       | 28.14% | 4.68% | 21.49s          | $0.0014        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 99.66       | 0.34%  | 0.07% | 12.46s          | $0.0124        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 48            | 35        | 1          | 295        |
| <code>anthropic/claude-fable-5</code>    | 44            | 32        | 0          | 295        |
| <code>anthropic/claude-haiku-5-5</code>  | 46            | 32        | 0          | 295        |
| <code>anthropic/claude-opus-5-5</code>   | 1             | 0         | 0          | 295        |
| <code>anthropic/claude-sonnet-5-5</code> | 44            | 32        | 0          | 295        |
| <code>gemini/gemini-3.8-flash</code>     | 2             | 2         | 0          | 295        |
| <code>grok/grok-4.7</code>               | 3             | 2         | 0          | 295        |
| <code>mistral/mistral-ocr-4-1</code>     | 4             | 2         | 0          | 295        |
| <code>openai/gpt-6-luna</code>           | 48            | 34        | 1          | 295        |
| <code>openai/gpt-6.1-sol</code>          | 1             | 0         | 0          | 295        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 71.53/100.
- Best cloud service: `anthropic/claude-opus-5-5` scored 99.66/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.0703¢ ($0.0007).
- Fastest local model: `tesseract/tesseract` at 0.74s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 2.78s.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- The protocol uses pinned page PNGs for every provider, including rendered baseline PDFs. Archived original runs remain separate.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental fidelity-metrics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
