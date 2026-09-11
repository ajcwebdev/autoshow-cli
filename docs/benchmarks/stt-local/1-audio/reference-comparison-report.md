# Consensus Transcript Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/stt-local/1-audio`
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
| 1 | <code>whisper-base</code> | $0.00 local monetary cost | 92.27 | 7.73% | 6.02% | not-supported | 1.42s | 41.49× realtime | $0.00 |
| 2 | <code>whisper-large-v3-turbo</code> | $0.00 local monetary cost | 92.73 | 7.27% | 5.56% | not-supported | 5.01s | 11.77× realtime | $0.00 |
| 3 | <code>whisper-medium</code> | $0.00 local monetary cost | 93.18 | 6.82% | 5.09% | not-supported | 7.07s | 8.35× realtime | $0.00 |
| 4 | <code>whisper-small</code> | $0.00 local monetary cost | 89.55 | 10.45% | 8.80% | not-supported | 2.40s | 24.56× realtime | $0.00 |
| 5 | <code>whisper-tiny</code> | $0.00 local monetary cost | 86.36 | 13.64% | 12.04% | not-supported | 1.10s | 53.78× realtime | $0.00 |
| 6 | <code>whisperfile-large-v2</code> | $0.00 local monetary cost | 93.18 | 6.82% | 5.09% | not-supported | 28.79s | 2.05× realtime | $0.00 |
| 7 | <code>whisperfile-large-v3</code> | $0.00 local monetary cost | 94.55 | 5.45% | 3.70% | not-supported | 28.30s | 2.08× realtime | $0.00 |
| 8 | <code>whisperfile-medium</code> | $0.00 local monetary cost | 93.18 | 6.82% | 5.09% | not-supported | 14.55s | 4.06× realtime | $0.00 |
| 9 | <code>whisperfile-medium.en</code> | $0.00 local monetary cost | 95.00 | 5.00% | 3.24% | not-supported | 13.56s | 4.35× realtime | $0.00 |
| 10 | <code>whisperfile-small</code> | $0.00 local monetary cost | 87.73 | 12.27% | 10.65% | not-supported | 4.57s | 12.91× realtime | $0.00 |
| 11 | <code>whisperfile-small.en</code> | $0.00 local monetary cost | 94.09 | 5.91% | 4.17% | not-supported | 4.73s | 12.48× realtime | $0.00 |
| 12 | <code>whisperfile-tiny</code> | $0.00 local monetary cost | 86.36 | 13.64% | 12.04% | not-supported | 1.06s | 55.50× realtime | $0.00 |
| 13 | <code>whisperfile-tiny.en</code> | $0.00 local monetary cost | 93.18 | 6.82% | 5.09% | not-supported | 1.08s | 54.73× realtime | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>whisperfile-tiny</code> | 1.06s | 86.36 | 13.64% | 12.04% | not-supported | 1.06s | 55.50× realtime | $0.00 |
| 2 | <code>whisperfile-tiny.en</code> | 1.08s | 93.18 | 6.82% | 5.09% | not-supported | 1.08s | 54.73× realtime | $0.00 |
| 3 | <code>whisper-tiny</code> | 1.10s | 86.36 | 13.64% | 12.04% | not-supported | 1.10s | 53.78× realtime | $0.00 |
| 4 | <code>whisper-base</code> | 1.42s | 92.27 | 7.73% | 6.02% | not-supported | 1.42s | 41.49× realtime | $0.00 |
| 5 | <code>whisper-small</code> | 2.40s | 89.55 | 10.45% | 8.80% | not-supported | 2.40s | 24.56× realtime | $0.00 |
| 6 | <code>whisperfile-small</code> | 4.57s | 87.73 | 12.27% | 10.65% | not-supported | 4.57s | 12.91× realtime | $0.00 |
| 7 | <code>whisperfile-small.en</code> | 4.73s | 94.09 | 5.91% | 4.17% | not-supported | 4.73s | 12.48× realtime | $0.00 |
| 8 | <code>whisper-large-v3-turbo</code> | 5.01s | 92.73 | 7.27% | 5.56% | not-supported | 5.01s | 11.77× realtime | $0.00 |
| 9 | <code>whisper-medium</code> | 7.07s | 93.18 | 6.82% | 5.09% | not-supported | 7.07s | 8.35× realtime | $0.00 |
| 10 | <code>whisperfile-medium.en</code> | 13.56s | 95.00 | 5.00% | 3.24% | not-supported | 13.56s | 4.35× realtime | $0.00 |
| 11 | <code>whisperfile-medium</code> | 14.55s | 93.18 | 6.82% | 5.09% | not-supported | 14.55s | 4.06× realtime | $0.00 |
| 12 | <code>whisperfile-large-v3</code> | 28.30s | 94.55 | 5.45% | 3.70% | not-supported | 28.30s | 2.08× realtime | $0.00 |
| 13 | <code>whisperfile-large-v2</code> | 28.79s | 93.18 | 6.82% | 5.09% | not-supported | 28.79s | 2.05× realtime | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>whisperfile-medium.en</code> | 95.00/100 quality score | 95.00 | 5.00% | 3.24% | not-supported | 13.56s | 4.35× realtime | $0.00 |
| 2 | <code>whisperfile-large-v3</code> | 94.55/100 quality score | 94.55 | 5.45% | 3.70% | not-supported | 28.30s | 2.08× realtime | $0.00 |
| 3 | <code>whisperfile-small.en</code> | 94.09/100 quality score | 94.09 | 5.91% | 4.17% | not-supported | 4.73s | 12.48× realtime | $0.00 |
| 4 | <code>whisper-medium</code> | 93.18/100 quality score | 93.18 | 6.82% | 5.09% | not-supported | 7.07s | 8.35× realtime | $0.00 |
| 5 | <code>whisperfile-large-v2</code> | 93.18/100 quality score | 93.18 | 6.82% | 5.09% | not-supported | 28.79s | 2.05× realtime | $0.00 |
| 6 | <code>whisperfile-medium</code> | 93.18/100 quality score | 93.18 | 6.82% | 5.09% | not-supported | 14.55s | 4.06× realtime | $0.00 |
| 7 | <code>whisperfile-tiny.en</code> | 93.18/100 quality score | 93.18 | 6.82% | 5.09% | not-supported | 1.08s | 54.73× realtime | $0.00 |
| 8 | <code>whisper-large-v3-turbo</code> | 92.73/100 quality score | 92.73 | 7.27% | 5.56% | not-supported | 5.01s | 11.77× realtime | $0.00 |
| 9 | <code>whisper-base</code> | 92.27/100 quality score | 92.27 | 7.73% | 6.02% | not-supported | 1.42s | 41.49× realtime | $0.00 |
| 10 | <code>whisper-small</code> | 89.55/100 quality score | 89.55 | 10.45% | 8.80% | not-supported | 2.40s | 24.56× realtime | $0.00 |
| 11 | <code>whisperfile-small</code> | 87.73/100 quality score | 87.73 | 12.27% | 10.65% | not-supported | 4.57s | 12.91× realtime | $0.00 |
| 12 | <code>whisper-tiny</code> | 86.36/100 quality score | 86.36 | 13.64% | 12.04% | not-supported | 1.10s | 53.78× realtime | $0.00 |
| 13 | <code>whisperfile-tiny</code> | 86.36/100 quality score | 86.36 | 13.64% | 12.04% | not-supported | 1.06s | 55.50× realtime | $0.00 |

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
| <code>whisper-base</code> | Local | not-supported | 92.27 | 7.73% | 6.02% | 1.42s | 41.49× realtime | $0.00 |
| <code>whisper-large-v3-turbo</code> | Local | not-supported | 92.73 | 7.27% | 5.56% | 5.01s | 11.77× realtime | $0.00 |
| <code>whisper-medium</code> | Local | not-supported | 93.18 | 6.82% | 5.09% | 7.07s | 8.35× realtime | $0.00 |
| <code>whisper-small</code> | Local | not-supported | 89.55 | 10.45% | 8.80% | 2.40s | 24.56× realtime | $0.00 |
| <code>whisper-tiny</code> | Local | not-supported | 86.36 | 13.64% | 12.04% | 1.10s | 53.78× realtime | $0.00 |
| <code>whisperfile-large-v2</code> | Local | not-supported | 93.18 | 6.82% | 5.09% | 28.79s | 2.05× realtime | $0.00 |
| <code>whisperfile-large-v3</code> | Local | not-supported | 94.55 | 5.45% | 3.70% | 28.30s | 2.08× realtime | $0.00 |
| <code>whisperfile-medium</code> | Local | not-supported | 93.18 | 6.82% | 5.09% | 14.55s | 4.06× realtime | $0.00 |
| <code>whisperfile-medium.en</code> | Local | not-supported | 95.00 | 5.00% | 3.24% | 13.56s | 4.35× realtime | $0.00 |
| <code>whisperfile-small</code> | Local | not-supported | 87.73 | 12.27% | 10.65% | 4.57s | 12.91× realtime | $0.00 |
| <code>whisperfile-small.en</code> | Local | not-supported | 94.09 | 5.91% | 4.17% | 4.73s | 12.48× realtime | $0.00 |
| <code>whisperfile-tiny</code> | Local | not-supported | 86.36 | 13.64% | 12.04% | 1.06s | 55.50× realtime | $0.00 |
| <code>whisperfile-tiny.en</code> | Local | not-supported | 93.18 | 6.82% | 5.09% | 1.08s | 54.73× realtime | $0.00 |

## Error Breakdown (Speaker-aware)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>whisper-base</code> | 5 | 11 | 1 | 220 |
| <code>whisper-large-v3-turbo</code> | 3 | 11 | 2 | 220 |
| <code>whisper-medium</code> | 7 | 6 | 2 | 220 |
| <code>whisper-small</code> | 15 | 8 | 0 | 220 |
| <code>whisper-tiny</code> | 17 | 8 | 5 | 220 |
| <code>whisperfile-large-v2</code> | 5 | 7 | 3 | 220 |
| <code>whisperfile-large-v3</code> | 2 | 10 | 0 | 220 |
| <code>whisperfile-medium</code> | 7 | 6 | 2 | 220 |
| <code>whisperfile-medium.en</code> | 4 | 5 | 2 | 220 |
| <code>whisperfile-small</code> | 14 | 12 | 1 | 220 |
| <code>whisperfile-small.en</code> | 5 | 6 | 2 | 220 |
| <code>whisperfile-tiny</code> | 16 | 9 | 5 | 220 |
| <code>whisperfile-tiny.en</code> | 5 | 9 | 1 | 220 |

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>whisper-base</code> | 4 | 8 | 1 | 216 |
| <code>whisper-large-v3-turbo</code> | 2 | 8 | 2 | 216 |
| <code>whisper-medium</code> | 6 | 3 | 2 | 216 |
| <code>whisper-small</code> | 14 | 5 | 0 | 216 |
| <code>whisper-tiny</code> | 16 | 5 | 5 | 216 |
| <code>whisperfile-large-v2</code> | 4 | 4 | 3 | 216 |
| <code>whisperfile-large-v3</code> | 1 | 7 | 0 | 216 |
| <code>whisperfile-medium</code> | 6 | 3 | 2 | 216 |
| <code>whisperfile-medium.en</code> | 3 | 2 | 2 | 216 |
| <code>whisperfile-small</code> | 13 | 9 | 1 | 216 |
| <code>whisperfile-small.en</code> | 4 | 3 | 2 | 216 |
| <code>whisperfile-tiny</code> | 15 | 6 | 5 | 216 |
| <code>whisperfile-tiny.en</code> | 4 | 6 | 1 | 216 |

## Quality Flags

| Provider | Quality Flags |
| --- | --- |
| <code>whisper-base</code> | Whisper timestamps exceeded the known audio duration and were clamped for normalized artifacts. |
| <code>whisper-medium</code> | Whisper timestamps exceeded the known audio duration and were clamped for normalized artifacts. |
| <code>whisper-small</code> | Whisper timestamps exceeded the known audio duration and were clamped for normalized artifacts. |
| <code>whisper-tiny</code> | Whisper timestamps exceeded the known audio duration and were clamped for normalized artifacts. |

## Duplicate Groups

| Group | Providers |
| --- | --- |
| duplicate-1 | <code>whisper-medium</code>, <code>whisperfile-medium</code> |

## Notes

- `whisperfile-medium.en` was the most accurate provider on strict speaker-aware WER, scoring 95.00/100.
- `whisperfile-tiny` was the fastest provider in this set at 1.06s.
- `whisperfile-medium.en` lost the most ground once speaker changes were counted, with 1.76 percentage-point gap between text-only and speaker-aware WER.
