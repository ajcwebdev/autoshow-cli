# Consensus Transcript Comparison Report

## Summary

- Run directory: `/Users/ajc/c/auto/autoshow-cli/docs/benchmarks/stt-local/2023-04-05-jsjam-react-miami-2023-10-minutes`
- Total providers: 8 (8 local, 0 third-party service)
- Local, third-party non-diarization, and third-party diarization providers are ranked separately for price, speed, and quality score.
- Quality score uses speaker-aware WER-derived transcript accuracy, with text-only WER retained as supporting evidence.

## Method

- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing speaker-aware WER-derived provider score from highest to lowest.
- Third-party service rankings are split by whether the normalized provider result supports diarization.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>whisperfile-large-v2</code> | $0.00 local monetary cost | 93.57 | 6.43% | 5.48% | not-supported | 203.35s | 2.95× realtime | $0.00 |
| 2 | <code>whisperfile-large-v3</code> | $0.00 local monetary cost | 0.00 | 172.51% | 173.78% | not-supported | 358.53s | 1.67× realtime | $0.00 |
| 3 | <code>whisperfile-medium</code> | $0.00 local monetary cost | 93.86 | 6.14% | 5.18% | not-supported | 110.44s | 5.43× realtime | $0.00 |
| 4 | <code>whisperfile-medium.en</code> | $0.00 local monetary cost | 91.27 | 8.73% | 7.81% | not-supported | 96.94s | 6.19× realtime | $0.00 |
| 5 | <code>whisperfile-small</code> | $0.00 local monetary cost | 88.02 | 11.98% | 11.14% | not-supported | 41.78s | 14.36× realtime | $0.00 |
| 6 | <code>whisperfile-small.en</code> | $0.00 local monetary cost | 93.57 | 6.43% | 5.48% | not-supported | 39.73s | 15.10× realtime | $0.00 |
| 7 | <code>whisperfile-tiny</code> | $0.00 local monetary cost | 89.97 | 10.03% | 9.18% | not-supported | 8.41s | 71.35× realtime | $0.00 |
| 8 | <code>whisperfile-tiny.en</code> | $0.00 local monetary cost | 90.27 | 9.73% | 9.00% | not-supported | 10.84s | 55.35× realtime | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>whisperfile-tiny</code> | 8.41s | 89.97 | 10.03% | 9.18% | not-supported | 8.41s | 71.35× realtime | $0.00 |
| 2 | <code>whisperfile-tiny.en</code> | 10.84s | 90.27 | 9.73% | 9.00% | not-supported | 10.84s | 55.35× realtime | $0.00 |
| 3 | <code>whisperfile-small.en</code> | 39.73s | 93.57 | 6.43% | 5.48% | not-supported | 39.73s | 15.10× realtime | $0.00 |
| 4 | <code>whisperfile-small</code> | 41.78s | 88.02 | 11.98% | 11.14% | not-supported | 41.78s | 14.36× realtime | $0.00 |
| 5 | <code>whisperfile-medium.en</code> | 96.94s | 91.27 | 8.73% | 7.81% | not-supported | 96.94s | 6.19× realtime | $0.00 |
| 6 | <code>whisperfile-medium</code> | 110.44s | 93.86 | 6.14% | 5.18% | not-supported | 110.44s | 5.43× realtime | $0.00 |
| 7 | <code>whisperfile-large-v2</code> | 203.35s | 93.57 | 6.43% | 5.48% | not-supported | 203.35s | 2.95× realtime | $0.00 |
| 8 | <code>whisperfile-large-v3</code> | 358.53s | 0.00 | 172.51% | 173.78% | not-supported | 358.53s | 1.67× realtime | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>whisperfile-medium</code> | 93.86/100 quality score | 93.86 | 6.14% | 5.18% | not-supported | 110.44s | 5.43× realtime | $0.00 |
| 2 | <code>whisperfile-large-v2</code> | 93.57/100 quality score | 93.57 | 6.43% | 5.48% | not-supported | 203.35s | 2.95× realtime | $0.00 |
| 3 | <code>whisperfile-small.en</code> | 93.57/100 quality score | 93.57 | 6.43% | 5.48% | not-supported | 39.73s | 15.10× realtime | $0.00 |
| 4 | <code>whisperfile-medium.en</code> | 91.27/100 quality score | 91.27 | 8.73% | 7.81% | not-supported | 96.94s | 6.19× realtime | $0.00 |
| 5 | <code>whisperfile-tiny.en</code> | 90.27/100 quality score | 90.27 | 9.73% | 9.00% | not-supported | 10.84s | 55.35× realtime | $0.00 |
| 6 | <code>whisperfile-tiny</code> | 89.97/100 quality score | 89.97 | 10.03% | 9.18% | not-supported | 8.41s | 71.35× realtime | $0.00 |
| 7 | <code>whisperfile-small</code> | 88.02/100 quality score | 88.02 | 11.98% | 11.14% | not-supported | 41.78s | 14.36× realtime | $0.00 |
| 8 | <code>whisperfile-large-v3</code> | 0.00/100 quality score | 0.00 | 172.51% | 173.78% | not-supported | 358.53s | 1.67× realtime | $0.00 |

### Third-Party Service Non-Diarization

#### Price

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

### Third-Party Service Diarization

#### Price

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |


## Provider Detail

| Provider | Group | Diarization | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Throughput | Actual Cost |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| <code>whisperfile-large-v2</code> | Local | not-supported | 93.57 | 6.43% | 5.48% | 203.35s | 2.95× realtime | $0.00 |
| <code>whisperfile-large-v3</code> | Local | not-supported | 0.00 | 172.51% | 173.78% | 358.53s | 1.67× realtime | $0.00 |
| <code>whisperfile-medium</code> | Local | not-supported | 93.86 | 6.14% | 5.18% | 110.44s | 5.43× realtime | $0.00 |
| <code>whisperfile-medium.en</code> | Local | not-supported | 91.27 | 8.73% | 7.81% | 96.94s | 6.19× realtime | $0.00 |
| <code>whisperfile-small</code> | Local | not-supported | 88.02 | 11.98% | 11.14% | 41.78s | 14.36× realtime | $0.00 |
| <code>whisperfile-small.en</code> | Local | not-supported | 93.57 | 6.43% | 5.48% | 39.73s | 15.10× realtime | $0.00 |
| <code>whisperfile-tiny</code> | Local | not-supported | 89.97 | 10.03% | 9.18% | 8.41s | 71.35× realtime | $0.00 |
| <code>whisperfile-tiny.en</code> | Local | not-supported | 90.27 | 9.73% | 9.00% | 10.84s | 55.35× realtime | $0.00 |

## Error Breakdown (Speaker-aware)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>whisperfile-large-v2</code> | 31 | 62 | 16 | 1695 |
| <code>whisperfile-large-v3</code> | 632 | 23 | 2269 | 1695 |
| <code>whisperfile-medium</code> | 41 | 42 | 21 | 1695 |
| <code>whisperfile-medium.en</code> | 55 | 60 | 33 | 1695 |
| <code>whisperfile-small</code> | 53 | 82 | 68 | 1695 |
| <code>whisperfile-small.en</code> | 41 | 37 | 31 | 1695 |
| <code>whisperfile-tiny</code> | 93 | 57 | 20 | 1695 |
| <code>whisperfile-tiny.en</code> | 72 | 65 | 28 | 1695 |

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>whisperfile-large-v2</code> | 28 | 47 | 17 | 1678 |
| <code>whisperfile-large-v3</code> | 620 | 17 | 2279 | 1678 |
| <code>whisperfile-medium</code> | 38 | 27 | 22 | 1678 |
| <code>whisperfile-medium.en</code> | 52 | 45 | 34 | 1678 |
| <code>whisperfile-small</code> | 51 | 67 | 69 | 1678 |
| <code>whisperfile-small.en</code> | 40 | 21 | 31 | 1678 |
| <code>whisperfile-tiny</code> | 87 | 44 | 23 | 1678 |
| <code>whisperfile-tiny.en</code> | 66 | 53 | 32 | 1678 |

## Quality Flags

No provider quality flags were detected.

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `whisperfile-medium` was the most accurate provider on strict speaker-aware WER, scoring 93.86/100.
- Actual provider cost data was unavailable in `manifest.json`.
- `whisperfile-tiny` was the fastest provider in this set at 8.41s.
- `whisperfile-medium` lost the most ground once speaker changes were counted, with 0.95 percentage-point gap between text-only and speaker-aware WER.
