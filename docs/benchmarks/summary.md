# Benchmark Rankings Summary

Static cross-run ranking report built from the current `provider-comparison-report.json` and `reference-comparison-report.json` files under `docs/benchmarks`.

Costs are lower-is-better and converted from cents to USD. Speeds are lower-is-better and converted from milliseconds to seconds. Auto-quality and human quality are higher-is-better. Averages use only observed rows for the exact `providerKey`; coverage shows observed category runs.

## Source Inventory

| Category             | Reports | Provider rows | Groups present |
| -------------------- | ------: | ------------: | --- |
| image                |       2 |            26 | local, service |
| music                |       4 |            16 | local, service |
| ocr                  |      14 |           305 | local, thirdPartyService |
| stt-with-speakers    |       4 |            32 | local, thirdPartyServiceDiarization, thirdPartyServiceNonDiarization |
| stt-without-speakers |       4 |            28 | local, thirdPartyServiceDiarization, thirdPartyServiceNonDiarization |
| tts                  |       4 |            84 | local, service |
| url                  |       7 |            37 | local, service |
| video                |       2 |            17 | local, service |
| **Total**            | **41** | **545** | **5 groups** |

## Method

- Cost rankings use report `price.value` values; values are converted from cents to USD.
- Speed rankings use report `speed.value` values; values are converted from milliseconds to seconds.
- Auto-quality uses `rankingSurfaces.*.automatedQuality`, except OCR and STT where it uses `metricRankings.*.qualityScore`.
- Human quality uses only explicit `rankingSurfaces.*.humanQuality` entries; automated scores are not used as proxies.
- Groups remain separate, and full rankings are shown without top-N truncation.

## Image

### local

#### Cost Ranking

_Unavailable: no price entries are present for `image/local` in the current report files._

#### Speed Ranking

_Unavailable: no speed entries are present for `image/local` in the current report files._

#### Auto-Quality Ranking

_Unavailable: no automatedQuality / qualityScore entries are present for `image/local` in the current report files._

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `image/local` in the current report files._

### service

#### Cost Ranking

| Rank | Provider/model                        |     Runs | Average |
| ---: | ------------------------------------- | -------: | ------: |
|    1 | grok/grok-imagine-image               | 2/2 runs | $0.0200 |
|    2 | reve/latest                           | 2/2 runs | $0.0240 |
|    3 | reve/reve-create@20250915             | 2/2 runs | $0.0240 |
|    4 | bfl/flux-2-pro                        | 2/2 runs | $0.0300 |
|    5 | recraft/recraftv4_1                   | 2/2 runs | $0.0400 |
|    6 | recraft/recraftv4_1_utility           | 2/2 runs | $0.0400 |
|    7 | bfl/flux-2-flex                       | 2/2 runs | $0.0500 |
|    8 | grok/grok-imagine-image-quality       | 2/2 runs | $0.0500 |
|    9 | openai/gpt-image-2                    | 2/2 runs | $0.0530 |
|   10 | gemini/gemini-3.1-flash-image-preview | 2/2 runs | $0.0670 |
|   11 | bfl/flux-2-max                        | 2/2 runs | $0.0700 |
|   12 | recraft/recraftv4_1_pro               | 2/2 runs | $0.2500 |
|   13 | recraft/recraftv4_1_utility_pro       | 2/2 runs | $0.2500 |

#### Speed Ranking

| Rank | Provider/model                        |     Runs | Average |
| ---: | ------------------------------------- | -------: | ------: |
|    1 | grok/grok-imagine-image-quality       | 2/2 runs |   4.88s |
|    2 | grok/grok-imagine-image               | 2/2 runs |   5.75s |
|    3 | reve/reve-create@20250915             | 2/2 runs |   6.32s |
|    4 | reve/latest                           | 2/2 runs |   6.50s |
|    5 | recraft/recraftv4_1                   | 2/2 runs |   8.60s |
|    6 | recraft/recraftv4_1_pro               | 2/2 runs |  12.65s |
|    7 | bfl/flux-2-pro                        | 2/2 runs |  14.16s |
|    8 | recraft/recraftv4_1_utility_pro       | 2/2 runs |  15.69s |
|    9 | bfl/flux-2-flex                       | 2/2 runs |  16.41s |
|   10 | recraft/recraftv4_1_utility           | 2/2 runs |  17.11s |
|   11 | gemini/gemini-3.1-flash-image-preview | 2/2 runs |  20.56s |
|   12 | bfl/flux-2-max                        | 2/2 runs |  44.41s |
|   13 | openai/gpt-image-2                    | 2/2 runs | 105.69s |

#### Auto-Quality Ranking

| Rank | Provider/model                        |     Runs |   Average |
| ---: | ------------------------------------- | -------: | --------: |
|    1 | openai/gpt-image-2                    | 2/2 runs | 89.00/100 |
|    2 | recraft/recraftv4_1                   | 2/2 runs | 88.00/100 |
|    3 | recraft/recraftv4_1_utility           | 2/2 runs | 86.00/100 |
|    4 | recraft/recraftv4_1_utility_pro       | 2/2 runs | 86.00/100 |
|    5 | gemini/gemini-3.1-flash-image-preview | 2/2 runs | 85.00/100 |
|    6 | recraft/recraftv4_1_pro               | 2/2 runs | 85.00/100 |
|    7 | grok/grok-imagine-image-quality       | 2/2 runs | 84.00/100 |
|    8 | bfl/flux-2-flex                       | 2/2 runs | 82.00/100 |
|    9 | bfl/flux-2-max                        | 2/2 runs | 80.00/100 |
|   10 | grok/grok-imagine-image               | 2/2 runs | 78.00/100 |
|   11 | bfl/flux-2-pro                        | 2/2 runs | 77.00/100 |
|   12 | reve/latest                           | 2/2 runs | 75.00/100 |
|   13 | reve/reve-create@20250915             | 2/2 runs | 70.00/100 |

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `image/service` in the current report files._

## Music

### local

#### Cost Ranking

_Unavailable: no price entries are present for `music/local` in the current report files._

#### Speed Ranking

_Unavailable: no speed entries are present for `music/local` in the current report files._

#### Auto-Quality Ranking

_Unavailable: no automatedQuality / qualityScore entries are present for `music/local` in the current report files._

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `music/local` in the current report files._

### service

#### Cost Ranking

| Rank | Provider/model              |     Runs | Average |
| ---: | --------------------------- | -------: | ------: |
|    1 | gemini/lyria-3-clip-preview | 4/4 runs | $0.0400 |
|    2 | gemini/lyria-3-pro-preview  | 4/4 runs | $0.0800 |
|    3 | minimax/music-2.6           | 4/4 runs | $0.1600 |
|    4 | elevenlabs/music_v1         | 4/4 runs | $0.4550 |

#### Speed Ranking

| Rank | Provider/model              |     Runs | Average |
| ---: | --------------------------- | -------: | ------: |
|    1 | gemini/lyria-3-clip-preview | 4/4 runs |  20.28s |
|    2 | elevenlabs/music_v1         | 4/4 runs |  20.76s |
|    3 | gemini/lyria-3-pro-preview  | 4/4 runs |  36.64s |
|    4 | minimax/music-2.6           | 4/4 runs | 110.04s |

#### Auto-Quality Ranking

_Unavailable: no automatedQuality / qualityScore entries are present for `music/service` in the current report files._

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `music/service` in the current report files._

## OCR

### local

#### Cost Ranking

| Rank | Provider/model        |       Runs | Average |
| ---: | --------------------- | ---------: | ------: |
|    1 | ocrmypdf/ocrmypdf     | 14/14 runs |   $0.00 |
|    2 | paddle-ocr/paddle-ocr | 14/14 runs |   $0.00 |
|    3 | tesseract/tesseract   | 14/14 runs |   $0.00 |

#### Speed Ranking

| Rank | Provider/model        |       Runs | Average |
| ---: | --------------------- | ---------: | ------: |
|    1 | tesseract/tesseract   | 14/14 runs |   2.28s |
|    2 | ocrmypdf/ocrmypdf     | 14/14 runs |   6.63s |
|    3 | paddle-ocr/paddle-ocr | 14/14 runs |  21.02s |

#### Auto-Quality Ranking

| Rank | Provider/model        |       Runs |   Average |
| ---: | --------------------- | ---------: | --------: |
|    1 | paddle-ocr/paddle-ocr | 14/14 runs | 54.54/100 |
|    2 | tesseract/tesseract   | 14/14 runs | 54.02/100 |
|    3 | ocrmypdf/ocrmypdf     | 14/14 runs | 51.55/100 |

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `ocr/local` in the current report files._

### thirdPartyService

#### Cost Ranking

| Rank | Provider/model                             |       Runs | Average |
| ---: | ------------------------------------------ | ---------: | ------: |
|    1 | glm/glm-ocr                                | 14/14 runs | $0.0003 |
|    2 | openai/gpt-5.4-nano                        | 14/14 runs | $0.0022 |
|    3 | gemini/gemini-3.1-flash-lite-preview       | 14/14 runs | $0.0025 |
|    4 | gemini/gemini-3.1-flash-lite               | 14/14 runs | $0.0025 |
|    5 | deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct   | 14/14 runs | $0.0037 |
|    6 | deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct | 14/14 runs | $0.0050 |
|    7 | mistral/mistral-ocr-2512                   | 14/14 runs | $0.0056 |
|    8 | openai/gpt-5.4-mini                        | 14/14 runs | $0.0075 |
|    9 | grok/grok-4.20-0309-non-reasoning          | 14/14 runs | $0.0110 |
|   10 | grok/grok-4.3                              | 14/14 runs | $0.0111 |
|   11 | mistral/mistral-ocr-4-0                    | 14/14 runs | $0.0111 |
|   12 | anthropic/claude-haiku-4-5                 | 14/14 runs | $0.0123 |
|   13 | kimi/kimi-k2.6                             | 14/14 runs | $0.0151 |
|   14 | gemini/gemini-3.5-flash                    | 14/14 runs | $0.0171 |
|   15 | gemini/gemini-3.1-pro-preview              | 14/14 runs | $0.0225 |
|   16 | anthropic/claude-sonnet-5                  | 14/14 runs | $0.0333 |
|   17 | anthropic/claude-sonnet-4-6                | 12/14 runs | $0.0388 |
|   18 | anthropic/claude-opus-4-8                  | 13/14 runs | $0.0821 |
|   19 | openai/gpt-5.5                             | 14/14 runs | $0.1020 |

#### Speed Ranking

| Rank | Provider/model                             |       Runs | Average |
| ---: | ------------------------------------------ | ---------: | ------: |
|    1 | mistral/mistral-ocr-2512                   | 14/14 runs |   3.65s |
|    2 | grok/grok-4.20-0309-non-reasoning          | 14/14 runs |   3.87s |
|    3 | mistral/mistral-ocr-4-0                    | 14/14 runs |   4.85s |
|    4 | gemini/gemini-3.1-flash-lite-preview       | 14/14 runs |   5.56s |
|    5 | gemini/gemini-3.1-flash-lite               | 14/14 runs |   5.64s |
|    6 | glm/glm-ocr                                | 14/14 runs |   9.73s |
|    7 | openai/gpt-5.4-mini                        | 14/14 runs |   9.76s |
|    8 | openai/gpt-5.4-nano                        | 14/14 runs |  14.36s |
|    9 | anthropic/claude-haiku-4-5                 | 14/14 runs |  17.96s |
|   10 | gemini/gemini-3.5-flash                    | 14/14 runs |  24.89s |
|   11 | anthropic/claude-sonnet-5                  | 14/14 runs |  28.72s |
|   12 | anthropic/claude-opus-4-8                  | 13/14 runs |  31.36s |
|   13 | gemini/gemini-3.1-pro-preview              | 14/14 runs |  32.97s |
|   14 | openai/gpt-5.5                             | 14/14 runs |  34.04s |
|   15 | deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct | 14/14 runs |  39.61s |
|   16 | grok/grok-4.3                              | 14/14 runs |  41.00s |
|   17 | kimi/kimi-k2.6                             | 14/14 runs |  42.77s |
|   18 | deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct   | 14/14 runs |  57.95s |
|   19 | anthropic/claude-sonnet-4-6                | 12/14 runs |  67.20s |

#### Auto-Quality Ranking

| Rank | Provider/model                             |       Runs |   Average |
| ---: | ------------------------------------------ | ---------: | --------: |
|    1 | gemini/gemini-3.1-pro-preview              | 14/14 runs | 94.13/100 |
|    2 | kimi/kimi-k2.6                             | 14/14 runs | 93.78/100 |
|    3 | anthropic/claude-sonnet-4-6                | 12/14 runs | 93.04/100 |
|    4 | gemini/gemini-3.5-flash                    | 14/14 runs | 91.75/100 |
|    5 | deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct | 14/14 runs | 89.36/100 |
|    6 | anthropic/claude-opus-4-8                  | 13/14 runs | 88.51/100 |
|    7 | grok/grok-4.20-0309-non-reasoning          | 14/14 runs | 88.13/100 |
|    8 | grok/grok-4.3                              | 14/14 runs | 87.93/100 |
|    9 | openai/gpt-5.5                             | 14/14 runs | 86.37/100 |
|   10 | gemini/gemini-3.1-flash-lite-preview       | 14/14 runs | 86.09/100 |
|   11 | mistral/mistral-ocr-4-0                    | 14/14 runs | 85.85/100 |
|   12 | deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct   | 14/14 runs | 83.00/100 |
|   13 | mistral/mistral-ocr-2512                   | 14/14 runs | 79.77/100 |
|   14 | anthropic/claude-sonnet-5                  | 14/14 runs | 78.57/100 |
|   15 | gemini/gemini-3.1-flash-lite               | 14/14 runs | 77.65/100 |
|   16 | openai/gpt-5.4-mini                        | 14/14 runs | 77.24/100 |
|   17 | anthropic/claude-haiku-4-5                 | 14/14 runs | 71.59/100 |
|   18 | openai/gpt-5.4-nano                        | 14/14 runs | 69.12/100 |
|   19 | glm/glm-ocr                                | 14/14 runs | 69.08/100 |

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `ocr/thirdPartyService` in the current report files._


## STT With Speakers

### local

#### Cost Ranking

_Unavailable: no entries are present in the current STT report files._

#### Speed Ranking

_Unavailable: no entries are present in the current STT report files._

#### Realtime Throughput Ranking

_Unavailable: no entries are present in the current STT report files._

#### Auto-Quality Ranking

_Unavailable: no entries are present in the current STT report files._

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `stt-with-speakers/local` in the current report files._

### thirdPartyServiceNonDiarization

#### Cost Ranking

_Unavailable: no entries are present in the current STT report files._

#### Speed Ranking

_Unavailable: no entries are present in the current STT report files._

#### Realtime Throughput Ranking

_Unavailable: no entries are present in the current STT report files._

#### Auto-Quality Ranking

_Unavailable: no entries are present in the current STT report files._

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `stt-with-speakers/thirdPartyServiceNonDiarization` in the current report files._

### thirdPartyServiceDiarization

#### Cost Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | soniox/stt-async-v5 | 4/4 runs | $0.0684 |
| 2 | grok/speech-to-text | 4/4 runs | $0.0684 |
| 3 | mistral/voxtral-mini-2602 | 4/4 runs | $0.0821 |
| 4 | speechmatics/melia-1 | 4/4 runs | $0.0883 |
| 5 | assemblyai/universal-3-5-pro | 4/4 runs | $0.1574 |
| 6 | deepgram/nova-3 | 4/4 runs | $0.3983 |
| 7 | happyscribe/auto | 4/4 runs | $0.4106 |
| 8 | gladia/solaria-3 | 4/4 runs | $0.4175 |

#### Speed Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | deepgram/nova-3 | 4/4 runs | 7.78s |
| 2 | speechmatics/melia-1 | 4/4 runs | 19.70s |
| 3 | grok/speech-to-text | 4/4 runs | 26.94s |
| 4 | mistral/voxtral-mini-2602 | 4/4 runs | 30.29s |
| 5 | gladia/solaria-3 | 4/4 runs | 33.78s |
| 6 | assemblyai/universal-3-5-pro | 4/4 runs | 36.43s |
| 7 | soniox/stt-async-v5 | 4/4 runs | 67.32s |
| 8 | happyscribe/auto | 4/4 runs | 93.53s |

#### Realtime Throughput Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | deepgram/nova-3 | 4/4 runs | 316.56× realtime |
| 2 | speechmatics/melia-1 | 4/4 runs | 125.04× realtime |
| 3 | grok/speech-to-text | 4/4 runs | 91.44× realtime |
| 4 | mistral/voxtral-mini-2602 | 4/4 runs | 81.33× realtime |
| 5 | gladia/solaria-3 | 4/4 runs | 72.94× realtime |
| 6 | assemblyai/universal-3-5-pro | 4/4 runs | 67.63× realtime |
| 7 | soniox/stt-async-v5 | 4/4 runs | 36.60× realtime |
| 8 | happyscribe/auto | 4/4 runs | 26.34× realtime |

#### Auto-Quality Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | assemblyai/universal-3-5-pro | 4/4 runs | 98.09/100 quality score |
| 2 | happyscribe/auto | 4/4 runs | 97.75/100 quality score |
| 3 | mistral/voxtral-mini-2602 | 4/4 runs | 95.75/100 quality score |
| 4 | soniox/stt-async-v5 | 4/4 runs | 95.65/100 quality score |
| 5 | gladia/solaria-3 | 4/4 runs | 95.49/100 quality score |
| 6 | speechmatics/melia-1 | 4/4 runs | 95.40/100 quality score |
| 7 | deepgram/nova-3 | 4/4 runs | 92.82/100 quality score |
| 8 | grok/speech-to-text | 4/4 runs | 89.73/100 quality score |

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `stt-with-speakers/thirdPartyServiceDiarization` in the current report files._


## STT Without Speakers

### local

#### Cost Ranking

_Unavailable: no entries are present in the current STT report files._

#### Speed Ranking

_Unavailable: no entries are present in the current STT report files._

#### Realtime Throughput Ranking

_Unavailable: no entries are present in the current STT report files._

#### Auto-Quality Ranking

_Unavailable: no entries are present in the current STT report files._

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `stt-without-speakers/local` in the current report files._

### thirdPartyServiceNonDiarization

#### Cost Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | deepinfra/openai/whisper-large-v3-turbo | 4/4 runs | $0.0082 |
| 2 | deepinfra/openai/whisper-large-v3 | 4/4 runs | $0.0185 |
| 3 | groq/whisper-large-v3-turbo | 4/4 runs | $0.0274 |
| 4 | together/openai/whisper-large-v3 | 4/4 runs | $0.0616 |
| 5 | together/nvidia/parakeet-tdt-0.6b-v3 | 4/4 runs | $0.0616 |
| 6 | groq/whisper-large-v3 | 4/4 runs | $0.0760 |
| 7 | gemini-stt/gemini-3.6-flash | 4/4 runs | $0.3973 |

#### Speed Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | together/openai/whisper-large-v3 | 4/4 runs | 10.84s |
| 2 | deepinfra/openai/whisper-large-v3-turbo | 4/4 runs | 13.08s |
| 3 | together/nvidia/parakeet-tdt-0.6b-v3 | 4/4 runs | 14.21s |
| 4 | groq/whisper-large-v3-turbo | 4/4 runs | 21.24s |
| 5 | groq/whisper-large-v3 | 4/4 runs | 24.57s |
| 6 | deepinfra/openai/whisper-large-v3 | 4/4 runs | 24.86s |
| 7 | gemini-stt/gemini-3.6-flash | 4/4 runs | 169.19s |

#### Realtime Throughput Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | together/openai/whisper-large-v3 | 4/4 runs | 227.18× realtime |
| 2 | deepinfra/openai/whisper-large-v3-turbo | 4/4 runs | 188.41× realtime |
| 3 | together/nvidia/parakeet-tdt-0.6b-v3 | 4/4 runs | 173.32× realtime |
| 4 | groq/whisper-large-v3-turbo | 4/4 runs | 116.00× realtime |
| 5 | groq/whisper-large-v3 | 4/4 runs | 100.26× realtime |
| 6 | deepinfra/openai/whisper-large-v3 | 4/4 runs | 99.09× realtime |
| 7 | gemini-stt/gemini-3.6-flash | 4/4 runs | 14.56× realtime |

#### Auto-Quality Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | groq/whisper-large-v3-turbo | 4/4 runs | 94.57/100 quality score |
| 2 | groq/whisper-large-v3 | 4/4 runs | 94.50/100 quality score |
| 3 | together/openai/whisper-large-v3 | 4/4 runs | 94.00/100 quality score |
| 4 | together/nvidia/parakeet-tdt-0.6b-v3 | 4/4 runs | 93.27/100 quality score |
| 5 | deepinfra/openai/whisper-large-v3 | 4/4 runs | 89.40/100 quality score |
| 6 | deepinfra/openai/whisper-large-v3-turbo | 4/4 runs | 88.40/100 quality score |
| 7 | gemini-stt/gemini-3.6-flash | 4/4 runs | 81.85/100 quality score |

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `stt-without-speakers/thirdPartyServiceNonDiarization` in the current report files._

### thirdPartyServiceDiarization

#### Cost Ranking

_Unavailable: no entries are present in the current STT report files._

#### Speed Ranking

_Unavailable: no entries are present in the current STT report files._

#### Realtime Throughput Ranking

_Unavailable: no entries are present in the current STT report files._

#### Auto-Quality Ranking

_Unavailable: no entries are present in the current STT report files._

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `stt-without-speakers/thirdPartyServiceDiarization` in the current report files._


## TTS

### local

#### Cost Ranking

_Unavailable: no price entries are present for `tts/local` in the current report files._

#### Speed Ranking

_Unavailable: no speed entries are present for `tts/local` in the current report files._

#### Auto-Quality Ranking

_Unavailable: no automatedQuality / qualityScore entries are present for `tts/local` in the current report files._

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `tts/local` in the current report files._

### service

#### Cost Ranking

| Rank | Provider/model                      |     Runs | Average |
| ---: | ----------------------------------- | -------: | ------: |
|    1 | speechify/simba-3.0                 | 4/4 runs | $0.0054 |
|    2 | speechify/simba-3.2                 | 4/4 runs | $0.0054 |
|    3 | speechify/simba-english             | 4/4 runs | $0.0054 |
|    4 | openai/gpt-4o-mini-tts              | 4/4 runs | $0.0068 |
|    5 | openai/gpt-4o-mini-tts-2025-12-15   | 4/4 runs | $0.0068 |
|    6 | grok/grok-tts                       | 4/4 runs | $0.0081 |
|    7 | openai/tts-1                        | 4/4 runs | $0.0081 |
|    8 | mistral/voxtral-mini-tts-2603       | 4/4 runs | $0.0087 |
|    9 | gemini/gemini-3.1-flash-tts-preview | 4/4 runs | $0.0114 |
|   10 | groq/canopylabs/orpheus-v1-english  | 4/4 runs | $0.0119 |
|   11 | deepgram/aura-2-thalia-en           | 4/4 runs | $0.0163 |
|   12 | openai/tts-1-hd                     | 4/4 runs | $0.0163 |
|   13 | cartesia/sonic-3                    | 4/4 runs | $0.0203 |
|   14 | cartesia/sonic-3.5                  | 4/4 runs | $0.0203 |
|   15 | cartesia/sonic-3.5-2026-05-04       | 4/4 runs | $0.0203 |
|   16 | elevenlabs/eleven_flash_v2_5        | 4/4 runs | $0.0271 |
|   17 | minimax/speech-2.8-turbo            | 4/4 runs | $0.0326 |
|   18 | elevenlabs/eleven_multilingual_v2   | 4/4 runs | $0.0542 |
|   19 | elevenlabs/eleven_v3                | 4/4 runs | $0.0542 |
|   20 | minimax/speech-2.8-hd               | 4/4 runs | $0.0542 |
|   21 | hume/octave-2                       | 4/4 runs | $0.0814 |

#### Speed Ranking

| Rank | Provider/model                      |     Runs | Average |
| ---: | ----------------------------------- | -------: | ------: |
|    1 | elevenlabs/eleven_flash_v2_5        | 4/4 runs |   1.44s |
|    2 | cartesia/sonic-3.5-2026-05-04       | 4/4 runs |   4.53s |
|    3 | cartesia/sonic-3.5                  | 4/4 runs |   5.60s |
|    4 | speechify/simba-3.2                 | 4/4 runs |   4.94s |
|    5 | speechify/simba-3.0                 | 4/4 runs |   5.30s |
|    6 | elevenlabs/eleven_multilingual_v2   | 4/4 runs |   5.96s |
|    7 | cartesia/sonic-3                    | 4/4 runs |   8.37s |
|    8 | hume/octave-2                       | 4/4 runs |   6.70s |
|    9 | groq/canopylabs/orpheus-v1-english  | 4/4 runs |   8.36s |
|   10 | mistral/voxtral-mini-tts-2603       | 4/4 runs |   5.61s |
|   11 | speechify/simba-english             | 4/4 runs |   5.87s |
|   12 | grok/grok-tts                       | 4/4 runs |  14.87s |
|   13 | openai/tts-1-hd                     | 4/4 runs |   6.27s |
|   14 | openai/gpt-4o-mini-tts              | 4/4 runs | 132.32s |
|   15 | openai/tts-1                        | 4/4 runs |  80.55s |
|   16 | openai/gpt-4o-mini-tts-2025-12-15   | 4/4 runs |   7.65s |
|   17 | deepgram/aura-2-thalia-en           | 4/4 runs |  19.82s |
|   18 | elevenlabs/eleven_v3                | 4/4 runs |  24.46s |
|   19 | gemini/gemini-3.1-flash-tts-preview | 4/4 runs |  25.37s |
|   20 | minimax/speech-2.8-turbo            | 4/4 runs |  45.26s |
|   21 | minimax/speech-2.8-hd               | 4/4 runs |  98.43s |

#### Auto-Quality Ranking

| Rank | Provider/model                      |     Runs |   Average |
| ---: | ----------------------------------- | -------: | --------: |
|    1 | cartesia/sonic-3.5                  | 3/4 runs | 88.71/100 |
|    2 | elevenlabs/eleven_v3                | 3/4 runs | 86.34/100 |
|    3 | gemini/gemini-3.1-flash-tts-preview | 3/4 runs | 88.48/100 |
|    4 | grok/grok-tts                       | 3/4 runs | 88.12/100 |
|    5 | openai/gpt-4o-mini-tts              | 3/4 runs | 88.67/100 |
|    6 | hume/octave-2                       | 3/4 runs | 87.70/100 |
|    7 | minimax/speech-2.8-hd               | 3/4 runs | 87.86/100 |
|    8 | minimax/speech-2.8-turbo            | 3/4 runs | 87.59/100 |
|    9 | speechify/simba-english             | 3/4 runs | 88.28/100 |
|   10 | openai/tts-1-hd                     | 3/4 runs | 88.44/100 |
|   11 | cartesia/sonic-3                    | 3/4 runs | 76.50/100 |
|   12 | deepgram/aura-2-thalia-en           | 3/4 runs | 83.94/100 |
|   13 | groq/canopylabs/orpheus-v1-english  | 3/4 runs | 84.19/100 |
|   14 | openai/tts-1                        | 3/4 runs | 84.72/100 |
|   15 | mistral/voxtral-mini-tts-2603       | 3/4 runs | 73.15/100 |

#### Human Quality Ranking

| Rank | Provider/model                      |     Runs |   Average |
| ---: | ----------------------------------- | -------: | --------: |
|    1 | openai/tts-1-hd                     | 1/4 runs | 91.75/100 |
|    2 | speechify/simba-english             | 1/4 runs | 91.72/100 |
|    3 | hume/octave-2                       | 1/4 runs | 91.35/100 |
|    4 | minimax/speech-2.8-turbo            | 1/4 runs | 90.71/100 |
|    5 | deepgram/aura-2-thalia-en           | 1/4 runs | 89.08/100 |
|    6 | openai/tts-1                        | 1/4 runs | 88.96/100 |
|    7 | minimax/speech-2.8-hd               | 1/4 runs | 87.64/100 |
|    8 | grok/grok-tts                       | 1/4 runs | 85.83/100 |
|    9 | groq/canopylabs/orpheus-v1-english  | 1/4 runs | 84.50/100 |
|   10 | elevenlabs/eleven_v3                | 1/4 runs | 84.17/100 |
|   11 | gemini/gemini-3.1-flash-tts-preview | 1/4 runs | 83.31/100 |
|   12 | cartesia/sonic-3.5                  | 1/4 runs | 82.68/100 |
|   13 | cartesia/sonic-3                    | 1/4 runs | 80.15/100 |
|   14 | openai/gpt-4o-mini-tts              | 1/4 runs | 77.78/100 |
|   15 | mistral/voxtral-mini-tts-2603       | 1/4 runs | 75.84/100 |

## URL

### local

#### Cost Ranking

| Rank | Provider/model |     Runs | Average |
| ---: | -------------- | -------: | ------: |
|    1 | defuddle       | 2/7 runs |   $0.00 |

#### Speed Ranking

| Rank | Provider/model |     Runs | Average |
| ---: | -------------- | -------: | ------: |
|    1 | defuddle       | 2/7 runs |   0.71s |

#### Auto-Quality Ranking

| Rank | Provider/model |     Runs |   Average |
| ---: | -------------- | -------: | --------: |
|    1 | defuddle       | 2/7 runs | 98.28/100 |

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `url/local` in the current report files._

### service

#### Cost Ranking

| Rank | Provider/model |     Runs | Average |
| ---: | -------------- | -------: | ------: |
|    1 | firecrawl      | 7/7 runs | $0.0008 |
|    2 | spider         | 7/7 runs | $0.0012 |
|    3 | zyte           | 7/7 runs | $0.0016 |
|    4 | supadata       | 7/7 runs | $0.0100 |
|    5 | glm-reader     | 7/7 runs | $0.0100 |

#### Speed Ranking

| Rank | Provider/model |     Runs | Average |
| ---: | -------------- | -------: | ------: |
|    1 | firecrawl      | 7/7 runs |   1.73s |
|    2 | spider         | 7/7 runs |   1.79s |
|    3 | glm-reader     | 7/7 runs |   4.04s |
|    4 | supadata       | 7/7 runs |   5.52s |
|    5 | zyte           | 7/7 runs |  10.48s |

#### Auto-Quality Ranking

| Rank | Provider/model |     Runs |   Average |
| ---: | -------------- | -------: | --------: |
|    1 | spider         | 7/7 runs | 92.42/100 |
|    2 | firecrawl      | 7/7 runs | 80.45/100 |
|    3 | supadata       | 7/7 runs | 75.39/100 |
|    4 | glm-reader     | 7/7 runs | 68.77/100 |
|    5 | zyte           | 7/7 runs | 52.99/100 |

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `url/service` in the current report files._

## Video

### local

#### Cost Ranking

_Unavailable: no price entries are present for `video/local` in the current report files._

#### Speed Ranking

_Unavailable: no speed entries are present for `video/local` in the current report files._

#### Auto-Quality Ranking

_Unavailable: no automatedQuality / qualityScore entries are present for `video/local` in the current report files._

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `video/local` in the current report files._

### service

#### Cost Ranking

| Rank | Provider/model                       |     Runs | Average |
| ---: | ------------------------------------ | -------: | ------: |
|    1 | minimax/T2V-01                       | 2/2 runs | $0.1900 |
|    2 | minimax/T2V-01-Director              | 2/2 runs | $0.1900 |
|    3 | glm/cogvideox-3                      | 2/2 runs | $0.2000 |
|    4 | gemini/veo-3.1-lite-generate-preview | 2/2 runs | $0.3000 |
|    5 | grok/grok-imagine-video              | 2/2 runs | $0.3000 |
|    6 | glm/viduq1-text                      | 2/2 runs | $0.4000 |
|    7 | minimax/MiniMax-Hailuo-2.3           | 2/2 runs | $0.4200 |
|    8 | gemini/veo-3.1-fast-generate-preview | 2/2 runs | $0.6000 |
|    9 | gemini/veo-3.1-generate-preview      | 1/2 runs | $3.2000 |

#### Speed Ranking

| Rank | Provider/model                       |     Runs | Average |
| ---: | ------------------------------------ | -------: | ------: |
|    1 | grok/grok-imagine-video              | 2/2 runs |  31.31s |
|    2 | gemini/veo-3.1-lite-generate-preview | 2/2 runs |  51.73s |
|    3 | gemini/veo-3.1-fast-generate-preview | 2/2 runs |  56.78s |
|    4 | gemini/veo-3.1-generate-preview      | 1/2 runs |  72.03s |
|    5 | minimax/MiniMax-Hailuo-2.3           | 2/2 runs |  97.97s |
|    6 | minimax/T2V-01-Director              | 2/2 runs | 154.84s |
|    7 | glm/viduq1-text                      | 2/2 runs | 193.60s |
|    8 | glm/cogvideox-3                      | 2/2 runs | 249.16s |
|    9 | minimax/T2V-01                       | 2/2 runs | 283.10s |

#### Auto-Quality Ranking

| Rank | Provider/model                       |     Runs |   Average |
| ---: | ------------------------------------ | -------: | --------: |
|    1 | gemini/veo-3.1-generate-preview      | 1/2 runs | 88.00/100 |
|    2 | minimax/MiniMax-Hailuo-2.3           | 1/2 runs | 88.00/100 |
|    3 | minimax/T2V-01-Director              | 1/2 runs | 88.00/100 |
|    4 | grok/grok-imagine-video              | 1/2 runs | 86.00/100 |
|    5 | gemini/veo-3.1-lite-generate-preview | 1/2 runs | 84.00/100 |
|    6 | gemini/veo-3.1-fast-generate-preview | 1/2 runs | 80.00/100 |
|    7 | glm/viduq1-text                      | 1/2 runs | 80.00/100 |
|    8 | minimax/T2V-01                       | 1/2 runs | 80.00/100 |
|    9 | glm/cogvideox-3                      | 1/2 runs | 78.00/100 |

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `video/service` in the current report files._

