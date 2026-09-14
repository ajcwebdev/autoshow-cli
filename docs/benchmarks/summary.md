# Benchmark Rankings Summary

Recomputed from retained per-run comparison reports. Each provider/model identity retains its original measured observations; no old judgments are attributed to replacement evaluators. Rankings compare averages within each category and provider group. Missing measurements remain unavailable.

## Source Inventory

| Category             | Reports | Provider rows | Groups present                                                       |
| -------------------- | ------: | ------------: | -------------------------------------------------------------------- |
| image                |       2 |            48 | local, service                                                       |
| music                |       4 |            16 | local, service                                                       |
| ocr                  |      13 |           268 | local, thirdPartyService                                             |
| stt-local            |       3 |            39 | local, thirdPartyServiceDiarization, thirdPartyServiceNonDiarization |
| stt-with-speakers    |       4 |            32 | local, thirdPartyServiceDiarization, thirdPartyServiceNonDiarization |
| stt-without-speakers |       4 |            28 | local, thirdPartyServiceDiarization, thirdPartyServiceNonDiarization |
| url                  |       7 |            37 | local, service                                                       |
| video                |       2 |            26 | local, service                                                       |
| write                |       1 |             3 | local, service                                                       |
| **Total**            |  **40** |       **497** | **5 groups**                                                         |

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

| Rank | Provider/model                             | Runs |  Average |
| ---: | ------------------------------------------ | ---: | -------: |
|    1 | gemini/gemini-3.1-flash-image-preview      |  2/2 | $0.00000 |
|    2 | fal/microsoft/mai-image-2.5                |  2/2 | $0.00210 |
|    3 | fal/alibaba/qwen-image-3                   |  2/2 | $0.00510 |
|    4 | fal/fal-ai/hidream-o1-image                |  2/2 | $0.01000 |
|    5 | replicate/prunaai/ernie-image-turbo        |  2/2 | $0.01150 |
|    6 | grok/grok-imagine-image                    |  2/2 | $0.02000 |
|    7 | reve/latest                                |  2/2 | $0.02400 |
|    8 | reve/reve-create@20250915                  |  2/2 | $0.02400 |
|    9 | replicate/ideogram-ai/ideogram-v4-turbo    |  2/2 | $0.03000 |
|   10 | gemini/gemini-3.1-flash-lite-image         |  2/2 | $0.03360 |
|   11 | replicate/bytedance/seedream-5-lite        |  2/2 | $0.03500 |
|   12 | recraft/recraftv4_1                        |  2/2 | $0.04000 |
|   13 | recraft/recraftv4_1_utility                |  2/2 | $0.04000 |
|   14 | lumalabs/uni-1                             |  2/2 | $0.04040 |
|   15 | replicate/bytedance/seedream-5-pro         |  2/2 | $0.04500 |
|   16 | replicate/prunaai/ernie-image              |  2/2 | $0.05280 |
|   17 | openai/gpt-image-2                         |  2/2 | $0.05300 |
|   18 | replicate/ideogram-ai/ideogram-v4-balanced |  2/2 | $0.06000 |
|   19 | lumalabs/uni-1-max                         |  2/2 | $0.10000 |
|   20 | replicate/ideogram-ai/ideogram-v4-quality  |  2/2 | $0.10000 |
|   21 | fal/reve/2.1                               |  2/2 | $0.25000 |
|   22 | recraft/recraftv4_1_pro                    |  2/2 | $0.25000 |
|   23 | recraft/recraftv4_1_utility_pro            |  2/2 | $0.25000 |
|   24 | fal/microsoft/mai-image-2.5-pro            |  2/2 | $1.50000 |

#### Speed

| Rank | Provider/model                             | Runs |   Average |
| ---: | ------------------------------------------ | ---: | --------: |
|    1 | gemini/gemini-3.1-flash-lite-image         |  2/2 |   2.849 s |
|    2 | grok/grok-imagine-image                    |  2/2 |   5.748 s |
|    3 | reve/reve-create@20250915                  |  2/2 |   6.317 s |
|    4 | reve/latest                                |  2/2 |   6.496 s |
|    5 | recraft/recraftv4_1                        |  2/2 |   8.600 s |
|    6 | recraft/recraftv4_1_pro                    |  2/2 |  12.649 s |
|    7 | recraft/recraftv4_1_utility_pro            |  2/2 |  15.686 s |
|    8 | recraft/recraftv4_1_utility                |  2/2 |  17.111 s |
|    9 | gemini/gemini-3.1-flash-image-preview      |  2/2 |  20.563 s |
|   10 | replicate/ideogram-ai/ideogram-v4-turbo    |  2/2 |  20.597 s |
|   11 | replicate/ideogram-ai/ideogram-v4-quality  |  2/2 |  34.124 s |
|   12 | fal/fal-ai/hidream-o1-image                |  2/2 |  35.855 s |
|   13 | fal/microsoft/mai-image-2.5                |  2/2 |  36.420 s |
|   14 | replicate/ideogram-ai/ideogram-v4-balanced |  2/2 |  43.274 s |
|   15 | fal/microsoft/mai-image-2.5-pro            |  2/2 |  43.428 s |
|   16 | fal/reve/2.1                               |  2/2 |  53.514 s |
|   17 | replicate/bytedance/seedream-5-lite        |  2/2 |  66.496 s |
|   18 | lumalabs/uni-1                             |  2/2 |  72.093 s |
|   19 | replicate/prunaai/ernie-image              |  2/2 |  80.778 s |
|   20 | openai/gpt-image-2                         |  2/2 | 105.686 s |
|   21 | lumalabs/uni-1-max                         |  2/2 | 113.552 s |
|   22 | replicate/bytedance/seedream-5-pro         |  2/2 | 175.238 s |
|   23 | replicate/prunaai/ernie-image-turbo        |  2/2 | 200.380 s |
|   24 | fal/alibaba/qwen-image-3                   |  2/2 | 481.423 s |

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

| Rank | Provider/model              | Runs |  Average |
| ---: | --------------------------- | ---: | -------: |
|    1 | gemini/lyria-3-clip-preview |  4/4 | $0.04000 |
|    2 | gemini/lyria-3-pro-preview  |  4/4 | $0.08000 |
|    3 | minimax/music-2.6           |  4/4 | $0.16000 |
|    4 | elevenlabs/music_v1         |  4/4 | $0.45500 |

#### Speed

| Rank | Provider/model              | Runs |   Average |
| ---: | --------------------------- | ---: | --------: |
|    1 | gemini/lyria-3-clip-preview |  4/4 |  20.280 s |
|    2 | elevenlabs/music_v1         |  4/4 |  20.765 s |
|    3 | gemini/lyria-3-pro-preview  |  4/4 |  36.636 s |
|    4 | minimax/music-2.6           |  4/4 | 110.037 s |

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

| Rank | Provider/model         | Runs |  Average |
| ---: | ---------------------- | ---: | -------: |
|    1 | whisper/base           |  3/3 | $0.00000 |
|    2 | whisper/large-v3-turbo |  3/3 | $0.00000 |
|    3 | whisper/medium         |  3/3 | $0.00000 |
|    4 | whisper/small          |  3/3 | $0.00000 |
|    5 | whisper/tiny           |  3/3 | $0.00000 |
|    6 | whisperfile/large-v2   |  3/3 | $0.00000 |
|    7 | whisperfile/large-v3   |  3/3 | $0.00000 |
|    8 | whisperfile/medium     |  3/3 | $0.00000 |
|    9 | whisperfile/medium.en  |  3/3 | $0.00000 |
|   10 | whisperfile/small      |  3/3 | $0.00000 |
|   11 | whisperfile/small.en   |  3/3 | $0.00000 |
|   12 | whisperfile/tiny       |  3/3 | $0.00000 |
|   13 | whisperfile/tiny.en    |  3/3 | $0.00000 |

#### Speed

| Rank | Provider/model         | Runs |   Average |
| ---: | ---------------------- | ---: | --------: |
|    1 | whisperfile/tiny       |  3/3 |  16.431 s |
|    2 | whisper/tiny           |  3/3 |  16.464 s |
|    3 | whisperfile/tiny.en    |  3/3 |  17.326 s |
|    4 | whisper/base           |  3/3 |  22.017 s |
|    5 | whisper/small          |  3/3 |  41.519 s |
|    6 | whisperfile/small.en   |  3/3 |  70.858 s |
|    7 | whisper/large-v3-turbo |  3/3 |  71.254 s |
|    8 | whisperfile/small      |  3/3 |  80.332 s |
|    9 | whisper/medium         |  3/3 |  97.604 s |
|   10 | whisperfile/medium.en  |  3/3 | 204.395 s |
|   11 | whisperfile/medium     |  3/3 | 208.043 s |
|   12 | whisperfile/large-v2   |  3/3 | 398.415 s |
|   13 | whisperfile/large-v3   |  3/3 | 412.680 s |

#### Automated quality

| Rank | Provider/model         | Runs | Average |
| ---: | ---------------------- | ---: | ------: |
|    1 | whisperfile/small.en   |  3/3 |  94.246 |
|    2 | whisperfile/medium     |  3/3 |  94.114 |
|    3 | whisperfile/medium.en  |  3/3 |  94.077 |
|    4 | whisperfile/large-v2   |  3/3 |  93.967 |
|    5 | whisper/large-v3-turbo |  3/3 |  93.907 |
|    6 | whisper/medium         |  3/3 |  93.638 |
|    7 | whisper/small          |  3/3 |  92.967 |
|    8 | whisper/base           |  3/3 |  92.428 |
|    9 | whisperfile/tiny.en    |  3/3 |  91.557 |
|   10 | whisperfile/small      |  3/3 |  90.316 |
|   11 | whisperfile/tiny       |  3/3 |  88.902 |
|   12 | whisper/tiny           |  3/3 |  88.320 |
|   13 | whisperfile/large-v3   |  3/3 |  62.770 |

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

| Rank | Provider/model               | Runs |  Average |
| ---: | ---------------------------- | ---: | -------: |
|    1 | grok/speech-to-text          |  4/4 | $0.06843 |
|    2 | soniox/stt-async-v5          |  4/4 | $0.06843 |
|    3 | mistral/voxtral-mini-2602    |  4/4 | $0.08212 |
|    4 | speechmatics/melia-1         |  4/4 | $0.08828 |
|    5 | assemblyai/universal-3-5-pro |  4/4 | $0.15740 |
|    6 | deepgram/nova-3              |  4/4 | $0.39829 |
|    7 | happyscribe/auto             |  4/4 | $0.41061 |
|    8 | gladia/solaria-3             |  4/4 | $0.41745 |

#### Speed

| Rank | Provider/model               | Runs |  Average |
| ---: | ---------------------------- | ---: | -------: |
|    1 | deepgram/nova-3              |  4/4 |  7.782 s |
|    2 | speechmatics/melia-1         |  4/4 | 19.703 s |
|    3 | grok/speech-to-text          |  4/4 | 26.943 s |
|    4 | mistral/voxtral-mini-2602    |  4/4 | 30.293 s |
|    5 | gladia/solaria-3             |  4/4 | 33.775 s |
|    6 | assemblyai/universal-3-5-pro |  4/4 | 36.427 s |
|    7 | soniox/stt-async-v5          |  4/4 | 67.317 s |
|    8 | happyscribe/auto             |  4/4 | 93.525 s |

#### Automated quality

| Rank | Provider/model               | Runs | Average |
| ---: | ---------------------------- | ---: | ------: |
|    1 | assemblyai/universal-3-5-pro |  4/4 |  98.088 |
|    2 | happyscribe/auto             |  4/4 |  97.754 |
|    3 | mistral/voxtral-mini-2602    |  4/4 |  95.751 |
|    4 | soniox/stt-async-v5          |  4/4 |  95.650 |
|    5 | gladia/solaria-3             |  4/4 |  95.490 |
|    6 | speechmatics/melia-1         |  4/4 |  95.395 |
|    7 | deepgram/nova-3              |  4/4 |  92.816 |
|    8 | grok/speech-to-text          |  4/4 |  89.728 |

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

| Rank | Provider/model                          | Runs |  Average |
| ---: | --------------------------------------- | ---: | -------: |
|    1 | deepinfra/openai/whisper-large-v3-turbo |  4/4 | $0.00821 |
|    2 | deepinfra/openai/whisper-large-v3       |  4/4 | $0.01848 |
|    3 | groq/whisper-large-v3-turbo             |  4/4 | $0.02737 |
|    4 | together/nvidia/parakeet-tdt-0.6b-v3    |  4/4 | $0.06159 |
|    5 | together/openai/whisper-large-v3        |  4/4 | $0.06159 |
|    6 | groq/whisper-large-v3                   |  4/4 | $0.07596 |
|    7 | gemini-stt/gemini-3.6-flash             |  4/4 | $0.39731 |

#### Speed

| Rank | Provider/model                          | Runs |   Average |
| ---: | --------------------------------------- | ---: | --------: |
|    1 | together/openai/whisper-large-v3        |  4/4 |  10.845 s |
|    2 | deepinfra/openai/whisper-large-v3-turbo |  4/4 |  13.076 s |
|    3 | together/nvidia/parakeet-tdt-0.6b-v3    |  4/4 |  14.214 s |
|    4 | groq/whisper-large-v3-turbo             |  4/4 |  21.239 s |
|    5 | groq/whisper-large-v3                   |  4/4 |  24.573 s |
|    6 | deepinfra/openai/whisper-large-v3       |  4/4 |  24.863 s |
|    7 | gemini-stt/gemini-3.6-flash             |  4/4 | 169.193 s |

#### Automated quality

| Rank | Provider/model                          | Runs | Average |
| ---: | --------------------------------------- | ---: | ------: |
|    1 | groq/whisper-large-v3-turbo             |  4/4 |  94.572 |
|    2 | groq/whisper-large-v3                   |  4/4 |  94.498 |
|    3 | together/openai/whisper-large-v3        |  4/4 |  94.001 |
|    4 | together/nvidia/parakeet-tdt-0.6b-v3    |  4/4 |  93.268 |
|    5 | deepinfra/openai/whisper-large-v3       |  4/4 |  89.397 |
|    6 | deepinfra/openai/whisper-large-v3-turbo |  4/4 |  88.400 |
|    7 | gemini-stt/gemini-3.6-flash             |  4/4 |  81.851 |

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

| Rank | Provider/model                       | Runs |  Average |
| ---: | ------------------------------------ | ---: | -------: |
|    1 | minimax/T2V-01                       |  2/2 | $0.19000 |
|    2 | minimax/T2V-01-Director              |  2/2 | $0.19000 |
|    3 | glm/cogvideox-3                      |  2/2 | $0.20000 |
|    4 | gemini/veo-3.1-lite-generate-preview |  2/2 | $0.30000 |
|    5 | lumalabs/ray-3.2                     |  2/2 | $0.30000 |
|    6 | glm/viduq1-text                      |  2/2 | $0.40000 |
|    7 | minimax/MiniMax-Hailuo-2.3           |  2/2 | $0.42000 |
|    8 | replicate/pixverse/pixverse-v6       |  2/2 | $0.45375 |
|    9 | replicate/wan-video/wan-2.7-t2v      |  2/2 | $0.50380 |
|   10 | runway/gen4.5                        |  2/2 | $0.60000 |
|   11 | grok/grok-imagine-video-1.5          |  2/2 | $0.64000 |
|   12 | replicate/alibaba/happyhorse-1.1     |  2/2 | $0.72277 |
|   13 | fal/minimax/h3                       |  2/2 | $1.30000 |

#### Speed

| Rank | Provider/model                       | Runs |   Average |
| ---: | ------------------------------------ | ---: | --------: |
|    1 | grok/grok-imagine-video-1.5          |  2/2 |  32.557 s |
|    2 | replicate/pixverse/pixverse-v6       |  2/2 |  38.762 s |
|    3 | lumalabs/ray-3.2                     |  2/2 |  49.755 s |
|    4 | gemini/veo-3.1-lite-generate-preview |  2/2 |  51.728 s |
|    5 | replicate/alibaba/happyhorse-1.1     |  2/2 |  96.338 s |
|    6 | minimax/MiniMax-Hailuo-2.3           |  2/2 |  97.972 s |
|    7 | runway/gen4.5                        |  2/2 | 101.683 s |
|    8 | replicate/wan-video/wan-2.7-t2v      |  2/2 | 116.555 s |
|    9 | minimax/T2V-01-Director              |  2/2 | 154.844 s |
|   10 | glm/viduq1-text                      |  2/2 | 193.605 s |
|   11 | glm/cogvideox-3                      |  2/2 | 249.165 s |
|   12 | fal/minimax/h3                       |  2/2 | 276.875 s |
|   13 | minimax/T2V-01                       |  2/2 | 283.097 s |

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

| Rank | Provider/model                       | Runs |  Average |
| ---: | ------------------------------------ | ---: | -------: |
|    1 | gemini/gemini-3.1-flash-lite         |  1/1 | $0.00017 |
|    2 | gemini/gemini-3.1-flash-lite-preview |  1/1 | $0.00018 |
|    3 | kimi/kimi-k2.6                       |  1/1 | $0.00055 |

#### Speed

| Rank | Provider/model                       | Runs |              Average |
| ---: | ------------------------------------ | ---: | -------------------: |
|    1 | gemini/gemini-3.1-flash-lite         |  1/1 | 1616.90 ms/1K tokens |
|    2 | gemini/gemini-3.1-flash-lite-preview |  1/1 | 1635.66 ms/1K tokens |
|    3 | kimi/kimi-k2.6                       |  1/1 | 4509.68 ms/1K tokens |

#### Automated quality

Unavailable in retained evidence.

#### Human quality

Unavailable in retained evidence.
