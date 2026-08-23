# Combined STT Provider Comparison Report

## Summary

- Root directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/stt-with-speakers`
- Runs aggregated: 4
  - `1-audio` (8 providers)
  - `2022-09-30-widgets-fsjam-40-minutes` (8 providers)
  - `2023-03-15-jsjam-qwik-misko-hevery` (8 providers)
  - `2023-04-05-jsjam-react-miami-2023-10-minutes` (8 providers)
- Distinct providers: 8 (0 local, 0 third-party non-diarization, 8 third-party diarization)
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
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Speed

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

### Third-Party Service Diarization

#### Price

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>soniox-stt-async-v5</code> | $0.0684 | 4 | 95.65 | 4.35% | 4.17% | supported | 67.32s | 36.60× | $0.0684 |
| 2 | <code>grok-speech-to-text</code> | $0.0684 | 4 | 89.73 | 10.27% | 10.10% | supported | 26.94s | 91.44× | $0.0684 |
| 3 | <code>mistral-voxtral-mini-2602</code> | $0.0821 | 4 | 95.75 | 4.25% | 4.09% | supported | 30.29s | 81.33× | $0.0821 |
| 4 | <code>speechmatics-melia-1</code> | $0.0883 | 4 | 95.40 | 4.60% | 4.50% | supported | 19.70s | 125.04× | $0.0883 |
| 5 | <code>assemblyai-universal-3-5-pro</code> | $0.1574 | 4 | 98.09 | 1.91% | 1.77% | supported | 36.43s | 67.63× | $0.1574 |
| 6 | <code>deepgram-nova-3</code> | $0.3983 | 4 | 92.82 | 7.18% | 6.32% | supported | 7.78s | 316.56× | $0.3983 |
| 7 | <code>happyscribe-auto</code> | $0.4106 | 4 | 97.75 | 2.25% | 2.01% | supported | 93.53s | 26.34× | $0.4106 |
| 8 | <code>gladia-solaria-3</code> | $0.4175 | 4 | 95.49 | 4.51% | 4.38% | supported | 33.78s | 72.94× | $0.4175 |

#### Speed

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>deepgram-nova-3</code> | 7.78s | 4 | 92.82 | 7.18% | 6.32% | supported | 7.78s | 316.56× | $0.3983 |
| 2 | <code>speechmatics-melia-1</code> | 19.70s | 4 | 95.40 | 4.60% | 4.50% | supported | 19.70s | 125.04× | $0.0883 |
| 3 | <code>grok-speech-to-text</code> | 26.94s | 4 | 89.73 | 10.27% | 10.10% | supported | 26.94s | 91.44× | $0.0684 |
| 4 | <code>mistral-voxtral-mini-2602</code> | 30.29s | 4 | 95.75 | 4.25% | 4.09% | supported | 30.29s | 81.33× | $0.0821 |
| 5 | <code>gladia-solaria-3</code> | 33.78s | 4 | 95.49 | 4.51% | 4.38% | supported | 33.78s | 72.94× | $0.4175 |
| 6 | <code>assemblyai-universal-3-5-pro</code> | 36.43s | 4 | 98.09 | 1.91% | 1.77% | supported | 36.43s | 67.63× | $0.1574 |
| 7 | <code>soniox-stt-async-v5</code> | 67.32s | 4 | 95.65 | 4.35% | 4.17% | supported | 67.32s | 36.60× | $0.0684 |
| 8 | <code>happyscribe-auto</code> | 93.53s | 4 | 97.75 | 2.25% | 2.01% | supported | 93.53s | 26.34× | $0.4106 |

#### Quality Score

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>assemblyai-universal-3-5-pro</code> | 98.09/100 quality score | 4 | 98.09 | 1.91% | 1.77% | supported | 36.43s | 67.63× | $0.1574 |
| 2 | <code>happyscribe-auto</code> | 97.75/100 quality score | 4 | 97.75 | 2.25% | 2.01% | supported | 93.53s | 26.34× | $0.4106 |
| 3 | <code>mistral-voxtral-mini-2602</code> | 95.75/100 quality score | 4 | 95.75 | 4.25% | 4.09% | supported | 30.29s | 81.33× | $0.0821 |
| 4 | <code>soniox-stt-async-v5</code> | 95.65/100 quality score | 4 | 95.65 | 4.35% | 4.17% | supported | 67.32s | 36.60× | $0.0684 |
| 5 | <code>gladia-solaria-3</code> | 95.49/100 quality score | 4 | 95.49 | 4.51% | 4.38% | supported | 33.78s | 72.94× | $0.4175 |
| 6 | <code>speechmatics-melia-1</code> | 95.40/100 quality score | 4 | 95.40 | 4.60% | 4.50% | supported | 19.70s | 125.04× | $0.0883 |
| 7 | <code>deepgram-nova-3</code> | 92.82/100 quality score | 4 | 92.82 | 7.18% | 6.32% | supported | 7.78s | 316.56× | $0.3983 |
| 8 | <code>grok-speech-to-text</code> | 89.73/100 quality score | 4 | 89.73 | 10.27% | 10.10% | supported | 26.94s | 91.44× | $0.0684 |

## Per-Run Quality Score

Speaker-aware WER-derived quality score per provider in each run, sorted by mean.

### Third-Party Service Diarization

| Provider | Mean | 1-audio | 2022-09-30-widgets-fsjam-40-minutes | 2023-03-15-jsjam-qwik-misko-hevery | 2023-04-05-jsjam-react-miami-2023-10-minutes |
| --- | ---: | ---: | ---: | ---: | ---: |
| <code>assemblyai-universal-3-5-pro</code> | 98.09 | 98.64 | 98.09 | 97.94 | 97.69 |
| <code>happyscribe-auto</code> | 97.75 | 99.09 | 97.95 | 96.94 | 97.04 |
| <code>mistral-voxtral-mini-2602</code> | 95.75 | 96.36 | 97.23 | 94.63 | 94.78 |
| <code>soniox-stt-async-v5</code> | 95.65 | 97.73 | 96.77 | 93.38 | 94.72 |
| <code>gladia-solaria-3</code> | 95.49 | 96.82 | 96.80 | 93.44 | 94.90 |
| <code>speechmatics-melia-1</code> | 95.40 | 97.73 | 96.45 | 92.56 | 94.84 |
| <code>deepgram-nova-3</code> | 92.82 | 91.82 | 95.20 | 90.94 | 93.30 |
| <code>grok-speech-to-text</code> | 89.73 | 85.45 | 92.04 | 89.60 | 91.82 |

## Notes

- Each provider is aggregated by providerKey across the runs it appears in; the mean is taken over present values only. Aggregate realtime throughput is total covered audio duration divided by total covered processing time.
- Groups follow the single-run STT contract: local, thirdPartyServiceNonDiarization, thirdPartyServiceDiarization.
- Each group ranks price, speed, and quality score independently. No weighted composite or model-tier ranking is emitted.
