# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-bc-run/benchmark-runs/technical-code-cli-parser`
- Publisher canonical reference: `technical-code-cli-parser.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `a6108564b74d0680f34fec3e0f0dc7c1b16cfae7caf05eb6f25af760e7d7863f`.
- Publisher source: https://zenodo.org/records/3743394/files/replication.zip?download=1 (revision `Zenodo 3743394, published archive MD5 48c44b34e47ee02b0fec281f86393e48`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 74.70       | 25.30% | 5.83% | 0.20s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.20s | 74.70       | 25.30% | 5.83% | 0.20s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 74.70/100 quality score | 74.70       | 25.30% | 5.83% | 0.20s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0004 | 100.00      | 0.00% | 0.00% | 2.09s           | $0.0004        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0005 | 100.00      | 0.00% | 0.00% | 7.23s           | $0.0005        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | $0.0039 | 100.00      | 0.00% | 0.00% | 104.32s         | $0.0039        |
| 4    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 100.00      | 0.00% | 0.00% | 0.95s           | $0.0040        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0058 | 100.00      | 0.00% | 0.00% | 6.25s           | $0.0058        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0077 | 100.00      | 0.00% | 0.00% | 3.16s           | $0.0077        |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.0155 | 100.00      | 0.00% | 0.00% | 3.96s           | $0.0155        |
| 8    | <code>grok/grok-4.7</code>               | $0.0199 | 100.00      | 0.00% | 0.00% | 22.38s          | $0.0199        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0387 | 100.00      | 0.00% | 0.00% | 5.82s           | $0.0387        |

#### Speed

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 0.95s   | 100.00      | 0.00% | 0.00% | 0.95s           | $0.0040        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 2.09s   | 100.00      | 0.00% | 0.00% | 2.09s           | $0.0004        |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 3.16s   | 100.00      | 0.00% | 0.00% | 3.16s           | $0.0077        |
| 4    | <code>anthropic/claude-opus-5-5</code>   | 3.96s   | 100.00      | 0.00% | 0.00% | 3.96s           | $0.0155        |
| 5    | <code>anthropic/claude-fable-5</code>    | 5.82s   | 100.00      | 0.00% | 0.00% | 5.82s           | $0.0387        |
| 6    | <code>openai/gpt-6.1-sol</code>          | 6.25s   | 100.00      | 0.00% | 0.00% | 6.25s           | $0.0058        |
| 7    | <code>openai/gpt-6-luna</code>           | 7.23s   | 100.00      | 0.00% | 0.00% | 7.23s           | $0.0005        |
| 8    | <code>grok/grok-4.7</code>               | 22.38s  | 100.00      | 0.00% | 0.00% | 22.38s          | $0.0199        |
| 9    | <code>gemini/gemini-3.8-flash</code>     | 104.32s | 100.00      | 0.00% | 0.00% | 104.32s         | $0.0039        |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-fable-5</code>    | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 5.82s           | $0.0387        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.09s           | $0.0004        |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 3.96s           | $0.0155        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 3.16s           | $0.0077        |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 104.32s         | $0.0039        |
| 6    | <code>grok/grok-4.7</code>               | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 22.38s          | $0.0199        |
| 7    | <code>mistral/mistral-ocr-4-1</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 0.95s           | $0.0040        |
| 8    | <code>openai/gpt-6-luna</code>           | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 7.23s           | $0.0005        |
| 9    | <code>openai/gpt-6.1-sol</code>          | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 6.25s           | $0.0058        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | ----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 74.70       | 25.30% | 5.83% | 0.20s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 100.00      | 0.00%  | 0.00% | 5.82s           | $0.0387        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 100.00      | 0.00%  | 0.00% | 2.09s           | $0.0004        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 100.00      | 0.00%  | 0.00% | 3.96s           | $0.0155        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00      | 0.00%  | 0.00% | 3.16s           | $0.0077        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 100.00      | 0.00%  | 0.00% | 104.32s         | $0.0039        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 100.00      | 0.00%  | 0.00% | 22.38s          | $0.0199        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 100.00      | 0.00%  | 0.00% | 0.95s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 100.00      | 0.00%  | 0.00% | 7.23s           | $0.0005        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 100.00      | 0.00%  | 0.00% | 6.25s           | $0.0058        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 10            | 7         | 4          | 83         |
| <code>anthropic/claude-fable-5</code>    | 0             | 0         | 0          | 83         |
| <code>anthropic/claude-haiku-5-5</code>  | 0             | 0         | 0          | 83         |
| <code>anthropic/claude-opus-5-5</code>   | 0             | 0         | 0          | 83         |
| <code>anthropic/claude-sonnet-5-5</code> | 0             | 0         | 0          | 83         |
| <code>gemini/gemini-3.8-flash</code>     | 0             | 0         | 0          | 83         |
| <code>grok/grok-4.7</code>               | 0             | 0         | 0          | 83         |
| <code>mistral/mistral-ocr-4-1</code>     | 0             | 0         | 0          | 83         |
| <code>openai/gpt-6-luna</code>           | 0             | 0         | 0          | 83         |
| <code>openai/gpt-6.1-sol</code>          | 0             | 0         | 0          | 83         |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 74.70/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.0392¢ ($0.0004).
- Fastest local model: `tesseract/tesseract` at 0.20s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 0.95s.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- The protocol uses pinned page PNGs for every provider, including rendered baseline PDFs. Archived original runs remain separate.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental fidelity-metrics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
