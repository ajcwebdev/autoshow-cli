# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-bc-run/benchmark-runs/historical-print-leaves-of-grass`
- Publisher canonical reference: `historical-print-leaves-of-grass.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `47d9087334b2e7f8cf2f5e21647b08d7e0a76bf07cff2481ec73ea5bc1234a37`.
- Publisher source: https://en.wikisource.org/w/index.php?title=Page%3ALeaves%20of%20Grass%20(1860).djvu%2F192&oldid=15832799&action=raw (revision `15832799`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 96.83       | 3.17% | 0.48% | 1.03s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 1.03s | 96.83       | 3.17% | 0.48% | 1.03s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 96.83/100 quality score | 96.83       | 3.17% | 0.48% | 1.03s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>openai/gpt-6-luna</code>           | $0.0007 | 98.19       | 1.81% | 0.16% | 8.12s           | $0.0007        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | $0.0008 | 100.00      | 0.00% | 0.00% | 3.37s           | $0.0008        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 97.74       | 2.26% | 0.24% | 3.77s           | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0047 | 98.19       | 1.81% | 0.16% | 6.41s           | $0.0047        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0109 | 98.19       | 1.81% | 0.16% | 6.84s           | $0.0109        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0163 | 98.19       | 1.81% | 0.16% | 4.90s           | $0.0163        |
| 7    | <code>grok/grok-4.7</code>               | $0.0207 | 98.19       | 1.81% | 0.16% | 19.92s          | $0.0207        |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.0325 | 98.19       | 1.81% | 0.16% | 6.27s           | $0.0325        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0814 | 98.19       | 1.81% | 0.16% | 10.01s          | $0.0814        |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | 3.37s  | 100.00      | 0.00% | 0.00% | 3.37s           | $0.0008        |
| 2    | <code>mistral/mistral-ocr-4-1</code>     | 3.77s  | 97.74       | 2.26% | 0.24% | 3.77s           | $0.0040        |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 4.90s  | 98.19       | 1.81% | 0.16% | 4.90s           | $0.0163        |
| 4    | <code>anthropic/claude-opus-5-5</code>   | 6.27s  | 98.19       | 1.81% | 0.16% | 6.27s           | $0.0325        |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 6.41s  | 98.19       | 1.81% | 0.16% | 6.41s           | $0.0047        |
| 6    | <code>openai/gpt-6.1-sol</code>          | 6.84s  | 98.19       | 1.81% | 0.16% | 6.84s           | $0.0109        |
| 7    | <code>openai/gpt-6-luna</code>           | 8.12s  | 98.19       | 1.81% | 0.16% | 8.12s           | $0.0007        |
| 8    | <code>anthropic/claude-fable-5</code>    | 10.01s | 98.19       | 1.81% | 0.16% | 10.01s          | $0.0814        |
| 9    | <code>grok/grok-4.7</code>               | 19.92s | 98.19       | 1.81% | 0.16% | 19.92s          | $0.0207        |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 3.37s           | $0.0008        |
| 2    | <code>anthropic/claude-fable-5</code>    | 98.19/100 quality score  | 98.19       | 1.81% | 0.16% | 10.01s          | $0.0814        |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 98.19/100 quality score  | 98.19       | 1.81% | 0.16% | 6.27s           | $0.0325        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 98.19/100 quality score  | 98.19       | 1.81% | 0.16% | 4.90s           | $0.0163        |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 98.19/100 quality score  | 98.19       | 1.81% | 0.16% | 6.41s           | $0.0047        |
| 6    | <code>grok/grok-4.7</code>               | 98.19/100 quality score  | 98.19       | 1.81% | 0.16% | 19.92s          | $0.0207        |
| 7    | <code>openai/gpt-6-luna</code>           | 98.19/100 quality score  | 98.19       | 1.81% | 0.16% | 8.12s           | $0.0007        |
| 8    | <code>openai/gpt-6.1-sol</code>          | 98.19/100 quality score  | 98.19       | 1.81% | 0.16% | 6.84s           | $0.0109        |
| 9    | <code>mistral/mistral-ocr-4-1</code>     | 97.74/100 quality score  | 97.74       | 2.26% | 0.24% | 3.77s           | $0.0040        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | ----: | ----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 96.83       | 3.17% | 0.48% | 1.03s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 98.19       | 1.81% | 0.16% | 10.01s          | $0.0814        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 100.00      | 0.00% | 0.00% | 3.37s           | $0.0008        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 98.19       | 1.81% | 0.16% | 6.27s           | $0.0325        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 98.19       | 1.81% | 0.16% | 4.90s           | $0.0163        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 98.19       | 1.81% | 0.16% | 6.41s           | $0.0047        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 98.19       | 1.81% | 0.16% | 19.92s          | $0.0207        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 97.74       | 2.26% | 0.24% | 3.77s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 98.19       | 1.81% | 0.16% | 8.12s           | $0.0007        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 98.19       | 1.81% | 0.16% | 6.84s           | $0.0109        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 5             | 0         | 2          | 221        |
| <code>anthropic/claude-fable-5</code>    | 2             | 0         | 2          | 221        |
| <code>anthropic/claude-haiku-5-5</code>  | 0             | 0         | 0          | 221        |
| <code>anthropic/claude-opus-5-5</code>   | 2             | 0         | 2          | 221        |
| <code>anthropic/claude-sonnet-5-5</code> | 2             | 0         | 2          | 221        |
| <code>gemini/gemini-3.8-flash</code>     | 2             | 0         | 2          | 221        |
| <code>grok/grok-4.7</code>               | 2             | 0         | 2          | 221        |
| <code>mistral/mistral-ocr-4-1</code>     | 3             | 0         | 2          | 221        |
| <code>openai/gpt-6-luna</code>           | 2             | 0         | 2          | 221        |
| <code>openai/gpt-6.1-sol</code>          | 2             | 0         | 2          | 221        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 96.83/100.
- Best cloud service: `anthropic/claude-haiku-5-5` scored 100.00/100.
- The cheapest cloud provider was `openai/gpt-6-luna` at 0.0727¢ ($0.0007).
- Fastest local model: `tesseract/tesseract` at 1.03s.
- Fastest cloud service: `anthropic/claude-haiku-5-5` at 3.37s.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- The protocol uses pinned page PNGs for every provider, including rendered baseline PDFs. Archived original runs remain separate.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental fidelity-metrics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
