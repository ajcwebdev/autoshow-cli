# Combined STT Provider Comparison Report

## Summary

- Root directory: `/Users/ajc/c/auto/autoshow-cli/docs/benchmarks/stt-without-speakers`
- Runs aggregated: 4
  - `1-audio` (10 providers)
  - `2022-09-30-widgets-fsjam-40-minutes` (10 providers)
  - `2023-03-15-jsjam-qwik-misko-hevery` (10 providers)
  - `2023-04-05-jsjam-react-miami-2023-10-minutes` (10 providers)
- Distinct providers: 10 (0 local, 10 third-party non-diarization, 0 third-party diarization)
- Quality score aggregates the per-run speaker-aware WER-derived score as a mean across runs; price and speed aggregate per-run cost and processing time as means.

## Method

- Providers are matched by `providerKey` and aggregated across the runs they appear in.
- Means are taken over present values only; a provider missing a value in some runs is averaged over the runs where it is present.
- Price rankings use mean per-run monetary cost ascending, local providers at zero, missing cost last.
- Speed rankings use mean processing time ascending, missing timing last.
- Quality Score rankings use the mean speaker-aware WER-derived score descending.
- Tied ranking values break deterministically: price ties by quality descending then provider key; speed and quality ties by provider key.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Speed

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

### Third-Party Service Non-Diarization

#### Price

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | $0.0082 | 4 | 94.20 | 5.80% | 4.82% | not-supported | 58.07s | 42.43× | $0.0082 |
| 2 | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | $0.0082 | 4 | 92.30 | 7.70% | 6.74% | not-supported | 149.05s | 16.53× | $0.0082 |
| 3 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | $0.0082 | 4 | 88.40 | 11.60% | 10.78% | not-supported | 13.08s | 188.41× | $0.0082 |
| 4 | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | $0.0185 | 4 | 94.17 | 5.83% | 4.87% | not-supported | 51.84s | 47.52× | $0.0185 |
| 5 | <code>deepinfra-openai_whisper-large-v3</code> | $0.0185 | 4 | 89.40 | 10.60% | 9.73% | not-supported | 24.86s | 99.09× | $0.0185 |
| 6 | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | $0.0411 | 4 | 94.92 | 5.08% | 4.09% | not-supported | 78.37s | 31.44× | $0.0411 |
| 7 | <code>together-openai_whisper-large-v3</code> | $0.0616 | 4 | 94.00 | 6.00% | 5.02% | not-supported | 10.84s | 227.18× | $0.0616 |
| 8 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | $0.0616 | 4 | 93.27 | 6.73% | 5.79% | not-supported | 14.21s | 173.32× | $0.0616 |
| 9 | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | $0.1232 | 4 | 78.04 | 21.96% | 21.09% | not-supported | 283.92s | 8.68× | $0.1232 |
| 10 | <code>openai-stt-gpt-transcribe</code> | $0.1848 | 4 | 94.90 | 5.10% | 4.13% | not-supported | 55.73s | 44.21× | $0.1848 |

#### Speed

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>together-openai_whisper-large-v3</code> | 10.84s | 4 | 94.00 | 6.00% | 5.02% | not-supported | 10.84s | 227.18× | $0.0616 |
| 2 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 13.08s | 4 | 88.40 | 11.60% | 10.78% | not-supported | 13.08s | 188.41× | $0.0082 |
| 3 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 14.21s | 4 | 93.27 | 6.73% | 5.79% | not-supported | 14.21s | 173.32× | $0.0616 |
| 4 | <code>deepinfra-openai_whisper-large-v3</code> | 24.86s | 4 | 89.40 | 10.60% | 9.73% | not-supported | 24.86s | 99.09× | $0.0185 |
| 5 | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | 51.84s | 4 | 94.17 | 5.83% | 4.87% | not-supported | 51.84s | 47.52× | $0.0185 |
| 6 | <code>openai-stt-gpt-transcribe</code> | 55.73s | 4 | 94.90 | 5.10% | 4.13% | not-supported | 55.73s | 44.21× | $0.1848 |
| 7 | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | 58.07s | 4 | 94.20 | 5.80% | 4.82% | not-supported | 58.07s | 42.43× | $0.0082 |
| 8 | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | 78.37s | 4 | 94.92 | 5.08% | 4.09% | not-supported | 78.37s | 31.44× | $0.0411 |
| 9 | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 149.05s | 4 | 92.30 | 7.70% | 6.74% | not-supported | 149.05s | 16.53× | $0.0082 |
| 10 | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | 283.92s | 4 | 78.04 | 21.96% | 21.09% | not-supported | 283.92s | 8.68× | $0.1232 |

#### Quality Score

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | 94.92/100 quality score | 4 | 94.92 | 5.08% | 4.09% | not-supported | 78.37s | 31.44× | $0.0411 |
| 2 | <code>openai-stt-gpt-transcribe</code> | 94.90/100 quality score | 4 | 94.90 | 5.10% | 4.13% | not-supported | 55.73s | 44.21× | $0.1848 |
| 3 | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | 94.20/100 quality score | 4 | 94.20 | 5.80% | 4.82% | not-supported | 58.07s | 42.43× | $0.0082 |
| 4 | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | 94.17/100 quality score | 4 | 94.17 | 5.83% | 4.87% | not-supported | 51.84s | 47.52× | $0.0185 |
| 5 | <code>together-openai_whisper-large-v3</code> | 94.00/100 quality score | 4 | 94.00 | 6.00% | 5.02% | not-supported | 10.84s | 227.18× | $0.0616 |
| 6 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 93.27/100 quality score | 4 | 93.27 | 6.73% | 5.79% | not-supported | 14.21s | 173.32× | $0.0616 |
| 7 | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 92.30/100 quality score | 4 | 92.30 | 7.70% | 6.74% | not-supported | 149.05s | 16.53× | $0.0082 |
| 8 | <code>deepinfra-openai_whisper-large-v3</code> | 89.40/100 quality score | 4 | 89.40 | 10.60% | 9.73% | not-supported | 24.86s | 99.09× | $0.0185 |
| 9 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 88.40/100 quality score | 4 | 88.40 | 11.60% | 10.78% | not-supported | 13.08s | 188.41× | $0.0082 |
| 10 | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | 78.04/100 quality score | 4 | 78.04 | 21.96% | 21.09% | not-supported | 283.92s | 8.68× | $0.1232 |

### Third-Party Service Diarization

#### Price

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Speed

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

## Per-Run Quality Score

Speaker-aware WER-derived quality score per provider in each run, sorted by mean.

### Third-Party Service Non-Diarization

| Provider | Mean | 1-audio | 2022-09-30-widgets-fsjam-40-minutes | 2023-03-15-jsjam-qwik-misko-hevery | 2023-04-05-jsjam-react-miami-2023-10-minutes |
| --- | ---: | ---: | ---: | ---: | ---: |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | 94.92 | 95.00 | 96.60 | 93.93 | 94.16 |
| <code>openai-stt-gpt-transcribe</code> | 94.90 | 94.55 | 96.75 | 93.85 | 94.45 |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | 94.20 | 95.91 | 95.16 | 91.39 | 94.34 |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | 94.17 | 94.55 | 95.96 | 91.32 | 94.87 |
| <code>together-openai_whisper-large-v3</code> | 94.00 | 95.00 | 94.68 | 92.99 | 93.33 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 93.27 | 93.18 | 95.70 | 89.44 | 94.75 |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 92.30 | 93.64 | 93.50 | 90.82 | 91.27 |
| <code>deepinfra-openai_whisper-large-v3</code> | 89.40 | 87.27 | 87.94 | 89.99 | 92.39 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 88.40 | 86.36 | 87.27 | 90.29 | 89.68 |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | 78.04 | 95.00 | 62.04 | 60.36 | 94.75 |

## Notes

- Each provider is aggregated by providerKey across the runs it appears in; the mean is taken over present values only. Aggregate realtime throughput is total covered audio duration divided by total covered processing time.
- Groups follow the single-run STT contract: local, thirdPartyServiceNonDiarization, thirdPartyServiceDiarization.
- Each group ranks price, speed, and quality score independently. No weighted composite or model-tier ranking is emitted.
