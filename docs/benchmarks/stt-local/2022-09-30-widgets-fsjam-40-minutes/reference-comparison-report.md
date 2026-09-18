# Consensus Transcript Comparison Report

## Summary

- Run directory: `docs/benchmarks/stt-local/2022-09-30-widgets-fsjam-40-minutes`
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
| 1 | <code>whisperfile-large-v2</code> | $0.00 local monetary cost | 95.15 | 4.85% | 4.12% | not-supported | 963.11s | 2.52× realtime | $0.00 |
| 2 | <code>whisperfile-large-v3</code> | $0.00 local monetary cost | 93.76 | 6.24% | 5.53% | not-supported | 851.22s | 2.85× realtime | $0.00 |
| 3 | <code>whisperfile-medium</code> | $0.00 local monetary cost | 95.30 | 4.70% | 3.96% | not-supported | 499.14s | 4.85× realtime | $0.00 |
| 4 | <code>whisperfile-medium.en</code> | $0.00 local monetary cost | 95.96 | 4.04% | 3.28% | not-supported | 502.69s | 4.82× realtime | $0.00 |
| 5 | <code>whisperfile-small</code> | $0.00 local monetary cost | 95.20 | 4.80% | 4.06% | not-supported | 194.64s | 12.45× realtime | $0.00 |
| 6 | <code>whisperfile-small.en</code> | $0.00 local monetary cost | 95.08 | 4.92% | 4.20% | not-supported | 168.12s | 14.41× realtime | $0.00 |
| 7 | <code>whisperfile-tiny</code> | $0.00 local monetary cost | 90.37 | 9.63% | 8.95% | not-supported | 39.82s | 60.85× realtime | $0.00 |
| 8 | <code>whisperfile-tiny.en</code> | $0.00 local monetary cost | 91.22 | 8.78% | 8.09% | not-supported | 40.06s | 60.49× realtime | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>whisperfile-tiny</code> | 39.82s | 90.37 | 9.63% | 8.95% | not-supported | 39.82s | 60.85× realtime | $0.00 |
| 2 | <code>whisperfile-tiny.en</code> | 40.06s | 91.22 | 8.78% | 8.09% | not-supported | 40.06s | 60.49× realtime | $0.00 |
| 3 | <code>whisperfile-small.en</code> | 168.12s | 95.08 | 4.92% | 4.20% | not-supported | 168.12s | 14.41× realtime | $0.00 |
| 4 | <code>whisperfile-small</code> | 194.64s | 95.20 | 4.80% | 4.06% | not-supported | 194.64s | 12.45× realtime | $0.00 |
| 5 | <code>whisperfile-medium</code> | 499.14s | 95.30 | 4.70% | 3.96% | not-supported | 499.14s | 4.85× realtime | $0.00 |
| 6 | <code>whisperfile-medium.en</code> | 502.69s | 95.96 | 4.04% | 3.28% | not-supported | 502.69s | 4.82× realtime | $0.00 |
| 7 | <code>whisperfile-large-v3</code> | 851.22s | 93.76 | 6.24% | 5.53% | not-supported | 851.22s | 2.85× realtime | $0.00 |
| 8 | <code>whisperfile-large-v2</code> | 963.11s | 95.15 | 4.85% | 4.12% | not-supported | 963.11s | 2.52× realtime | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>whisperfile-medium.en</code> | 95.96/100 quality score | 95.96 | 4.04% | 3.28% | not-supported | 502.69s | 4.82× realtime | $0.00 |
| 2 | <code>whisperfile-medium</code> | 95.30/100 quality score | 95.30 | 4.70% | 3.96% | not-supported | 499.14s | 4.85× realtime | $0.00 |
| 3 | <code>whisperfile-small</code> | 95.20/100 quality score | 95.20 | 4.80% | 4.06% | not-supported | 194.64s | 12.45× realtime | $0.00 |
| 4 | <code>whisperfile-large-v2</code> | 95.15/100 quality score | 95.15 | 4.85% | 4.12% | not-supported | 963.11s | 2.52× realtime | $0.00 |
| 5 | <code>whisperfile-small.en</code> | 95.08/100 quality score | 95.08 | 4.92% | 4.20% | not-supported | 168.12s | 14.41× realtime | $0.00 |
| 6 | <code>whisperfile-large-v3</code> | 93.76/100 quality score | 93.76 | 6.24% | 5.53% | not-supported | 851.22s | 2.85× realtime | $0.00 |
| 7 | <code>whisperfile-tiny.en</code> | 91.22/100 quality score | 91.22 | 8.78% | 8.09% | not-supported | 40.06s | 60.49× realtime | $0.00 |
| 8 | <code>whisperfile-tiny</code> | 90.37/100 quality score | 90.37 | 9.63% | 8.95% | not-supported | 39.82s | 60.85× realtime | $0.00 |

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
| <code>whisperfile-large-v2</code> | 139 | 121 | 76 | 8160 |
| <code>whisperfile-large-v3</code> | 157 | 106 | 188 | 8160 |
| <code>whisperfile-medium</code> | 157 | 94 | 72 | 8160 |
| <code>whisperfile-medium.en</code> | 129 | 92 | 47 | 8160 |
| <code>whisperfile-small</code> | 178 | 82 | 71 | 8160 |
| <code>whisperfile-small.en</code> | 173 | 82 | 88 | 8160 |
| <code>whisperfile-tiny</code> | 412 | 179 | 139 | 8160 |
| <code>whisperfile-tiny.en</code> | 319 | 156 | 185 | 8160 |

## Quality Flags

No provider quality flags were detected.

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `whisperfile-medium.en` was the most accurate provider on strict speaker-aware WER, scoring 95.96/100.
- Actual provider cost data was unavailable in `manifest.json`.
- `whisperfile-tiny` was the fastest provider in this set at 39.82s.
- `whisperfile-medium.en` lost the most ground once speaker changes were counted, with 0.75 percentage-point gap between text-only and speaker-aware WER.
