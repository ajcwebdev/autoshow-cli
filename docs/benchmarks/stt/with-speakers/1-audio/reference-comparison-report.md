# Consensus Transcript Comparison Report

## Summary

- Run directory: `docs/benchmarks/stt/with-speakers/1-audio`
- Total providers: 11 (0 local, 11 third-party service)
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

| Rank | Provider                                      | Value   | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput      | Actual Cost |
| ---: | --------------------------------------------- | ------: | ----------: | ----------------: | ------------: | ----------- | --------------: | --------------: | ----------: |
| 1    | <code>grok-grok-voice-transcribe-2.0</code>   | $0.0017 | 97.27       | 2.73%             | 2.78%         | supported   | 1.43s           | 41.64× realtime | $0.0017     |
| 2    | <code>grok-speech-to-text</code>              | $0.0017 | 85.45       | 14.55%            | 14.81%        | supported   | 1.02s           | 58.42× realtime | $0.0017     |
| 3    | <code>soniox-stt-async-v5</code>              | $0.0017 | 97.73       | 2.27%             | 2.31%         | supported   | 3.85s           | 15.47× realtime | $0.0017     |
| 4    | <code>speechmatics-melia-1</code>             | $0.0021 | 97.73       | 2.27%             | 2.31%         | supported   | 2.80s           | 21.26× realtime | $0.0021     |
| 5    | <code>mistral-voxtral-mini-2602</code>        | $0.0030 | 96.36       | 3.64%             | 3.70%         | supported   | 4.89s           | 12.17× realtime | $0.0030     |
| 6    | <code>assemblyai-universal-3-5-pro</code>     | $0.0038 | 98.64       | 1.36%             | 1.39%         | supported   | 7.71s           | 7.72× realtime  | $0.0038     |
| 7    | <code>deepgram-nova-3</code>                  | $0.0043 | 91.82       | 8.18%             | 6.48%         | supported   | 2.86s           | 20.85× realtime | $0.0043     |
| 8    | <code>gemini-stt-gemini-3.5-transcribe</code> | $0.0050 | 97.27       | 2.73%             | 2.78%         | supported   | 5.45s           | 10.94× realtime | $0.0050     |
| 9    | <code>cloudflare-@cf_deepgram_nova-3</code>   | $0.0052 | 93.64       | 6.36%             | 6.48%         | supported   | 2.29s           | 26.03× realtime | $0.0052     |
| 10   | <code>happyscribe-auto</code>                 | $0.0099 | 99.09       | 0.91%             | 0.93%         | supported   | 50.34s          | 1.18× realtime  | $0.0099     |
| 11   | <code>gladia-solaria-3</code>                 | $0.0101 | 96.82       | 3.18%             | 3.24%         | supported   | 8.77s           | 6.79× realtime  | $0.0101     |

#### Speed

| Rank | Provider                                      | Value  | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput      | Actual Cost |
| ---: | --------------------------------------------- | -----: | ----------: | ----------------: | ------------: | ----------- | --------------: | --------------: | ----------: |
| 1    | <code>grok-speech-to-text</code>              | 1.02s  | 85.45       | 14.55%            | 14.81%        | supported   | 1.02s           | 58.42× realtime | $0.0017     |
| 2    | <code>grok-grok-voice-transcribe-2.0</code>   | 1.43s  | 97.27       | 2.73%             | 2.78%         | supported   | 1.43s           | 41.64× realtime | $0.0017     |
| 3    | <code>cloudflare-@cf_deepgram_nova-3</code>   | 2.29s  | 93.64       | 6.36%             | 6.48%         | supported   | 2.29s           | 26.03× realtime | $0.0052     |
| 4    | <code>speechmatics-melia-1</code>             | 2.80s  | 97.73       | 2.27%             | 2.31%         | supported   | 2.80s           | 21.26× realtime | $0.0021     |
| 5    | <code>deepgram-nova-3</code>                  | 2.86s  | 91.82       | 8.18%             | 6.48%         | supported   | 2.86s           | 20.85× realtime | $0.0043     |
| 6    | <code>soniox-stt-async-v5</code>              | 3.85s  | 97.73       | 2.27%             | 2.31%         | supported   | 3.85s           | 15.47× realtime | $0.0017     |
| 7    | <code>mistral-voxtral-mini-2602</code>        | 4.89s  | 96.36       | 3.64%             | 3.70%         | supported   | 4.89s           | 12.17× realtime | $0.0030     |
| 8    | <code>gemini-stt-gemini-3.5-transcribe</code> | 5.45s  | 97.27       | 2.73%             | 2.78%         | supported   | 5.45s           | 10.94× realtime | $0.0050     |
| 9    | <code>assemblyai-universal-3-5-pro</code>     | 7.71s  | 98.64       | 1.36%             | 1.39%         | supported   | 7.71s           | 7.72× realtime  | $0.0038     |
| 10   | <code>gladia-solaria-3</code>                 | 8.77s  | 96.82       | 3.18%             | 3.24%         | supported   | 8.77s           | 6.79× realtime  | $0.0101     |
| 11   | <code>happyscribe-auto</code>                 | 50.34s | 99.09       | 0.91%             | 0.93%         | supported   | 50.34s          | 1.18× realtime  | $0.0099     |

#### Quality Score

| Rank | Provider                                      | Value                   | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput      | Actual Cost |
| ---: | --------------------------------------------- | ----------------------: | ----------: | ----------------: | ------------: | ----------- | --------------: | --------------: | ----------: |
| 1    | <code>happyscribe-auto</code>                 | 99.09/100 quality score | 99.09       | 0.91%             | 0.93%         | supported   | 50.34s          | 1.18× realtime  | $0.0099     |
| 2    | <code>assemblyai-universal-3-5-pro</code>     | 98.64/100 quality score | 98.64       | 1.36%             | 1.39%         | supported   | 7.71s           | 7.72× realtime  | $0.0038     |
| 3    | <code>soniox-stt-async-v5</code>              | 97.73/100 quality score | 97.73       | 2.27%             | 2.31%         | supported   | 3.85s           | 15.47× realtime | $0.0017     |
| 4    | <code>speechmatics-melia-1</code>             | 97.73/100 quality score | 97.73       | 2.27%             | 2.31%         | supported   | 2.80s           | 21.26× realtime | $0.0021     |
| 5    | <code>gemini-stt-gemini-3.5-transcribe</code> | 97.27/100 quality score | 97.27       | 2.73%             | 2.78%         | supported   | 5.45s           | 10.94× realtime | $0.0050     |
| 6    | <code>grok-grok-voice-transcribe-2.0</code>   | 97.27/100 quality score | 97.27       | 2.73%             | 2.78%         | supported   | 1.43s           | 41.64× realtime | $0.0017     |
| 7    | <code>gladia-solaria-3</code>                 | 96.82/100 quality score | 96.82       | 3.18%             | 3.24%         | supported   | 8.77s           | 6.79× realtime  | $0.0101     |
| 8    | <code>mistral-voxtral-mini-2602</code>        | 96.36/100 quality score | 96.36       | 3.64%             | 3.70%         | supported   | 4.89s           | 12.17× realtime | $0.0030     |
| 9    | <code>cloudflare-@cf_deepgram_nova-3</code>   | 93.64/100 quality score | 93.64       | 6.36%             | 6.48%         | supported   | 2.29s           | 26.03× realtime | $0.0052     |
| 10   | <code>deepgram-nova-3</code>                  | 91.82/100 quality score | 91.82       | 8.18%             | 6.48%         | supported   | 2.86s           | 20.85× realtime | $0.0043     |
| 11   | <code>grok-speech-to-text</code>              | 85.45/100 quality score | 85.45       | 14.55%            | 14.81%        | supported   | 1.02s           | 58.42× realtime | $0.0017     |


## Provider Detail

| Provider                                      | Group                           | Diarization | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Throughput      | Actual Cost |
| --------------------------------------------- | ------------------------------- | ----------- | ----------: | ----------------: | ------------: | --------------: | --------------: | ----------: |
| <code>assemblyai-universal-3-5-pro</code>     | Third-Party Service Diarization | supported   | 98.64       | 1.36%             | 1.39%         | 7.71s           | 7.72× realtime  | $0.0038     |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | Third-Party Service Diarization | supported   | 93.64       | 6.36%             | 6.48%         | 2.29s           | 26.03× realtime | $0.0052     |
| <code>deepgram-nova-3</code>                  | Third-Party Service Diarization | supported   | 91.82       | 8.18%             | 6.48%         | 2.86s           | 20.85× realtime | $0.0043     |
| <code>gemini-stt-gemini-3.5-transcribe</code> | Third-Party Service Diarization | supported   | 97.27       | 2.73%             | 2.78%         | 5.45s           | 10.94× realtime | $0.0050     |
| <code>gladia-solaria-3</code>                 | Third-Party Service Diarization | supported   | 96.82       | 3.18%             | 3.24%         | 8.77s           | 6.79× realtime  | $0.0101     |
| <code>grok-grok-voice-transcribe-2.0</code>   | Third-Party Service Diarization | supported   | 97.27       | 2.73%             | 2.78%         | 1.43s           | 41.64× realtime | $0.0017     |
| <code>grok-speech-to-text</code>              | Third-Party Service Diarization | supported   | 85.45       | 14.55%            | 14.81%        | 1.02s           | 58.42× realtime | $0.0017     |
| <code>happyscribe-auto</code>                 | Third-Party Service Diarization | supported   | 99.09       | 0.91%             | 0.93%         | 50.34s          | 1.18× realtime  | $0.0099     |
| <code>mistral-voxtral-mini-2602</code>        | Third-Party Service Diarization | supported   | 96.36       | 3.64%             | 3.70%         | 4.89s           | 12.17× realtime | $0.0030     |
| <code>soniox-stt-async-v5</code>              | Third-Party Service Diarization | supported   | 97.73       | 2.27%             | 2.31%         | 3.85s           | 15.47× realtime | $0.0017     |
| <code>speechmatics-melia-1</code>             | Third-Party Service Diarization | supported   | 97.73       | 2.27%             | 2.31%         | 2.80s           | 21.26× realtime | $0.0021     |

## Error Breakdown (Speaker-aware)

| Provider                                      | Substitutions | Deletions | Insertions | Ref. Words |
| --------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>assemblyai-universal-3-5-pro</code>     | 0             | 1         | 2          | 220        |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | 5             | 8         | 1          | 220        |
| <code>deepgram-nova-3</code>                  | 5             | 11        | 2          | 220        |
| <code>gemini-stt-gemini-3.5-transcribe</code> | 2             | 2         | 2          | 220        |
| <code>gladia-solaria-3</code>                 | 3             | 1         | 3          | 220        |
| <code>grok-grok-voice-transcribe-2.0</code>   | 2             | 1         | 3          | 220        |
| <code>grok-speech-to-text</code>              | 8             | 19        | 5          | 220        |
| <code>happyscribe-auto</code>                 | 0             | 1         | 1          | 220        |
| <code>mistral-voxtral-mini-2602</code>        | 1             | 7         | 0          | 220        |
| <code>soniox-stt-async-v5</code>              | 1             | 4         | 0          | 220        |
| <code>speechmatics-melia-1</code>             | 1             | 3         | 1          | 220        |

## Error Breakdown (Text-only)

| Provider                                      | Substitutions | Deletions | Insertions | Ref. Words |
| --------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>assemblyai-universal-3-5-pro</code>     | 0             | 1         | 2          | 216        |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | 5             | 8         | 1          | 216        |
| <code>deepgram-nova-3</code>                  | 5             | 8         | 1          | 216        |
| <code>gemini-stt-gemini-3.5-transcribe</code> | 2             | 2         | 2          | 216        |
| <code>gladia-solaria-3</code>                 | 3             | 1         | 3          | 216        |
| <code>grok-grok-voice-transcribe-2.0</code>   | 2             | 1         | 3          | 216        |
| <code>grok-speech-to-text</code>              | 8             | 19        | 5          | 216        |
| <code>happyscribe-auto</code>                 | 0             | 1         | 1          | 216        |
| <code>mistral-voxtral-mini-2602</code>        | 1             | 7         | 0          | 216        |
| <code>soniox-stt-async-v5</code>              | 1             | 4         | 0          | 216        |
| <code>speechmatics-melia-1</code>             | 1             | 3         | 1          | 216        |

## Quality Flags

No provider quality flags were detected.

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `happyscribe-auto` was the most accurate provider on strict speaker-aware WER, scoring 99.09/100.
- `grok-speech-to-text` was the fastest provider in this set at 1.02s.
- `deepgram-nova-3` lost the most ground once speaker changes were counted, with 1.70 percentage-point gap between text-only and speaker-aware WER.
