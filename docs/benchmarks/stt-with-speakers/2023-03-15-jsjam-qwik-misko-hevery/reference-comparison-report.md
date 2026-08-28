# Consensus Transcript Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/stt-with-speakers/2023-03-15-jsjam-qwik-misko-hevery`
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
| 1 | <code>grok-speech-to-text</code> | $0.1881 | 89.60 | 10.40% | 10.08% | supported | 71.45s | 94.78× realtime | $0.1881 |
| 2 | <code>soniox-stt-async-v5</code> | $0.1881 | 93.38 | 6.62% | 6.14% | supported | 155.42s | 43.57× realtime | $0.1881 |
| 3 | <code>mistral-voxtral-mini-2602</code> | $0.2257 | 94.63 | 5.37% | 5.22% | supported | 73.00s | 92.76× realtime | $0.2257 |
| 4 | <code>speechmatics-melia-1</code> | $0.2427 | 92.56 | 7.44% | 7.27% | supported | 48.30s | 140.20× realtime | $0.2427 |
| 5 | <code>assemblyai-universal-3-5-pro</code> | $0.4327 | 97.94 | 2.06% | 1.72% | supported | 75.36s | 89.87× realtime | $0.4327 |
| 6 | <code>deepgram-nova-3</code> | $1.0948 | 90.94 | 9.06% | 8.70% | supported | 16.42s | 412.52× realtime | $1.0948 |
| 7 | <code>happyscribe-auto</code> | $1.1287 | 96.94 | 3.06% | 2.56% | supported | 128.38s | 52.75× realtime | $1.1287 |
| 8 | <code>gladia-solaria-3</code> | $1.1475 | 93.44 | 6.56% | 6.32% | supported | 76.34s | 88.70× realtime | $1.1475 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>deepgram-nova-3</code> | 16.42s | 90.94 | 9.06% | 8.70% | supported | 16.42s | 412.52× realtime | $1.0948 |
| 2 | <code>speechmatics-melia-1</code> | 48.30s | 92.56 | 7.44% | 7.27% | supported | 48.30s | 140.20× realtime | $0.2427 |
| 3 | <code>grok-speech-to-text</code> | 71.45s | 89.60 | 10.40% | 10.08% | supported | 71.45s | 94.78× realtime | $0.1881 |
| 4 | <code>mistral-voxtral-mini-2602</code> | 73.00s | 94.63 | 5.37% | 5.22% | supported | 73.00s | 92.76× realtime | $0.2257 |
| 5 | <code>assemblyai-universal-3-5-pro</code> | 75.36s | 97.94 | 2.06% | 1.72% | supported | 75.36s | 89.87× realtime | $0.4327 |
| 6 | <code>gladia-solaria-3</code> | 76.34s | 93.44 | 6.56% | 6.32% | supported | 76.34s | 88.70× realtime | $1.1475 |
| 7 | <code>happyscribe-auto</code> | 128.38s | 96.94 | 3.06% | 2.56% | supported | 128.38s | 52.75× realtime | $1.1287 |
| 8 | <code>soniox-stt-async-v5</code> | 155.42s | 93.38 | 6.62% | 6.14% | supported | 155.42s | 43.57× realtime | $0.1881 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>assemblyai-universal-3-5-pro</code> | 97.94/100 quality score | 97.94 | 2.06% | 1.72% | supported | 75.36s | 89.87× realtime | $0.4327 |
| 2 | <code>happyscribe-auto</code> | 96.94/100 quality score | 96.94 | 3.06% | 2.56% | supported | 128.38s | 52.75× realtime | $1.1287 |
| 3 | <code>mistral-voxtral-mini-2602</code> | 94.63/100 quality score | 94.63 | 5.37% | 5.22% | supported | 73.00s | 92.76× realtime | $0.2257 |
| 4 | <code>gladia-solaria-3</code> | 93.44/100 quality score | 93.44 | 6.56% | 6.32% | supported | 76.34s | 88.70× realtime | $1.1475 |
| 5 | <code>soniox-stt-async-v5</code> | 93.38/100 quality score | 93.38 | 6.62% | 6.14% | supported | 155.42s | 43.57× realtime | $0.1881 |
| 6 | <code>speechmatics-melia-1</code> | 92.56/100 quality score | 92.56 | 7.44% | 7.27% | supported | 48.30s | 140.20× realtime | $0.2427 |
| 7 | <code>deepgram-nova-3</code> | 90.94/100 quality score | 90.94 | 9.06% | 8.70% | supported | 16.42s | 412.52× realtime | $1.0948 |
| 8 | <code>grok-speech-to-text</code> | 89.60/100 quality score | 89.60 | 10.40% | 10.08% | supported | 71.45s | 94.78× realtime | $0.1881 |


## Provider Detail

| Provider | Group | Diarization | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Throughput | Actual Cost |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| <code>assemblyai-universal-3-5-pro</code> | Third-Party Service Diarization | supported | 97.94 | 2.06% | 1.72% | 75.36s | 89.87× realtime | $0.4327 |
| <code>deepgram-nova-3</code> | Third-Party Service Diarization | supported | 90.94 | 9.06% | 8.70% | 16.42s | 412.52× realtime | $1.0948 |
| <code>gladia-solaria-3</code> | Third-Party Service Diarization | supported | 93.44 | 6.56% | 6.32% | 76.34s | 88.70× realtime | $1.1475 |
| <code>grok-speech-to-text</code> | Third-Party Service Diarization | supported | 89.60 | 10.40% | 10.08% | 71.45s | 94.78× realtime | $0.1881 |
| <code>happyscribe-auto</code> | Third-Party Service Diarization | supported | 96.94 | 3.06% | 2.56% | 128.38s | 52.75× realtime | $1.1287 |
| <code>mistral-voxtral-mini-2602</code> | Third-Party Service Diarization | supported | 94.63 | 5.37% | 5.22% | 73.00s | 92.76× realtime | $0.2257 |
| <code>soniox-stt-async-v5</code> | Third-Party Service Diarization | supported | 93.38 | 6.62% | 6.14% | 155.42s | 43.57× realtime | $0.1881 |
| <code>speechmatics-melia-1</code> | Third-Party Service Diarization | supported | 92.56 | 7.44% | 7.27% | 48.30s | 140.20× realtime | $0.2427 |

## Error Breakdown (Speaker-aware)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>assemblyai-universal-3-5-pro</code> | -1 | -1 | -1 | 20215 |
| <code>deepgram-nova-3</code> | -1 | -1 | -1 | 20215 |
| <code>gladia-solaria-3</code> | -1 | -1 | -1 | 20215 |
| <code>grok-speech-to-text</code> | -1 | -1 | -1 | 20215 |
| <code>happyscribe-auto</code> | -1 | -1 | -1 | 20215 |
| <code>mistral-voxtral-mini-2602</code> | -1 | -1 | -1 | 20215 |
| <code>soniox-stt-async-v5</code> | -1 | -1 | -1 | 20215 |
| <code>speechmatics-melia-1</code> | -1 | -1 | -1 | 20215 |

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>assemblyai-universal-3-5-pro</code> | -1 | -1 | -1 | 20045 |
| <code>deepgram-nova-3</code> | -1 | -1 | -1 | 20045 |
| <code>gladia-solaria-3</code> | -1 | -1 | -1 | 20045 |
| <code>grok-speech-to-text</code> | -1 | -1 | -1 | 20045 |
| <code>happyscribe-auto</code> | -1 | -1 | -1 | 20045 |
| <code>mistral-voxtral-mini-2602</code> | -1 | -1 | -1 | 20045 |
| <code>soniox-stt-async-v5</code> | -1 | -1 | -1 | 20045 |
| <code>speechmatics-melia-1</code> | -1 | -1 | -1 | 20045 |

## Quality Flags

No provider quality flags were detected.

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `assemblyai-universal-3-5-pro` was the most accurate provider on strict speaker-aware WER, scoring 97.94/100.
- `deepgram-nova-3` was the fastest provider in this set at 16.42s.
- `happyscribe-auto` lost the most ground once speaker changes were counted, with 0.50 percentage-point gap between text-only and speaker-aware WER.
