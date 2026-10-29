# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-clean-typography/benchmark-runs/clean-typography-good-talk`
- Publisher canonical reference: `canonical-reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `b829d2120657ee4b9a97d7ecc9cb827daac50d6152e5fb9c8a11b4dbea7c10d8`.
- Publisher source: https://huggingface.co/datasets/opendatalab/OmniDocBench/resolve/aa1ee96d106dbe53d0ae59474d75c6e6d9b53fec/OmniDocBench.json (revision `aa1ee96d106dbe53d0ae59474d75c6e6d9b53fec`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 82.50       | 17.50% | 6.28% | 0.27s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.27s | 82.50       | 17.50% | 6.28% | 0.27s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 82.50/100 quality score | 82.50       | 17.50% | 6.28% | 0.27s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>openai/gpt-6-luna</code>           | $0.0004 | 100.00      | 0.00%  | 0.00%  | 2.74s           | $0.0004        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | $0.0005 | 100.00      | 0.00%  | 0.00%  | 1.61s           | $0.0005        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | $0.0025 | 100.00      | 0.00%  | 0.00%  | 115.99s         | $0.0025        |
| 4    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 70.00       | 30.00% | 21.26% | 2.00s           | $0.0040        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0081 | 100.00      | 0.00%  | 0.00%  | 3.97s           | $0.0081        |
| 6    | <code>grok/grok-4.7</code>               | $0.0088 | 100.00      | 0.00%  | 0.00%  | 2.68s           | $0.0088        |
| 7    | <code>anthropic/claude-sonnet-5-5</code> | $0.0102 | 100.00      | 0.00%  | 0.00%  | 4.70s           | $0.0102        |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.0203 | 100.00      | 0.00%  | 0.00%  | 4.62s           | $0.0203        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0513 | 100.00      | 0.00%  | 0.00%  | 4.08s           | $0.0513        |

#### Speed

| Rank | Provider                                 | Value   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | 1.61s   | 100.00      | 0.00%  | 0.00%  | 1.61s           | $0.0005        |
| 2    | <code>mistral/mistral-ocr-4-1</code>     | 2.00s   | 70.00       | 30.00% | 21.26% | 2.00s           | $0.0040        |
| 3    | <code>grok/grok-4.7</code>               | 2.68s   | 100.00      | 0.00%  | 0.00%  | 2.68s           | $0.0088        |
| 4    | <code>openai/gpt-6-luna</code>           | 2.74s   | 100.00      | 0.00%  | 0.00%  | 2.74s           | $0.0004        |
| 5    | <code>openai/gpt-6.1-sol</code>          | 3.97s   | 100.00      | 0.00%  | 0.00%  | 3.97s           | $0.0081        |
| 6    | <code>anthropic/claude-fable-5</code>    | 4.08s   | 100.00      | 0.00%  | 0.00%  | 4.08s           | $0.0513        |
| 7    | <code>anthropic/claude-opus-5-5</code>   | 4.62s   | 100.00      | 0.00%  | 0.00%  | 4.62s           | $0.0203        |
| 8    | <code>anthropic/claude-sonnet-5-5</code> | 4.70s   | 100.00      | 0.00%  | 0.00%  | 4.70s           | $0.0102        |
| 9    | <code>gemini/gemini-3.8-flash</code>     | 115.99s | 100.00      | 0.00%  | 0.00%  | 115.99s         | $0.0025        |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-fable-5</code>    | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 4.08s           | $0.0513        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 1.61s           | $0.0005        |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 4.62s           | $0.0203        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 4.70s           | $0.0102        |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 115.99s         | $0.0025        |
| 6    | <code>grok/grok-4.7</code>               | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 2.68s           | $0.0088        |
| 7    | <code>openai/gpt-6-luna</code>           | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 2.74s           | $0.0004        |
| 8    | <code>openai/gpt-6.1-sol</code>          | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 3.97s           | $0.0081        |
| 9    | <code>mistral/mistral-ocr-4-1</code>     | 70.00/100 quality score  | 70.00       | 30.00% | 21.26% | 2.00s           | $0.0040        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | -----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 82.50       | 17.50% | 6.28%  | 0.27s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 4.08s           | $0.0513        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 1.61s           | $0.0005        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 4.62s           | $0.0203        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 4.70s           | $0.0102        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 115.99s         | $0.0025        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 2.68s           | $0.0088        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 70.00       | 30.00% | 21.26% | 2.00s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 2.74s           | $0.0004        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 3.97s           | $0.0081        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 5             | 1         | 1          | 40         |
| <code>anthropic/claude-fable-5</code>    | 0             | 0         | 0          | 40         |
| <code>anthropic/claude-haiku-5-5</code>  | 0             | 0         | 0          | 40         |
| <code>anthropic/claude-opus-5-5</code>   | 0             | 0         | 0          | 40         |
| <code>anthropic/claude-sonnet-5-5</code> | 0             | 0         | 0          | 40         |
| <code>gemini/gemini-3.8-flash</code>     | 0             | 0         | 0          | 40         |
| <code>grok/grok-4.7</code>               | 0             | 0         | 0          | 40         |
| <code>mistral/mistral-ocr-4-1</code>     | 0             | 0         | 12         | 40         |
| <code>openai/gpt-6-luna</code>           | 0             | 0         | 0          | 40         |
| <code>openai/gpt-6.1-sol</code>          | 0             | 0         | 0          | 40         |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 82.50/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `openai/gpt-6-luna` at 0.0438¢ ($0.0004).
- Fastest local model: `tesseract/tesseract` at 0.27s.
- Fastest cloud service: `anthropic/claude-haiku-5-5` at 1.61s.

## Cost accounting

- Reported usage is valued at reviewed rates; prices include settled retry costs and retained unresolved reservations once and are not invoice-reconciled charges.
- Any settled conservative amount or retained unresolved reservation makes the price a conservative upper bound; billing uncertainty remains visible in the separate breakdown.
