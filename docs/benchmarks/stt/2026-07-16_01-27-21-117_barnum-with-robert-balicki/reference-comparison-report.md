# Consensus Transcript Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/stt/2026-07-16_01-27-21-117_barnum-with-robert-balicki`
- Total providers: 26 (0 local, 26 third-party service)
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

| Rank | Provider                                             |   Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization   | Processing Time |        Throughput | Actual Cost |
| ---: | ---------------------------------------------------- | ------: | ----------: | ----------------: | ------------: | ------------- | --------------: | ----------------: | ----------: |
|    1 | <code>scrapecreators-youtube-transcript</code>       | $0.0019 |       93.39 |             6.61% |         5.51% | not-supported |           3.06s | 2942.14× realtime |     $0.0019 |
|    2 | <code>supadata-auto</code>                           | $0.0100 |       93.39 |             6.61% |         5.51% | not-supported |          11.23s |  801.28× realtime |     $0.0100 |
|    3 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | $0.0300 |       91.39 |             8.61% |         7.55% | not-supported |          76.56s |  117.56× realtime |     $0.0300 |
|    4 | <code>deepinfra-openai_whisper-large-v3</code>       | $0.0675 |       93.18 |             6.82% |         5.68% | not-supported |         143.72s |   62.62× realtime |     $0.0675 |
|    5 | <code>groq-whisper-large-v3-turbo</code>             | $0.1000 |       93.35 |             6.65% |         5.52% | not-supported |          54.91s |  163.90× realtime |     $0.1000 |
|    6 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>    | $0.2250 |       92.81 |             7.19% |         6.11% | not-supported |           8.74s | 1030.10× realtime |     $0.2250 |
|    7 | <code>together-openai_whisper-large-v3</code>        | $0.2250 |       92.74 |             7.26% |         6.14% | not-supported |          56.83s |  158.36× realtime |     $0.2250 |
|    8 | <code>groq-whisper-large-v3</code>                   | $0.2775 |       93.07 |             6.93% |         5.85% | not-supported |          85.58s |  105.17× realtime |     $0.2775 |
|    9 | <code>gemini-stt-gemini-3-flash-preview</code>       | $0.8013 |       59.74 |            40.26% |        39.69% | not-supported |         735.35s |   12.24× realtime |     $0.8013 |
|   10 | <code>gemini-stt-gemini-3.6-flash</code>             | $1.4410 |       77.67 |            22.33% |        21.52% | not-supported |         667.77s |   13.48× realtime |     $1.4410 |

#### Speed

| Rank | Provider                                             |   Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization   | Processing Time |        Throughput | Actual Cost |
| ---: | ---------------------------------------------------- | ------: | ----------: | ----------------: | ------------: | ------------- | --------------: | ----------------: | ----------: |
|    1 | <code>scrapecreators-youtube-transcript</code>       |   3.06s |       93.39 |             6.61% |         5.51% | not-supported |           3.06s | 2942.14× realtime |     $0.0019 |
|    2 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>    |   8.74s |       92.81 |             7.19% |         6.11% | not-supported |           8.74s | 1030.10× realtime |     $0.2250 |
|    3 | <code>supadata-auto</code>                           |  11.23s |       93.39 |             6.61% |         5.51% | not-supported |          11.23s |  801.28× realtime |     $0.0100 |
|    4 | <code>groq-whisper-large-v3-turbo</code>             |  54.91s |       93.35 |             6.65% |         5.52% | not-supported |          54.91s |  163.90× realtime |     $0.1000 |
|    5 | <code>together-openai_whisper-large-v3</code>        |  56.83s |       92.74 |             7.26% |         6.14% | not-supported |          56.83s |  158.36× realtime |     $0.2250 |
|    6 | <code>deepinfra-openai_whisper-large-v3-turbo</code> |  76.56s |       91.39 |             8.61% |         7.55% | not-supported |          76.56s |  117.56× realtime |     $0.0300 |
|    7 | <code>groq-whisper-large-v3</code>                   |  85.58s |       93.07 |             6.93% |         5.85% | not-supported |          85.58s |  105.17× realtime |     $0.2775 |
|    8 | <code>deepinfra-openai_whisper-large-v3</code>       | 143.72s |       93.18 |             6.82% |         5.68% | not-supported |         143.72s |   62.62× realtime |     $0.0675 |
|    9 | <code>gemini-stt-gemini-3.6-flash</code>             | 667.77s |       77.67 |            22.33% |        21.52% | not-supported |         667.77s |   13.48× realtime |     $1.4410 |
|   10 | <code>gemini-stt-gemini-3-flash-preview</code>       | 735.35s |       59.74 |            40.26% |        39.69% | not-supported |         735.35s |   12.24× realtime |     $0.8013 |

#### Quality Score

| Rank | Provider                                             |                   Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization   | Processing Time |        Throughput | Actual Cost |
| ---: | ---------------------------------------------------- | ----------------------: | ----------: | ----------------: | ------------: | ------------- | --------------: | ----------------: | ----------: |
|    1 | <code>scrapecreators-youtube-transcript</code>       | 93.39/100 quality score |       93.39 |             6.61% |         5.51% | not-supported |           3.06s | 2942.14× realtime |     $0.0019 |
|    2 | <code>supadata-auto</code>                           | 93.39/100 quality score |       93.39 |             6.61% |         5.51% | not-supported |          11.23s |  801.28× realtime |     $0.0100 |
|    3 | <code>groq-whisper-large-v3-turbo</code>             | 93.35/100 quality score |       93.35 |             6.65% |         5.52% | not-supported |          54.91s |  163.90× realtime |     $0.1000 |
|    4 | <code>deepinfra-openai_whisper-large-v3</code>       | 93.18/100 quality score |       93.18 |             6.82% |         5.68% | not-supported |         143.72s |   62.62× realtime |     $0.0675 |
|    5 | <code>groq-whisper-large-v3</code>                   | 93.07/100 quality score |       93.07 |             6.93% |         5.85% | not-supported |          85.58s |  105.17× realtime |     $0.2775 |
|    6 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>    | 92.81/100 quality score |       92.81 |             7.19% |         6.11% | not-supported |           8.74s | 1030.10× realtime |     $0.2250 |
|    7 | <code>together-openai_whisper-large-v3</code>        | 92.74/100 quality score |       92.74 |             7.26% |         6.14% | not-supported |          56.83s |  158.36× realtime |     $0.2250 |
|    8 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 91.39/100 quality score |       91.39 |             8.61% |         7.55% | not-supported |          76.56s |  117.56× realtime |     $0.0300 |
|    9 | <code>gemini-stt-gemini-3.6-flash</code>             | 77.67/100 quality score |       77.67 |            22.33% |        21.52% | not-supported |         667.77s |   13.48× realtime |     $1.4410 |
|   10 | <code>gemini-stt-gemini-3-flash-preview</code>       | 59.74/100 quality score |       59.74 |            40.26% |        39.69% | not-supported |         735.35s |   12.24× realtime |     $0.8013 |

### Third-Party Service Diarization

#### Price

| Rank | Provider                                  |   Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time |       Throughput | Actual Cost |
| ---: | ----------------------------------------- | ------: | ----------: | ----------------: | ------------: | ----------- | --------------: | ---------------: | ----------: |
|    1 | <code>happyscribe-auto</code>             |   $0.00 |       94.01 |             5.99% |         5.25% | supported   |         165.51s |  54.38× realtime |       $0.00 |
|    2 | <code>rev-low_cost</code>                 | $0.2500 |       92.44 |             7.56% |         7.18% | supported   |         303.14s |  29.69× realtime |     $0.2500 |
|    3 | <code>soniox-stt-async-v4</code>          | $0.2500 |       94.92 |             5.08% |         4.56% | supported   |         402.96s |  22.33× realtime |     $0.2500 |
|    4 | <code>soniox-stt-async-v5</code>          | $0.2500 |       95.52 |             4.48% |         4.07% | supported   |         543.34s |  16.56× realtime |     $0.2500 |
|    5 | <code>mistral-voxtral-mini-2602</code>    | $0.3000 |       94.22 |             5.78% |         5.45% | supported   |          90.67s |  99.26× realtime |     $0.3000 |
|    6 | <code>speechmatics-melia-1</code>         | $0.3225 |       92.47 |             7.53% |         7.07% | supported   |          53.34s | 168.74× realtime |     $0.3225 |
|    7 | <code>assemblyai-universal-2</code>       | $0.4250 |       92.69 |             7.31% |         6.57% | supported   |          72.95s | 123.38× realtime |     $0.4250 |
|    8 | <code>rev-machine</code>                  | $0.5000 |       92.95 |             7.05% |         6.67% | supported   |         164.79s |  54.62× realtime |     $0.5000 |
|    9 | <code>assemblyai-universal-3-pro</code>   | $0.5250 |       94.30 |             5.70% |         4.88% | supported   |         103.94s |  86.59× realtime |     $0.5250 |
|   10 | <code>assemblyai-universal-3-5-pro</code> | $0.5750 |       94.19 |             5.81% |         5.05% | supported   |          86.78s | 103.71× realtime |     $0.5750 |
|   11 | <code>deepgram-nova-3</code>              | $1.4550 |       92.58 |             7.42% |         6.54% | supported   |          41.43s | 217.23× realtime |     $1.4550 |
|   12 | <code>gladia-default</code>               | $1.5250 |       22.41 |            77.59% |        77.80% | supported   |          10.32s | 871.76× realtime |     $1.5250 |
|   13 | <code>gladia-solaria-1</code>             | $1.5250 |       91.63 |             8.37% |         7.36% | supported   |         120.73s |  74.55× realtime |     $1.5250 |
|   14 | <code>gladia-solaria-3</code>             | $1.5250 |       93.88 |             6.12% |         5.07% | supported   |         116.54s |  77.23× realtime |     $1.5250 |
|   15 | <code>speechmatics-enhanced</code>        | $1.8750 |       93.87 |             6.13% |         5.73% | supported   |         339.92s |  26.48× realtime |     $1.8750 |
|   16 | <code>grok-speech-to-text</code>          |     n/a |       91.55 |             8.45% |         7.70% | supported   |         160.18s |  56.19× realtime |         n/a |

#### Speed

| Rank | Provider                                  |   Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time |       Throughput | Actual Cost |
| ---: | ----------------------------------------- | ------: | ----------: | ----------------: | ------------: | ----------- | --------------: | ---------------: | ----------: |
|    1 | <code>gladia-default</code>               |  10.32s |       22.41 |            77.59% |        77.80% | supported   |          10.32s | 871.76× realtime |     $1.5250 |
|    2 | <code>deepgram-nova-3</code>              |  41.43s |       92.58 |             7.42% |         6.54% | supported   |          41.43s | 217.23× realtime |     $1.4550 |
|    3 | <code>speechmatics-melia-1</code>         |  53.34s |       92.47 |             7.53% |         7.07% | supported   |          53.34s | 168.74× realtime |     $0.3225 |
|    4 | <code>assemblyai-universal-2</code>       |  72.95s |       92.69 |             7.31% |         6.57% | supported   |          72.95s | 123.38× realtime |     $0.4250 |
|    5 | <code>assemblyai-universal-3-5-pro</code> |  86.78s |       94.19 |             5.81% |         5.05% | supported   |          86.78s | 103.71× realtime |     $0.5750 |
|    6 | <code>mistral-voxtral-mini-2602</code>    |  90.67s |       94.22 |             5.78% |         5.45% | supported   |          90.67s |  99.26× realtime |     $0.3000 |
|    7 | <code>assemblyai-universal-3-pro</code>   | 103.94s |       94.30 |             5.70% |         4.88% | supported   |         103.94s |  86.59× realtime |     $0.5250 |
|    8 | <code>gladia-solaria-3</code>             | 116.54s |       93.88 |             6.12% |         5.07% | supported   |         116.54s |  77.23× realtime |     $1.5250 |
|    9 | <code>gladia-solaria-1</code>             | 120.73s |       91.63 |             8.37% |         7.36% | supported   |         120.73s |  74.55× realtime |     $1.5250 |
|   10 | <code>grok-speech-to-text</code>          | 160.18s |       91.55 |             8.45% |         7.70% | supported   |         160.18s |  56.19× realtime |         n/a |
|   11 | <code>rev-machine</code>                  | 164.79s |       92.95 |             7.05% |         6.67% | supported   |         164.79s |  54.62× realtime |     $0.5000 |
|   12 | <code>happyscribe-auto</code>             | 165.51s |       94.01 |             5.99% |         5.25% | supported   |         165.51s |  54.38× realtime |       $0.00 |
|   13 | <code>rev-low_cost</code>                 | 303.14s |       92.44 |             7.56% |         7.18% | supported   |         303.14s |  29.69× realtime |     $0.2500 |
|   14 | <code>speechmatics-enhanced</code>        | 339.92s |       93.87 |             6.13% |         5.73% | supported   |         339.92s |  26.48× realtime |     $1.8750 |
|   15 | <code>soniox-stt-async-v4</code>          | 402.96s |       94.92 |             5.08% |         4.56% | supported   |         402.96s |  22.33× realtime |     $0.2500 |
|   16 | <code>soniox-stt-async-v5</code>          | 543.34s |       95.52 |             4.48% |         4.07% | supported   |         543.34s |  16.56× realtime |     $0.2500 |

#### Quality Score

| Rank | Provider                                  |                   Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time |       Throughput | Actual Cost |
| ---: | ----------------------------------------- | ----------------------: | ----------: | ----------------: | ------------: | ----------- | --------------: | ---------------: | ----------: |
|    1 | <code>soniox-stt-async-v5</code>          | 95.52/100 quality score |       95.52 |             4.48% |         4.07% | supported   |         543.34s |  16.56× realtime |     $0.2500 |
|    2 | <code>soniox-stt-async-v4</code>          | 94.92/100 quality score |       94.92 |             5.08% |         4.56% | supported   |         402.96s |  22.33× realtime |     $0.2500 |
|    3 | <code>assemblyai-universal-3-pro</code>   | 94.30/100 quality score |       94.30 |             5.70% |         4.88% | supported   |         103.94s |  86.59× realtime |     $0.5250 |
|    4 | <code>mistral-voxtral-mini-2602</code>    | 94.22/100 quality score |       94.22 |             5.78% |         5.45% | supported   |          90.67s |  99.26× realtime |     $0.3000 |
|    5 | <code>assemblyai-universal-3-5-pro</code> | 94.19/100 quality score |       94.19 |             5.81% |         5.05% | supported   |          86.78s | 103.71× realtime |     $0.5750 |
|    6 | <code>happyscribe-auto</code>             | 94.01/100 quality score |       94.01 |             5.99% |         5.25% | supported   |         165.51s |  54.38× realtime |       $0.00 |
|    7 | <code>gladia-solaria-3</code>             | 93.88/100 quality score |       93.88 |             6.12% |         5.07% | supported   |         116.54s |  77.23× realtime |     $1.5250 |
|    8 | <code>speechmatics-enhanced</code>        | 93.87/100 quality score |       93.87 |             6.13% |         5.73% | supported   |         339.92s |  26.48× realtime |     $1.8750 |
|    9 | <code>rev-machine</code>                  | 92.95/100 quality score |       92.95 |             7.05% |         6.67% | supported   |         164.79s |  54.62× realtime |     $0.5000 |
|   10 | <code>assemblyai-universal-2</code>       | 92.69/100 quality score |       92.69 |             7.31% |         6.57% | supported   |          72.95s | 123.38× realtime |     $0.4250 |
|   11 | <code>deepgram-nova-3</code>              | 92.58/100 quality score |       92.58 |             7.42% |         6.54% | supported   |          41.43s | 217.23× realtime |     $1.4550 |
|   12 | <code>speechmatics-melia-1</code>         | 92.47/100 quality score |       92.47 |             7.53% |         7.07% | supported   |          53.34s | 168.74× realtime |     $0.3225 |
|   13 | <code>rev-low_cost</code>                 | 92.44/100 quality score |       92.44 |             7.56% |         7.18% | supported   |         303.14s |  29.69× realtime |     $0.2500 |
|   14 | <code>gladia-solaria-1</code>             | 91.63/100 quality score |       91.63 |             8.37% |         7.36% | supported   |         120.73s |  74.55× realtime |     $1.5250 |
|   15 | <code>grok-speech-to-text</code>          | 91.55/100 quality score |       91.55 |             8.45% |         7.70% | supported   |         160.18s |  56.19× realtime |         n/a |
|   16 | <code>gladia-default</code>               | 22.41/100 quality score |       22.41 |            77.59% |        77.80% | supported   |          10.32s | 871.76× realtime |     $1.5250 |


## Provider Detail

| Provider                                             | Group                               | Diarization   | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time |        Throughput | Actual Cost |
| ---------------------------------------------------- | ----------------------------------- | ------------- | ----------: | ----------------: | ------------: | --------------: | ----------------: | ----------: |
| <code>assemblyai-universal-2</code>                  | Third-Party Service Diarization     | supported     |       92.69 |             7.31% |         6.57% |          72.95s |  123.38× realtime |     $0.4250 |
| <code>assemblyai-universal-3-5-pro</code>            | Third-Party Service Diarization     | supported     |       94.19 |             5.81% |         5.05% |          86.78s |  103.71× realtime |     $0.5750 |
| <code>assemblyai-universal-3-pro</code>              | Third-Party Service Diarization     | supported     |       94.30 |             5.70% |         4.88% |         103.94s |   86.59× realtime |     $0.5250 |
| <code>deepgram-nova-3</code>                         | Third-Party Service Diarization     | supported     |       92.58 |             7.42% |         6.54% |          41.43s |  217.23× realtime |     $1.4550 |
| <code>deepinfra-openai_whisper-large-v3</code>       | Third-Party Service Non-Diarization | not-supported |       93.18 |             6.82% |         5.68% |         143.72s |   62.62× realtime |     $0.0675 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported |       91.39 |             8.61% |         7.55% |          76.56s |  117.56× realtime |     $0.0300 |
| <code>gemini-stt-gemini-3-flash-preview</code>       | Third-Party Service Non-Diarization | not-supported |       59.74 |            40.26% |        39.69% |         735.35s |   12.24× realtime |     $0.8013 |
| <code>gemini-stt-gemini-3.6-flash</code>             | Third-Party Service Non-Diarization | not-supported |       77.67 |            22.33% |        21.52% |         667.77s |   13.48× realtime |     $1.4410 |
| <code>gladia-default</code>                          | Third-Party Service Diarization     | supported     |       22.41 |            77.59% |        77.80% |          10.32s |  871.76× realtime |     $1.5250 |
| <code>gladia-solaria-1</code>                        | Third-Party Service Diarization     | supported     |       91.63 |             8.37% |         7.36% |         120.73s |   74.55× realtime |     $1.5250 |
| <code>gladia-solaria-3</code>                        | Third-Party Service Diarization     | supported     |       93.88 |             6.12% |         5.07% |         116.54s |   77.23× realtime |     $1.5250 |
| <code>grok-speech-to-text</code>                     | Third-Party Service Diarization     | supported     |       91.55 |             8.45% |         7.70% |         160.18s |   56.19× realtime |         n/a |
| <code>groq-whisper-large-v3</code>                   | Third-Party Service Non-Diarization | not-supported |       93.07 |             6.93% |         5.85% |          85.58s |  105.17× realtime |     $0.2775 |
| <code>groq-whisper-large-v3-turbo</code>             | Third-Party Service Non-Diarization | not-supported |       93.35 |             6.65% |         5.52% |          54.91s |  163.90× realtime |     $0.1000 |
| <code>happyscribe-auto</code>                        | Third-Party Service Diarization     | supported     |       94.01 |             5.99% |         5.25% |         165.51s |   54.38× realtime |       $0.00 |
| <code>mistral-voxtral-mini-2602</code>               | Third-Party Service Diarization     | supported     |       94.22 |             5.78% |         5.45% |          90.67s |   99.26× realtime |     $0.3000 |
| <code>rev-low_cost</code>                            | Third-Party Service Diarization     | supported     |       92.44 |             7.56% |         7.18% |         303.14s |   29.69× realtime |     $0.2500 |
| <code>rev-machine</code>                             | Third-Party Service Diarization     | supported     |       92.95 |             7.05% |         6.67% |         164.79s |   54.62× realtime |     $0.5000 |
| <code>scrapecreators-youtube-transcript</code>       | Third-Party Service Non-Diarization | not-supported |       93.39 |             6.61% |         5.51% |           3.06s | 2942.14× realtime |     $0.0019 |
| <code>soniox-stt-async-v4</code>                     | Third-Party Service Diarization     | supported     |       94.92 |             5.08% |         4.56% |         402.96s |   22.33× realtime |     $0.2500 |
| <code>soniox-stt-async-v5</code>                     | Third-Party Service Diarization     | supported     |       95.52 |             4.48% |         4.07% |         543.34s |   16.56× realtime |     $0.2500 |
| <code>speechmatics-enhanced</code>                   | Third-Party Service Diarization     | supported     |       93.87 |             6.13% |         5.73% |         339.92s |   26.48× realtime |     $1.8750 |
| <code>speechmatics-melia-1</code>                    | Third-Party Service Diarization     | supported     |       92.47 |             7.53% |         7.07% |          53.34s |  168.74× realtime |     $0.3225 |
| <code>supadata-auto</code>                           | Third-Party Service Non-Diarization | not-supported |       93.39 |             6.61% |         5.51% |          11.23s |  801.28× realtime |     $0.0100 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>    | Third-Party Service Non-Diarization | not-supported |       92.81 |             7.19% |         6.11% |           8.74s | 1030.10× realtime |     $0.2250 |
| <code>together-openai_whisper-large-v3</code>        | Third-Party Service Non-Diarization | not-supported |       92.74 |             7.26% |         6.14% |          56.83s |  158.36× realtime |     $0.2250 |

## Error Breakdown (Speaker-aware)

| Provider                                             | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>assemblyai-universal-2</code>                  |            -1 |        -1 |         -1 |      26105 |
| <code>assemblyai-universal-3-5-pro</code>            |            -1 |        -1 |         -1 |      26105 |
| <code>assemblyai-universal-3-pro</code>              |            -1 |        -1 |         -1 |      26105 |
| <code>deepgram-nova-3</code>                         |            -1 |        -1 |         -1 |      26105 |
| <code>deepinfra-openai_whisper-large-v3</code>       |            -1 |        -1 |         -1 |      26105 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> |            -1 |        -1 |         -1 |      26105 |
| <code>gemini-stt-gemini-3-flash-preview</code>       |            -1 |        -1 |         -1 |      26105 |
| <code>gemini-stt-gemini-3.6-flash</code>             |            -1 |        -1 |         -1 |      26105 |
| <code>gladia-default</code>                          |            -1 |        -1 |         -1 |      26105 |
| <code>gladia-solaria-1</code>                        |            -1 |        -1 |         -1 |      26105 |
| <code>gladia-solaria-3</code>                        |            -1 |        -1 |         -1 |      26105 |
| <code>grok-speech-to-text</code>                     |            -1 |        -1 |         -1 |      26105 |
| <code>groq-whisper-large-v3</code>                   |            -1 |        -1 |         -1 |      26105 |
| <code>groq-whisper-large-v3-turbo</code>             |            -1 |        -1 |         -1 |      26105 |
| <code>happyscribe-auto</code>                        |            -1 |        -1 |         -1 |      26105 |
| <code>mistral-voxtral-mini-2602</code>               |            -1 |        -1 |         -1 |      26105 |
| <code>rev-low_cost</code>                            |            -1 |        -1 |         -1 |      26105 |
| <code>rev-machine</code>                             |            -1 |        -1 |         -1 |      26105 |
| <code>scrapecreators-youtube-transcript</code>       |            -1 |        -1 |         -1 |      26105 |
| <code>soniox-stt-async-v4</code>                     |            -1 |        -1 |         -1 |      26105 |
| <code>soniox-stt-async-v5</code>                     |            -1 |        -1 |         -1 |      26105 |
| <code>speechmatics-enhanced</code>                   |            -1 |        -1 |         -1 |      26105 |
| <code>speechmatics-melia-1</code>                    |            -1 |        -1 |         -1 |      26105 |
| <code>supadata-auto</code>                           |            -1 |        -1 |         -1 |      26105 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>    |            -1 |        -1 |         -1 |      26105 |
| <code>together-openai_whisper-large-v3</code>        |            -1 |        -1 |         -1 |      26105 |

## Error Breakdown (Text-only)

| Provider                                             | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>assemblyai-universal-2</code>                  |            -1 |        -1 |         -1 |      25778 |
| <code>assemblyai-universal-3-5-pro</code>            |            -1 |        -1 |         -1 |      25778 |
| <code>assemblyai-universal-3-pro</code>              |            -1 |        -1 |         -1 |      25778 |
| <code>deepgram-nova-3</code>                         |            -1 |        -1 |         -1 |      25778 |
| <code>deepinfra-openai_whisper-large-v3</code>       |            -1 |        -1 |         -1 |      25778 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> |            -1 |        -1 |         -1 |      25778 |
| <code>gemini-stt-gemini-3-flash-preview</code>       |            -1 |        -1 |         -1 |      25778 |
| <code>gemini-stt-gemini-3.6-flash</code>             |            -1 |        -1 |         -1 |      25778 |
| <code>gladia-default</code>                          |            -1 |        -1 |         -1 |      25778 |
| <code>gladia-solaria-1</code>                        |            -1 |        -1 |         -1 |      25778 |
| <code>gladia-solaria-3</code>                        |            -1 |        -1 |         -1 |      25778 |
| <code>grok-speech-to-text</code>                     |            -1 |        -1 |         -1 |      25778 |
| <code>groq-whisper-large-v3</code>                   |            -1 |        -1 |         -1 |      25778 |
| <code>groq-whisper-large-v3-turbo</code>             |            -1 |        -1 |         -1 |      25778 |
| <code>happyscribe-auto</code>                        |            -1 |        -1 |         -1 |      25778 |
| <code>mistral-voxtral-mini-2602</code>               |            -1 |        -1 |         -1 |      25778 |
| <code>rev-low_cost</code>                            |            -1 |        -1 |         -1 |      25778 |
| <code>rev-machine</code>                             |            -1 |        -1 |         -1 |      25778 |
| <code>scrapecreators-youtube-transcript</code>       |            -1 |        -1 |         -1 |      25778 |
| <code>soniox-stt-async-v4</code>                     |            -1 |        -1 |         -1 |      25778 |
| <code>soniox-stt-async-v5</code>                     |            -1 |        -1 |         -1 |      25778 |
| <code>speechmatics-enhanced</code>                   |            -1 |        -1 |         -1 |      25778 |
| <code>speechmatics-melia-1</code>                    |            -1 |        -1 |         -1 |      25778 |
| <code>supadata-auto</code>                           |            -1 |        -1 |         -1 |      25778 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>    |            -1 |        -1 |         -1 |      25778 |
| <code>together-openai_whisper-large-v3</code>        |            -1 |        -1 |         -1 |      25778 |

## Quality Flags

| Provider                   | Quality Flags                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| <code>supadata-auto</code> | Supadata output duplicates another provider artifact in duplicate-1; ranking is unchanged. |

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `soniox-stt-async-v5` was the most accurate provider on strict speaker-aware WER, scoring 95.52/100.
- `scrapecreators-youtube-transcript` was the fastest provider in this set at 3.06s.
- `deepinfra-openai_whisper-large-v3` lost the most ground once speaker changes were counted, with 1.14 percentage-point gap between text-only and speaker-aware WER.
