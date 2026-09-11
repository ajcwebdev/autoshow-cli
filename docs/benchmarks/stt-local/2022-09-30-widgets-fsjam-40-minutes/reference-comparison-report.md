# Consensus Transcript Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/stt-local/2022-09-30-widgets-fsjam-40-minutes`
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
| 1 | <code>whisper-base</code> | $0.00 local monetary cost | 93.45 | 6.55% | 5.86% | not-supported | 54.26s | 44.66× realtime | $0.00 |
| 2 | <code>whisper-large-v3-turbo</code> | $0.00 local monetary cost | 96.49 | 3.51% | 2.77% | not-supported | 168.76s | 14.36× realtime | $0.00 |
| 3 | <code>whisper-medium</code> | $0.00 local monetary cost | 94.93 | 5.07% | 4.33% | not-supported | 234.87s | 10.32× realtime | $0.00 |
| 4 | <code>whisper-small</code> | $0.00 local monetary cost | 95.49 | 4.51% | 3.75% | not-supported | 99.21s | 24.42× realtime | $0.00 |
| 5 | <code>whisper-tiny</code> | $0.00 local monetary cost | 90.81 | 9.19% | 8.52% | not-supported | 39.65s | 61.11× realtime | $0.00 |
| 6 | <code>whisperfile-large-v2</code> | $0.00 local monetary cost | 95.15 | 4.85% | 4.12% | not-supported | 963.11s | 2.52× realtime | $0.00 |
| 7 | <code>whisperfile-large-v3</code> | $0.00 local monetary cost | 93.76 | 6.24% | 5.53% | not-supported | 851.22s | 2.85× realtime | $0.00 |
| 8 | <code>whisperfile-medium</code> | $0.00 local monetary cost | 95.30 | 4.70% | 3.96% | not-supported | 499.14s | 4.85× realtime | $0.00 |
| 9 | <code>whisperfile-medium.en</code> | $0.00 local monetary cost | 95.96 | 4.04% | 3.28% | not-supported | 502.69s | 4.82× realtime | $0.00 |
| 10 | <code>whisperfile-small</code> | $0.00 local monetary cost | 95.20 | 4.80% | 4.06% | not-supported | 194.64s | 12.45× realtime | $0.00 |
| 11 | <code>whisperfile-small.en</code> | $0.00 local monetary cost | 95.08 | 4.92% | 4.20% | not-supported | 168.12s | 14.41× realtime | $0.00 |
| 12 | <code>whisperfile-tiny</code> | $0.00 local monetary cost | 90.37 | 9.63% | 8.95% | not-supported | 39.82s | 60.85× realtime | $0.00 |
| 13 | <code>whisperfile-tiny.en</code> | $0.00 local monetary cost | 91.22 | 8.78% | 8.09% | not-supported | 40.06s | 60.49× realtime | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>whisper-tiny</code> | 39.65s | 90.81 | 9.19% | 8.52% | not-supported | 39.65s | 61.11× realtime | $0.00 |
| 2 | <code>whisperfile-tiny</code> | 39.82s | 90.37 | 9.63% | 8.95% | not-supported | 39.82s | 60.85× realtime | $0.00 |
| 3 | <code>whisperfile-tiny.en</code> | 40.06s | 91.22 | 8.78% | 8.09% | not-supported | 40.06s | 60.49× realtime | $0.00 |
| 4 | <code>whisper-base</code> | 54.26s | 93.45 | 6.55% | 5.86% | not-supported | 54.26s | 44.66× realtime | $0.00 |
| 5 | <code>whisper-small</code> | 99.21s | 95.49 | 4.51% | 3.75% | not-supported | 99.21s | 24.42× realtime | $0.00 |
| 6 | <code>whisperfile-small.en</code> | 168.12s | 95.08 | 4.92% | 4.20% | not-supported | 168.12s | 14.41× realtime | $0.00 |
| 7 | <code>whisper-large-v3-turbo</code> | 168.76s | 96.49 | 3.51% | 2.77% | not-supported | 168.76s | 14.36× realtime | $0.00 |
| 8 | <code>whisperfile-small</code> | 194.64s | 95.20 | 4.80% | 4.06% | not-supported | 194.64s | 12.45× realtime | $0.00 |
| 9 | <code>whisper-medium</code> | 234.87s | 94.93 | 5.07% | 4.33% | not-supported | 234.87s | 10.32× realtime | $0.00 |
| 10 | <code>whisperfile-medium</code> | 499.14s | 95.30 | 4.70% | 3.96% | not-supported | 499.14s | 4.85× realtime | $0.00 |
| 11 | <code>whisperfile-medium.en</code> | 502.69s | 95.96 | 4.04% | 3.28% | not-supported | 502.69s | 4.82× realtime | $0.00 |
| 12 | <code>whisperfile-large-v3</code> | 851.22s | 93.76 | 6.24% | 5.53% | not-supported | 851.22s | 2.85× realtime | $0.00 |
| 13 | <code>whisperfile-large-v2</code> | 963.11s | 95.15 | 4.85% | 4.12% | not-supported | 963.11s | 2.52× realtime | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>whisper-large-v3-turbo</code> | 96.49/100 quality score | 96.49 | 3.51% | 2.77% | not-supported | 168.76s | 14.36× realtime | $0.00 |
| 2 | <code>whisperfile-medium.en</code> | 95.96/100 quality score | 95.96 | 4.04% | 3.28% | not-supported | 502.69s | 4.82× realtime | $0.00 |
| 3 | <code>whisper-small</code> | 95.49/100 quality score | 95.49 | 4.51% | 3.75% | not-supported | 99.21s | 24.42× realtime | $0.00 |
| 4 | <code>whisperfile-medium</code> | 95.30/100 quality score | 95.30 | 4.70% | 3.96% | not-supported | 499.14s | 4.85× realtime | $0.00 |
| 5 | <code>whisperfile-small</code> | 95.20/100 quality score | 95.20 | 4.80% | 4.06% | not-supported | 194.64s | 12.45× realtime | $0.00 |
| 6 | <code>whisperfile-large-v2</code> | 95.15/100 quality score | 95.15 | 4.85% | 4.12% | not-supported | 963.11s | 2.52× realtime | $0.00 |
| 7 | <code>whisperfile-small.en</code> | 95.08/100 quality score | 95.08 | 4.92% | 4.20% | not-supported | 168.12s | 14.41× realtime | $0.00 |
| 8 | <code>whisper-medium</code> | 94.93/100 quality score | 94.93 | 5.07% | 4.33% | not-supported | 234.87s | 10.32× realtime | $0.00 |
| 9 | <code>whisperfile-large-v3</code> | 93.76/100 quality score | 93.76 | 6.24% | 5.53% | not-supported | 851.22s | 2.85× realtime | $0.00 |
| 10 | <code>whisper-base</code> | 93.45/100 quality score | 93.45 | 6.55% | 5.86% | not-supported | 54.26s | 44.66× realtime | $0.00 |
| 11 | <code>whisperfile-tiny.en</code> | 91.22/100 quality score | 91.22 | 8.78% | 8.09% | not-supported | 40.06s | 60.49× realtime | $0.00 |
| 12 | <code>whisper-tiny</code> | 90.81/100 quality score | 90.81 | 9.19% | 8.52% | not-supported | 39.65s | 61.11× realtime | $0.00 |
| 13 | <code>whisperfile-tiny</code> | 90.37/100 quality score | 90.37 | 9.63% | 8.95% | not-supported | 39.82s | 60.85× realtime | $0.00 |

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
| <code>whisper-base</code> | Local | not-supported | 93.45 | 6.55% | 5.86% | 54.26s | 44.66× realtime | $0.00 |
| <code>whisper-large-v3-turbo</code> | Local | not-supported | 96.49 | 3.51% | 2.77% | 168.76s | 14.36× realtime | $0.00 |
| <code>whisper-medium</code> | Local | not-supported | 94.93 | 5.07% | 4.33% | 234.87s | 10.32× realtime | $0.00 |
| <code>whisper-small</code> | Local | not-supported | 95.49 | 4.51% | 3.75% | 99.21s | 24.42× realtime | $0.00 |
| <code>whisper-tiny</code> | Local | not-supported | 90.81 | 9.19% | 8.52% | 39.65s | 61.11× realtime | $0.00 |
| <code>whisperfile-large-v2</code> | Local | not-supported | 95.15 | 4.85% | 4.12% | 963.11s | 2.52× realtime | $0.00 |
| <code>whisperfile-large-v3</code> | Local | not-supported | 93.76 | 6.24% | 5.53% | 851.22s | 2.85× realtime | $0.00 |
| <code>whisperfile-medium</code> | Local | not-supported | 95.30 | 4.70% | 3.96% | 499.14s | 4.85× realtime | $0.00 |
| <code>whisperfile-medium.en</code> | Local | not-supported | 95.96 | 4.04% | 3.28% | 502.69s | 4.82× realtime | $0.00 |
| <code>whisperfile-small</code> | Local | not-supported | 95.20 | 4.80% | 4.06% | 194.64s | 12.45× realtime | $0.00 |
| <code>whisperfile-small.en</code> | Local | not-supported | 95.08 | 4.92% | 4.20% | 168.12s | 14.41× realtime | $0.00 |
| <code>whisperfile-tiny</code> | Local | not-supported | 90.37 | 9.63% | 8.95% | 39.82s | 60.85× realtime | $0.00 |
| <code>whisperfile-tiny.en</code> | Local | not-supported | 91.22 | 8.78% | 8.09% | 40.06s | 60.49× realtime | $0.00 |

## Error Breakdown (Speaker-aware)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>whisper-base</code> | 262 | 178 | 99 | 8226 |
| <code>whisper-large-v3-turbo</code> | 126 | 104 | 59 | 8226 |
| <code>whisper-medium</code> | 207 | 135 | 75 | 8226 |
| <code>whisper-small</code> | 164 | 151 | 56 | 8226 |
| <code>whisper-tiny</code> | 408 | 214 | 134 | 8226 |
| <code>whisperfile-large-v2</code> | 143 | 183 | 73 | 8226 |
| <code>whisperfile-large-v3</code> | 168 | 164 | 181 | 8226 |
| <code>whisperfile-medium</code> | 162 | 156 | 69 | 8226 |
| <code>whisperfile-medium.en</code> | 132 | 155 | 45 | 8226 |
| <code>whisperfile-small</code> | 183 | 144 | 68 | 8226 |
| <code>whisperfile-small.en</code> | 182 | 141 | 82 | 8226 |
| <code>whisperfile-tiny</code> | 423 | 237 | 132 | 8226 |
| <code>whisperfile-tiny.en</code> | 328 | 215 | 179 | 8226 |

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>whisper-base</code> | 254 | 119 | 105 | 8160 |
| <code>whisper-large-v3-turbo</code> | 120 | 43 | 63 | 8160 |
| <code>whisper-medium</code> | 198 | 75 | 80 | 8160 |
| <code>whisper-small</code> | 160 | 88 | 58 | 8160 |
| <code>whisper-tiny</code> | 398 | 156 | 141 | 8160 |
| <code>whisperfile-large-v2</code> | 139 | 121 | 76 | 8160 |
| <code>whisperfile-large-v3</code> | 157 | 106 | 188 | 8160 |
| <code>whisperfile-medium</code> | 157 | 94 | 72 | 8160 |
| <code>whisperfile-medium.en</code> | 129 | 92 | 47 | 8160 |
| <code>whisperfile-small</code> | 178 | 82 | 71 | 8160 |
| <code>whisperfile-small.en</code> | 173 | 82 | 88 | 8160 |
| <code>whisperfile-tiny</code> | 412 | 179 | 139 | 8160 |
| <code>whisperfile-tiny.en</code> | 319 | 156 | 185 | 8160 |

## Quality Flags

| Provider | Quality Flags |
| --- | --- |
| <code>whisper-medium</code> | Whisper timestamps exceeded the known audio duration and were clamped for normalized artifacts. |

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `whisper-large-v3-turbo` was the most accurate provider on strict speaker-aware WER, scoring 96.49/100.
- `whisper-tiny` was the fastest provider in this set at 39.65s.
- `whisper-small` lost the most ground once speaker changes were counted, with 0.76 percentage-point gap between text-only and speaker-aware WER.
