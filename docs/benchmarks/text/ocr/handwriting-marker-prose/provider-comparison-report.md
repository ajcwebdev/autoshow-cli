# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/handwriting-marker-prose`
- Publisher canonical reference: `reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `5bdb9cd588baebcd71a51e4014fc8d54b30ee64e413a209eeb926144d51b330d`.
- Publisher source: https://huggingface.co/datasets/danielrosehill/Whiteboards/resolve/4b31e86e15743ffea20204a8f6992b0173ecbdf9/data/metadata.jsonl (revision `4b31e86e15743ffea20204a8f6992b0173ecbdf9`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 11.76       | 88.24% | 52.69% | 0.91s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.91s | 11.76       | 88.24% | 52.69% | 0.91s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 11.76/100 quality score | 11.76       | 88.24% | 52.69% | 0.91s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>openai/gpt-6-luna</code>           | $0.0005 | 97.06       | 2.94% | 1.08% | 5.40s           | $0.0005        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | $0.0006 | 100.00      | 0.00% | 0.00% | 2.35s           | $0.0006        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | $0.0024 | 97.06       | 2.94% | 0.54% | 6.06s           | $0.0024        |
| 4    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 100.00      | 0.00% | 0.00% | 6.88s           | $0.0040        |
| 5    | <code>grok/grok-4.7</code>               | $0.0087 | 97.06       | 2.94% | 1.08% | 7.17s           | $0.0087        |
| 6    | <code>openai/gpt-6.1-sol</code>          | $0.0092 | 97.06       | 2.94% | 1.08% | 6.76s           | $0.0092        |
| 7    | <code>anthropic/claude-sonnet-5-5</code> | $0.0118 | 100.00      | 0.00% | 0.00% | 6.53s           | $0.0118        |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.0236 | 100.00      | 0.00% | 0.00% | 4.96s           | $0.0236        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0600 | 97.06       | 2.94% | 1.08% | 5.84s           | $0.0600        |

#### Speed

| Rank | Provider                                 | Value | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | 2.35s | 100.00      | 0.00% | 0.00% | 2.35s           | $0.0006        |
| 2    | <code>anthropic/claude-opus-5-5</code>   | 4.96s | 100.00      | 0.00% | 0.00% | 4.96s           | $0.0236        |
| 3    | <code>openai/gpt-6-luna</code>           | 5.40s | 97.06       | 2.94% | 1.08% | 5.40s           | $0.0005        |
| 4    | <code>anthropic/claude-fable-5</code>    | 5.84s | 97.06       | 2.94% | 1.08% | 5.84s           | $0.0600        |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 6.06s | 97.06       | 2.94% | 0.54% | 6.06s           | $0.0024        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | 6.53s | 100.00      | 0.00% | 0.00% | 6.53s           | $0.0118        |
| 7    | <code>openai/gpt-6.1-sol</code>          | 6.76s | 97.06       | 2.94% | 1.08% | 6.76s           | $0.0092        |
| 8    | <code>mistral/mistral-ocr-4-1</code>     | 6.88s | 100.00      | 0.00% | 0.00% | 6.88s           | $0.0040        |
| 9    | <code>grok/grok-4.7</code>               | 7.17s | 97.06       | 2.94% | 1.08% | 7.17s           | $0.0087        |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.35s           | $0.0006        |
| 2    | <code>anthropic/claude-opus-5-5</code>   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 4.96s           | $0.0236        |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 6.53s           | $0.0118        |
| 4    | <code>mistral/mistral-ocr-4-1</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 6.88s           | $0.0040        |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 97.06/100 quality score  | 97.06       | 2.94% | 0.54% | 6.06s           | $0.0024        |
| 6    | <code>anthropic/claude-fable-5</code>    | 97.06/100 quality score  | 97.06       | 2.94% | 1.08% | 5.84s           | $0.0600        |
| 7    | <code>grok/grok-4.7</code>               | 97.06/100 quality score  | 97.06       | 2.94% | 1.08% | 7.17s           | $0.0087        |
| 8    | <code>openai/gpt-6-luna</code>           | 97.06/100 quality score  | 97.06       | 2.94% | 1.08% | 5.40s           | $0.0005        |
| 9    | <code>openai/gpt-6.1-sol</code>          | 97.06/100 quality score  | 97.06       | 2.94% | 1.08% | 6.76s           | $0.0092        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | -----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 11.76       | 88.24% | 52.69% | 0.91s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 97.06       | 2.94%  | 1.08%  | 5.84s           | $0.0600        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 2.35s           | $0.0006        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 4.96s           | $0.0236        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 6.53s           | $0.0118        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 97.06       | 2.94%  | 0.54%  | 6.06s           | $0.0024        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 97.06       | 2.94%  | 1.08%  | 7.17s           | $0.0087        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 6.88s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 97.06       | 2.94%  | 1.08%  | 5.40s           | $0.0005        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 97.06       | 2.94%  | 1.08%  | 6.76s           | $0.0092        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 28            | 1         | 1          | 34         |
| <code>anthropic/claude-fable-5</code>    | 1             | 0         | 0          | 34         |
| <code>anthropic/claude-haiku-5-5</code>  | 0             | 0         | 0          | 34         |
| <code>anthropic/claude-opus-5-5</code>   | 0             | 0         | 0          | 34         |
| <code>anthropic/claude-sonnet-5-5</code> | 0             | 0         | 0          | 34         |
| <code>gemini/gemini-3.8-flash</code>     | 1             | 0         | 0          | 34         |
| <code>grok/grok-4.7</code>               | 1             | 0         | 0          | 34         |
| <code>mistral/mistral-ocr-4-1</code>     | 0             | 0         | 0          | 34         |
| <code>openai/gpt-6-luna</code>           | 1             | 0         | 0          | 34         |
| <code>openai/gpt-6.1-sol</code>          | 1             | 0         | 0          | 34         |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 11.76/100.
- Best cloud service: `anthropic/claude-haiku-5-5` scored 100.00/100.
- The cheapest cloud provider was `openai/gpt-6-luna` at 0.0470¢ ($0.0005).
- Fastest local model: `tesseract/tesseract` at 0.91s.
- Fastest cloud service: `anthropic/claude-haiku-5-5` at 2.35s.

## Lexical evaluation scope

Reference scope: full-page. Exhaustive lexical target for the declared input page/crop; drawing syntax is excluded where the publisher serialization declares it.

Headline WER/CER use the existing case-insensitive lexical normalization and declared reference order. Reading-order or serialization differences can increase edit distance; these scores do not measure layout or exact glyph/punctuation fidelity.

Text-only OCR does not establish handwriting placement, drawing geometry or spatial association.

Literal numeric, punctuation and whitespace comparisons are representation-fidelity diagnostics. TSV tabs, span-continuation blanks, Markdown wrappers and source case conventions can differ without establishing a recognition error.

[Literal numeric, punctuation and alternate-reading diagnostics](evaluation-diagnostics.json) retain all source and provider text privately.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- Each provider received the same pinned original PNG/JPEG or the declared rendered-PNG baseline variant. Reference text, table cells, manuscript deletions and graph/layout annotations were never sent to providers. Text recognition is scored separately from unavailable cell, branch and page-geometry accuracy.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental evaluation-diagnostics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
