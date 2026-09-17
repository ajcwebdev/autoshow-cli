# Consensus Transcript Comparison Report

## Summary

- Run directory: `/Users/ajc/c/auto/autoshow-cli/docs/benchmarks/stt-local/1-audio`
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
| 1 | <code>whisperfile-large-v2</code> | $0.00 local monetary cost | 93.18 | 6.82% | 5.09% | not-supported | 28.79s | 2.05× realtime | $0.00 |
| 2 | <code>whisperfile-large-v3</code> | $0.00 local monetary cost | 94.55 | 5.45% | 3.70% | not-supported | 28.30s | 2.08× realtime | $0.00 |
| 3 | <code>whisperfile-medium</code> | $0.00 local monetary cost | 93.18 | 6.82% | 5.09% | not-supported | 14.55s | 4.06× realtime | $0.00 |
| 4 | <code>whisperfile-medium.en</code> | $0.00 local monetary cost | 95.00 | 5.00% | 3.24% | not-supported | 13.56s | 4.35× realtime | $0.00 |
| 5 | <code>whisperfile-small</code> | $0.00 local monetary cost | 87.73 | 12.27% | 10.65% | not-supported | 4.57s | 12.91× realtime | $0.00 |
| 6 | <code>whisperfile-small.en</code> | $0.00 local monetary cost | 94.09 | 5.91% | 4.17% | not-supported | 4.73s | 12.48× realtime | $0.00 |
| 7 | <code>whisperfile-tiny</code> | $0.00 local monetary cost | 86.36 | 13.64% | 12.04% | not-supported | 1.06s | 55.50× realtime | $0.00 |
| 8 | <code>whisperfile-tiny.en</code> | $0.00 local monetary cost | 93.18 | 6.82% | 5.09% | not-supported | 1.08s | 54.73× realtime | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>whisperfile-tiny</code> | 1.06s | 86.36 | 13.64% | 12.04% | not-supported | 1.06s | 55.50× realtime | $0.00 |
| 2 | <code>whisperfile-tiny.en</code> | 1.08s | 93.18 | 6.82% | 5.09% | not-supported | 1.08s | 54.73× realtime | $0.00 |
| 3 | <code>whisperfile-small</code> | 4.57s | 87.73 | 12.27% | 10.65% | not-supported | 4.57s | 12.91× realtime | $0.00 |
| 4 | <code>whisperfile-small.en</code> | 4.73s | 94.09 | 5.91% | 4.17% | not-supported | 4.73s | 12.48× realtime | $0.00 |
| 5 | <code>whisperfile-medium.en</code> | 13.56s | 95.00 | 5.00% | 3.24% | not-supported | 13.56s | 4.35× realtime | $0.00 |
| 6 | <code>whisperfile-medium</code> | 14.55s | 93.18 | 6.82% | 5.09% | not-supported | 14.55s | 4.06× realtime | $0.00 |
| 7 | <code>whisperfile-large-v3</code> | 28.30s | 94.55 | 5.45% | 3.70% | not-supported | 28.30s | 2.08× realtime | $0.00 |
| 8 | <code>whisperfile-large-v2</code> | 28.79s | 93.18 | 6.82% | 5.09% | not-supported | 28.79s | 2.05× realtime | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>whisperfile-medium.en</code> | 95.00/100 quality score | 95.00 | 5.00% | 3.24% | not-supported | 13.56s | 4.35× realtime | $0.00 |
| 2 | <code>whisperfile-large-v3</code> | 94.55/100 quality score | 94.55 | 5.45% | 3.70% | not-supported | 28.30s | 2.08× realtime | $0.00 |
| 3 | <code>whisperfile-small.en</code> | 94.09/100 quality score | 94.09 | 5.91% | 4.17% | not-supported | 4.73s | 12.48× realtime | $0.00 |
| 4 | <code>whisperfile-large-v2</code> | 93.18/100 quality score | 93.18 | 6.82% | 5.09% | not-supported | 28.79s | 2.05× realtime | $0.00 |
| 5 | <code>whisperfile-medium</code> | 93.18/100 quality score | 93.18 | 6.82% | 5.09% | not-supported | 14.55s | 4.06× realtime | $0.00 |
| 6 | <code>whisperfile-tiny.en</code> | 93.18/100 quality score | 93.18 | 6.82% | 5.09% | not-supported | 1.08s | 54.73× realtime | $0.00 |
| 7 | <code>whisperfile-small</code> | 87.73/100 quality score | 87.73 | 12.27% | 10.65% | not-supported | 4.57s | 12.91× realtime | $0.00 |
| 8 | <code>whisperfile-tiny</code> | 86.36/100 quality score | 86.36 | 13.64% | 12.04% | not-supported | 1.06s | 55.50× realtime | $0.00 |

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
| <code>whisperfile-large-v2</code> | 4 | 4 | 3 | 216 |
| <code>whisperfile-large-v3</code> | 1 | 7 | 0 | 216 |
| <code>whisperfile-medium</code> | 6 | 3 | 2 | 216 |
| <code>whisperfile-medium.en</code> | 3 | 2 | 2 | 216 |
| <code>whisperfile-small</code> | 13 | 9 | 1 | 216 |
| <code>whisperfile-small.en</code> | 4 | 3 | 2 | 216 |
| <code>whisperfile-tiny</code> | 15 | 6 | 5 | 216 |
| <code>whisperfile-tiny.en</code> | 4 | 6 | 1 | 216 |

## Quality Flags

No provider quality flags were detected.

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `whisperfile-medium.en` was the most accurate provider on strict speaker-aware WER, scoring 95.00/100.
- Actual provider cost data was unavailable in `manifest.json`.
- `whisperfile-tiny` was the fastest provider in this set at 1.06s.
- `whisperfile-medium.en` lost the most ground once speaker changes were counted, with 1.76 percentage-point gap between text-only and speaker-aware WER.
