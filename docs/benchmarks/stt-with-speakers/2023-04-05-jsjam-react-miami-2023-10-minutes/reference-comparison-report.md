# Consensus Transcript Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/stt-with-speakers/2023-04-05-jsjam-react-miami-2023-10-minutes`
- Total providers: 8 (0 local, 8 third-party service)
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
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

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
| 1 | <code>grok-speech-to-text</code> | $0.0167 | 91.82 | 8.18% | 7.98% | supported | 5.98s | 100.32× realtime | $0.0167 |
| 2 | <code>soniox-stt-async-v5</code> | $0.0167 | 94.72 | 5.28% | 5.22% | supported | 26.75s | 22.43× realtime | $0.0167 |
| 3 | <code>mistral-voxtral-mini-2602</code> | $0.0200 | 94.78 | 5.22% | 4.86% | supported | 10.01s | 59.95× realtime | $0.0200 |
| 4 | <code>speechmatics-melia-1</code> | $0.0215 | 94.84 | 5.16% | 5.04% | supported | 4.97s | 120.82× realtime | $0.0215 |
| 5 | <code>assemblyai-universal-3-5-pro</code> | $0.0383 | 97.69 | 2.31% | 2.28% | supported | 17.10s | 35.08× realtime | $0.0383 |
| 6 | <code>deepgram-nova-3</code> | $0.0970 | 93.30 | 6.70% | 6.30% | supported | 2.93s | 204.99× realtime | $0.0970 |
| 7 | <code>happyscribe-auto</code> | $0.1000 | 97.04 | 2.96% | 2.70% | supported | 71.37s | 8.41× realtime | $0.1000 |
| 8 | <code>gladia-solaria-3</code> | $0.1017 | 94.90 | 5.10% | 4.98% | supported | 10.71s | 56.05× realtime | $0.1017 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>deepgram-nova-3</code> | 2.93s | 93.30 | 6.70% | 6.30% | supported | 2.93s | 204.99× realtime | $0.0970 |
| 2 | <code>speechmatics-melia-1</code> | 4.97s | 94.84 | 5.16% | 5.04% | supported | 4.97s | 120.82× realtime | $0.0215 |
| 3 | <code>grok-speech-to-text</code> | 5.98s | 91.82 | 8.18% | 7.98% | supported | 5.98s | 100.32× realtime | $0.0167 |
| 4 | <code>mistral-voxtral-mini-2602</code> | 10.01s | 94.78 | 5.22% | 4.86% | supported | 10.01s | 59.95× realtime | $0.0200 |
| 5 | <code>gladia-solaria-3</code> | 10.71s | 94.90 | 5.10% | 4.98% | supported | 10.71s | 56.05× realtime | $0.1017 |
| 6 | <code>assemblyai-universal-3-5-pro</code> | 17.10s | 97.69 | 2.31% | 2.28% | supported | 17.10s | 35.08× realtime | $0.0383 |
| 7 | <code>soniox-stt-async-v5</code> | 26.75s | 94.72 | 5.28% | 5.22% | supported | 26.75s | 22.43× realtime | $0.0167 |
| 8 | <code>happyscribe-auto</code> | 71.37s | 97.04 | 2.96% | 2.70% | supported | 71.37s | 8.41× realtime | $0.1000 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>assemblyai-universal-3-5-pro</code> | 97.69/100 quality score | 97.69 | 2.31% | 2.28% | supported | 17.10s | 35.08× realtime | $0.0383 |
| 2 | <code>happyscribe-auto</code> | 97.04/100 quality score | 97.04 | 2.96% | 2.70% | supported | 71.37s | 8.41× realtime | $0.1000 |
| 3 | <code>gladia-solaria-3</code> | 94.90/100 quality score | 94.90 | 5.10% | 4.98% | supported | 10.71s | 56.05× realtime | $0.1017 |
| 4 | <code>speechmatics-melia-1</code> | 94.84/100 quality score | 94.84 | 5.16% | 5.04% | supported | 4.97s | 120.82× realtime | $0.0215 |
| 5 | <code>mistral-voxtral-mini-2602</code> | 94.78/100 quality score | 94.78 | 5.22% | 4.86% | supported | 10.01s | 59.95× realtime | $0.0200 |
| 6 | <code>soniox-stt-async-v5</code> | 94.72/100 quality score | 94.72 | 5.28% | 5.22% | supported | 26.75s | 22.43× realtime | $0.0167 |
| 7 | <code>deepgram-nova-3</code> | 93.30/100 quality score | 93.30 | 6.70% | 6.30% | supported | 2.93s | 204.99× realtime | $0.0970 |
| 8 | <code>grok-speech-to-text</code> | 91.82/100 quality score | 91.82 | 8.18% | 7.98% | supported | 5.98s | 100.32× realtime | $0.0167 |


## Provider Detail

| Provider | Group | Diarization | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Throughput | Actual Cost |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| <code>assemblyai-universal-3-5-pro</code> | Third-Party Service Diarization | supported | 97.69 | 2.31% | 2.28% | 17.10s | 35.08× realtime | $0.0383 |
| <code>deepgram-nova-3</code> | Third-Party Service Diarization | supported | 93.30 | 6.70% | 6.30% | 2.93s | 204.99× realtime | $0.0970 |
| <code>gladia-solaria-3</code> | Third-Party Service Diarization | supported | 94.90 | 5.10% | 4.98% | 10.71s | 56.05× realtime | $0.1017 |
| <code>grok-speech-to-text</code> | Third-Party Service Diarization | supported | 91.82 | 8.18% | 7.98% | 5.98s | 100.32× realtime | $0.0167 |
| <code>happyscribe-auto</code> | Third-Party Service Diarization | supported | 97.04 | 2.96% | 2.70% | 71.37s | 8.41× realtime | $0.1000 |
| <code>mistral-voxtral-mini-2602</code> | Third-Party Service Diarization | supported | 94.78 | 5.22% | 4.86% | 10.01s | 59.95× realtime | $0.0200 |
| <code>soniox-stt-async-v5</code> | Third-Party Service Diarization | supported | 94.72 | 5.28% | 5.22% | 26.75s | 22.43× realtime | $0.0167 |
| <code>speechmatics-melia-1</code> | Third-Party Service Diarization | supported | 94.84 | 5.16% | 5.04% | 4.97s | 120.82× realtime | $0.0215 |

## Error Breakdown (Speaker-aware)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>assemblyai-universal-3-5-pro</code> | 19 | 13 | 7 | 1687 |
| <code>deepgram-nova-3</code> | 35 | 30 | 48 | 1687 |
| <code>gladia-solaria-3</code> | 26 | 17 | 43 | 1687 |
| <code>grok-speech-to-text</code> | 32 | 67 | 39 | 1687 |
| <code>happyscribe-auto</code> | 15 | 22 | 13 | 1687 |
| <code>mistral-voxtral-mini-2602</code> | 25 | 40 | 23 | 1687 |
| <code>soniox-stt-async-v5</code> | 30 | 32 | 27 | 1687 |
| <code>speechmatics-melia-1</code> | 32 | 13 | 42 | 1687 |

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>assemblyai-universal-3-5-pro</code> | 18 | 12 | 8 | 1667 |
| <code>deepgram-nova-3</code> | 34 | 26 | 45 | 1667 |
| <code>gladia-solaria-3</code> | 24 | 17 | 42 | 1667 |
| <code>grok-speech-to-text</code> | 30 | 64 | 39 | 1667 |
| <code>happyscribe-auto</code> | 13 | 20 | 12 | 1667 |
| <code>mistral-voxtral-mini-2602</code> | 23 | 36 | 22 | 1667 |
| <code>soniox-stt-async-v5</code> | 29 | 32 | 26 | 1667 |
| <code>speechmatics-melia-1</code> | 30 | 13 | 41 | 1667 |

## Quality Flags

No provider quality flags were detected.

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `assemblyai-universal-3-5-pro` was the most accurate provider on strict speaker-aware WER, scoring 97.69/100.
- `deepgram-nova-3` was the fastest provider in this set at 2.93s.
- `deepgram-nova-3` lost the most ground once speaker changes were counted, with 0.40 percentage-point gap between text-only and speaker-aware WER.
