# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-bc-run/benchmark-runs/historical-print-origin-of-species`
- Publisher canonical reference: `historical-print-origin-of-species.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `2affdf333a4b3e7317f63ca55e910926c8bb672ec40bef41194c9dc44958edeb`.
- Publisher source: https://en.wikisource.org/w/index.php?title=Page%3AOrigin%20of%20Species%201859%20facsimile.djvu%2F13&oldid=7963369&action=raw (revision `7963369`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 96.03       | 3.97% | 0.32% | 1.03s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 1.03s | 96.03       | 3.97% | 0.32% | 1.03s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 96.03/100 quality score | 96.03       | 3.97% | 0.32% | 1.03s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0007 | 96.03       | 3.97% | 0.32% | 3.31s           | $0.0007        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0008 | 100.00      | 0.00% | 0.00% | 7.97s           | $0.0008        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 100.00      | 0.00% | 0.00% | 1.75s           | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0051 | 96.03       | 3.97% | 0.32% | 5.19s           | $0.0051        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0114 | 96.03       | 3.97% | 0.32% | 7.99s           | $0.0114        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0143 | 96.03       | 3.97% | 0.32% | 6.65s           | $0.0143        |
| 7    | <code>grok/grok-4.7</code>               | $0.0186 | 100.00      | 0.00% | 0.00% | 19.23s          | $0.0186        |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.0267 | 100.00      | 0.00% | 0.00% | 9.38s           | $0.0267        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0709 | 96.03       | 3.97% | 0.32% | 10.96s          | $0.0709        |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 1.75s  | 100.00      | 0.00% | 0.00% | 1.75s           | $0.0040        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 3.31s  | 96.03       | 3.97% | 0.32% | 3.31s           | $0.0007        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | 5.19s  | 96.03       | 3.97% | 0.32% | 5.19s           | $0.0051        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 6.65s  | 96.03       | 3.97% | 0.32% | 6.65s           | $0.0143        |
| 5    | <code>openai/gpt-6-luna</code>           | 7.97s  | 100.00      | 0.00% | 0.00% | 7.97s           | $0.0008        |
| 6    | <code>openai/gpt-6.1-sol</code>          | 7.99s  | 96.03       | 3.97% | 0.32% | 7.99s           | $0.0114        |
| 7    | <code>anthropic/claude-opus-5-5</code>   | 9.38s  | 100.00      | 0.00% | 0.00% | 9.38s           | $0.0267        |
| 8    | <code>anthropic/claude-fable-5</code>    | 10.96s | 96.03       | 3.97% | 0.32% | 10.96s          | $0.0709        |
| 9    | <code>grok/grok-4.7</code>               | 19.23s | 100.00      | 0.00% | 0.00% | 19.23s          | $0.0186        |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-opus-5-5</code>   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 9.38s           | $0.0267        |
| 2    | <code>grok/grok-4.7</code>               | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 19.23s          | $0.0186        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 1.75s           | $0.0040        |
| 4    | <code>openai/gpt-6-luna</code>           | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 7.97s           | $0.0008        |
| 5    | <code>anthropic/claude-fable-5</code>    | 96.03/100 quality score  | 96.03       | 3.97% | 0.32% | 10.96s          | $0.0709        |
| 6    | <code>anthropic/claude-haiku-5-5</code>  | 96.03/100 quality score  | 96.03       | 3.97% | 0.32% | 3.31s           | $0.0007        |
| 7    | <code>anthropic/claude-sonnet-5-5</code> | 96.03/100 quality score  | 96.03       | 3.97% | 0.32% | 6.65s           | $0.0143        |
| 8    | <code>gemini/gemini-3.8-flash</code>     | 96.03/100 quality score  | 96.03       | 3.97% | 0.32% | 5.19s           | $0.0051        |
| 9    | <code>openai/gpt-6.1-sol</code>          | 96.03/100 quality score  | 96.03       | 3.97% | 0.32% | 7.99s           | $0.0114        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | ----: | ----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 96.03       | 3.97% | 0.32% | 1.03s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 96.03       | 3.97% | 0.32% | 10.96s          | $0.0709        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 96.03       | 3.97% | 0.32% | 3.31s           | $0.0007        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 100.00      | 0.00% | 0.00% | 9.38s           | $0.0267        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 96.03       | 3.97% | 0.32% | 6.65s           | $0.0143        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 96.03       | 3.97% | 0.32% | 5.19s           | $0.0051        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 100.00      | 0.00% | 0.00% | 19.23s          | $0.0186        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 100.00      | 0.00% | 0.00% | 1.75s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 100.00      | 0.00% | 0.00% | 7.97s           | $0.0008        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 96.03       | 3.97% | 0.32% | 7.99s           | $0.0114        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 6             | 0         | 6          | 302        |
| <code>anthropic/claude-fable-5</code>    | 6             | 0         | 6          | 302        |
| <code>anthropic/claude-haiku-5-5</code>  | 6             | 0         | 6          | 302        |
| <code>anthropic/claude-opus-5-5</code>   | 0             | 0         | 0          | 302        |
| <code>anthropic/claude-sonnet-5-5</code> | 6             | 0         | 6          | 302        |
| <code>gemini/gemini-3.8-flash</code>     | 6             | 0         | 6          | 302        |
| <code>grok/grok-4.7</code>               | 0             | 0         | 0          | 302        |
| <code>mistral/mistral-ocr-4-1</code>     | 0             | 0         | 0          | 302        |
| <code>openai/gpt-6-luna</code>           | 0             | 0         | 0          | 302        |
| <code>openai/gpt-6.1-sol</code>          | 6             | 0         | 6          | 302        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 96.03/100.
- Best cloud service: `anthropic/claude-opus-5-5` scored 100.00/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.0708¢ ($0.0007).
- Fastest local model: `tesseract/tesseract` at 1.03s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 1.75s.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- The protocol uses pinned page PNGs for every provider, including rendered baseline PDFs. Archived original runs remain separate.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental fidelity-metrics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
