# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/numeric-tables-practitioner-attitudes`
- Publisher canonical reference: `numeric-tables-practitioner-attitudes.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `e059378acc0c8f041887b0369ba021730fea47268af5e194ed66e0a7ed55fa80`.
- Publisher source: https://raw.githubusercontent.com/ibm-aur-nlp/PubTabNet/8ffde9024bd331f5a61c3c549fdf30dd3c3e43a5/examples/PubTabNet_Examples.jsonl (revision `8ffde9024bd331f5a61c3c549fdf30dd3c3e43a5`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 1.79        | 98.21% | 86.96% | 0.33s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.33s | 1.79        | 98.21% | 86.96% | 0.33s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                  | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ---------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 1.79/100 quality score | 1.79        | 98.21% | 86.96% | 0.33s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0009 | 98.66       | 1.34% | 0.50% | 6.76s           | $0.0009        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0009 | 98.66       | 1.34% | 2.01% | 16.21s          | $0.0009        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 100.00      | 0.00% | 0.00% | 1.53s           | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0057 | 100.00      | 0.00% | 0.00% | 4.81s           | $0.0057        |
| 5    | <code>anthropic/claude-sonnet-5-5</code> | $0.0078 | 100.00      | 0.00% | 0.00% | 4.78s           | $0.0078        |
| 6    | <code>openai/gpt-6.1-sol</code>          | $0.0100 | 95.98       | 4.02% | 4.61% | 17.90s          | $0.0100        |
| 7    | <code>grok/grok-4.7</code>               | $0.0152 | 99.55       | 0.45% | 0.10% | 14.86s          | $0.0152        |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.0166 | 100.00      | 0.00% | 0.00% | 6.68s           | $0.0166        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0421 | 100.00      | 0.00% | 0.00% | 8.70s           | $0.0421        |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 1.53s  | 100.00      | 0.00% | 0.00% | 1.53s           | $0.0040        |
| 2    | <code>anthropic/claude-sonnet-5-5</code> | 4.78s  | 100.00      | 0.00% | 0.00% | 4.78s           | $0.0078        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | 4.81s  | 100.00      | 0.00% | 0.00% | 4.81s           | $0.0057        |
| 4    | <code>anthropic/claude-opus-5-5</code>   | 6.68s  | 100.00      | 0.00% | 0.00% | 6.68s           | $0.0166        |
| 5    | <code>anthropic/claude-haiku-5-5</code>  | 6.76s  | 98.66       | 1.34% | 0.50% | 6.76s           | $0.0009        |
| 6    | <code>anthropic/claude-fable-5</code>    | 8.70s  | 100.00      | 0.00% | 0.00% | 8.70s           | $0.0421        |
| 7    | <code>grok/grok-4.7</code>               | 14.86s | 99.55       | 0.45% | 0.10% | 14.86s          | $0.0152        |
| 8    | <code>openai/gpt-6-luna</code>           | 16.21s | 98.66       | 1.34% | 2.01% | 16.21s          | $0.0009        |
| 9    | <code>openai/gpt-6.1-sol</code>          | 17.90s | 95.98       | 4.02% | 4.61% | 17.90s          | $0.0100        |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-fable-5</code>    | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 8.70s           | $0.0421        |
| 2    | <code>anthropic/claude-opus-5-5</code>   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 6.68s           | $0.0166        |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 4.78s           | $0.0078        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 4.81s           | $0.0057        |
| 5    | <code>mistral/mistral-ocr-4-1</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 1.53s           | $0.0040        |
| 6    | <code>grok/grok-4.7</code>               | 99.55/100 quality score  | 99.55       | 0.45% | 0.10% | 14.86s          | $0.0152        |
| 7    | <code>anthropic/claude-haiku-5-5</code>  | 98.66/100 quality score  | 98.66       | 1.34% | 0.50% | 6.76s           | $0.0009        |
| 8    | <code>openai/gpt-6-luna</code>           | 98.66/100 quality score  | 98.66       | 1.34% | 2.01% | 16.21s          | $0.0009        |
| 9    | <code>openai/gpt-6.1-sol</code>          | 95.98/100 quality score  | 95.98       | 4.02% | 4.61% | 17.90s          | $0.0100        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | -----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 1.79        | 98.21% | 86.96% | 0.33s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 8.70s           | $0.0421        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 98.66       | 1.34%  | 0.50%  | 6.76s           | $0.0009        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 6.68s           | $0.0166        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 4.78s           | $0.0078        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 4.81s           | $0.0057        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 99.55       | 0.45%  | 0.10%  | 14.86s          | $0.0152        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 1.53s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 98.66       | 1.34%  | 2.01%  | 16.21s          | $0.0009        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 95.98       | 4.02%  | 4.61%  | 17.90s          | $0.0100        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 24            | 196       | 0          | 224        |
| <code>anthropic/claude-fable-5</code>    | 0             | 0         | 0          | 224        |
| <code>anthropic/claude-haiku-5-5</code>  | 1             | 1         | 1          | 224        |
| <code>anthropic/claude-opus-5-5</code>   | 0             | 0         | 0          | 224        |
| <code>anthropic/claude-sonnet-5-5</code> | 0             | 0         | 0          | 224        |
| <code>gemini/gemini-3.8-flash</code>     | 0             | 0         | 0          | 224        |
| <code>grok/grok-4.7</code>               | 1             | 0         | 0          | 224        |
| <code>mistral/mistral-ocr-4-1</code>     | 0             | 0         | 0          | 224        |
| <code>openai/gpt-6-luna</code>           | 0             | 0         | 3          | 224        |
| <code>openai/gpt-6.1-sol</code>          | 3             | 3         | 3          | 224        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 1.79/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.0885¢ ($0.0009).
- Fastest local model: `tesseract/tesseract` at 0.33s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 1.53s.

## Lexical evaluation scope

Reference scope: region-crop. Exhaustive lexical target for the declared input page/crop; drawing syntax is excluded where the publisher serialization declares it.

Headline WER/CER use the existing case-insensitive lexical normalization and declared reference order. Reading-order or serialization differences can increase edit distance; these scores do not measure layout or exact glyph/punctuation fidelity.

Text-only OCR does not establish cell assignment, row/column mapping, spans or blank-cell geometry. Numeric/text presence is not table-structure accuracy.

Literal numeric, punctuation and whitespace comparisons are representation-fidelity diagnostics. TSV tabs, span-continuation blanks, Markdown wrappers and source case conventions can differ without establishing a recognition error.

[Literal numeric, punctuation and alternate-reading diagnostics](evaluation-diagnostics.json) retain all source and provider text privately.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- Each provider received the same pinned original PNG/JPEG or the declared rendered-PNG baseline variant. Reference text, table cells, manuscript deletions and graph/layout annotations were never sent to providers. Text recognition is scored separately from unavailable cell, branch and page-geometry accuracy.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental evaluation-diagnostics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
