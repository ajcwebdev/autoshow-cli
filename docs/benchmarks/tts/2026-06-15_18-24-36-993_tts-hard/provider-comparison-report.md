# TTS Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/tts/2026-06-15_18-24-36-993_tts-hard`
- Total providers: 33 (0 local, 33 service)
- Local models and third-party service models are intentionally not ranked against each other.
- Reports expose complete price, speed, automated-quality, and human-quality rankings for each group.

## Method

- Price rankings use zero monetary cost for local models and reported monetary cost for services.
- Speed rankings use processing time when present.
- Automated quality rankings use roundtrip WER-derived accuracy when present.
- Human quality rankings use humanSpeechScore from voice-quality-report.json when present.
- Duration, bitrate, file size, and subjective judgment are not used as quality proxies.

## Local Models

### Price

Unavailable: No local providers were found.

### Speed

Unavailable: No local providers were found.

### Automated Quality

Unavailable: No local providers were found.

### Human Quality

Unavailable: No local providers were found.

### Provider Detail

No local providers were found.

## Third-Party Service Models

### Price

| Rank | Provider                                                    | Evidence |
| ---: | ----------------------------------------------------------- | -------- |
|    1 | <code>deepinfra/XiaomiMiMo/MiMo-V2.5-tts</code>             | $0.00    |
|    2 | <code>deepinfra/XiaomiMiMo/MiMo-V2.5-tts-voicedesign</code> | $0.00    |
|    3 | <code>replicate/jaaari/kokoro-82m</code>                    | $0.0002  |
|    4 | <code>deepinfra/ResembleAI/chatterbox-turbo</code>          | $0.0016  |
|    5 | <code>speechify/simba-3.0</code>                            | $0.0161  |
|    6 | <code>speechify/simba-3.2</code>                            | $0.0161  |
|    7 | <code>speechify/simba-english</code>                        | $0.0161  |
|    8 | <code>openai/gpt-4o-mini-tts</code>                         | $0.0203  |
|    9 | <code>openai/gpt-4o-mini-tts-2025-12-15</code>              | $0.0203  |
|   10 | <code>grok/grok-tts</code>                                  | $0.0242  |
|   11 | <code>inworld/realtime-tts-2-flash</code>                   | $0.0242  |
|   12 | <code>openai/tts-1</code>                                   | $0.0242  |
|   13 | <code>mistral/voxtral-mini-tts-2603</code>                  | $0.0258  |
|   14 | <code>deepinfra/Qwen/Qwen3-TTS</code>                       | $0.0323  |
|   15 | <code>deepinfra/Qwen/Qwen3-TTS-VoiceDesign</code>           | $0.0323  |
|   16 | <code>gemini/gemini-3.1-flash-tts-preview</code>            | $0.0339  |
|   17 | <code>groq/canopylabs/orpheus-v1-english</code>             | $0.0355  |
|   18 | <code>inworld/realtime-tts-2</code>                         | $0.0403  |
|   19 | <code>deepgram/aura-2-thalia-en</code>                      | $0.0484  |
|   20 | <code>openai/tts-1-hd</code>                                | $0.0484  |
|   21 | <code>cartesia/sonic-3</code>                               | $0.0603  |
|   22 | <code>cartesia/sonic-3.5</code>                             | $0.0603  |
|   23 | <code>cartesia/sonic-3.5-2026-05-04</code>                  | $0.0603  |
|   24 | <code>elevenlabs/eleven_flash_v2_5</code>                   | $0.0806  |
|   25 | <code>fish/fish-speech-1.5</code>                           | $0.0806  |
|   26 | <code>fish/s1</code>                                        | $0.0806  |
|   27 | <code>minimax/speech-2.8-turbo</code>                       | $0.0968  |
|   28 | <code>elevenlabs/eleven_multilingual_v2</code>              | $0.1613  |
|   29 | <code>elevenlabs/eleven_v3</code>                           | $0.1613  |
|   30 | <code>fish/s2-pro</code>                                    | $0.1613  |
|   31 | <code>minimax/speech-2.8-hd</code>                          | $0.1613  |
|   32 | <code>hume/octave-2</code>                                  | $0.2419  |
|   33 | <code>fish/voice-design-1</code>                            | $0.3226  |

### Speed

| Rank | Provider                                                    | Evidence |
| ---: | ----------------------------------------------------------- | -------- |
|    1 | <code>elevenlabs/eleven_flash_v2_5</code>                   | 4.28s    |
|    2 | <code>replicate/jaaari/kokoro-82m</code>                    | 9.64s    |
|    3 | <code>inworld/realtime-tts-2-flash</code>                   | 11.50s   |
|    4 | <code>openai/tts-1-hd</code>                                | 12.06s   |
|    5 | <code>mistral/voxtral-mini-tts-2603</code>                  | 12.17s   |
|    6 | <code>openai/tts-1</code>                                   | 12.83s   |
|    7 | <code>cartesia/sonic-3.5-2026-05-04</code>                  | 13.14s   |
|    8 | <code>speechify/simba-english</code>                        | 13.32s   |
|    9 | <code>speechify/simba-3.2</code>                            | 14.51s   |
|   10 | <code>speechify/simba-3.0</code>                            | 15.02s   |
|   11 | <code>cartesia/sonic-3.5</code>                             | 16.63s   |
|   12 | <code>elevenlabs/eleven_multilingual_v2</code>              | 17.13s   |
|   13 | <code>hume/octave-2</code>                                  | 18.60s   |
|   14 | <code>openai/gpt-4o-mini-tts-2025-12-15</code>              | 19.15s   |
|   15 | <code>fish/fish-speech-1.5</code>                           | 20.41s   |
|   16 | <code>groq/canopylabs/orpheus-v1-english</code>             | 23.75s   |
|   17 | <code>cartesia/sonic-3</code>                               | 24.58s   |
|   18 | <code>fish/s2-pro</code>                                    | 26.28s   |
|   19 | <code>inworld/realtime-tts-2</code>                         | 28.60s   |
|   20 | <code>fish/s1</code>                                        | 32.43s   |
|   21 | <code>fish/voice-design-1</code>                            | 39.45s   |
|   22 | <code>deepinfra/XiaomiMiMo/MiMo-V2.5-tts</code>             | 39.46s   |
|   23 | <code>grok/grok-tts</code>                                  | 43.78s   |
|   24 | <code>deepinfra/XiaomiMiMo/MiMo-V2.5-tts-voicedesign</code> | 45.28s   |
|   25 | <code>minimax/speech-2.8-turbo</code>                       | 53.08s   |
|   26 | <code>deepgram/aura-2-thalia-en</code>                      | 59.92s   |
|   27 | <code>deepinfra/Qwen/Qwen3-TTS</code>                       | 67.06s   |
|   28 | <code>gemini/gemini-3.1-flash-tts-preview</code>            | 69.41s   |
|   29 | <code>elevenlabs/eleven_v3</code>                           | 77.81s   |
|   30 | <code>minimax/speech-2.8-hd</code>                          | 80.31s   |
|   31 | <code>deepinfra/Qwen/Qwen3-TTS-VoiceDesign</code>           | 84.22s   |
|   32 | <code>deepinfra/ResembleAI/chatterbox-turbo</code>          | 129.52s  |
|   33 | <code>openai/gpt-4o-mini-tts</code>                         | 520.22s  |

### Automated Quality

Unavailable: No roundtrip WER was available for service providers. Duration, bitrate, and file size are not used as automated quality proxies.

### Human Quality

Unavailable: No humanSpeechScore from voice-quality-report.json was available for service providers. Duration, bitrate, and file size are not used as human quality proxies.

### Provider Detail

| Provider                                                    | Quality Evidence | Processing Time | Monetary Cost |
| ----------------------------------------------------------- | ---------------- | --------------: | ------------: |
| <code>cartesia/sonic-3</code>                               | n/a              |          24.58s |       $0.0603 |
| <code>cartesia/sonic-3.5</code>                             | n/a              |          16.63s |       $0.0603 |
| <code>cartesia/sonic-3.5-2026-05-04</code>                  | n/a              |          13.14s |       $0.0603 |
| <code>deepgram/aura-2-thalia-en</code>                      | n/a              |          59.92s |       $0.0484 |
| <code>deepinfra/Qwen/Qwen3-TTS</code>                       | n/a              |          67.06s |       $0.0323 |
| <code>deepinfra/Qwen/Qwen3-TTS-VoiceDesign</code>           | n/a              |          84.22s |       $0.0323 |
| <code>deepinfra/ResembleAI/chatterbox-turbo</code>          | n/a              |         129.52s |       $0.0016 |
| <code>deepinfra/XiaomiMiMo/MiMo-V2.5-tts</code>             | n/a              |          39.46s |         $0.00 |
| <code>deepinfra/XiaomiMiMo/MiMo-V2.5-tts-voicedesign</code> | n/a              |          45.28s |         $0.00 |
| <code>elevenlabs/eleven_flash_v2_5</code>                   | n/a              |           4.28s |       $0.0806 |
| <code>elevenlabs/eleven_multilingual_v2</code>              | n/a              |          17.13s |       $0.1613 |
| <code>elevenlabs/eleven_v3</code>                           | n/a              |          77.81s |       $0.1613 |
| <code>fish/fish-speech-1.5</code>                           | n/a              |          20.41s |       $0.0806 |
| <code>fish/s1</code>                                        | n/a              |          32.43s |       $0.0806 |
| <code>fish/s2-pro</code>                                    | n/a              |          26.28s |       $0.1613 |
| <code>fish/voice-design-1</code>                            | n/a              |          39.45s |       $0.3226 |
| <code>gemini/gemini-3.1-flash-tts-preview</code>            | n/a              |          69.41s |       $0.0339 |
| <code>grok/grok-tts</code>                                  | n/a              |          43.78s |       $0.0242 |
| <code>groq/canopylabs/orpheus-v1-english</code>             | n/a              |          23.75s |       $0.0355 |
| <code>hume/octave-2</code>                                  | n/a              |          18.60s |       $0.2419 |
| <code>inworld/realtime-tts-2</code>                         | n/a              |          28.60s |       $0.0403 |
| <code>inworld/realtime-tts-2-flash</code>                   | n/a              |          11.50s |       $0.0242 |
| <code>minimax/speech-2.8-hd</code>                          | n/a              |          80.31s |       $0.1613 |
| <code>minimax/speech-2.8-turbo</code>                       | n/a              |          53.08s |       $0.0968 |
| <code>mistral/voxtral-mini-tts-2603</code>                  | n/a              |          12.17s |       $0.0258 |
| <code>openai/gpt-4o-mini-tts</code>                         | n/a              |         520.22s |       $0.0203 |
| <code>openai/gpt-4o-mini-tts-2025-12-15</code>              | n/a              |          19.15s |       $0.0203 |
| <code>openai/tts-1</code>                                   | n/a              |          12.83s |       $0.0242 |
| <code>openai/tts-1-hd</code>                                | n/a              |          12.06s |       $0.0484 |
| <code>replicate/jaaari/kokoro-82m</code>                    | n/a              |           9.64s |       $0.0002 |
| <code>speechify/simba-3.0</code>                            | n/a              |          15.02s |       $0.0161 |
| <code>speechify/simba-3.2</code>                            | n/a              |          14.51s |       $0.0161 |
| <code>speechify/simba-english</code>                        | n/a              |          13.32s |       $0.0161 |

## Notes

- Best cloud service: `replicate/jaaari/kokoro-82m` scored 36.76/100.
- The cheapest cloud providers were `deepinfra/XiaomiMiMo/MiMo-V2.5-tts` and `deepinfra/XiaomiMiMo/MiMo-V2.5-tts-voicedesign` at 0.0000¢ ($0.0000).
- Fastest cloud service: `elevenlabs/eleven_flash_v2_5` at 4.28s.
- No roundtrip STT data was available. Existing local/cloud ranking used a composite of speaking rate naturalness (60%), cost (20%), and speed (20%); overall ranking used neutral 50/100 accuracy components for providers without roundtrip data.
