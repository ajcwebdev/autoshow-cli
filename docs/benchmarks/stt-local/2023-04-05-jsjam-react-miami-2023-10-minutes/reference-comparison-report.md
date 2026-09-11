# Consensus Transcript Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/stt-local/2023-04-05-jsjam-react-miami-2023-10-minutes`
- Total providers: 13 (13 local, 0 third-party service)
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
| 1 | <code>whisper-base</code> | $0.00 local monetary cost | 91.56 | 8.44% | 7.63% | not-supported | 10.37s | 57.86× realtime | $0.00 |
| 2 | <code>whisper-large-v3-turbo</code> | $0.00 local monetary cost | 92.51 | 7.49% | 6.56% | not-supported | 39.99s | 15.00× realtime | $0.00 |
| 3 | <code>whisper-medium</code> | $0.00 local monetary cost | 92.80 | 7.20% | 6.26% | not-supported | 50.88s | 11.79× realtime | $0.00 |
| 4 | <code>whisper-small</code> | $0.00 local monetary cost | 93.86 | 6.14% | 5.18% | not-supported | 22.94s | 26.15× realtime | $0.00 |
| 5 | <code>whisper-tiny</code> | $0.00 local monetary cost | 87.79 | 12.21% | 11.44% | not-supported | 8.65s | 69.40× realtime | $0.00 |
| 6 | <code>whisperfile-large-v2</code> | $0.00 local monetary cost | 93.57 | 6.43% | 5.48% | not-supported | 203.35s | 2.95× realtime | $0.00 |
| 7 | <code>whisperfile-large-v3</code> | $0.00 local monetary cost | 0.00 | 172.51% | 173.78% | not-supported | 358.53s | 1.67× realtime | $0.00 |
| 8 | <code>whisperfile-medium</code> | $0.00 local monetary cost | 93.86 | 6.14% | 5.18% | not-supported | 110.44s | 5.43× realtime | $0.00 |
| 9 | <code>whisperfile-medium.en</code> | $0.00 local monetary cost | 91.27 | 8.73% | 7.81% | not-supported | 96.94s | 6.19× realtime | $0.00 |
| 10 | <code>whisperfile-small</code> | $0.00 local monetary cost | 88.02 | 11.98% | 11.14% | not-supported | 41.78s | 14.36× realtime | $0.00 |
| 11 | <code>whisperfile-small.en</code> | $0.00 local monetary cost | 93.57 | 6.43% | 5.48% | not-supported | 39.73s | 15.10× realtime | $0.00 |
| 12 | <code>whisperfile-tiny</code> | $0.00 local monetary cost | 89.97 | 10.03% | 9.18% | not-supported | 8.41s | 71.35× realtime | $0.00 |
| 13 | <code>whisperfile-tiny.en</code> | $0.00 local monetary cost | 90.27 | 9.73% | 9.00% | not-supported | 10.84s | 55.35× realtime | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>whisperfile-tiny</code> | 8.41s | 89.97 | 10.03% | 9.18% | not-supported | 8.41s | 71.35× realtime | $0.00 |
| 2 | <code>whisper-tiny</code> | 8.65s | 87.79 | 12.21% | 11.44% | not-supported | 8.65s | 69.40× realtime | $0.00 |
| 3 | <code>whisper-base</code> | 10.37s | 91.56 | 8.44% | 7.63% | not-supported | 10.37s | 57.86× realtime | $0.00 |
| 4 | <code>whisperfile-tiny.en</code> | 10.84s | 90.27 | 9.73% | 9.00% | not-supported | 10.84s | 55.35× realtime | $0.00 |
| 5 | <code>whisper-small</code> | 22.94s | 93.86 | 6.14% | 5.18% | not-supported | 22.94s | 26.15× realtime | $0.00 |
| 6 | <code>whisperfile-small.en</code> | 39.73s | 93.57 | 6.43% | 5.48% | not-supported | 39.73s | 15.10× realtime | $0.00 |
| 7 | <code>whisper-large-v3-turbo</code> | 39.99s | 92.51 | 7.49% | 6.56% | not-supported | 39.99s | 15.00× realtime | $0.00 |
| 8 | <code>whisperfile-small</code> | 41.78s | 88.02 | 11.98% | 11.14% | not-supported | 41.78s | 14.36× realtime | $0.00 |
| 9 | <code>whisper-medium</code> | 50.88s | 92.80 | 7.20% | 6.26% | not-supported | 50.88s | 11.79× realtime | $0.00 |
| 10 | <code>whisperfile-medium.en</code> | 96.94s | 91.27 | 8.73% | 7.81% | not-supported | 96.94s | 6.19× realtime | $0.00 |
| 11 | <code>whisperfile-medium</code> | 110.44s | 93.86 | 6.14% | 5.18% | not-supported | 110.44s | 5.43× realtime | $0.00 |
| 12 | <code>whisperfile-large-v2</code> | 203.35s | 93.57 | 6.43% | 5.48% | not-supported | 203.35s | 2.95× realtime | $0.00 |
| 13 | <code>whisperfile-large-v3</code> | 358.53s | 0.00 | 172.51% | 173.78% | not-supported | 358.53s | 1.67× realtime | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>whisper-small</code> | 93.86/100 quality score | 93.86 | 6.14% | 5.18% | not-supported | 22.94s | 26.15× realtime | $0.00 |
| 2 | <code>whisperfile-medium</code> | 93.86/100 quality score | 93.86 | 6.14% | 5.18% | not-supported | 110.44s | 5.43× realtime | $0.00 |
| 3 | <code>whisperfile-large-v2</code> | 93.57/100 quality score | 93.57 | 6.43% | 5.48% | not-supported | 203.35s | 2.95× realtime | $0.00 |
| 4 | <code>whisperfile-small.en</code> | 93.57/100 quality score | 93.57 | 6.43% | 5.48% | not-supported | 39.73s | 15.10× realtime | $0.00 |
| 5 | <code>whisper-medium</code> | 92.80/100 quality score | 92.80 | 7.20% | 6.26% | not-supported | 50.88s | 11.79× realtime | $0.00 |
| 6 | <code>whisper-large-v3-turbo</code> | 92.51/100 quality score | 92.51 | 7.49% | 6.56% | not-supported | 39.99s | 15.00× realtime | $0.00 |
| 7 | <code>whisper-base</code> | 91.56/100 quality score | 91.56 | 8.44% | 7.63% | not-supported | 10.37s | 57.86× realtime | $0.00 |
| 8 | <code>whisperfile-medium.en</code> | 91.27/100 quality score | 91.27 | 8.73% | 7.81% | not-supported | 96.94s | 6.19× realtime | $0.00 |
| 9 | <code>whisperfile-tiny.en</code> | 90.27/100 quality score | 90.27 | 9.73% | 9.00% | not-supported | 10.84s | 55.35× realtime | $0.00 |
| 10 | <code>whisperfile-tiny</code> | 89.97/100 quality score | 89.97 | 10.03% | 9.18% | not-supported | 8.41s | 71.35× realtime | $0.00 |
| 11 | <code>whisperfile-small</code> | 88.02/100 quality score | 88.02 | 11.98% | 11.14% | not-supported | 41.78s | 14.36× realtime | $0.00 |
| 12 | <code>whisper-tiny</code> | 87.79/100 quality score | 87.79 | 12.21% | 11.44% | not-supported | 8.65s | 69.40× realtime | $0.00 |
| 13 | <code>whisperfile-large-v3</code> | 0.00/100 quality score | 0.00 | 172.51% | 173.78% | not-supported | 358.53s | 1.67× realtime | $0.00 |

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
| <code>whisper-base</code> | Local | not-supported | 91.56 | 8.44% | 7.63% | 10.37s | 57.86× realtime | $0.00 |
| <code>whisper-large-v3-turbo</code> | Local | not-supported | 92.51 | 7.49% | 6.56% | 39.99s | 15.00× realtime | $0.00 |
| <code>whisper-medium</code> | Local | not-supported | 92.80 | 7.20% | 6.26% | 50.88s | 11.79× realtime | $0.00 |
| <code>whisper-small</code> | Local | not-supported | 93.86 | 6.14% | 5.18% | 22.94s | 26.15× realtime | $0.00 |
| <code>whisper-tiny</code> | Local | not-supported | 87.79 | 12.21% | 11.44% | 8.65s | 69.40× realtime | $0.00 |
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
| <code>whisper-base</code> | 81 | 34 | 28 | 1695 |
| <code>whisper-large-v3-turbo</code> | 46 | 51 | 30 | 1695 |
| <code>whisper-medium</code> | 37 | 68 | 17 | 1695 |
| <code>whisper-small</code> | 40 | 29 | 35 | 1695 |
| <code>whisper-tiny</code> | 85 | 93 | 29 | 1695 |
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
| <code>whisper-base</code> | 76 | 21 | 31 | 1678 |
| <code>whisper-large-v3-turbo</code> | 43 | 36 | 31 | 1678 |
| <code>whisper-medium</code> | 36 | 52 | 17 | 1678 |
| <code>whisper-small</code> | 39 | 13 | 35 | 1678 |
| <code>whisper-tiny</code> | 80 | 80 | 32 | 1678 |
| <code>whisperfile-large-v2</code> | 28 | 47 | 17 | 1678 |
| <code>whisperfile-large-v3</code> | 620 | 17 | 2279 | 1678 |
| <code>whisperfile-medium</code> | 38 | 27 | 22 | 1678 |
| <code>whisperfile-medium.en</code> | 52 | 45 | 34 | 1678 |
| <code>whisperfile-small</code> | 51 | 67 | 69 | 1678 |
| <code>whisperfile-small.en</code> | 40 | 21 | 31 | 1678 |
| <code>whisperfile-tiny</code> | 87 | 44 | 23 | 1678 |
| <code>whisperfile-tiny.en</code> | 66 | 53 | 32 | 1678 |

## Quality Flags

| Provider | Quality Flags |
| --- | --- |
| <code>whisper-medium</code> | Whisper timestamps exceeded the known audio duration and were clamped for normalized artifacts. |
| <code>whisper-tiny</code> | Whisper timestamps exceeded the known audio duration and were clamped for normalized artifacts. |

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `whisper-small` was the most accurate provider on strict speaker-aware WER, scoring 93.86/100.
- `whisperfile-tiny` was the fastest provider in this set at 8.41s.
- `whisper-small` lost the most ground once speaker changes were counted, with 0.95 percentage-point gap between text-only and speaker-aware WER.
