# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-category-d-run/benchmark-runs/advertisement-nyc-skate`
- Publisher canonical reference: `canonical-reference.txt`.
- Primary region accuracy: unavailable. Primary word-region recognition/localization accuracy is unavailable: outputs contain text without coordinates, and the publisher annotations are not an exhaustive full-image transcription. Text presence can match incidental duplicates outside annotated regions.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Annotated-token coverage and ordered-reference WER/CER are secondary diagnostics; they are not primary accuracy scores.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- Publisher word-region text is independently supplied. Its reviewed order is a derived convention, and it is not exhaustive full-image gold.
- Reference SHA-256: `6773129d25d7a7b1d87885ae9e6911bad534240f565fb6f4af891703ce138963`.
- Publisher source: https://dl.fbaipublicfiles.com/textvqa/data/textocr/TextOCR_0.1_train.json (revision `v0.1; annotation S3 version nOSHBYLvXX4J7TUWv5Esml0IYeU3I3az`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Primary Quality Score values are unavailable for this partial-reference/text-only protocol; price and speed remain measurable.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | n/a | n/a | n/a | 0.24s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.24s | n/a | n/a | n/a | 0.24s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | n/a | n/a | n/a | n/a | 0.24s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0001 | n/a | n/a | n/a | 4.23s | $0.0001 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0002 | n/a | n/a | n/a | 1.95s | $0.0002 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0003 | n/a | n/a | n/a | 1.84s | $0.0003 |
| 4 | <code>openai/gpt-6-luna</code> | $0.0004 | n/a | n/a | n/a | 4.26s | $0.0004 |
| 5 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0005 | n/a | n/a | n/a | 5.62s | $0.0005 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0007 | n/a | n/a | n/a | 1.46s | $0.0007 |
| 7 | <code>gemini/gemini-3.6-flash</code> | $0.0028 | n/a | n/a | n/a | 1.76s | $0.0028 |
| 8 | <code>gemini/gemini-3.8-flash</code> | $0.0028 | n/a | n/a | n/a | 3.42s | $0.0028 |
| 9 | <code>gemini/gemini-3.5-flash</code> | $0.0030 | n/a | n/a | n/a | 1.83s | $0.0030 |
| 10 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | n/a | n/a | n/a | 1.86s | $0.0040 |
| 11 | <code>openai/gpt-5.6-terra</code> | $0.0046 | n/a | n/a | n/a | 2.59s | $0.0046 |
| 12 | <code>openai/gpt-6.1-sol</code> | $0.0050 | n/a | n/a | n/a | 4.50s | $0.0050 |
| 13 | <code>grok/grok-4.5</code> | $0.0058 | n/a | n/a | n/a | 5.18s | $0.0058 |
| 14 | <code>anthropic/claude-sonnet-5-5</code> | $0.0061 | n/a | n/a | n/a | 2.41s | $0.0061 |
| 15 | <code>grok/grok-4.7</code> | $0.0067 | n/a | n/a | n/a | 3.32s | $0.0067 |
| 16 | <code>gemini/gemini-4-argon</code> | $0.0083 | n/a | n/a | n/a | 12.49s | $0.0083 |
| 17 | <code>anthropic/claude-opus-5-5</code> | $0.0121 | n/a | n/a | n/a | 4.05s | $0.0121 |
| 18 | <code>openai/gpt-6-astra</code> | $0.0219 | n/a | n/a | n/a | 2.58s | $0.0219 |
| 19 | <code>anthropic/claude-fable-5</code> | $0.0304 | n/a | n/a | n/a | 4.71s | $0.0304 |
| 20 | <code>anthropic/claude-fable-5-1</code> | $0.0304 | n/a | n/a | n/a | 6.26s | $0.0304 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 1.46s | n/a | n/a | n/a | 1.46s | $0.0007 |
| 2 | <code>gemini/gemini-3.6-flash</code> | 1.76s | n/a | n/a | n/a | 1.76s | $0.0028 |
| 3 | <code>gemini/gemini-3.5-flash</code> | 1.83s | n/a | n/a | n/a | 1.83s | $0.0030 |
| 4 | <code>anthropic/claude-haiku-5-5</code> | 1.84s | n/a | n/a | n/a | 1.84s | $0.0003 |
| 5 | <code>mistral/mistral-ocr-4-1</code> | 1.86s | n/a | n/a | n/a | 1.86s | $0.0040 |
| 6 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 1.95s | n/a | n/a | n/a | 1.95s | $0.0002 |
| 7 | <code>anthropic/claude-sonnet-5-5</code> | 2.41s | n/a | n/a | n/a | 2.41s | $0.0061 |
| 8 | <code>openai/gpt-6-astra</code> | 2.58s | n/a | n/a | n/a | 2.58s | $0.0219 |
| 9 | <code>openai/gpt-5.6-terra</code> | 2.59s | n/a | n/a | n/a | 2.59s | $0.0046 |
| 10 | <code>grok/grok-4.7</code> | 3.32s | n/a | n/a | n/a | 3.32s | $0.0067 |
| 11 | <code>gemini/gemini-3.8-flash</code> | 3.42s | n/a | n/a | n/a | 3.42s | $0.0028 |
| 12 | <code>anthropic/claude-opus-5-5</code> | 4.05s | n/a | n/a | n/a | 4.05s | $0.0121 |
| 13 | <code>deepinfra/google/gemma-4-31B-it</code> | 4.23s | n/a | n/a | n/a | 4.23s | $0.0001 |
| 14 | <code>openai/gpt-6-luna</code> | 4.26s | n/a | n/a | n/a | 4.26s | $0.0004 |
| 15 | <code>openai/gpt-6.1-sol</code> | 4.50s | n/a | n/a | n/a | 4.50s | $0.0050 |
| 16 | <code>anthropic/claude-fable-5</code> | 4.71s | n/a | n/a | n/a | 4.71s | $0.0304 |
| 17 | <code>grok/grok-4.5</code> | 5.18s | n/a | n/a | n/a | 5.18s | $0.0058 |
| 18 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 5.62s | n/a | n/a | n/a | 5.62s | $0.0005 |
| 19 | <code>anthropic/claude-fable-5-1</code> | 6.26s | n/a | n/a | n/a | 6.26s | $0.0304 |
| 20 | <code>gemini/gemini-4-argon</code> | 12.49s | n/a | n/a | n/a | 12.49s | $0.0083 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | n/a | n/a | n/a | n/a | 4.71s | $0.0304 |
| 2 | <code>anthropic/claude-fable-5-1</code> | n/a | n/a | n/a | n/a | 6.26s | $0.0304 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | n/a | n/a | n/a | n/a | 1.84s | $0.0003 |
| 4 | <code>anthropic/claude-opus-5-5</code> | n/a | n/a | n/a | n/a | 4.05s | $0.0121 |
| 5 | <code>anthropic/claude-sonnet-5-5</code> | n/a | n/a | n/a | n/a | 2.41s | $0.0061 |
| 6 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | n/a | n/a | n/a | n/a | 1.95s | $0.0002 |
| 7 | <code>deepinfra/google/gemma-4-31B-it</code> | n/a | n/a | n/a | n/a | 4.23s | $0.0001 |
| 8 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | n/a | n/a | n/a | n/a | 5.62s | $0.0005 |
| 9 | <code>gemini/gemini-3.5-flash</code> | n/a | n/a | n/a | n/a | 1.83s | $0.0030 |
| 10 | <code>gemini/gemini-3.5-flash-lite</code> | n/a | n/a | n/a | n/a | 1.46s | $0.0007 |
| 11 | <code>gemini/gemini-3.6-flash</code> | n/a | n/a | n/a | n/a | 1.76s | $0.0028 |
| 12 | <code>gemini/gemini-3.8-flash</code> | n/a | n/a | n/a | n/a | 3.42s | $0.0028 |
| 13 | <code>gemini/gemini-4-argon</code> | n/a | n/a | n/a | n/a | 12.49s | $0.0083 |
| 14 | <code>grok/grok-4.5</code> | n/a | n/a | n/a | n/a | 5.18s | $0.0058 |
| 15 | <code>grok/grok-4.7</code> | n/a | n/a | n/a | n/a | 3.32s | $0.0067 |
| 16 | <code>mistral/mistral-ocr-4-1</code> | n/a | n/a | n/a | n/a | 1.86s | $0.0040 |
| 17 | <code>openai/gpt-5.6-terra</code> | n/a | n/a | n/a | n/a | 2.59s | $0.0046 |
| 18 | <code>openai/gpt-6-astra</code> | n/a | n/a | n/a | n/a | 2.58s | $0.0219 |
| 19 | <code>openai/gpt-6-luna</code> | n/a | n/a | n/a | n/a | 4.26s | $0.0004 |
| 20 | <code>openai/gpt-6.1-sol</code> | n/a | n/a | n/a | n/a | 4.50s | $0.0050 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | n/a | n/a | n/a | 0.24s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | n/a | n/a | n/a | 4.71s | $0.0304 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | n/a | n/a | n/a | 6.26s | $0.0304 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | n/a | n/a | n/a | 1.84s | $0.0003 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | n/a | n/a | n/a | 4.05s | $0.0121 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | n/a | n/a | n/a | 2.41s | $0.0061 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | n/a | n/a | n/a | 1.95s | $0.0002 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | n/a | n/a | n/a | 4.23s | $0.0001 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | n/a | n/a | n/a | 5.62s | $0.0005 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | n/a | n/a | n/a | 1.83s | $0.0030 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | n/a | n/a | n/a | 1.46s | $0.0007 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | n/a | n/a | n/a | 1.76s | $0.0028 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | n/a | n/a | n/a | 3.42s | $0.0028 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | n/a | n/a | n/a | 12.49s | $0.0083 |
| <code>grok/grok-4.5</code> | Third-Party Service | n/a | n/a | n/a | 5.18s | $0.0058 |
| <code>grok/grok-4.7</code> | Third-Party Service | n/a | n/a | n/a | 3.32s | $0.0067 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | n/a | n/a | n/a | 1.86s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | n/a | n/a | n/a | 2.59s | $0.0046 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | n/a | n/a | n/a | 2.58s | $0.0219 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | n/a | n/a | n/a | 4.26s | $0.0004 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | n/a | n/a | n/a | 4.50s | $0.0050 |

## Primary region accuracy unavailable

Primary word-region recognition/localization accuracy is unavailable: outputs contain text without coordinates, and the publisher annotations are not an exhaustive full-image transcription. Text presence can match incidental duplicates outside annotated regions.


## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0113¢ ($0.0001).
- Fastest local model: `tesseract/tesseract` at 0.24s.
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 1.46s.

## Annotated-token coverage diagnostic

Primary word-region recognition/localization accuracy is unavailable: outputs contain text without coordinates, and the publisher annotations are not an exhaustive full-image transcription. Text presence can match incidental duplicates outside annotated regions.

Unmatched output can be valid unannotated image text; the counts below are not false-positive counts. Duplicate targets count separately under the declared lexical normalization. These unranked text-presence diagnostics do not establish where a word was read.

| Provider                                    | Annotated-token coverage | Matched / reference | Missing tokens | Unmatched output tokens |
| ------------------------------------------- | ------------------------ | ------------------- | -------------- | ----------------------- |
| `tesseract/tesseract`                       | 61.97%                   | 44 / 71             | 27             | 4                       |
| `mistral/mistral-ocr-4-1`                   | 98.59%                   | 70 / 71             | 1              | 0                       |
| `openai/gpt-6.1-sol`                        | 100.00%                  | 71 / 71             | 0              | 0                       |
| `openai/gpt-6-luna`                         | 100.00%                  | 71 / 71             | 0              | 0                       |
| `openai/gpt-6-astra`                        | 100.00%                  | 71 / 71             | 0              | 0                       |
| `openai/gpt-5.6-terra`                      | 100.00%                  | 71 / 71             | 0              | 0                       |
| `grok/grok-4.7`                             | 100.00%                  | 71 / 71             | 0              | 0                       |
| `grok/grok-4.5`                             | 100.00%                  | 71 / 71             | 0              | 0                       |
| `anthropic/claude-opus-5-5`                 | 100.00%                  | 71 / 71             | 0              | 0                       |
| `anthropic/claude-sonnet-5-5`               | 100.00%                  | 71 / 71             | 0              | 0                       |
| `anthropic/claude-haiku-5-5`                | 100.00%                  | 71 / 71             | 0              | 0                       |
| `anthropic/claude-fable-5-1`                | 100.00%                  | 71 / 71             | 0              | 0                       |
| `anthropic/claude-fable-5`                  | 100.00%                  | 71 / 71             | 0              | 0                       |
| `gemini/gemini-4-argon`                     | 100.00%                  | 71 / 71             | 0              | 0                       |
| `gemini/gemini-3.8-flash`                   | 100.00%                  | 71 / 71             | 0              | 0                       |
| `gemini/gemini-3.5-flash`                   | 100.00%                  | 71 / 71             | 0              | 0                       |
| `gemini/gemini-3.6-flash`                   | 100.00%                  | 71 / 71             | 0              | 0                       |
| `gemini/gemini-3.5-flash-lite`              | 100.00%                  | 71 / 71             | 0              | 0                       |
| `deepinfra/google/gemma-4-31B-it`           | 100.00%                  | 71 / 71             | 0              | 0                       |
| `deepinfra/Qwen/Qwen3.8-27B`                | 100.00%                  | 71 / 71             | 0              | 0                       |
| `deepinfra/deepseek-ai/DeepSeek-V4.1-Flash` | 100.00%                  | 71 / 71             | 0              | 0                       |

[Evaluation policy and secondary ordered-text diagnostics](evaluation-diagnostics.json).

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- Every provider received the same full original JPEG. No gold words or annotation coordinates were sent to providers. Text-only outputs do not establish word-region localization or full-image exhaustive accuracy.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Primary word-region recognition/localization accuracy is unavailable: outputs contain text without coordinates, and the publisher annotations are not an exhaustive full-image transcription. Text presence can match incidental duplicates outside annotated regions.
