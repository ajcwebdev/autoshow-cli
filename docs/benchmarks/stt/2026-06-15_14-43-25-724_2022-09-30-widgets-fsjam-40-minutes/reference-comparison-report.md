# Consensus Transcript Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/stt/2026-06-15_14-43-25-724_2022-09-30-widgets-fsjam-40-minutes`
- Total providers: 25 (0 local, 25 third-party service)
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

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput |                 Actual Cost |
| ---: | -------- | ----: | ----------: | ----------------: | ------------: | ----------- | --------------: | ---------: | --------------------------: |
|  n/a | n/a      |   n/a |         n/a |               n/a |           n/a | n/a         |             n/a |        n/a | No providers in this group. |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput |                 Actual Cost |
| ---: | -------- | ----: | ----------: | ----------------: | ------------: | ----------- | --------------: | ---------: | --------------------------: |
|  n/a | n/a      |   n/a |         n/a |               n/a |           n/a | n/a         |             n/a |        n/a | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput |                 Actual Cost |
| ---: | -------- | ----: | ----------: | ----------------: | ------------: | ----------- | --------------: | ---------: | --------------------------: |
|  n/a | n/a      |   n/a |         n/a |               n/a |           n/a | n/a         |             n/a |        n/a | No providers in this group. |

### Third-Party Service Non-Diarization

#### Price

| Rank | Provider                                             |   Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization   | Processing Time |       Throughput | Actual Cost |
| ---: | ---------------------------------------------------- | ------: | ----------: | ----------------: | ------------: | ------------- | --------------: | ---------------: | ----------: |
|    1 | <code>supadata-auto</code>                           |   $0.00 |       81.87 |            18.13% |        17.55% | not-supported |          70.97s |  34.14× realtime |       $0.00 |
|    2 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | $0.0081 |       87.78 |            12.22% |        11.52% | not-supported |          14.40s | 168.28× realtime |     $0.0081 |
|    3 | <code>deepinfra-openai_whisper-large-v3</code>       | $0.0182 |       96.44 |             3.56% |         2.79% | not-supported |          57.63s |  42.04× realtime |     $0.0182 |
|    4 | <code>groq-whisper-large-v3-turbo</code>             | $0.0269 |       96.39 |             3.61% |         2.86% | not-supported |         122.18s |  19.83× realtime |     $0.0269 |
|    5 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>    | $0.0606 |       95.45 |             4.55% |         3.84% | not-supported |           2.76s | 878.55× realtime |     $0.0606 |
|    6 | <code>together-openai_whisper-large-v3</code>        | $0.0606 |       96.23 |             3.77% |         3.00% | not-supported |           5.07s | 478.20× realtime |     $0.0606 |
|    7 | <code>groq-whisper-large-v3</code>                   | $0.0747 |       96.06 |             3.94% |         3.17% | not-supported |          34.98s |  69.28× realtime |     $0.0747 |
|    8 | <code>gemini-stt-gemini-3-flash-preview</code>       | $0.2483 |       96.15 |             3.85% |         3.13% | not-supported |         271.09s |   8.94× realtime |     $0.2483 |
|    9 | <code>gemini-stt-gemini-3.6-flash</code>             | $0.4375 |       96.06 |             3.94% |         3.19% | not-supported |         236.95s |  10.23× realtime |     $0.4375 |

#### Speed

| Rank | Provider                                             |   Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization   | Processing Time |       Throughput | Actual Cost |
| ---: | ---------------------------------------------------- | ------: | ----------: | ----------------: | ------------: | ------------- | --------------: | ---------------: | ----------: |
|    1 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>    |   2.76s |       95.45 |             4.55% |         3.84% | not-supported |           2.76s | 878.55× realtime |     $0.0606 |
|    2 | <code>together-openai_whisper-large-v3</code>        |   5.07s |       96.23 |             3.77% |         3.00% | not-supported |           5.07s | 478.20× realtime |     $0.0606 |
|    3 | <code>deepinfra-openai_whisper-large-v3-turbo</code> |  14.40s |       87.78 |            12.22% |        11.52% | not-supported |          14.40s | 168.28× realtime |     $0.0081 |
|    4 | <code>groq-whisper-large-v3</code>                   |  34.98s |       96.06 |             3.94% |         3.17% | not-supported |          34.98s |  69.28× realtime |     $0.0747 |
|    5 | <code>deepinfra-openai_whisper-large-v3</code>       |  57.63s |       96.44 |             3.56% |         2.79% | not-supported |          57.63s |  42.04× realtime |     $0.0182 |
|    6 | <code>supadata-auto</code>                           |  70.97s |       81.87 |            18.13% |        17.55% | not-supported |          70.97s |  34.14× realtime |       $0.00 |
|    7 | <code>groq-whisper-large-v3-turbo</code>             | 122.18s |       96.39 |             3.61% |         2.86% | not-supported |         122.18s |  19.83× realtime |     $0.0269 |
|    8 | <code>gemini-stt-gemini-3.6-flash</code>             | 236.95s |       96.06 |             3.94% |         3.19% | not-supported |         236.95s |  10.23× realtime |     $0.4375 |
|    9 | <code>gemini-stt-gemini-3-flash-preview</code>       | 271.09s |       96.15 |             3.85% |         3.13% | not-supported |         271.09s |   8.94× realtime |     $0.2483 |

#### Quality Score

| Rank | Provider                                             |                   Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization   | Processing Time |       Throughput | Actual Cost |
| ---: | ---------------------------------------------------- | ----------------------: | ----------: | ----------------: | ------------: | ------------- | --------------: | ---------------: | ----------: |
|    1 | <code>deepinfra-openai_whisper-large-v3</code>       | 96.44/100 quality score |       96.44 |             3.56% |         2.79% | not-supported |          57.63s |  42.04× realtime |     $0.0182 |
|    2 | <code>groq-whisper-large-v3-turbo</code>             | 96.39/100 quality score |       96.39 |             3.61% |         2.86% | not-supported |         122.18s |  19.83× realtime |     $0.0269 |
|    3 | <code>together-openai_whisper-large-v3</code>        | 96.23/100 quality score |       96.23 |             3.77% |         3.00% | not-supported |           5.07s | 478.20× realtime |     $0.0606 |
|    4 | <code>gemini-stt-gemini-3-flash-preview</code>       | 96.15/100 quality score |       96.15 |             3.85% |         3.13% | not-supported |         271.09s |   8.94× realtime |     $0.2483 |
|    5 | <code>groq-whisper-large-v3</code>                   | 96.06/100 quality score |       96.06 |             3.94% |         3.17% | not-supported |          34.98s |  69.28× realtime |     $0.0747 |
|    6 | <code>gemini-stt-gemini-3.6-flash</code>             | 96.06/100 quality score |       96.06 |             3.94% |         3.19% | not-supported |         236.95s |  10.23× realtime |     $0.4375 |
|    7 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>    | 95.45/100 quality score |       95.45 |             4.55% |         3.84% | not-supported |           2.76s | 878.55× realtime |     $0.0606 |
|    8 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 87.78/100 quality score |       87.78 |            12.22% |        11.52% | not-supported |          14.40s | 168.28× realtime |     $0.0081 |
|    9 | <code>supadata-auto</code>                           | 81.87/100 quality score |       81.87 |            18.13% |        17.55% | not-supported |          70.97s |  34.14× realtime |       $0.00 |

### Third-Party Service Diarization

#### Price

| Rank | Provider                                  |   Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time |       Throughput | Actual Cost |
| ---: | ----------------------------------------- | ------: | ----------: | ----------------: | ------------: | ----------- | --------------: | ---------------: | ----------: |
|    1 | <code>grok-speech-to-text</code>          | $0.0673 |       92.28 |             7.72% |         7.35% | supported   |          40.00s |  60.58× realtime |     $0.0673 |
|    2 | <code>soniox-stt-async-v4</code>          | $0.0673 |       96.40 |             3.60% |         3.48% | supported   |          77.74s |  31.17× realtime |     $0.0673 |
|    3 | <code>soniox-stt-async-v5</code>          | $0.0673 |       97.08 |             2.92% |         2.79% | supported   |         188.19s |  12.88× realtime |     $0.0673 |
|    4 | <code>rev-low_cost</code>                 | $0.0673 |       93.59 |             6.41% |         5.97% | supported   |         220.52s |  10.99× realtime |     $0.0673 |
|    5 | <code>mistral-voxtral-mini-2602</code>    | $0.0808 |       97.31 |             2.69% |         2.56% | supported   |          26.74s |  90.62× realtime |     $0.0808 |
|    6 | <code>speechmatics-melia-1</code>         | $0.0868 |       96.19 |             3.81% |         3.74% | supported   |          20.42s | 118.68× realtime |     $0.0868 |
|    7 | <code>assemblyai-universal-2</code>       | $0.1144 |       96.74 |             3.26% |         3.08% | supported   |          37.81s |  64.08× realtime |     $0.1144 |
|    8 | <code>rev-machine</code>                  | $0.1347 |       94.29 |             5.71% |         5.28% | supported   |          89.31s |  27.13× realtime |     $0.1347 |
|    9 | <code>assemblyai-universal-3-pro</code>   | $0.1413 |       99.62 |             0.38% |         0.38% | supported   |          31.16s |  77.76× realtime |     $0.1413 |
|   10 | <code>assemblyai-universal-3-5-pro</code> | $0.1548 |       98.52 |             1.48% |         1.31% | supported   |          27.57s |  87.88× realtime |     $0.1548 |
|   11 | <code>deepgram-nova-3</code>              | $0.3917 |       95.37 |             4.63% |         3.69% | supported   |           8.18s | 296.40× realtime |     $0.3917 |
|   12 | <code>happyscribe-auto</code>             | $0.4038 |       99.21 |             0.79% |         0.80% | supported   |          83.72s |  28.94× realtime |     $0.4038 |
|   13 | <code>gladia-default</code>               | $0.4106 |       96.81 |             3.19% |         2.99% | supported   |          38.29s |  63.28× realtime |     $0.4106 |
|   14 | <code>gladia-solaria-1</code>             | $0.4106 |       96.90 |             3.10% |         2.90% | supported   |          36.26s |  66.82× realtime |     $0.4106 |
|   15 | <code>gladia-solaria-3</code>             | $0.4106 |       96.91 |             3.09% |         3.00% | supported   |          34.33s |  70.58× realtime |     $0.4106 |
|   16 | <code>speechmatics-enhanced</code>        | $0.5048 |       96.57 |             3.43% |         3.32% | supported   |         204.72s |  11.84× realtime |     $0.5048 |

#### Speed

| Rank | Provider                                  |   Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time |       Throughput | Actual Cost |
| ---: | ----------------------------------------- | ------: | ----------: | ----------------: | ------------: | ----------- | --------------: | ---------------: | ----------: |
|    1 | <code>deepgram-nova-3</code>              |   8.18s |       95.37 |             4.63% |         3.69% | supported   |           8.18s | 296.40× realtime |     $0.3917 |
|    2 | <code>speechmatics-melia-1</code>         |  20.42s |       96.19 |             3.81% |         3.74% | supported   |          20.42s | 118.68× realtime |     $0.0868 |
|    3 | <code>mistral-voxtral-mini-2602</code>    |  26.74s |       97.31 |             2.69% |         2.56% | supported   |          26.74s |  90.62× realtime |     $0.0808 |
|    4 | <code>assemblyai-universal-3-5-pro</code> |  27.57s |       98.52 |             1.48% |         1.31% | supported   |          27.57s |  87.88× realtime |     $0.1548 |
|    5 | <code>assemblyai-universal-3-pro</code>   |  31.16s |       99.62 |             0.38% |         0.38% | supported   |          31.16s |  77.76× realtime |     $0.1413 |
|    6 | <code>gladia-solaria-3</code>             |  34.33s |       96.91 |             3.09% |         3.00% | supported   |          34.33s |  70.58× realtime |     $0.4106 |
|    7 | <code>gladia-solaria-1</code>             |  36.26s |       96.90 |             3.10% |         2.90% | supported   |          36.26s |  66.82× realtime |     $0.4106 |
|    8 | <code>assemblyai-universal-2</code>       |  37.81s |       96.74 |             3.26% |         3.08% | supported   |          37.81s |  64.08× realtime |     $0.1144 |
|    9 | <code>gladia-default</code>               |  38.29s |       96.81 |             3.19% |         2.99% | supported   |          38.29s |  63.28× realtime |     $0.4106 |
|   10 | <code>grok-speech-to-text</code>          |  40.00s |       92.28 |             7.72% |         7.35% | supported   |          40.00s |  60.58× realtime |     $0.0673 |
|   11 | <code>soniox-stt-async-v4</code>          |  77.74s |       96.40 |             3.60% |         3.48% | supported   |          77.74s |  31.17× realtime |     $0.0673 |
|   12 | <code>happyscribe-auto</code>             |  83.72s |       99.21 |             0.79% |         0.80% | supported   |          83.72s |  28.94× realtime |     $0.4038 |
|   13 | <code>rev-machine</code>                  |  89.31s |       94.29 |             5.71% |         5.28% | supported   |          89.31s |  27.13× realtime |     $0.1347 |
|   14 | <code>soniox-stt-async-v5</code>          | 188.19s |       97.08 |             2.92% |         2.79% | supported   |         188.19s |  12.88× realtime |     $0.0673 |
|   15 | <code>speechmatics-enhanced</code>        | 204.72s |       96.57 |             3.43% |         3.32% | supported   |         204.72s |  11.84× realtime |     $0.5048 |
|   16 | <code>rev-low_cost</code>                 | 220.52s |       93.59 |             6.41% |         5.97% | supported   |         220.52s |  10.99× realtime |     $0.0673 |

#### Quality Score

| Rank | Provider                                  |                   Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time |       Throughput | Actual Cost |
| ---: | ----------------------------------------- | ----------------------: | ----------: | ----------------: | ------------: | ----------- | --------------: | ---------------: | ----------: |
|    1 | <code>assemblyai-universal-3-pro</code>   | 99.62/100 quality score |       99.62 |             0.38% |         0.38% | supported   |          31.16s |  77.76× realtime |     $0.1413 |
|    2 | <code>happyscribe-auto</code>             | 99.21/100 quality score |       99.21 |             0.79% |         0.80% | supported   |          83.72s |  28.94× realtime |     $0.4038 |
|    3 | <code>assemblyai-universal-3-5-pro</code> | 98.52/100 quality score |       98.52 |             1.48% |         1.31% | supported   |          27.57s |  87.88× realtime |     $0.1548 |
|    4 | <code>mistral-voxtral-mini-2602</code>    | 97.31/100 quality score |       97.31 |             2.69% |         2.56% | supported   |          26.74s |  90.62× realtime |     $0.0808 |
|    5 | <code>soniox-stt-async-v5</code>          | 97.08/100 quality score |       97.08 |             2.92% |         2.79% | supported   |         188.19s |  12.88× realtime |     $0.0673 |
|    6 | <code>gladia-solaria-3</code>             | 96.91/100 quality score |       96.91 |             3.09% |         3.00% | supported   |          34.33s |  70.58× realtime |     $0.4106 |
|    7 | <code>gladia-solaria-1</code>             | 96.90/100 quality score |       96.90 |             3.10% |         2.90% | supported   |          36.26s |  66.82× realtime |     $0.4106 |
|    8 | <code>gladia-default</code>               | 96.81/100 quality score |       96.81 |             3.19% |         2.99% | supported   |          38.29s |  63.28× realtime |     $0.4106 |
|    9 | <code>assemblyai-universal-2</code>       | 96.74/100 quality score |       96.74 |             3.26% |         3.08% | supported   |          37.81s |  64.08× realtime |     $0.1144 |
|   10 | <code>speechmatics-enhanced</code>        | 96.57/100 quality score |       96.57 |             3.43% |         3.32% | supported   |         204.72s |  11.84× realtime |     $0.5048 |
|   11 | <code>soniox-stt-async-v4</code>          | 96.40/100 quality score |       96.40 |             3.60% |         3.48% | supported   |          77.74s |  31.17× realtime |     $0.0673 |
|   12 | <code>speechmatics-melia-1</code>         | 96.19/100 quality score |       96.19 |             3.81% |         3.74% | supported   |          20.42s | 118.68× realtime |     $0.0868 |
|   13 | <code>deepgram-nova-3</code>              | 95.37/100 quality score |       95.37 |             4.63% |         3.69% | supported   |           8.18s | 296.40× realtime |     $0.3917 |
|   14 | <code>rev-machine</code>                  | 94.29/100 quality score |       94.29 |             5.71% |         5.28% | supported   |          89.31s |  27.13× realtime |     $0.1347 |
|   15 | <code>rev-low_cost</code>                 | 93.59/100 quality score |       93.59 |             6.41% |         5.97% | supported   |         220.52s |  10.99× realtime |     $0.0673 |
|   16 | <code>grok-speech-to-text</code>          | 92.28/100 quality score |       92.28 |             7.72% |         7.35% | supported   |          40.00s |  60.58× realtime |     $0.0673 |


## Provider Detail

| Provider                                             | Group                               | Diarization   | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time |       Throughput | Actual Cost |
| ---------------------------------------------------- | ----------------------------------- | ------------- | ----------: | ----------------: | ------------: | --------------: | ---------------: | ----------: |
| <code>assemblyai-universal-2</code>                  | Third-Party Service Diarization     | supported     |       96.74 |             3.26% |         3.08% |          37.81s |  64.08× realtime |     $0.1144 |
| <code>assemblyai-universal-3-5-pro</code>            | Third-Party Service Diarization     | supported     |       98.52 |             1.48% |         1.31% |          27.57s |  87.88× realtime |     $0.1548 |
| <code>assemblyai-universal-3-pro</code>              | Third-Party Service Diarization     | supported     |       99.62 |             0.38% |         0.38% |          31.16s |  77.76× realtime |     $0.1413 |
| <code>deepgram-nova-3</code>                         | Third-Party Service Diarization     | supported     |       95.37 |             4.63% |         3.69% |           8.18s | 296.40× realtime |     $0.3917 |
| <code>deepinfra-openai_whisper-large-v3</code>       | Third-Party Service Non-Diarization | not-supported |       96.44 |             3.56% |         2.79% |          57.63s |  42.04× realtime |     $0.0182 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported |       87.78 |            12.22% |        11.52% |          14.40s | 168.28× realtime |     $0.0081 |
| <code>gemini-stt-gemini-3-flash-preview</code>       | Third-Party Service Non-Diarization | not-supported |       96.15 |             3.85% |         3.13% |         271.09s |   8.94× realtime |     $0.2483 |
| <code>gemini-stt-gemini-3.6-flash</code>             | Third-Party Service Non-Diarization | not-supported |       96.06 |             3.94% |         3.19% |         236.95s |  10.23× realtime |     $0.4375 |
| <code>gladia-default</code>                          | Third-Party Service Diarization     | supported     |       96.81 |             3.19% |         2.99% |          38.29s |  63.28× realtime |     $0.4106 |
| <code>gladia-solaria-1</code>                        | Third-Party Service Diarization     | supported     |       96.90 |             3.10% |         2.90% |          36.26s |  66.82× realtime |     $0.4106 |
| <code>gladia-solaria-3</code>                        | Third-Party Service Diarization     | supported     |       96.91 |             3.09% |         3.00% |          34.33s |  70.58× realtime |     $0.4106 |
| <code>grok-speech-to-text</code>                     | Third-Party Service Diarization     | supported     |       92.28 |             7.72% |         7.35% |          40.00s |  60.58× realtime |     $0.0673 |
| <code>groq-whisper-large-v3</code>                   | Third-Party Service Non-Diarization | not-supported |       96.06 |             3.94% |         3.17% |          34.98s |  69.28× realtime |     $0.0747 |
| <code>groq-whisper-large-v3-turbo</code>             | Third-Party Service Non-Diarization | not-supported |       96.39 |             3.61% |         2.86% |         122.18s |  19.83× realtime |     $0.0269 |
| <code>happyscribe-auto</code>                        | Third-Party Service Diarization     | supported     |       99.21 |             0.79% |         0.80% |          83.72s |  28.94× realtime |     $0.4038 |
| <code>mistral-voxtral-mini-2602</code>               | Third-Party Service Diarization     | supported     |       97.31 |             2.69% |         2.56% |          26.74s |  90.62× realtime |     $0.0808 |
| <code>rev-low_cost</code>                            | Third-Party Service Diarization     | supported     |       93.59 |             6.41% |         5.97% |         220.52s |  10.99× realtime |     $0.0673 |
| <code>rev-machine</code>                             | Third-Party Service Diarization     | supported     |       94.29 |             5.71% |         5.28% |          89.31s |  27.13× realtime |     $0.1347 |
| <code>soniox-stt-async-v4</code>                     | Third-Party Service Diarization     | supported     |       96.40 |             3.60% |         3.48% |          77.74s |  31.17× realtime |     $0.0673 |
| <code>soniox-stt-async-v5</code>                     | Third-Party Service Diarization     | supported     |       97.08 |             2.92% |         2.79% |         188.19s |  12.88× realtime |     $0.0673 |
| <code>speechmatics-enhanced</code>                   | Third-Party Service Diarization     | supported     |       96.57 |             3.43% |         3.32% |         204.72s |  11.84× realtime |     $0.5048 |
| <code>speechmatics-melia-1</code>                    | Third-Party Service Diarization     | supported     |       96.19 |             3.81% |         3.74% |          20.42s | 118.68× realtime |     $0.0868 |
| <code>supadata-auto</code>                           | Third-Party Service Non-Diarization | not-supported |       81.87 |            18.13% |        17.55% |          70.97s |  34.14× realtime |       $0.00 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>    | Third-Party Service Non-Diarization | not-supported |       95.45 |             4.55% |         3.84% |           2.76s | 878.55× realtime |     $0.0606 |
| <code>together-openai_whisper-large-v3</code>        | Third-Party Service Non-Diarization | not-supported |       96.23 |             3.77% |         3.00% |           5.07s | 478.20× realtime |     $0.0606 |

## Error Breakdown (Speaker-aware)

| Provider                                             | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>assemblyai-universal-2</code>                  |           137 |        64 |         67 |       8225 |
| <code>assemblyai-universal-3-5-pro</code>            |            45 |        39 |         38 |       8225 |
| <code>assemblyai-universal-3-pro</code>              |            11 |        11 |          9 |       8225 |
| <code>deepgram-nova-3</code>                         |           153 |       148 |         80 |       8225 |
| <code>deepinfra-openai_whisper-large-v3</code>       |           117 |       124 |         52 |       8225 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> |           118 |       842 |         45 |       8225 |
| <code>gemini-stt-gemini-3-flash-preview</code>       |           130 |       101 |         86 |       8225 |
| <code>gemini-stt-gemini-3.6-flash</code>             |           141 |       115 |         68 |       8225 |
| <code>gladia-default</code>                          |           122 |        70 |         70 |       8225 |
| <code>gladia-solaria-1</code>                        |           120 |        68 |         67 |       8225 |
| <code>gladia-solaria-3</code>                        |           135 |        64 |         55 |       8225 |
| <code>grok-speech-to-text</code>                     |           199 |       357 |         79 |       8225 |
| <code>groq-whisper-large-v3</code>                   |           134 |       133 |         57 |       8225 |
| <code>groq-whisper-large-v3-turbo</code>             |           122 |       123 |         52 |       8225 |
| <code>happyscribe-auto</code>                        |            25 |        26 |         14 |       8225 |
| <code>mistral-voxtral-mini-2602</code>               |           109 |        43 |         69 |       8225 |
| <code>rev-low_cost</code>                            |           310 |        98 |        119 |       8225 |
| <code>rev-machine</code>                             |           281 |        73 |        116 |       8225 |
| <code>soniox-stt-async-v4</code>                     |           146 |        49 |        101 |       8225 |
| <code>soniox-stt-async-v5</code>                     |           131 |        35 |         74 |       8225 |
| <code>speechmatics-enhanced</code>                   |           153 |        66 |         63 |       8225 |
| <code>speechmatics-melia-1</code>                    |           155 |        85 |         73 |       8225 |
| <code>supadata-auto</code>                           |           153 |       115 |       1223 |       8225 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>    |           186 |       108 |         80 |       8225 |
| <code>together-openai_whisper-large-v3</code>        |           135 |       117 |         58 |       8225 |

## Error Breakdown (Text-only)

| Provider                                             | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>assemblyai-universal-2</code>                  |           134 |        59 |         58 |       8159 |
| <code>assemblyai-universal-3-5-pro</code>            |            45 |        34 |         28 |       8159 |
| <code>assemblyai-universal-3-pro</code>              |            11 |        11 |          9 |       8159 |
| <code>deepgram-nova-3</code>                         |           149 |        93 |         59 |       8159 |
| <code>deepinfra-openai_whisper-large-v3</code>       |           115 |        60 |         53 |       8159 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> |           114 |       779 |         47 |       8159 |
| <code>gemini-stt-gemini-3-flash-preview</code>       |           123 |        41 |         91 |       8159 |
| <code>gemini-stt-gemini-3.6-flash</code>             |           138 |        52 |         70 |       8159 |
| <code>gladia-default</code>                          |           121 |        60 |         63 |       8159 |
| <code>gladia-solaria-1</code>                        |           119 |        58 |         60 |       8159 |
| <code>gladia-solaria-3</code>                        |           135 |        61 |         49 |       8159 |
| <code>grok-speech-to-text</code>                     |           199 |       329 |         72 |       8159 |
| <code>groq-whisper-large-v3</code>                   |           128 |        71 |         60 |       8159 |
| <code>groq-whisper-large-v3-turbo</code>             |           119 |        60 |         54 |       8159 |
| <code>happyscribe-auto</code>                        |            25 |        26 |         14 |       8159 |
| <code>mistral-voxtral-mini-2602</code>               |           109 |        39 |         61 |       8159 |
| <code>rev-low_cost</code>                            |           282 |        93 |        112 |       8159 |
| <code>rev-machine</code>                             |           256 |        67 |        108 |       8159 |
| <code>soniox-stt-async-v4</code>                     |           148 |        44 |         92 |       8159 |
| <code>soniox-stt-async-v5</code>                     |           129 |        33 |         66 |       8159 |
| <code>speechmatics-enhanced</code>                   |           154 |        61 |         56 |       8159 |
| <code>speechmatics-melia-1</code>                    |           153 |        83 |         69 |       8159 |
| <code>supadata-auto</code>                           |           139 |        60 |       1233 |       8159 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>    |           178 |        49 |         86 |       8159 |
| <code>together-openai_whisper-large-v3</code>        |           131 |        54 |         60 |       8159 |

## Quality Flags

No provider quality flags were detected.

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `assemblyai-universal-3-pro` was the most accurate provider on strict speaker-aware WER, scoring 99.62/100.
- `together-nvidia_parakeet-tdt-0.6b-v3` was the fastest provider in this set at 2.76s.
- `deepgram-nova-3` lost the most ground once speaker changes were counted, with 0.94 percentage-point gap between text-only and speaker-aware WER.
