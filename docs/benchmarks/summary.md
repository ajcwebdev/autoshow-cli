# Benchmark Rankings Summary

Recomputed from retained per-run comparison reports. Each provider/model identity retains its original measured observations; no old judgments are attributed to replacement evaluators. Rankings compare averages within each category and provider group. Missing measurements remain unavailable.

The combined OCR, STT, and URL cross-run rankings are also browsable as one tabbed page in [`combined-comparison-dashboard.html`](combined-comparison-dashboard.html).

## Source Inventory

| Category             | Reports | Provider rows | Groups present                                                       |
| -------------------- | ------: | ------------: | -------------------------------------------------------------------- |
| image                |       2 |            18 | local, service                                                       |
| music                |       4 |             8 | local, service                                                       |
| ocr                  |      13 |           268 | local, thirdPartyService                                             |
| stt-local            |       3 |            24 | local, thirdPartyServiceNonDiarization, thirdPartyServiceDiarization |
| stt-with-speakers    |       4 |            36 | local, thirdPartyServiceNonDiarization, thirdPartyServiceDiarization |
| stt-without-speakers |       4 |            40 | local, thirdPartyServiceNonDiarization, thirdPartyServiceDiarization |
| url                  |       7 |            37 | local, service                                                       |
| video                |       2 |            10 | local, service                                                       |
| write                |       1 |            16 | local, service                                                       |
| **Total**            |  **40** |       **457** | **5 groups**                                                         |

## image

### local

#### Cost

Unavailable in retained evidence.

#### Speed

Unavailable in retained evidence.

#### Automated quality

Unavailable in retained evidence.

#### Human quality

Unavailable in retained evidence.

### service

#### Cost

| Rank | Provider/model                      | Runs |  Average |
| ---: | ----------------------------------- | ---: | -------: |
|    1 | fal/alibaba/qwen-image-3            |  2/2 | $0.00510 |
|    2 | fal/fal-ai/hidream-o1-image         |  2/2 | $0.01000 |
|    3 | gemini/gemini-3.1-flash-lite-image  |  2/2 | $0.03360 |
|    4 | replicate/bytedance/seedream-5-lite |  2/2 | $0.03500 |
|    5 | lumalabs/uni-1                      |  2/2 | $0.04040 |
|    6 | replicate/bytedance/seedream-5-pro  |  2/2 | $0.04500 |
|    7 | openai/gpt-image-2                  |  2/2 | $0.05300 |
|    8 | lumalabs/uni-1-max                  |  2/2 | $0.10000 |
|    9 | fal/reve/2.1                        |  2/2 | $0.25000 |

#### Speed

| Rank | Provider/model                      | Runs |   Average |
| ---: | ----------------------------------- | ---: | --------: |
|    1 | gemini/gemini-3.1-flash-lite-image  |  2/2 |   2.849 s |
|    2 | fal/fal-ai/hidream-o1-image         |  2/2 |  35.855 s |
|    3 | fal/reve/2.1                        |  2/2 |  53.514 s |
|    4 | replicate/bytedance/seedream-5-lite |  2/2 |  66.496 s |
|    5 | lumalabs/uni-1                      |  2/2 |  72.093 s |
|    6 | openai/gpt-image-2                  |  2/2 | 105.686 s |
|    7 | lumalabs/uni-1-max                  |  2/2 | 113.552 s |
|    8 | replicate/bytedance/seedream-5-pro  |  2/2 | 175.238 s |
|    9 | fal/alibaba/qwen-image-3            |  2/2 | 481.423 s |

#### Automated quality

Unavailable in retained evidence.

#### Human quality

Unavailable in retained evidence.

## music

### local

#### Cost

Unavailable in retained evidence.

#### Speed

Unavailable in retained evidence.

#### Automated quality

Unavailable in retained evidence.

#### Human quality

Unavailable in retained evidence.

### service

#### Cost

| Rank | Provider/model      | Runs |  Average |
| ---: | ------------------- | ---: | -------: |
|    1 | minimax/music-3.0   |  4/4 | $0.16000 |
|    2 | elevenlabs/music_v2 |  4/4 | $0.24375 |

#### Speed

| Rank | Provider/model      | Runs |   Average |
| ---: | ------------------- | ---: | --------: |
|    1 | elevenlabs/music_v2 |  4/4 |  15.505 s |
|    2 | minimax/music-3.0   |  4/4 | 164.788 s |

#### Automated quality

Unavailable in retained evidence.

#### Human quality

Unavailable in retained evidence.

## ocr

### local

Cost is USD per 100 pages; speed is pages per minute.

#### Cost

Unavailable in retained evidence.

#### Speed

Unavailable in retained evidence.

#### Automated quality

Unavailable in retained evidence.

#### Human quality

Unavailable in retained evidence.

### thirdPartyService

Cost is USD per 100 pages; speed is pages per minute.

#### Cost

| Rank | Provider/model                  | Runs  | Cost     |
| ---- | ------------------------------- | ----- | -------- |
| 1    | deepinfra/google/gemma-4-31B-it | 10/13 | $0.01928 |
| 2    | gemini/gemini-3.5-flash-lite    | 13/13 | $0.14674 |
| 3    | openai/gpt-5.6-luna             | 13/13 | $0.15467 |
| 4    | glm/glm-5.3-flash               | 11/13 | $0.19619 |
| 5    | mistral/mistral-ocr-4-0         | 13/13 | $0.40000 |
| 6    | mistral/mistral-ocr-4-1         | 13/13 | $0.40000 |
| 7    | gemini/gemini-3.6-flash         | 13/13 | $0.54227 |
| 8    | kimi/kimi-k2.6                  | 13/13 | $0.54524 |
| 9    | gemini/gemini-3.8-flash         | 13/13 | $0.58540 |
| 10   | gemini/gemini-3.7-flash         | 13/13 | $0.60483 |
| 11   | gemini/gemini-3.5-flash         | 13/13 | $0.73382 |
| 12   | grok/grok-4.5                   | 13/13 | $0.82768 |
| 13   | grok/grok-4.6                   | 13/13 | $0.85739 |
| 14   | anthropic/claude-sonnet-5       | 13/13 | $1.26796 |
| 15   | openai/gpt-5.6-terra            | 13/13 | $1.34310 |
| 16   | anthropic/claude-opus-5         | 13/13 | $3.21860 |
| 17   | openai/gpt-5.6-sol              | 13/13 | $4.53345 |
| 18   | kimi/kimi-k3                    | 13/13 | $5.16629 |
| 19   | openai/gpt-6-astra              | 13/13 | $5.55107 |
| 20   | anthropic/claude-fable-5        | 13/13 | $6.65238 |
| 21   | anthropic/claude-fable-5-1      | 13/13 | $7.67838 |

#### Speed

| Rank | Provider/model                  | Runs  | Speed            |
| ---- | ------------------------------- | ----- | ---------------- |
| 1    | mistral/mistral-ocr-4-0         | 13/13 | 44.808 pages/min |
| 2    | mistral/mistral-ocr-4-1         | 13/13 | 41.144 pages/min |
| 3    | gemini/gemini-3.5-flash-lite    | 13/13 | 33.320 pages/min |
| 4    | gemini/gemini-3.7-flash         | 13/13 | 27.083 pages/min |
| 5    | gemini/gemini-3.8-flash         | 13/13 | 21.446 pages/min |
| 6    | gemini/gemini-3.6-flash         | 13/13 | 18.635 pages/min |
| 7    | gemini/gemini-3.5-flash         | 13/13 | 17.579 pages/min |
| 8    | openai/gpt-5.6-luna             | 13/13 | 12.615 pages/min |
| 9    | openai/gpt-5.6-terra            | 13/13 | 10.817 pages/min |
| 10   | deepinfra/google/gemma-4-31B-it | 10/13 | 7.597 pages/min  |
| 11   | openai/gpt-6-astra              | 13/13 | 7.440 pages/min  |
| 12   | kimi/kimi-k2.6                  | 13/13 | 5.614 pages/min  |
| 13   | anthropic/claude-sonnet-5       | 13/13 | 5.478 pages/min  |
| 14   | openai/gpt-5.6-sol              | 13/13 | 5.336 pages/min  |
| 15   | grok/grok-4.5                   | 13/13 | 5.053 pages/min  |
| 16   | anthropic/claude-fable-5        | 13/13 | 4.650 pages/min  |
| 17   | anthropic/claude-opus-5         | 13/13 | 4.543 pages/min  |
| 18   | anthropic/claude-fable-5-1      | 13/13 | 4.085 pages/min  |
| 19   | grok/grok-4.6                   | 13/13 | 3.443 pages/min  |
| 20   | glm/glm-5.3-flash               | 11/13 | 2.030 pages/min  |
| 21   | kimi/kimi-k3                    | 13/13 | 0.908 pages/min  |

#### Automated quality

| Rank | Provider/model                  | Runs  | Automated quality |
| ---- | ------------------------------- | ----- | ----------------- |
| 1    | anthropic/claude-fable-5-1      | 13/13 | 96.703            |
| 2    | deepinfra/google/gemma-4-31B-it | 10/13 | 96.130            |
| 3    | openai/gpt-6-astra              | 13/13 | 95.642            |
| 4    | anthropic/claude-fable-5        | 13/13 | 95.515            |
| 5    | openai/gpt-5.6-sol              | 13/13 | 94.884            |
| 6    | gemini/gemini-3.6-flash         | 13/13 | 94.410            |
| 7    | gemini/gemini-3.8-flash         | 13/13 | 94.079            |
| 8    | glm/glm-5.3-flash               | 11/13 | 93.941            |
| 9    | anthropic/claude-sonnet-5       | 13/13 | 93.086            |
| 10   | gemini/gemini-3.7-flash         | 13/13 | 92.809            |
| 11   | anthropic/claude-opus-5         | 13/13 | 92.769            |
| 12   | kimi/kimi-k3                    | 13/13 | 91.179            |
| 13   | openai/gpt-5.6-terra            | 13/13 | 91.056            |
| 14   | gemini/gemini-3.5-flash         | 13/13 | 90.568            |
| 15   | mistral/mistral-ocr-4-0         | 13/13 | 89.936            |
| 16   | mistral/mistral-ocr-4-1         | 13/13 | 89.787            |
| 17   | openai/gpt-5.6-luna             | 13/13 | 88.723            |
| 18   | grok/grok-4.5                   | 13/13 | 88.502            |
| 19   | grok/grok-4.6                   | 13/13 | 87.925            |
| 20   | kimi/kimi-k2.6                  | 13/13 | 87.433            |
| 21   | gemini/gemini-3.5-flash-lite    | 13/13 | 81.312            |

#### Human quality

Unavailable in retained evidence.

## stt-local

### local

#### Cost

| Rank | Provider/model        | Runs |  Average |
| ---: | --------------------- | ---: | -------: |
|    1 | whisperfile/large-v2  |  3/3 | $0.00000 |
|    2 | whisperfile/large-v3  |  3/3 | $0.00000 |
|    3 | whisperfile/medium    |  3/3 | $0.00000 |
|    4 | whisperfile/medium.en |  3/3 | $0.00000 |
|    5 | whisperfile/small     |  3/3 | $0.00000 |
|    6 | whisperfile/small.en  |  3/3 | $0.00000 |
|    7 | whisperfile/tiny      |  3/3 | $0.00000 |
|    8 | whisperfile/tiny.en   |  3/3 | $0.00000 |

#### Speed

| Rank | Provider/model        | Runs |   Average |
| ---: | --------------------- | ---: | --------: |
|    1 | whisperfile/tiny      |  3/3 |  16.431 s |
|    2 | whisperfile/tiny.en   |  3/3 |  17.326 s |
|    3 | whisperfile/small.en  |  3/3 |  70.858 s |
|    4 | whisperfile/small     |  3/3 |  80.332 s |
|    5 | whisperfile/medium.en |  3/3 | 204.395 s |
|    6 | whisperfile/medium    |  3/3 | 208.043 s |
|    7 | whisperfile/large-v2  |  3/3 | 398.415 s |
|    8 | whisperfile/large-v3  |  3/3 | 412.680 s |

#### Automated quality

| Rank | Provider/model        | Runs | Average |
| ---: | --------------------- | ---: | ------: |
|    1 | whisperfile/small.en  |  3/3 |  94.246 |
|    2 | whisperfile/medium    |  3/3 |  94.114 |
|    3 | whisperfile/medium.en |  3/3 |  94.077 |
|    4 | whisperfile/large-v2  |  3/3 |  93.967 |
|    5 | whisperfile/tiny.en   |  3/3 |  91.557 |
|    6 | whisperfile/small     |  3/3 |  90.316 |
|    7 | whisperfile/tiny      |  3/3 |  88.902 |
|    8 | whisperfile/large-v3  |  3/3 |  62.770 |

#### Human quality

Unavailable in retained evidence.

### thirdPartyServiceNonDiarization

#### Cost

Unavailable in retained evidence.

#### Speed

Unavailable in retained evidence.

#### Automated quality

Unavailable in retained evidence.

#### Human quality

Unavailable in retained evidence.

### thirdPartyServiceDiarization

#### Cost

Unavailable in retained evidence.

#### Speed

Unavailable in retained evidence.

#### Automated quality

Unavailable in retained evidence.

#### Human quality

Unavailable in retained evidence.

## stt-with-speakers

### local

#### Cost

Unavailable in retained evidence.

#### Speed

Unavailable in retained evidence.

#### Automated quality

Unavailable in retained evidence.

#### Human quality

Unavailable in retained evidence.

### thirdPartyServiceNonDiarization

#### Cost

Unavailable in retained evidence.

#### Speed

Unavailable in retained evidence.

#### Automated quality

Unavailable in retained evidence.

#### Human quality

Unavailable in retained evidence.

### thirdPartyServiceDiarization

#### Cost

| Rank | Provider/model                   | Runs |  Average |
| ---: | -------------------------------- | ---: | -------: |
|    1 | grok/speech-to-text              |  4/4 | $0.06843 |
|    2 | soniox/stt-async-v5              |  4/4 | $0.06843 |
|    3 | speechmatics/melia-1             |  4/4 | $0.08828 |
|    4 | mistral/voxtral-mini-2602        |  4/4 | $0.12318 |
|    5 | assemblyai/universal-3-5-pro     |  4/4 | $0.15740 |
|    6 | deepgram/nova-3                  |  4/4 | $0.17656 |
|    7 | gemini-stt/gemini-3.5-transcribe |  4/4 | $0.20530 |
|    8 | happyscribe/auto                 |  4/4 | $0.41061 |
|    9 | gladia/solaria-3                 |  4/4 | $0.41745 |

#### Speed

| Rank | Provider/model                   | Runs |  Average |
| ---: | -------------------------------- | ---: | -------: |
|    1 | deepgram/nova-3                  |  4/4 |  7.783 s |
|    2 | speechmatics/melia-1             |  4/4 | 19.703 s |
|    3 | grok/speech-to-text              |  4/4 | 26.943 s |
|    4 | mistral/voxtral-mini-2602        |  4/4 | 30.293 s |
|    5 | gladia/solaria-3                 |  4/4 | 33.775 s |
|    6 | assemblyai/universal-3-5-pro     |  4/4 | 36.427 s |
|    7 | soniox/stt-async-v5              |  4/4 | 67.317 s |
|    8 | happyscribe/auto                 |  4/4 | 93.525 s |
|    9 | gemini-stt/gemini-3.5-transcribe |  4/4 | 98.879 s |

#### Automated quality

| Rank | Provider/model                   | Runs | Average |
| ---: | -------------------------------- | ---: | ------: |
|    1 | assemblyai/universal-3-5-pro     |  4/4 |  98.088 |
|    2 | happyscribe/auto                 |  4/4 |  97.754 |
|    3 | mistral/voxtral-mini-2602        |  4/4 |  95.751 |
|    4 | soniox/stt-async-v5              |  4/4 |  95.650 |
|    5 | gladia/solaria-3                 |  4/4 |  95.490 |
|    6 | speechmatics/melia-1             |  4/4 |  95.395 |
|    7 | gemini-stt/gemini-3.5-transcribe |  4/4 |  93.236 |
|    8 | deepgram/nova-3                  |  4/4 |  92.816 |
|    9 | grok/speech-to-text              |  4/4 |  89.728 |

#### Human quality

Unavailable in retained evidence.

## stt-without-speakers

### local

#### Cost

Unavailable in retained evidence.

#### Speed

Unavailable in retained evidence.

#### Automated quality

Unavailable in retained evidence.

#### Human quality

Unavailable in retained evidence.

### thirdPartyServiceNonDiarization

#### Cost

| Rank | Provider/model                                                | Runs |  Average |
| ---: | ------------------------------------------------------------- | ---: | -------: |
|    1 | deepinfra/nvidia/Nemotron-3.5-ASR-Streaming-Multilingual-0.6b |  4/4 | $0.00821 |
|    2 | deepinfra/openai/whisper-large-v3-turbo                       |  4/4 | $0.00821 |
|    3 | deepinfra/Qwen/Qwen3-ASR-0.6B                                 |  4/4 | $0.00821 |
|    4 | deepinfra/openai/whisper-large-v3                             |  4/4 | $0.01848 |
|    5 | deepinfra/Qwen/Qwen3-ASR-1.7B                                 |  4/4 | $0.01848 |
|    6 | deepinfra/mistralai/Voxtral-Mini-3B-2507                      |  4/4 | $0.04106 |
|    7 | together/nvidia/parakeet-tdt-0.6b-v3                          |  4/4 | $0.06159 |
|    8 | together/openai/whisper-large-v3                              |  4/4 | $0.06159 |
|    9 | deepinfra/mistralai/Voxtral-Small-24B-2507                    |  4/4 | $0.12318 |
|   10 | openai-stt/gpt-transcribe                                     |  4/4 | $0.18480 |

#### Speed

| Rank | Provider/model                                                | Runs |   Average |
| ---: | ------------------------------------------------------------- | ---: | --------: |
|    1 | together/openai/whisper-large-v3                              |  4/4 |  10.845 s |
|    2 | deepinfra/openai/whisper-large-v3-turbo                       |  4/4 |  13.076 s |
|    3 | together/nvidia/parakeet-tdt-0.6b-v3                          |  4/4 |  14.214 s |
|    4 | deepinfra/openai/whisper-large-v3                             |  4/4 |  24.863 s |
|    5 | deepinfra/Qwen/Qwen3-ASR-1.7B                                 |  4/4 |  51.840 s |
|    6 | openai-stt/gpt-transcribe                                     |  4/4 |  55.732 s |
|    7 | deepinfra/Qwen/Qwen3-ASR-0.6B                                 |  4/4 |  58.070 s |
|    8 | deepinfra/mistralai/Voxtral-Mini-3B-2507                      |  4/4 |  78.368 s |
|    9 | deepinfra/nvidia/Nemotron-3.5-ASR-Streaming-Multilingual-0.6b |  4/4 | 149.047 s |
|   10 | deepinfra/mistralai/Voxtral-Small-24B-2507                    |  4/4 | 283.917 s |

#### Automated quality

| Rank | Provider/model                                                | Runs | Average |
| ---: | ------------------------------------------------------------- | ---: | ------: |
|    1 | deepinfra/mistralai/Voxtral-Mini-3B-2507                      |  4/4 |  94.920 |
|    2 | openai-stt/gpt-transcribe                                     |  4/4 |  94.901 |
|    3 | deepinfra/Qwen/Qwen3-ASR-0.6B                                 |  4/4 |  94.198 |
|    4 | deepinfra/Qwen/Qwen3-ASR-1.7B                                 |  4/4 |  94.173 |
|    5 | together/openai/whisper-large-v3                              |  4/4 |  94.001 |
|    6 | together/nvidia/parakeet-tdt-0.6b-v3                          |  4/4 |  93.268 |
|    7 | deepinfra/nvidia/Nemotron-3.5-ASR-Streaming-Multilingual-0.6b |  4/4 |  92.305 |
|    8 | deepinfra/openai/whisper-large-v3                             |  4/4 |  89.397 |
|    9 | deepinfra/openai/whisper-large-v3-turbo                       |  4/4 |  88.400 |
|   10 | deepinfra/mistralai/Voxtral-Small-24B-2507                    |  4/4 |  78.037 |

#### Human quality

Unavailable in retained evidence.

### thirdPartyServiceDiarization

#### Cost

Unavailable in retained evidence.

#### Speed

Unavailable in retained evidence.

#### Automated quality

Unavailable in retained evidence.

#### Human quality

Unavailable in retained evidence.

## URL

### local

#### Cost

| Rank | Provider/model |     Runs | Average |
| ---: | -------------- | -------: | ------: |
|    1 | defuddle       | 2/7 runs |   $0.00 |

#### Speed

| Rank | Provider/model |     Runs | Average |
| ---: | -------------- | -------: | ------: |
|    1 | defuddle       | 2/7 runs |   0.71s |

#### Automated quality

| Rank | Provider/model |     Runs |   Average |
| ---: | -------------- | -------: | --------: |
|    1 | defuddle       | 2/7 runs | 98.28/100 |

#### Human quality

Unavailable in retained evidence.

### service

#### Cost

| Rank | Provider/model |     Runs | Average |
| ---: | -------------- | -------: | ------: |
|    1 | firecrawl      | 7/7 runs | $0.0008 |
|    2 | spider         | 7/7 runs | $0.0012 |
|    3 | zyte           | 7/7 runs | $0.0016 |
|    4 | supadata       | 7/7 runs | $0.0100 |
|    5 | glm-reader     | 7/7 runs | $0.0100 |

#### Speed

| Rank | Provider/model |     Runs | Average |
| ---: | -------------- | -------: | ------: |
|    1 | firecrawl      | 7/7 runs |   1.73s |
|    2 | spider         | 7/7 runs |   1.79s |
|    3 | glm-reader     | 7/7 runs |   4.04s |
|    4 | supadata       | 7/7 runs |   5.52s |
|    5 | zyte           | 7/7 runs |  10.48s |

#### Automated quality

| Rank | Provider/model |     Runs |   Average |
| ---: | -------------- | -------: | --------: |
|    1 | spider         | 7/7 runs | 92.42/100 |
|    2 | firecrawl      | 7/7 runs | 80.45/100 |
|    3 | supadata       | 7/7 runs | 75.39/100 |
|    4 | glm-reader     | 7/7 runs | 68.77/100 |
|    5 | zyte           | 7/7 runs | 52.99/100 |

#### Human quality

Unavailable in retained evidence.

## Video

### local

#### Cost

Unavailable in retained evidence.

#### Speed

Unavailable in retained evidence.

#### Automated quality

Unavailable in retained evidence.

#### Human quality

Unavailable in retained evidence.

### service

#### Cost

| Rank | Provider/model                   | Runs |  Average |
| ---: | -------------------------------- | ---: | -------: |
|    1 | lumalabs/ray-3.2                 |  2/2 | $0.30000 |
|    2 | replicate/pixverse/pixverse-v6   |  2/2 | $0.45375 |
|    3 | grok/grok-imagine-video-1.5      |  2/2 | $0.64000 |
|    4 | replicate/alibaba/happyhorse-1.1 |  2/2 | $0.72277 |
|    5 | fal/minimax/h3                   |  2/2 | $1.30000 |

#### Speed

| Rank | Provider/model                   | Runs |   Average |
| ---: | -------------------------------- | ---: | --------: |
|    1 | grok/grok-imagine-video-1.5      |  2/2 |  32.557 s |
|    2 | replicate/pixverse/pixverse-v6   |  2/2 |  38.762 s |
|    3 | lumalabs/ray-3.2                 |  2/2 |  49.755 s |
|    4 | replicate/alibaba/happyhorse-1.1 |  2/2 |  96.338 s |
|    5 | fal/minimax/h3                   |  2/2 | 276.875 s |

#### Automated quality

Unavailable in retained evidence.

#### Human quality

Unavailable in retained evidence.

## write

### local

#### Cost

Unavailable in retained evidence.

#### Speed

Unavailable in retained evidence.

#### Automated quality

Unavailable in retained evidence.

#### Human quality

Unavailable in retained evidence.

### service

#### Cost

| Rank | Provider/model             | Runs |  Average |
| ---: | -------------------------- | ---: | -------: |
|    1 | openai/gpt-5.6-luna        |  1/1 | $0.00020 |
|    2 | together/glm-5.3-flash     |  1/1 | $0.00055 |
|    3 | together/glm-5.3           |  1/1 | $0.00080 |
|    4 | glm/glm-5.3-flash          |  1/1 | $0.00081 |
|    5 | gemini/gemini-3.7-flash    |  1/1 | $0.00093 |
|    6 | gemini/gemini-3.8-flash    |  1/1 | $0.00097 |
|    7 | openai/gpt-5.6-terra       |  1/1 | $0.00138 |
|    8 | anthropic/claude-sonnet-5  |  1/1 | $0.00227 |
|    9 | grok/grok-4.6              |  1/1 | $0.00245 |
|   10 | kimi/kimi-k3               |  1/1 | $0.00253 |
|   11 | glm/glm-5.3                |  1/1 | $0.00268 |
|   12 | openai/gpt-5.6-sol         |  1/1 | $0.00345 |
|   13 | together/kimi-k3           |  1/1 | $0.00447 |
|   14 | anthropic/claude-opus-5    |  1/1 | $0.00572 |
|   15 | openai/gpt-6-astra         |  1/1 | $0.00659 |
|   16 | anthropic/claude-fable-5-1 |  1/1 | $0.01175 |

#### Speed

| Rank | Provider/model             | Runs |               Average |
| ---: | -------------------------- | ---: | --------------------: |
|    1 | together/glm-5.3           |  1/1 |  2296.68 ms/1K tokens |
|    2 | anthropic/claude-sonnet-5  |  1/1 |  2964.00 ms/1K tokens |
|    3 | openai/gpt-5.6-terra       |  1/1 |  3200.41 ms/1K tokens |
|    4 | openai/gpt-5.6-luna        |  1/1 |  3309.26 ms/1K tokens |
|    5 | together/kimi-k3           |  1/1 |  3563.71 ms/1K tokens |
|    6 | anthropic/claude-opus-5    |  1/1 |  3846.24 ms/1K tokens |
|    7 | gemini/gemini-3.7-flash    |  1/1 |  4213.73 ms/1K tokens |
|    8 | openai/gpt-5.6-sol         |  1/1 |  5879.35 ms/1K tokens |
|    9 | anthropic/claude-fable-5-1 |  1/1 |  6176.86 ms/1K tokens |
|   10 | together/glm-5.3-flash     |  1/1 |  6485.88 ms/1K tokens |
|   11 | gemini/gemini-3.8-flash    |  1/1 |  6811.65 ms/1K tokens |
|   12 | glm/glm-5.3                |  1/1 |  7624.21 ms/1K tokens |
|   13 | openai/gpt-6-astra         |  1/1 |  7857.43 ms/1K tokens |
|   14 | glm/glm-5.3-flash          |  1/1 |  8224.30 ms/1K tokens |
|   15 | kimi/kimi-k3               |  1/1 |  8804.92 ms/1K tokens |
|   16 | grok/grok-4.6              |  1/1 | 14830.60 ms/1K tokens |

#### Automated quality

Unavailable in retained evidence.

#### Human quality

Unavailable in retained evidence.
