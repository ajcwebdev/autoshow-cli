# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-bc-run/benchmark-runs/technical-code-nbitcoin`
- Publisher canonical reference: `technical-code-nbitcoin.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `f6008b7a33e1029c749339dbf3890867f0aa4e7e594303925fca3aa9a2fa3118`.
- Publisher source: https://zenodo.org/records/3743394/files/replication.zip?download=1 (revision `Zenodo 3743394, published archive MD5 48c44b34e47ee02b0fec281f86393e48`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 82.35       | 17.65% | 9.74% | 0.32s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.32s | 82.35       | 17.65% | 9.74% | 0.32s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 82.35/100 quality score | 82.35       | 17.65% | 9.74% | 0.32s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>openai/gpt-6-luna</code>           | $0.0003 | 100.00      | 0.00% | 0.00% | 5.78s           | $0.0003        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | $0.0004 | 100.00      | 0.00% | 0.00% | 2.17s           | $0.0004        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 100.00      | 0.00% | 0.00% | 1.13s           | $0.0040        |
| 4    | <code>openai/gpt-6.1-sol</code>          | $0.0046 | 100.00      | 0.00% | 0.00% | 4.27s           | $0.0046        |
| 5    | <code>anthropic/claude-sonnet-5-5</code> | $0.0074 | 100.00      | 0.00% | 0.00% | 3.06s           | $0.0074        |
| 6    | <code>grok/grok-4.7</code>               | $0.0119 | 100.00      | 0.00% | 0.00% | 9.49s           | $0.0119        |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.0147 | 100.00      | 0.00% | 0.00% | 4.19s           | $0.0147        |
| 8    | <code>anthropic/claude-fable-5</code>    | $0.0368 | 100.00      | 0.00% | 0.00% | 5.20s           | $0.0368        |
| 9    | <code>gemini/gemini-3.8-flash</code>     | $0.3181 | 100.00      | 0.00% | 0.00% | 82.32s          | $0.3181        |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 1.13s  | 100.00      | 0.00% | 0.00% | 1.13s           | $0.0040        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 2.17s  | 100.00      | 0.00% | 0.00% | 2.17s           | $0.0004        |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 3.06s  | 100.00      | 0.00% | 0.00% | 3.06s           | $0.0074        |
| 4    | <code>anthropic/claude-opus-5-5</code>   | 4.19s  | 100.00      | 0.00% | 0.00% | 4.19s           | $0.0147        |
| 5    | <code>openai/gpt-6.1-sol</code>          | 4.27s  | 100.00      | 0.00% | 0.00% | 4.27s           | $0.0046        |
| 6    | <code>anthropic/claude-fable-5</code>    | 5.20s  | 100.00      | 0.00% | 0.00% | 5.20s           | $0.0368        |
| 7    | <code>openai/gpt-6-luna</code>           | 5.78s  | 100.00      | 0.00% | 0.00% | 5.78s           | $0.0003        |
| 8    | <code>grok/grok-4.7</code>               | 9.49s  | 100.00      | 0.00% | 0.00% | 9.49s           | $0.0119        |
| 9    | <code>gemini/gemini-3.8-flash</code>     | 82.32s | 100.00      | 0.00% | 0.00% | 82.32s          | $0.3181        |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-fable-5</code>    | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 5.20s           | $0.0368        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.17s           | $0.0004        |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 4.19s           | $0.0147        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 3.06s           | $0.0074        |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 82.32s          | $0.3181        |
| 6    | <code>grok/grok-4.7</code>               | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 9.49s           | $0.0119        |
| 7    | <code>mistral/mistral-ocr-4-1</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 1.13s           | $0.0040        |
| 8    | <code>openai/gpt-6-luna</code>           | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 5.78s           | $0.0003        |
| 9    | <code>openai/gpt-6.1-sol</code>          | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 4.27s           | $0.0046        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | ----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 82.35       | 17.65% | 9.74% | 0.32s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 100.00      | 0.00%  | 0.00% | 5.20s           | $0.0368        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 100.00      | 0.00%  | 0.00% | 2.17s           | $0.0004        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 100.00      | 0.00%  | 0.00% | 4.19s           | $0.0147        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00      | 0.00%  | 0.00% | 3.06s           | $0.0074        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 100.00      | 0.00%  | 0.00% | 82.32s          | $0.3181        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 100.00      | 0.00%  | 0.00% | 9.49s           | $0.0119        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 100.00      | 0.00%  | 0.00% | 1.13s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 100.00      | 0.00%  | 0.00% | 5.78s           | $0.0003        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 100.00      | 0.00%  | 0.00% | 4.27s           | $0.0046        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 3             | 3         | 3          | 51         |
| <code>anthropic/claude-fable-5</code>    | 0             | 0         | 0          | 51         |
| <code>anthropic/claude-haiku-5-5</code>  | 0             | 0         | 0          | 51         |
| <code>anthropic/claude-opus-5-5</code>   | 0             | 0         | 0          | 51         |
| <code>anthropic/claude-sonnet-5-5</code> | 0             | 0         | 0          | 51         |
| <code>gemini/gemini-3.8-flash</code>     | 0             | 0         | 0          | 51         |
| <code>grok/grok-4.7</code>               | 0             | 0         | 0          | 51         |
| <code>mistral/mistral-ocr-4-1</code>     | 0             | 0         | 0          | 51         |
| <code>openai/gpt-6-luna</code>           | 0             | 0         | 0          | 51         |
| <code>openai/gpt-6.1-sol</code>          | 0             | 0         | 0          | 51         |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 82.35/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `openai/gpt-6-luna` at 0.0328¢ ($0.0003).
- Fastest local model: `tesseract/tesseract` at 0.32s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 1.13s.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- The protocol uses pinned page PNGs for every provider, including rendered baseline PDFs. Archived original runs remain separate.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental fidelity-metrics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
