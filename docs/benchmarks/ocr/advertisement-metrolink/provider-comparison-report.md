# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-category-d-run/benchmark-runs/advertisement-metrolink`
- Publisher canonical reference: `canonical-reference.txt`.
- Primary region accuracy: unavailable. Primary word-region recognition/localization accuracy is unavailable: outputs contain text without coordinates, and the publisher annotations are not an exhaustive full-image transcription. Text presence can match incidental duplicates outside annotated regions.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Annotated-token coverage and ordered-reference WER/CER are secondary diagnostics; they are not primary accuracy scores.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- Publisher word-region text is independently supplied. Its reviewed order is a derived convention, and it is not exhaustive full-image gold.
- Reference SHA-256: `cc2b69c23819fcbd8584776bb874e0483b6d3eb0317c2a85ff90f4c2b50342d6`.
- Publisher source: https://dl.fbaipublicfiles.com/textvqa/data/textocr/TextOCR_0.1_train.json (revision `v0.1; annotation S3 version nOSHBYLvXX4J7TUWv5Esml0IYeU3I3az`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Primary Quality Score values are unavailable for this partial-reference/text-only protocol; price and speed remain measurable.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | n/a | n/a | n/a | 0.08s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.08s | n/a | n/a | n/a | 0.08s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | n/a | n/a | n/a | n/a | 0.08s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0001 | n/a | n/a | n/a | 5.69s | $0.0001 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0001 | n/a | n/a | n/a | 1.74s | $0.0001 |
| 3 | <code>openai/gpt-6-luna</code> | $0.0002 | n/a | n/a | n/a | 3.37s | $0.0002 |
| 4 | <code>anthropic/claude-haiku-5-5</code> | $0.0002 | n/a | n/a | n/a | 1.55s | $0.0002 |
| 5 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0004 | n/a | n/a | n/a | 2.86s | $0.0004 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0007 | n/a | n/a | n/a | 1.34s | $0.0007 |
| 7 | <code>gemini/gemini-3.6-flash</code> | $0.0028 | n/a | n/a | n/a | 1.57s | $0.0028 |
| 8 | <code>gemini/gemini-3.8-flash</code> | $0.0029 | n/a | n/a | n/a | 3.33s | $0.0029 |
| 9 | <code>gemini/gemini-3.5-flash</code> | $0.0032 | n/a | n/a | n/a | 1.61s | $0.0032 |
| 10 | <code>openai/gpt-6.1-sol</code> | $0.0038 | n/a | n/a | n/a | 8.62s | $0.0038 |
| 11 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | n/a | n/a | n/a | 1.46s | $0.0040 |
| 12 | <code>openai/gpt-5.6-terra</code> | $0.0045 | n/a | n/a | n/a | 3.42s | $0.0045 |
| 13 | <code>anthropic/claude-sonnet-5-5</code> | $0.0048 | n/a | n/a | n/a | 2.52s | $0.0048 |
| 14 | <code>grok/grok-4.5</code> | $0.0052 | n/a | n/a | n/a | 5.28s | $0.0052 |
| 15 | <code>grok/grok-4.7</code> | $0.0081 | n/a | n/a | n/a | 6.96s | $0.0081 |
| 16 | <code>gemini/gemini-4-argon</code> | $0.0091 | n/a | n/a | n/a | 5.97s | $0.0091 |
| 17 | <code>anthropic/claude-opus-5-5</code> | $0.0095 | n/a | n/a | n/a | 4.46s | $0.0095 |
| 18 | <code>openai/gpt-6-astra</code> | $0.0127 | n/a | n/a | n/a | 2.52s | $0.0127 |
| 19 | <code>anthropic/claude-fable-5</code> | $0.0238 | n/a | n/a | n/a | 4.22s | $0.0238 |
| 20 | <code>anthropic/claude-fable-5-1</code> | $0.0238 | n/a | n/a | n/a | 2.71s | $0.0238 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 1.34s | n/a | n/a | n/a | 1.34s | $0.0007 |
| 2 | <code>mistral/mistral-ocr-4-1</code> | 1.46s | n/a | n/a | n/a | 1.46s | $0.0040 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 1.55s | n/a | n/a | n/a | 1.55s | $0.0002 |
| 4 | <code>gemini/gemini-3.6-flash</code> | 1.57s | n/a | n/a | n/a | 1.57s | $0.0028 |
| 5 | <code>gemini/gemini-3.5-flash</code> | 1.61s | n/a | n/a | n/a | 1.61s | $0.0032 |
| 6 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 1.74s | n/a | n/a | n/a | 1.74s | $0.0001 |
| 7 | <code>openai/gpt-6-astra</code> | 2.52s | n/a | n/a | n/a | 2.52s | $0.0127 |
| 8 | <code>anthropic/claude-sonnet-5-5</code> | 2.52s | n/a | n/a | n/a | 2.52s | $0.0048 |
| 9 | <code>anthropic/claude-fable-5-1</code> | 2.71s | n/a | n/a | n/a | 2.71s | $0.0238 |
| 10 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 2.86s | n/a | n/a | n/a | 2.86s | $0.0004 |
| 11 | <code>gemini/gemini-3.8-flash</code> | 3.33s | n/a | n/a | n/a | 3.33s | $0.0029 |
| 12 | <code>openai/gpt-6-luna</code> | 3.37s | n/a | n/a | n/a | 3.37s | $0.0002 |
| 13 | <code>openai/gpt-5.6-terra</code> | 3.42s | n/a | n/a | n/a | 3.42s | $0.0045 |
| 14 | <code>anthropic/claude-fable-5</code> | 4.22s | n/a | n/a | n/a | 4.22s | $0.0238 |
| 15 | <code>anthropic/claude-opus-5-5</code> | 4.46s | n/a | n/a | n/a | 4.46s | $0.0095 |
| 16 | <code>grok/grok-4.5</code> | 5.28s | n/a | n/a | n/a | 5.28s | $0.0052 |
| 17 | <code>deepinfra/google/gemma-4-31B-it</code> | 5.69s | n/a | n/a | n/a | 5.69s | $0.0001 |
| 18 | <code>gemini/gemini-4-argon</code> | 5.97s | n/a | n/a | n/a | 5.97s | $0.0091 |
| 19 | <code>grok/grok-4.7</code> | 6.96s | n/a | n/a | n/a | 6.96s | $0.0081 |
| 20 | <code>openai/gpt-6.1-sol</code> | 8.62s | n/a | n/a | n/a | 8.62s | $0.0038 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | n/a | n/a | n/a | n/a | 4.22s | $0.0238 |
| 2 | <code>anthropic/claude-fable-5-1</code> | n/a | n/a | n/a | n/a | 2.71s | $0.0238 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | n/a | n/a | n/a | n/a | 1.55s | $0.0002 |
| 4 | <code>anthropic/claude-opus-5-5</code> | n/a | n/a | n/a | n/a | 4.46s | $0.0095 |
| 5 | <code>anthropic/claude-sonnet-5-5</code> | n/a | n/a | n/a | n/a | 2.52s | $0.0048 |
| 6 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | n/a | n/a | n/a | n/a | 1.74s | $0.0001 |
| 7 | <code>deepinfra/google/gemma-4-31B-it</code> | n/a | n/a | n/a | n/a | 5.69s | $0.0001 |
| 8 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | n/a | n/a | n/a | n/a | 2.86s | $0.0004 |
| 9 | <code>gemini/gemini-3.5-flash</code> | n/a | n/a | n/a | n/a | 1.61s | $0.0032 |
| 10 | <code>gemini/gemini-3.5-flash-lite</code> | n/a | n/a | n/a | n/a | 1.34s | $0.0007 |
| 11 | <code>gemini/gemini-3.6-flash</code> | n/a | n/a | n/a | n/a | 1.57s | $0.0028 |
| 12 | <code>gemini/gemini-3.8-flash</code> | n/a | n/a | n/a | n/a | 3.33s | $0.0029 |
| 13 | <code>gemini/gemini-4-argon</code> | n/a | n/a | n/a | n/a | 5.97s | $0.0091 |
| 14 | <code>grok/grok-4.5</code> | n/a | n/a | n/a | n/a | 5.28s | $0.0052 |
| 15 | <code>grok/grok-4.7</code> | n/a | n/a | n/a | n/a | 6.96s | $0.0081 |
| 16 | <code>mistral/mistral-ocr-4-1</code> | n/a | n/a | n/a | n/a | 1.46s | $0.0040 |
| 17 | <code>openai/gpt-5.6-terra</code> | n/a | n/a | n/a | n/a | 3.42s | $0.0045 |
| 18 | <code>openai/gpt-6-astra</code> | n/a | n/a | n/a | n/a | 2.52s | $0.0127 |
| 19 | <code>openai/gpt-6-luna</code> | n/a | n/a | n/a | n/a | 3.37s | $0.0002 |
| 20 | <code>openai/gpt-6.1-sol</code> | n/a | n/a | n/a | n/a | 8.62s | $0.0038 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | n/a | n/a | n/a | 0.08s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | n/a | n/a | n/a | 4.22s | $0.0238 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | n/a | n/a | n/a | 2.71s | $0.0238 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | n/a | n/a | n/a | 1.55s | $0.0002 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | n/a | n/a | n/a | 4.46s | $0.0095 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | n/a | n/a | n/a | 2.52s | $0.0048 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | n/a | n/a | n/a | 1.74s | $0.0001 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | n/a | n/a | n/a | 5.69s | $0.0001 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | n/a | n/a | n/a | 2.86s | $0.0004 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | n/a | n/a | n/a | 1.61s | $0.0032 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | n/a | n/a | n/a | 1.34s | $0.0007 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | n/a | n/a | n/a | 1.57s | $0.0028 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | n/a | n/a | n/a | 3.33s | $0.0029 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | n/a | n/a | n/a | 5.97s | $0.0091 |
| <code>grok/grok-4.5</code> | Third-Party Service | n/a | n/a | n/a | 5.28s | $0.0052 |
| <code>grok/grok-4.7</code> | Third-Party Service | n/a | n/a | n/a | 6.96s | $0.0081 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | n/a | n/a | n/a | 1.46s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | n/a | n/a | n/a | 3.42s | $0.0045 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | n/a | n/a | n/a | 2.52s | $0.0127 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | n/a | n/a | n/a | 3.37s | $0.0002 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | n/a | n/a | n/a | 8.62s | $0.0038 |

## Primary region accuracy unavailable

Primary word-region recognition/localization accuracy is unavailable: outputs contain text without coordinates, and the publisher annotations are not an exhaustive full-image transcription. Text presence can match incidental duplicates outside annotated regions.


## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0110¢ ($0.0001).
- Fastest local model: `tesseract/tesseract` at 0.08s.
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 1.34s.

## Annotated-token coverage diagnostic

Primary word-region recognition/localization accuracy is unavailable: outputs contain text without coordinates, and the publisher annotations are not an exhaustive full-image transcription. Text presence can match incidental duplicates outside annotated regions.

Unmatched output can be valid unannotated image text; the counts below are not false-positive counts. Duplicate targets count separately under the declared lexical normalization. These unranked text-presence diagnostics do not establish where a word was read.

| Provider                                    | Annotated-token coverage | Matched / reference | Missing tokens | Unmatched output tokens |
| ------------------------------------------- | ------------------------ | ------------------- | -------------- | ----------------------- |
| `tesseract/tesseract`                       | 0.00%                    | 0 / 64              | 64             | 0                       |
| `mistral/mistral-ocr-4-1`                   | 98.44%                   | 63 / 64             | 1              | 6                       |
| `openai/gpt-6.1-sol`                        | 98.44%                   | 63 / 64             | 1              | 0                       |
| `openai/gpt-6-luna`                         | 98.44%                   | 63 / 64             | 1              | 0                       |
| `openai/gpt-6-astra`                        | 98.44%                   | 63 / 64             | 1              | 0                       |
| `openai/gpt-5.6-terra`                      | 98.44%                   | 63 / 64             | 1              | 0                       |
| `grok/grok-4.7`                             | 98.44%                   | 63 / 64             | 1              | 0                       |
| `grok/grok-4.5`                             | 98.44%                   | 63 / 64             | 1              | 0                       |
| `anthropic/claude-opus-5-5`                 | 98.44%                   | 63 / 64             | 1              | 0                       |
| `anthropic/claude-sonnet-5-5`               | 98.44%                   | 63 / 64             | 1              | 0                       |
| `anthropic/claude-haiku-5-5`                | 98.44%                   | 63 / 64             | 1              | 0                       |
| `anthropic/claude-fable-5-1`                | 98.44%                   | 63 / 64             | 1              | 0                       |
| `anthropic/claude-fable-5`                  | 98.44%                   | 63 / 64             | 1              | 0                       |
| `gemini/gemini-4-argon`                     | 98.44%                   | 63 / 64             | 1              | 2                       |
| `gemini/gemini-3.8-flash`                   | 100.00%                  | 64 / 64             | 0              | 0                       |
| `gemini/gemini-3.5-flash`                   | 98.44%                   | 63 / 64             | 1              | 0                       |
| `gemini/gemini-3.6-flash`                   | 98.44%                   | 63 / 64             | 1              | 2                       |
| `gemini/gemini-3.5-flash-lite`              | 98.44%                   | 63 / 64             | 1              | 0                       |
| `deepinfra/google/gemma-4-31B-it`           | 98.44%                   | 63 / 64             | 1              | 0                       |
| `deepinfra/Qwen/Qwen3.8-27B`                | 98.44%                   | 63 / 64             | 1              | 0                       |
| `deepinfra/deepseek-ai/DeepSeek-V4.1-Flash` | 98.44%                   | 63 / 64             | 1              | 0                       |

[Evaluation policy and secondary ordered-text diagnostics](evaluation-diagnostics.json).

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- Every provider received the same full original JPEG. No gold words or annotation coordinates were sent to providers. Text-only outputs do not establish word-region localization or full-image exhaustive accuracy.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Primary word-region recognition/localization accuracy is unavailable: outputs contain text without coordinates, and the publisher annotations are not an exhaustive full-image transcription. Text presence can match incidental duplicates outside annotated regions.
