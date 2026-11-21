# Combined STT Provider Comparison Report

## Summary

- Root directory: `docs/benchmarks/stt/without-speakers`
- Runs aggregated: 4
  - `1-audio` (14 providers)
  - `2022-09-30-widgets-fsjam-40-minutes` (14 providers)
  - `2023-03-15-jsjam-qwik-misko-hevery` (14 providers)
  - `2023-04-05-jsjam-react-miami-2023-10-minutes` (14 providers)
- Distinct providers: 14 (0 local, 14 third-party non-diarization, 0 third-party diarization)
- Quality score aggregates the per-run speaker-aware WER-derived score as a mean across runs; price and speed aggregate per-run cost and processing time as means.

## Method

- Providers are matched by `providerKey` and aggregated across the runs they appear in.
- Means are taken over present values only; a provider missing a value in some runs is averaged over the runs where it is present.
- Price rankings use mean per-run monetary cost ascending, local providers at zero, missing cost last.
- Speed rankings use mean processing time ascending, missing timing last.
- Quality Score rankings use the mean neutral speaker-aware WER-derived score descending (scoring version 2); legacy (scoring version 1) means are retained as columns.
- Tied ranking values break deterministically: price ties by quality descending then provider key; speed and quality ties by provider key.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Mean Legacy Score / 100 | Mean Legacy Speaker-aware WER | Diarization | Mean Speed | Throughput | Mean Cost                   |
| ---: | -------- | ----: | ---: | ---------------: | ---------------------: | -----------------: | ----------------------: | ----------------------------: | ----------- | ---------: | ---------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a  | n/a              | n/a                    | n/a                | n/a                     | n/a                           | n/a         | n/a        | n/a        | No providers in this group. |

#### Speed

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Mean Legacy Score / 100 | Mean Legacy Speaker-aware WER | Diarization | Mean Speed | Throughput | Mean Cost                   |
| ---: | -------- | ----: | ---: | ---------------: | ---------------------: | -----------------: | ----------------------: | ----------------------------: | ----------- | ---------: | ---------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a  | n/a              | n/a                    | n/a                | n/a                     | n/a                           | n/a         | n/a        | n/a        | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Mean Legacy Score / 100 | Mean Legacy Speaker-aware WER | Diarization | Mean Speed | Throughput | Mean Cost                   |
| ---: | -------- | ----: | ---: | ---------------: | ---------------------: | -----------------: | ----------------------: | ----------------------------: | ----------- | ---------: | ---------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a  | n/a              | n/a                    | n/a                | n/a                     | n/a                           | n/a         | n/a        | n/a        | No providers in this group. |

### Third-Party Service Non-Diarization

#### Price

| Rank | Provider                                                                   | Value   | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Mean Legacy Score / 100 | Mean Legacy Speaker-aware WER | Diarization   | Mean Speed | Throughput | Mean Cost |
| ---: | -------------------------------------------------------------------------- | ------: | ---: | ---------------: | ---------------------: | -----------------: | ----------------------: | ----------------------------: | ------------- | ---------: | ---------: | --------: |
| 1    | <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | $0.0003 | 4    | 83.42            | 16.58%                 | 15.71%             | 81.78                   | 18.22%                        | not-supported | 175.63s    | 14.03×     | $0.0003   |
| 2    | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | $0.0082 | 4    | 95.64            | 4.36%                  | 3.34%              | 94.20                   | 5.80%                         | not-supported | 58.07s     | 42.43×     | $0.0082   |
| 3    | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | $0.0082 | 4    | 93.94            | 6.06%                  | 5.06%              | 92.30                   | 7.70%                         | not-supported | 149.05s    | 16.53×     | $0.0082   |
| 4    | <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | $0.0082 | 4    | 89.95            | 10.05%                 | 9.19%              | 88.40                   | 11.60%                        | not-supported | 13.08s     | 188.41×    | $0.0082   |
| 5    | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | $0.0185 | 4    | 96.02            | 3.98%                  | 2.98%              | 94.17                   | 5.83%                         | not-supported | 51.84s     | 47.52×     | $0.0185   |
| 6    | <code>deepinfra-openai_whisper-large-v3</code>                             | $0.0185 | 4    | 91.08            | 8.92%                  | 8.01%              | 89.40                   | 10.60%                        | not-supported | 24.86s     | 99.09×     | $0.0185   |
| 7    | <code>cloudflare-@cf_openai_whisper</code>                                 | $0.0186 | 4    | 90.02            | 9.98%                  | 9.07%              | 87.06                   | 12.94%                        | not-supported | 343.36s    | 7.18×      | $0.0186   |
| 8    | <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | $0.0211 | 4    | 95.74            | 4.26%                  | 3.26%              | 93.54                   | 6.46%                         | not-supported | 191.75s    | 12.85×     | $0.0211   |
| 9    | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | $0.0411 | 4    | 96.56            | 3.44%                  | 2.41%              | 94.92                   | 5.08%                         | not-supported | 78.37s     | 31.44×     | $0.0411   |
| 10   | <code>together-openai_whisper-large-v3</code>                              | $0.0616 | 4    | 95.71            | 4.29%                  | 3.26%              | 94.00                   | 6.00%                         | not-supported | 10.84s     | 227.18×    | $0.0616   |
| 11   | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | $0.0616 | 4    | 95.65            | 4.35%                  | 3.35%              | 93.27                   | 6.73%                         | not-supported | 14.21s     | 173.32×    | $0.0616   |
| 12   | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | $0.1232 | 4    | 79.55            | 20.45%                 | 19.54%             | 78.04                   | 21.96%                        | not-supported | 283.92s    | 8.68×      | $0.1232   |
| 13   | <code>openai-stt-gpt-transcribe</code>                                     | $0.1848 | 4    | 96.51            | 3.49%                  | 2.48%              | 94.90                   | 5.10%                         | not-supported | 55.73s     | 44.21×     | $0.1848   |
| 14   | <code>cloudflare-@cf_deepgram_nova-3</code>                                | $0.2135 | 4    | 95.44            | 4.56%                  | 3.60%              | 92.63                   | 7.37%                         | not-supported | 9.37s      | 263.00×    | $0.2135   |

#### Speed

| Rank | Provider                                                                   | Value   | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Mean Legacy Score / 100 | Mean Legacy Speaker-aware WER | Diarization   | Mean Speed | Throughput | Mean Cost |
| ---: | -------------------------------------------------------------------------- | ------: | ---: | ---------------: | ---------------------: | -----------------: | ----------------------: | ----------------------------: | ------------- | ---------: | ---------: | --------: |
| 1    | <code>cloudflare-@cf_deepgram_nova-3</code>                                | 9.37s   | 4    | 95.44            | 4.56%                  | 3.60%              | 92.63                   | 7.37%                         | not-supported | 9.37s      | 263.00×    | $0.2135   |
| 2    | <code>together-openai_whisper-large-v3</code>                              | 10.84s  | 4    | 95.71            | 4.29%                  | 3.26%              | 94.00                   | 6.00%                         | not-supported | 10.84s     | 227.18×    | $0.0616   |
| 3    | <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 13.08s  | 4    | 89.95            | 10.05%                 | 9.19%              | 88.40                   | 11.60%                        | not-supported | 13.08s     | 188.41×    | $0.0082   |
| 4    | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 14.21s  | 4    | 95.65            | 4.35%                  | 3.35%              | 93.27                   | 6.73%                         | not-supported | 14.21s     | 173.32×    | $0.0616   |
| 5    | <code>deepinfra-openai_whisper-large-v3</code>                             | 24.86s  | 4    | 91.08            | 8.92%                  | 8.01%              | 89.40                   | 10.60%                        | not-supported | 24.86s     | 99.09×     | $0.0185   |
| 6    | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 51.84s  | 4    | 96.02            | 3.98%                  | 2.98%              | 94.17                   | 5.83%                         | not-supported | 51.84s     | 47.52×     | $0.0185   |
| 7    | <code>openai-stt-gpt-transcribe</code>                                     | 55.73s  | 4    | 96.51            | 3.49%                  | 2.48%              | 94.90                   | 5.10%                         | not-supported | 55.73s     | 44.21×     | $0.1848   |
| 8    | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 58.07s  | 4    | 95.64            | 4.36%                  | 3.34%              | 94.20                   | 5.80%                         | not-supported | 58.07s     | 42.43×     | $0.0082   |
| 9    | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 78.37s  | 4    | 96.56            | 3.44%                  | 2.41%              | 94.92                   | 5.08%                         | not-supported | 78.37s     | 31.44×     | $0.0411   |
| 10   | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 149.05s | 4    | 93.94            | 6.06%                  | 5.06%              | 92.30                   | 7.70%                         | not-supported | 149.05s    | 16.53×     | $0.0082   |
| 11   | <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 175.63s | 4    | 83.42            | 16.58%                 | 15.71%             | 81.78                   | 18.22%                        | not-supported | 175.63s    | 14.03×     | $0.0003   |
| 12   | <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 191.75s | 4    | 95.74            | 4.26%                  | 3.26%              | 93.54                   | 6.46%                         | not-supported | 191.75s    | 12.85×     | $0.0211   |
| 13   | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 283.92s | 4    | 79.55            | 20.45%                 | 19.54%             | 78.04                   | 21.96%                        | not-supported | 283.92s    | 8.68×      | $0.1232   |
| 14   | <code>cloudflare-@cf_openai_whisper</code>                                 | 343.36s | 4    | 90.02            | 9.98%                  | 9.07%              | 87.06                   | 12.94%                        | not-supported | 343.36s    | 7.18×      | $0.0186   |

#### Quality Score

| Rank | Provider                                                                   | Value                   | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Mean Legacy Score / 100 | Mean Legacy Speaker-aware WER | Diarization   | Mean Speed | Throughput | Mean Cost |
| ---: | -------------------------------------------------------------------------- | ----------------------: | ---: | ---------------: | ---------------------: | -----------------: | ----------------------: | ----------------------------: | ------------- | ---------: | ---------: | --------: |
| 1    | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 96.56/100 quality score | 4    | 96.56            | 3.44%                  | 2.41%              | 94.92                   | 5.08%                         | not-supported | 78.37s     | 31.44×     | $0.0411   |
| 2    | <code>openai-stt-gpt-transcribe</code>                                     | 96.51/100 quality score | 4    | 96.51            | 3.49%                  | 2.48%              | 94.90                   | 5.10%                         | not-supported | 55.73s     | 44.21×     | $0.1848   |
| 3    | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 96.02/100 quality score | 4    | 96.02            | 3.98%                  | 2.98%              | 94.17                   | 5.83%                         | not-supported | 51.84s     | 47.52×     | $0.0185   |
| 4    | <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 95.74/100 quality score | 4    | 95.74            | 4.26%                  | 3.26%              | 93.54                   | 6.46%                         | not-supported | 191.75s    | 12.85×     | $0.0211   |
| 5    | <code>together-openai_whisper-large-v3</code>                              | 95.71/100 quality score | 4    | 95.71            | 4.29%                  | 3.26%              | 94.00                   | 6.00%                         | not-supported | 10.84s     | 227.18×    | $0.0616   |
| 6    | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 95.65/100 quality score | 4    | 95.65            | 4.35%                  | 3.35%              | 93.27                   | 6.73%                         | not-supported | 14.21s     | 173.32×    | $0.0616   |
| 7    | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 95.64/100 quality score | 4    | 95.64            | 4.36%                  | 3.34%              | 94.20                   | 5.80%                         | not-supported | 58.07s     | 42.43×     | $0.0082   |
| 8    | <code>cloudflare-@cf_deepgram_nova-3</code>                                | 95.44/100 quality score | 4    | 95.44            | 4.56%                  | 3.60%              | 92.63                   | 7.37%                         | not-supported | 9.37s      | 263.00×    | $0.2135   |
| 9    | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 93.94/100 quality score | 4    | 93.94            | 6.06%                  | 5.06%              | 92.30                   | 7.70%                         | not-supported | 149.05s    | 16.53×     | $0.0082   |
| 10   | <code>deepinfra-openai_whisper-large-v3</code>                             | 91.08/100 quality score | 4    | 91.08            | 8.92%                  | 8.01%              | 89.40                   | 10.60%                        | not-supported | 24.86s     | 99.09×     | $0.0185   |
| 11   | <code>cloudflare-@cf_openai_whisper</code>                                 | 90.02/100 quality score | 4    | 90.02            | 9.98%                  | 9.07%              | 87.06                   | 12.94%                        | not-supported | 343.36s    | 7.18×      | $0.0186   |
| 12   | <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 89.95/100 quality score | 4    | 89.95            | 10.05%                 | 9.19%              | 88.40                   | 11.60%                        | not-supported | 13.08s     | 188.41×    | $0.0082   |
| 13   | <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 83.42/100 quality score | 4    | 83.42            | 16.58%                 | 15.71%             | 81.78                   | 18.22%                        | not-supported | 175.63s    | 14.03×     | $0.0003   |
| 14   | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 79.55/100 quality score | 4    | 79.55            | 20.45%                 | 19.54%             | 78.04                   | 21.96%                        | not-supported | 283.92s    | 8.68×      | $0.1232   |

### Third-Party Service Diarization

#### Price

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Mean Legacy Score / 100 | Mean Legacy Speaker-aware WER | Diarization | Mean Speed | Throughput | Mean Cost                   |
| ---: | -------- | ----: | ---: | ---------------: | ---------------------: | -----------------: | ----------------------: | ----------------------------: | ----------- | ---------: | ---------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a  | n/a              | n/a                    | n/a                | n/a                     | n/a                           | n/a         | n/a        | n/a        | No providers in this group. |

#### Speed

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Mean Legacy Score / 100 | Mean Legacy Speaker-aware WER | Diarization | Mean Speed | Throughput | Mean Cost                   |
| ---: | -------- | ----: | ---: | ---------------: | ---------------------: | -----------------: | ----------------------: | ----------------------------: | ----------- | ---------: | ---------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a  | n/a              | n/a                    | n/a                | n/a                     | n/a                           | n/a         | n/a        | n/a        | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Mean Legacy Score / 100 | Mean Legacy Speaker-aware WER | Diarization | Mean Speed | Throughput | Mean Cost                   |
| ---: | -------- | ----: | ---: | ---------------: | ---------------------: | -----------------: | ----------------------: | ----------------------------: | ----------- | ---------: | ---------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a  | n/a              | n/a                    | n/a                | n/a                     | n/a                           | n/a         | n/a        | n/a        | No providers in this group. |

## Per-Run Quality Score

Neutral speaker-aware WER-derived quality score per provider in each run, sorted by mean.

### Third-Party Service Non-Diarization

| Provider                                                                   | Mean  | 1-audio | 2022-09-30-widgets-fsjam-40-minutes | 2023-03-15-jsjam-qwik-misko-hevery | 2023-04-05-jsjam-react-miami-2023-10-minutes |
| -------------------------------------------------------------------------- | ----: | ------: | ----------------------------------: | ---------------------------------: | -------------------------------------------: |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 96.56 | 97.66   | 97.27                               | 94.53                              | 96.76                                        |
| <code>openai-stt-gpt-transcribe</code>                                     | 96.51 | 97.20   | 97.45                               | 94.38                              | 97.00                                        |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 96.02 | 97.20   | 96.78                               | 93.40                              | 96.70                                        |
| <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 95.74 | 97.20   | 96.78                               | 93.71                              | 95.26                                        |
| <code>together-openai_whisper-large-v3</code>                              | 95.71 | 97.66   | 95.37                               | 93.54                              | 96.28                                        |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 95.65 | 97.20   | 96.76                               | 92.25                              | 96.40                                        |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 95.64 | 97.20   | 96.11                               | 93.07                              | 96.16                                        |
| <code>cloudflare-@cf_deepgram_nova-3</code>                                | 95.44 | 96.26   | 96.56                               | 92.90                              | 96.04                                        |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 93.94 | 95.79   | 94.51                               | 91.88                              | 93.59                                        |
| <code>deepinfra-openai_whisper-large-v3</code>                             | 91.08 | 89.72   | 88.52                               | 90.75                              | 95.32                                        |
| <code>cloudflare-@cf_openai_whisper</code>                                 | 90.02 | 94.39   | 87.12                               | 87.13                              | 91.43                                        |
| <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 89.95 | 88.79   | 87.93                               | 91.01                              | 92.09                                        |
| <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 83.42 | 84.11   | 87.01                               | 79.04                              | 83.50                                        |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 79.55 | 97.66   | 62.35                               | 61.05                              | 97.12                                        |

## Error Attribution

Speaker-aware edit counts summed over runs: strict (legacy) edits, edits removed as each neutral view is enabled in order, the remaining headline edits, and their aligned-token classification.

| Provider                                                                   | Runs | Strict Edits | Disfluency | Orthographic | Number/Format | Neutral Edits | Speaker Attribution | Residual Number/Format | Other Lexical |
| -------------------------------------------------------------------------- | ---: | -----------: | ---------: | -----------: | ------------: | ------------: | ------------------: | ---------------------: | ------------: |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 4    | 1596         | 91         | 146          | 6             | 1353          | 192                 | 3                      | 1158          |
| <code>openai-stt-gpt-transcribe</code>                                     | 4    | 1594         | 103        | 114          | 13            | 1364          | 192                 | 8                      | 1164          |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 4    | 2155         | 335        | 161          | 43            | 1616          | 191                 | 20                     | 1405          |
| <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 4    | 2050         | 338        | 124          | 9             | 1579          | 192                 | 6                      | 1381          |
| <code>together-openai_whisper-large-v3</code>                              | 4    | 1953         | 102        | 133          | 8             | 1710          | 192                 | 3                      | 1515          |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 4    | 2554         | 411        | 248          | 48            | 1847          | 191                 | 19                     | 1637          |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 4    | 2213         | 261        | 167          | 42            | 1743          | 191                 | 23                     | 1529          |
| <code>cloudflare-@cf_deepgram_nova-3</code>                                | 4    | 2685         | 400        | 527          | 14            | 1744          | 191                 | 23                     | 1530          |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 4    | 2520         | 112        | 170          | 85            | 2153          | 192                 | 21                     | 1940          |
| <code>deepinfra-openai_whisper-large-v3</code>                             | 4    | 3137         | 151        | 129          | 9             | 2848          | 192                 | 6                      | 2650          |
| <code>cloudflare-@cf_openai_whisper</code>                                 | 4    | 4930         | 1050       | 144          | 10            | 3726          | 192                 | 21                     | 3513          |
| <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 4    | 3180         | 129        | 143          | 8             | 2900          | 191                 | 10                     | 2699          |
| <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 4    | 5816         | 153        | 175          | 15            | 5473          | 192                 | 53                     | 5228          |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 4    | 11092        | 121        | 213          | 6             | 10752         | 192                 | 6                      | 10554         |

## Speaker Metrics

Mean word attribution accuracy (matched words whose mapped provider speaker equals the reference speaker) and mean absolute speaker-count error, for diarizing providers.

No speaker metrics are available.

## Notes

- Each provider is aggregated by providerKey across the runs it appears in; the mean is taken over present values only. Aggregate realtime throughput is total covered audio duration divided by total covered processing time.
- Groups follow the single-run STT contract: local, thirdPartyServiceNonDiarization, thirdPartyServiceDiarization.
- Each group ranks price, speed, and quality score independently. No weighted composite or model-tier ranking is emitted.
- Scoring version 2 headline: per-run quality is max(0, 100 * (1 - neutralSpeakerAwareWER)) after disfluency-, orthographic-, and number-neutral normalization applied identically to reference and provider; the scoring-version-1 score is retained as the mean legacy score and legacy speaker-aware WER.
- Providers run with non-default request settings are distinct rows keyed service/model[setting=value,...] and rank alongside default rows.
