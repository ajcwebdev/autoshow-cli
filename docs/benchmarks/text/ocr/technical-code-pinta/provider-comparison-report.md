# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-bc-run/benchmark-runs/technical-code-pinta`
- Publisher canonical reference: `technical-code-pinta.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `594a74666cb9a0d692cdfdec50ea6e63996243d7a7a839e5987c18cfc71830f3`.
- Publisher source: https://zenodo.org/records/3743394/files/replication.zip?download=1 (revision `Zenodo 3743394, published archive MD5 48c44b34e47ee02b0fec281f86393e48`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 90.14       | 9.86% | 1.30% | 0.29s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.29s | 90.14       | 9.86% | 1.30% | 0.29s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 90.14/100 quality score | 90.14       | 9.86% | 1.30% | 0.29s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0005 | 100.00      | 0.00% | 0.00% | 2.50s           | $0.0005        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0005 | 100.00      | 0.00% | 0.00% | 9.00s           | $0.0005        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 100.00      | 0.00% | 0.00% | 1.17s           | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0045 | 100.00      | 0.00% | 0.00% | 101.32s         | $0.0045        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0062 | 100.00      | 0.00% | 0.00% | 5.81s           | $0.0062        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0095 | 100.00      | 0.00% | 0.00% | 4.04s           | $0.0095        |
| 7    | <code>grok/grok-4.7</code>               | $0.0120 | 100.00      | 0.00% | 0.00% | 7.96s           | $0.0120        |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.0190 | 100.00      | 0.00% | 0.00% | 5.71s           | $0.0190        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0474 | 100.00      | 0.00% | 0.00% | 6.86s           | $0.0474        |

#### Speed

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 1.17s   | 100.00      | 0.00% | 0.00% | 1.17s           | $0.0040        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 2.50s   | 100.00      | 0.00% | 0.00% | 2.50s           | $0.0005        |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 4.04s   | 100.00      | 0.00% | 0.00% | 4.04s           | $0.0095        |
| 4    | <code>anthropic/claude-opus-5-5</code>   | 5.71s   | 100.00      | 0.00% | 0.00% | 5.71s           | $0.0190        |
| 5    | <code>openai/gpt-6.1-sol</code>          | 5.81s   | 100.00      | 0.00% | 0.00% | 5.81s           | $0.0062        |
| 6    | <code>anthropic/claude-fable-5</code>    | 6.86s   | 100.00      | 0.00% | 0.00% | 6.86s           | $0.0474        |
| 7    | <code>grok/grok-4.7</code>               | 7.96s   | 100.00      | 0.00% | 0.00% | 7.96s           | $0.0120        |
| 8    | <code>openai/gpt-6-luna</code>           | 9.00s   | 100.00      | 0.00% | 0.00% | 9.00s           | $0.0005        |
| 9    | <code>gemini/gemini-3.8-flash</code>     | 101.32s | 100.00      | 0.00% | 0.00% | 101.32s         | $0.0045        |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-fable-5</code>    | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 6.86s           | $0.0474        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.50s           | $0.0005        |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 5.71s           | $0.0190        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 4.04s           | $0.0095        |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 101.32s         | $0.0045        |
| 6    | <code>grok/grok-4.7</code>               | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 7.96s           | $0.0120        |
| 7    | <code>mistral/mistral-ocr-4-1</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 1.17s           | $0.0040        |
| 8    | <code>openai/gpt-6-luna</code>           | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 9.00s           | $0.0005        |
| 9    | <code>openai/gpt-6.1-sol</code>          | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 5.81s           | $0.0062        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | ----: | ----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 90.14       | 9.86% | 1.30% | 0.29s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 100.00      | 0.00% | 0.00% | 6.86s           | $0.0474        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 100.00      | 0.00% | 0.00% | 2.50s           | $0.0005        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 100.00      | 0.00% | 0.00% | 5.71s           | $0.0190        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00      | 0.00% | 0.00% | 4.04s           | $0.0095        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 100.00      | 0.00% | 0.00% | 101.32s         | $0.0045        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 100.00      | 0.00% | 0.00% | 7.96s           | $0.0120        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 100.00      | 0.00% | 0.00% | 1.17s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 100.00      | 0.00% | 0.00% | 9.00s           | $0.0005        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 100.00      | 0.00% | 0.00% | 5.81s           | $0.0062        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 11            | 0         | 3          | 142        |
| <code>anthropic/claude-fable-5</code>    | 0             | 0         | 0          | 142        |
| <code>anthropic/claude-haiku-5-5</code>  | 0             | 0         | 0          | 142        |
| <code>anthropic/claude-opus-5-5</code>   | 0             | 0         | 0          | 142        |
| <code>anthropic/claude-sonnet-5-5</code> | 0             | 0         | 0          | 142        |
| <code>gemini/gemini-3.8-flash</code>     | 0             | 0         | 0          | 142        |
| <code>grok/grok-4.7</code>               | 0             | 0         | 0          | 142        |
| <code>mistral/mistral-ocr-4-1</code>     | 0             | 0         | 0          | 142        |
| <code>openai/gpt-6-luna</code>           | 0             | 0         | 0          | 142        |
| <code>openai/gpt-6.1-sol</code>          | 0             | 0         | 0          | 142        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 90.14/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.0476¢ ($0.0005).
- Fastest local model: `tesseract/tesseract` at 0.29s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 1.17s.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- The protocol uses pinned page PNGs for every provider, including rendered baseline PDFs. Archived original runs remain separate.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental fidelity-metrics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
