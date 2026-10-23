# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-bc-run/benchmark-runs/historical-print-birds`
- Publisher canonical reference: `historical-print-birds.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `f6f4f04cb5c938ea7930c00813c6fc6837f4e1fbfc3ae41d23c1ff27795e0f25`.
- Publisher source: https://raw.githubusercontent.com/impactcentre/groundtruth-bhl/9eb0fc75166bfaaec24c8523ccb69da48f6cf13f/birdsofgreatbrit02butl_XML/pc-00667895.xml (revision `9eb0fc75166bfaaec24c8523ccb69da48f6cf13f`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 93.08       | 6.92% | 1.59% | 0.82s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.82s | 93.08       | 6.92% | 1.59% | 0.82s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 93.08/100 quality score | 93.08       | 6.92% | 1.59% | 0.82s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>openai/gpt-6-luna</code>           | $0.0007 | 100.00      | 0.00% | 0.00% | 7.46s           | $0.0007        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | $0.0008 | 100.00      | 0.00% | 0.00% | 2.63s           | $0.0008        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 100.00      | 0.00% | 0.00% | 2.38s           | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0040 | 100.00      | 0.00% | 0.00% | 6.62s           | $0.0040        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0101 | 100.00      | 0.00% | 0.00% | 6.75s           | $0.0101        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0154 | 100.00      | 0.00% | 0.00% | 6.53s           | $0.0154        |
| 7    | <code>grok/grok-4.7</code>               | $0.0166 | 100.00      | 0.00% | 0.00% | 16.59s          | $0.0166        |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.0309 | 100.00      | 0.00% | 0.00% | 4.99s           | $0.0309        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0771 | 100.00      | 0.00% | 0.00% | 8.03s           | $0.0771        |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 2.38s  | 100.00      | 0.00% | 0.00% | 2.38s           | $0.0040        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 2.63s  | 100.00      | 0.00% | 0.00% | 2.63s           | $0.0008        |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 4.99s  | 100.00      | 0.00% | 0.00% | 4.99s           | $0.0309        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 6.53s  | 100.00      | 0.00% | 0.00% | 6.53s           | $0.0154        |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 6.62s  | 100.00      | 0.00% | 0.00% | 6.62s           | $0.0040        |
| 6    | <code>openai/gpt-6.1-sol</code>          | 6.75s  | 100.00      | 0.00% | 0.00% | 6.75s           | $0.0101        |
| 7    | <code>openai/gpt-6-luna</code>           | 7.46s  | 100.00      | 0.00% | 0.00% | 7.46s           | $0.0007        |
| 8    | <code>anthropic/claude-fable-5</code>    | 8.03s  | 100.00      | 0.00% | 0.00% | 8.03s           | $0.0771        |
| 9    | <code>grok/grok-4.7</code>               | 16.59s | 100.00      | 0.00% | 0.00% | 16.59s          | $0.0166        |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-fable-5</code>    | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 8.03s           | $0.0771        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.63s           | $0.0008        |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 4.99s           | $0.0309        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 6.53s           | $0.0154        |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 6.62s           | $0.0040        |
| 6    | <code>grok/grok-4.7</code>               | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 16.59s          | $0.0166        |
| 7    | <code>mistral/mistral-ocr-4-1</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.38s           | $0.0040        |
| 8    | <code>openai/gpt-6-luna</code>           | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 7.46s           | $0.0007        |
| 9    | <code>openai/gpt-6.1-sol</code>          | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 6.75s           | $0.0101        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | ----: | ----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 93.08       | 6.92% | 1.59% | 0.82s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 100.00      | 0.00% | 0.00% | 8.03s           | $0.0771        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 100.00      | 0.00% | 0.00% | 2.63s           | $0.0008        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 100.00      | 0.00% | 0.00% | 4.99s           | $0.0309        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00      | 0.00% | 0.00% | 6.53s           | $0.0154        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 100.00      | 0.00% | 0.00% | 6.62s           | $0.0040        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 100.00      | 0.00% | 0.00% | 16.59s          | $0.0166        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 100.00      | 0.00% | 0.00% | 2.38s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 100.00      | 0.00% | 0.00% | 7.46s           | $0.0007        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 100.00      | 0.00% | 0.00% | 6.75s           | $0.0101        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 9             | 0         | 2          | 159        |
| <code>anthropic/claude-fable-5</code>    | 0             | 0         | 0          | 159        |
| <code>anthropic/claude-haiku-5-5</code>  | 0             | 0         | 0          | 159        |
| <code>anthropic/claude-opus-5-5</code>   | 0             | 0         | 0          | 159        |
| <code>anthropic/claude-sonnet-5-5</code> | 0             | 0         | 0          | 159        |
| <code>gemini/gemini-3.8-flash</code>     | 0             | 0         | 0          | 159        |
| <code>grok/grok-4.7</code>               | 0             | 0         | 0          | 159        |
| <code>mistral/mistral-ocr-4-1</code>     | 0             | 0         | 0          | 159        |
| <code>openai/gpt-6-luna</code>           | 0             | 0         | 0          | 159        |
| <code>openai/gpt-6.1-sol</code>          | 0             | 0         | 0          | 159        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 93.08/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `openai/gpt-6-luna` at 0.0684¢ ($0.0007).
- Fastest local model: `tesseract/tesseract` at 0.82s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 2.38s.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- The protocol uses pinned page PNGs for every provider, including rendered baseline PDFs. Archived original runs remain separate.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental fidelity-metrics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
