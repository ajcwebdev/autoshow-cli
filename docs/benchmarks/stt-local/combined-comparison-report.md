# Combined STT Provider Comparison Report

## Summary

- Root directory: `/Users/ajc/c/auto/autoshow-cli/docs/benchmarks/stt-local`
- Runs aggregated: 3
  - `1-audio` (8 providers)
  - `2022-09-30-widgets-fsjam-40-minutes` (8 providers)
  - `2023-04-05-jsjam-react-miami-2023-10-minutes` (8 providers)
- Distinct providers: 8 (8 local, 0 third-party non-diarization, 0 third-party diarization)
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
| 1 | <code>whisperfile-small.en</code> | $0.00 | 3 | 94.25 | 5.75% | 4.62% | not-supported | 70.86s | 14.50× | $0.00 |
| 2 | <code>whisperfile-medium</code> | $0.00 | 3 | 94.11 | 5.89% | 4.75% | not-supported | 208.04s | 4.94× | $0.00 |
| 3 | <code>whisperfile-medium.en</code> | $0.00 | 3 | 94.08 | 5.92% | 4.78% | not-supported | 204.40s | 5.03× | $0.00 |
| 4 | <code>whisperfile-large-v2</code> | $0.00 | 3 | 93.97 | 6.03% | 4.90% | not-supported | 398.42s | 2.58× | $0.00 |
| 5 | <code>whisperfile-tiny.en</code> | $0.00 | 3 | 91.56 | 8.44% | 7.39% | not-supported | 17.33s | 59.29× | $0.00 |
| 6 | <code>whisperfile-small</code> | $0.00 | 3 | 90.32 | 9.68% | 8.62% | not-supported | 80.33s | 12.79× | $0.00 |
| 7 | <code>whisperfile-tiny</code> | $0.00 | 3 | 88.90 | 11.10% | 10.05% | not-supported | 16.43s | 62.53× | $0.00 |
| 8 | <code>whisperfile-large-v3</code> | $0.00 | 3 | 62.77 | 61.40% | 61.00% | not-supported | 412.68s | 2.49× | $0.00 |

#### Speed

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>whisperfile-tiny</code> | 16.43s | 3 | 88.90 | 11.10% | 10.05% | not-supported | 16.43s | 62.53× | $0.00 |
| 2 | <code>whisperfile-tiny.en</code> | 17.33s | 3 | 91.56 | 8.44% | 7.39% | not-supported | 17.33s | 59.29× | $0.00 |
| 3 | <code>whisperfile-small.en</code> | 70.86s | 3 | 94.25 | 5.75% | 4.62% | not-supported | 70.86s | 14.50× | $0.00 |
| 4 | <code>whisperfile-small</code> | 80.33s | 3 | 90.32 | 9.68% | 8.62% | not-supported | 80.33s | 12.79× | $0.00 |
| 5 | <code>whisperfile-medium.en</code> | 204.40s | 3 | 94.08 | 5.92% | 4.78% | not-supported | 204.40s | 5.03× | $0.00 |
| 6 | <code>whisperfile-medium</code> | 208.04s | 3 | 94.11 | 5.89% | 4.75% | not-supported | 208.04s | 4.94× | $0.00 |
| 7 | <code>whisperfile-large-v2</code> | 398.42s | 3 | 93.97 | 6.03% | 4.90% | not-supported | 398.42s | 2.58× | $0.00 |
| 8 | <code>whisperfile-large-v3</code> | 412.68s | 3 | 62.77 | 61.40% | 61.00% | not-supported | 412.68s | 2.49× | $0.00 |

#### Quality Score

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>whisperfile-small.en</code> | 94.25/100 quality score | 3 | 94.25 | 5.75% | 4.62% | not-supported | 70.86s | 14.50× | $0.00 |
| 2 | <code>whisperfile-medium</code> | 94.11/100 quality score | 3 | 94.11 | 5.89% | 4.75% | not-supported | 208.04s | 4.94× | $0.00 |
| 3 | <code>whisperfile-medium.en</code> | 94.08/100 quality score | 3 | 94.08 | 5.92% | 4.78% | not-supported | 204.40s | 5.03× | $0.00 |
| 4 | <code>whisperfile-large-v2</code> | 93.97/100 quality score | 3 | 93.97 | 6.03% | 4.90% | not-supported | 398.42s | 2.58× | $0.00 |
| 5 | <code>whisperfile-tiny.en</code> | 91.56/100 quality score | 3 | 91.56 | 8.44% | 7.39% | not-supported | 17.33s | 59.29× | $0.00 |
| 6 | <code>whisperfile-small</code> | 90.32/100 quality score | 3 | 90.32 | 9.68% | 8.62% | not-supported | 80.33s | 12.79× | $0.00 |
| 7 | <code>whisperfile-tiny</code> | 88.90/100 quality score | 3 | 88.90 | 11.10% | 10.05% | not-supported | 16.43s | 62.53× | $0.00 |
| 8 | <code>whisperfile-large-v3</code> | 62.77/100 quality score | 3 | 62.77 | 61.40% | 61.00% | not-supported | 412.68s | 2.49× | $0.00 |

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

### Local

| Provider | Mean | 1-audio | 2022-09-30-widgets-fsjam-40-minutes | 2023-04-05-jsjam-react-miami-2023-10-minutes |
| --- | ---: | ---: | ---: | ---: |
| <code>whisperfile-small.en</code> | 94.25 | 94.09 | 95.08 | 93.57 |
| <code>whisperfile-medium</code> | 94.11 | 93.18 | 95.30 | 93.86 |
| <code>whisperfile-medium.en</code> | 94.08 | 95.00 | 95.96 | 91.27 |
| <code>whisperfile-large-v2</code> | 93.97 | 93.18 | 95.15 | 93.57 |
| <code>whisperfile-tiny.en</code> | 91.56 | 93.18 | 91.22 | 90.27 |
| <code>whisperfile-small</code> | 90.32 | 87.73 | 95.20 | 88.02 |
| <code>whisperfile-tiny</code> | 88.90 | 86.36 | 90.37 | 89.97 |
| <code>whisperfile-large-v3</code> | 62.77 | 94.55 | 93.76 | 0.00 |

## Notes

- Each provider is aggregated by providerKey across the runs it appears in; the mean is taken over present values only. Aggregate realtime throughput is total covered audio duration divided by total covered processing time.
- Groups follow the single-run STT contract: local, thirdPartyServiceNonDiarization, thirdPartyServiceDiarization.
- Each group ranks price, speed, and quality score independently. No weighted composite or model-tier ranking is emitted.
