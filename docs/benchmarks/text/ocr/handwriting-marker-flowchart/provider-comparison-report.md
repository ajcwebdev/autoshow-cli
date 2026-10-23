# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/handwriting-marker-flowchart`
- Publisher canonical reference: `reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `b033e75b1d542a51a1127747b82ce4974e39d5a03e42825a54db075cef7a5890`.
- Publisher source: https://huggingface.co/datasets/danielrosehill/Whiteboards/resolve/4b31e86e15743ffea20204a8f6992b0173ecbdf9/data/metadata.jsonl (revision `4b31e86e15743ffea20204a8f6992b0173ecbdf9`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 5.26        | 94.74% | 55.42% | 0.82s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.82s | 5.26        | 94.74% | 55.42% | 0.82s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                  | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ---------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 5.26/100 quality score | 5.26        | 94.74% | 55.42% | 0.82s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0006 | 84.21       | 15.79% | 6.02%  | 2.65s           | $0.0006        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0006 | 100.00      | 0.00%  | 0.00%  | 7.89s           | $0.0006        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | $0.0033 | 100.00      | 0.00%  | 0.00%  | 5.41s           | $0.0033        |
| 4    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 47.37       | 52.63% | 32.53% | 5.31s           | $0.0040        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0083 | 100.00      | 0.00%  | 0.00%  | 5.18s           | $0.0083        |
| 6    | <code>grok/grok-4.7</code>               | $0.0092 | 100.00      | 0.00%  | 0.00%  | 4.98s           | $0.0092        |
| 7    | <code>anthropic/claude-sonnet-5-5</code> | $0.0116 | 100.00      | 0.00%  | 0.00%  | 3.48s           | $0.0116        |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.0231 | 100.00      | 0.00%  | 0.00%  | 4.21s           | $0.0231        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0579 | 100.00      | 0.00%  | 0.00%  | 5.04s           | $0.0579        |

#### Speed

| Rank | Provider                                 | Value | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ----: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | 2.65s | 84.21       | 15.79% | 6.02%  | 2.65s           | $0.0006        |
| 2    | <code>anthropic/claude-sonnet-5-5</code> | 3.48s | 100.00      | 0.00%  | 0.00%  | 3.48s           | $0.0116        |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 4.21s | 100.00      | 0.00%  | 0.00%  | 4.21s           | $0.0231        |
| 4    | <code>grok/grok-4.7</code>               | 4.98s | 100.00      | 0.00%  | 0.00%  | 4.98s           | $0.0092        |
| 5    | <code>anthropic/claude-fable-5</code>    | 5.04s | 100.00      | 0.00%  | 0.00%  | 5.04s           | $0.0579        |
| 6    | <code>openai/gpt-6.1-sol</code>          | 5.18s | 100.00      | 0.00%  | 0.00%  | 5.18s           | $0.0083        |
| 7    | <code>mistral/mistral-ocr-4-1</code>     | 5.31s | 47.37       | 52.63% | 32.53% | 5.31s           | $0.0040        |
| 8    | <code>gemini/gemini-3.8-flash</code>     | 5.41s | 100.00      | 0.00%  | 0.00%  | 5.41s           | $0.0033        |
| 9    | <code>openai/gpt-6-luna</code>           | 7.89s | 100.00      | 0.00%  | 0.00%  | 7.89s           | $0.0006        |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-fable-5</code>    | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 5.04s           | $0.0579        |
| 2    | <code>anthropic/claude-opus-5-5</code>   | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 4.21s           | $0.0231        |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 3.48s           | $0.0116        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 5.41s           | $0.0033        |
| 5    | <code>grok/grok-4.7</code>               | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 4.98s           | $0.0092        |
| 6    | <code>openai/gpt-6-luna</code>           | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 7.89s           | $0.0006        |
| 7    | <code>openai/gpt-6.1-sol</code>          | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 5.18s           | $0.0083        |
| 8    | <code>anthropic/claude-haiku-5-5</code>  | 84.21/100 quality score  | 84.21       | 15.79% | 6.02%  | 2.65s           | $0.0006        |
| 9    | <code>mistral/mistral-ocr-4-1</code>     | 47.37/100 quality score  | 47.37       | 52.63% | 32.53% | 5.31s           | $0.0040        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | -----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 5.26        | 94.74% | 55.42% | 0.82s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 5.04s           | $0.0579        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 84.21       | 15.79% | 6.02%  | 2.65s           | $0.0006        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 4.21s           | $0.0231        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 3.48s           | $0.0116        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 5.41s           | $0.0033        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 4.98s           | $0.0092        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 47.37       | 52.63% | 32.53% | 5.31s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 7.89s           | $0.0006        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 5.18s           | $0.0083        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 13            | 5         | 0          | 19         |
| <code>anthropic/claude-fable-5</code>    | 0             | 0         | 0          | 19         |
| <code>anthropic/claude-haiku-5-5</code>  | 2             | 1         | 0          | 19         |
| <code>anthropic/claude-opus-5-5</code>   | 0             | 0         | 0          | 19         |
| <code>anthropic/claude-sonnet-5-5</code> | 0             | 0         | 0          | 19         |
| <code>gemini/gemini-3.8-flash</code>     | 0             | 0         | 0          | 19         |
| <code>grok/grok-4.7</code>               | 0             | 0         | 0          | 19         |
| <code>mistral/mistral-ocr-4-1</code>     | 7             | 0         | 3          | 19         |
| <code>openai/gpt-6-luna</code>           | 0             | 0         | 0          | 19         |
| <code>openai/gpt-6.1-sol</code>          | 0             | 0         | 0          | 19         |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 5.26/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.0574¢ ($0.0006).
- Fastest local model: `tesseract/tesseract` at 0.82s.
- Fastest cloud service: `anthropic/claude-haiku-5-5` at 2.65s.

## Lexical evaluation scope

Reference scope: full-page. Exhaustive lexical target for the declared input page/crop; drawing syntax is excluded where the publisher serialization declares it.

Headline WER/CER use the existing case-insensitive lexical normalization and declared reference order. Reading-order or serialization differences can increase edit distance; these scores do not measure layout or exact glyph/punctuation fidelity.

Text-only OCR does not establish node placement, edge direction or label-to-branch association. Correct label text is not graph-topology accuracy.

Literal numeric, punctuation and whitespace comparisons are representation-fidelity diagnostics. TSV tabs, span-continuation blanks, Markdown wrappers and source case conventions can differ without establishing a recognition error.

[Literal numeric, punctuation and alternate-reading diagnostics](evaluation-diagnostics.json) retain all source and provider text privately.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- Each provider received the same pinned original PNG/JPEG or the declared rendered-PNG baseline variant. Reference text, table cells, manuscript deletions and graph/layout annotations were never sent to providers. Text recognition is scored separately from unavailable cell, branch and page-geometry accuracy.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental evaluation-diagnostics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
