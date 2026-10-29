# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/newspapers-leader`
- Publisher canonical reference: `newspapers-leader.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `87cde1ccc10eb3cec39d04ca4385a49964d39b4c7e7d2df1fe043551f6d594ed`.
- Publisher source: https://ndownloader.figshare.com/files/52256378 (revision `10.5522/04/28381610.v1`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 66.05       | 33.95% | 16.98% | 1.21s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 1.21s | 66.05       | 33.95% | 16.98% | 1.21s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 66.05/100 quality score | 66.05       | 33.95% | 16.98% | 1.21s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0007 | 95.19       | 4.81% | 0.50% | 4.44s           | $0.0007        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0021 | 94.91       | 5.09% | 1.00% | 34.41s          | $0.0021        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 95.47       | 4.53% | 0.73% | 2.04s           | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0086 | 100.00      | 0.00% | 0.00% | 8.03s           | $0.0086        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0104 | 99.15       | 0.85% | 0.53% | 21.21s          | $0.0104        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0141 | 96.04       | 3.96% | 0.35% | 9.88s           | $0.0141        |
| 7    | <code>grok/grok-4.7</code>               | $0.0254 | 96.04       | 3.96% | 0.35% | 28.15s          | $0.0254        |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.0281 | 96.04       | 3.96% | 0.35% | 10.76s          | $0.0281        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0711 | 96.04       | 3.96% | 0.35% | 16.35s          | $0.0711        |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 2.04s  | 95.47       | 4.53% | 0.73% | 2.04s           | $0.0040        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 4.44s  | 95.19       | 4.81% | 0.50% | 4.44s           | $0.0007        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | 8.03s  | 100.00      | 0.00% | 0.00% | 8.03s           | $0.0086        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 9.88s  | 96.04       | 3.96% | 0.35% | 9.88s           | $0.0141        |
| 5    | <code>anthropic/claude-opus-5-5</code>   | 10.76s | 96.04       | 3.96% | 0.35% | 10.76s          | $0.0281        |
| 6    | <code>anthropic/claude-fable-5</code>    | 16.35s | 96.04       | 3.96% | 0.35% | 16.35s          | $0.0711        |
| 7    | <code>openai/gpt-6.1-sol</code>          | 21.21s | 99.15       | 0.85% | 0.53% | 21.21s          | $0.0104        |
| 8    | <code>grok/grok-4.7</code>               | 28.15s | 96.04       | 3.96% | 0.35% | 28.15s          | $0.0254        |
| 9    | <code>openai/gpt-6-luna</code>           | 34.41s | 94.91       | 5.09% | 1.00% | 34.41s          | $0.0021        |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>gemini/gemini-3.8-flash</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 8.03s           | $0.0086        |
| 2    | <code>openai/gpt-6.1-sol</code>          | 99.15/100 quality score  | 99.15       | 0.85% | 0.53% | 21.21s          | $0.0104        |
| 3    | <code>anthropic/claude-fable-5</code>    | 96.04/100 quality score  | 96.04       | 3.96% | 0.35% | 16.35s          | $0.0711        |
| 4    | <code>anthropic/claude-opus-5-5</code>   | 96.04/100 quality score  | 96.04       | 3.96% | 0.35% | 10.76s          | $0.0281        |
| 5    | <code>anthropic/claude-sonnet-5-5</code> | 96.04/100 quality score  | 96.04       | 3.96% | 0.35% | 9.88s           | $0.0141        |
| 6    | <code>grok/grok-4.7</code>               | 96.04/100 quality score  | 96.04       | 3.96% | 0.35% | 28.15s          | $0.0254        |
| 7    | <code>mistral/mistral-ocr-4-1</code>     | 95.47/100 quality score  | 95.47       | 4.53% | 0.73% | 2.04s           | $0.0040        |
| 8    | <code>anthropic/claude-haiku-5-5</code>  | 95.19/100 quality score  | 95.19       | 4.81% | 0.50% | 4.44s           | $0.0007        |
| 9    | <code>openai/gpt-6-luna</code>           | 94.91/100 quality score  | 94.91       | 5.09% | 1.00% | 34.41s          | $0.0021        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | -----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 66.05       | 33.95% | 16.98% | 1.21s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 96.04       | 3.96%  | 0.35%  | 16.35s          | $0.0711        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 95.19       | 4.81%  | 0.50%  | 4.44s           | $0.0007        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 96.04       | 3.96%  | 0.35%  | 10.76s          | $0.0281        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 96.04       | 3.96%  | 0.35%  | 9.88s           | $0.0141        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 8.03s           | $0.0086        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 96.04       | 3.96%  | 0.35%  | 28.15s          | $0.0254        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 95.47       | 4.53%  | 0.73%  | 2.04s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 94.91       | 5.09%  | 1.00%  | 34.41s          | $0.0021        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 99.15       | 0.85%  | 0.53%  | 21.21s          | $0.0104        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 194           | 41        | 5          | 707        |
| <code>anthropic/claude-fable-5</code>    | 14            | 14        | 0          | 707        |
| <code>anthropic/claude-haiku-5-5</code>  | 20            | 14        | 0          | 707        |
| <code>anthropic/claude-opus-5-5</code>   | 14            | 14        | 0          | 707        |
| <code>anthropic/claude-sonnet-5-5</code> | 14            | 14        | 0          | 707        |
| <code>gemini/gemini-3.8-flash</code>     | 0             | 0         | 0          | 707        |
| <code>grok/grok-4.7</code>               | 14            | 14        | 0          | 707        |
| <code>mistral/mistral-ocr-4-1</code>     | 18            | 14        | 0          | 707        |
| <code>openai/gpt-6-luna</code>           | 19            | 15        | 2          | 707        |
| <code>openai/gpt-6.1-sol</code>          | 5             | 0         | 1          | 707        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 66.05/100.
- Best cloud service: `gemini/gemini-3.8-flash` scored 100.00/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.0706¢ ($0.0007).
- Fastest local model: `tesseract/tesseract` at 1.21s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 2.04s.

## Lexical evaluation scope

Reference scope: region-crop. Exhaustive lexical target for the declared input page/crop; drawing syntax is excluded where the publisher serialization declares it.

Headline WER/CER use the existing case-insensitive lexical normalization and declared reference order. Reading-order or serialization differences can increase edit distance; these scores do not measure layout or exact glyph/punctuation fidelity.

Text-only OCR does not establish column/region localization or page layout. An article crop does not establish whole-page reading order.

Literal numeric, punctuation and whitespace comparisons are representation-fidelity diagnostics. TSV tabs, span-continuation blanks, Markdown wrappers and source case conventions can differ without establishing a recognition error.

[Literal numeric, punctuation and alternate-reading diagnostics](evaluation-diagnostics.json) retain all source and provider text privately.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- Each provider received the same pinned original PNG/JPEG or the declared rendered-PNG baseline variant. Reference text, table cells, manuscript deletions and graph/layout annotations were never sent to providers. Text recognition is scored separately from unavailable cell, branch and page-geometry accuracy.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental evaluation-diagnostics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
