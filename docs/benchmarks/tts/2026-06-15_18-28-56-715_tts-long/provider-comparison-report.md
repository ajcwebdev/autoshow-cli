# TTS Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/tts/2026-06-15_18-28-56-715_tts-long`
- Total providers: 34 (0 local, 34 service)
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
|    4 | <code>deepinfra/ResembleAI/chatterbox-multilingual</code>   | $0.0005  |
|    5 | <code>deepinfra/ResembleAI/chatterbox-turbo</code>          | $0.0005  |
|    6 | <code>speechify/simba-3.0</code>                            | $0.0045  |
|    7 | <code>speechify/simba-3.2</code>                            | $0.0045  |
|    8 | <code>speechify/simba-english</code>                        | $0.0045  |
|    9 | <code>openai/gpt-4o-mini-tts</code>                         | $0.0057  |
|   10 | <code>openai/gpt-4o-mini-tts-2025-12-15</code>              | $0.0057  |
|   11 | <code>grok/grok-tts</code>                                  | $0.0068  |
|   12 | <code>inworld/realtime-tts-2-flash</code>                   | $0.0068  |
|   13 | <code>openai/tts-1</code>                                   | $0.0068  |
|   14 | <code>mistral/voxtral-mini-tts-2603</code>                  | $0.0072  |
|   15 | <code>deepinfra/Qwen/Qwen3-TTS</code>                       | $0.0091  |
|   16 | <code>deepinfra/Qwen/Qwen3-TTS-VoiceDesign</code>           | $0.0091  |
|   17 | <code>gemini/gemini-3.1-flash-tts-preview</code>            | $0.0095  |
|   18 | <code>groq/canopylabs/orpheus-v1-english</code>             | $0.0100  |
|   19 | <code>inworld/realtime-tts-2</code>                         | $0.0113  |
|   20 | <code>deepgram/aura-2-thalia-en</code>                      | $0.0136  |
|   21 | <code>openai/tts-1-hd</code>                                | $0.0136  |
|   22 | <code>cartesia/sonic-3</code>                               | $0.0169  |
|   23 | <code>cartesia/sonic-3.5</code>                             | $0.0169  |
|   24 | <code>cartesia/sonic-3.5-2026-05-04</code>                  | $0.0169  |
|   25 | <code>elevenlabs/eleven_flash_v2_5</code>                   | $0.0226  |
|   26 | <code>fish/fish-speech-1.5</code>                           | $0.0226  |
|   27 | <code>fish/s1</code>                                        | $0.0226  |
|   28 | <code>minimax/speech-2.8-turbo</code>                       | $0.0272  |
|   29 | <code>elevenlabs/eleven_multilingual_v2</code>              | $0.0453  |
|   30 | <code>elevenlabs/eleven_v3</code>                           | $0.0453  |
|   31 | <code>fish/s2-pro</code>                                    | $0.0453  |
|   32 | <code>minimax/speech-2.8-hd</code>                          | $0.0453  |
|   33 | <code>hume/octave-2</code>                                  | $0.0679  |
|   34 | <code>fish/voice-design-1</code>                            | $0.0906  |

### Speed

| Rank | Provider                                                    | Evidence |
| ---: | ----------------------------------------------------------- | -------- |
|    1 | <code>elevenlabs/eleven_flash_v2_5</code>                   | 0.97s    |
|    2 | <code>replicate/jaaari/kokoro-82m</code>                    | 2.97s    |
|    3 | <code>cartesia/sonic-3.5-2026-05-04</code>                  | 3.48s    |
|    4 | <code>speechify/simba-3.2</code>                            | 3.70s    |
|    5 | <code>speechify/simba-3.0</code>                            | 4.38s    |
|    6 | <code>cartesia/sonic-3.5</code>                             | 4.56s    |
|    7 | <code>elevenlabs/eleven_multilingual_v2</code>              | 4.70s    |
|    8 | <code>hume/octave-2</code>                                  | 5.40s    |
|    9 | <code>inworld/realtime-tts-2-flash</code>                   | 5.63s    |
|   10 | <code>openai/gpt-4o-mini-tts</code>                         | 5.91s    |
|   11 | <code>openai/gpt-4o-mini-tts-2025-12-15</code>              | 5.93s    |
|   12 | <code>mistral/voxtral-mini-tts-2603</code>                  | 6.02s    |
|   13 | <code>fish/s1</code>                                        | 6.20s    |
|   14 | <code>speechify/simba-english</code>                        | 6.49s    |
|   15 | <code>fish/fish-speech-1.5</code>                           | 6.54s    |
|   16 | <code>fish/s2-pro</code>                                    | 6.85s    |
|   17 | <code>cartesia/sonic-3</code>                               | 7.07s    |
|   18 | <code>groq/canopylabs/orpheus-v1-english</code>             | 7.08s    |
|   19 | <code>openai/tts-1-hd</code>                                | 7.15s    |
|   20 | <code>fish/voice-design-1</code>                            | 7.82s    |
|   21 | <code>inworld/realtime-tts-2</code>                         | 9.40s    |
|   22 | <code>grok/grok-tts</code>                                  | 12.48s   |
|   23 | <code>deepgram/aura-2-thalia-en</code>                      | 15.74s   |
|   24 | <code>elevenlabs/eleven_v3</code>                           | 15.75s   |
|   25 | <code>deepinfra/XiaomiMiMo/MiMo-V2.5-tts-voicedesign</code> | 16.88s   |
|   26 | <code>deepinfra/Qwen/Qwen3-TTS</code>                       | 19.67s   |
|   27 | <code>deepinfra/Qwen/Qwen3-TTS-VoiceDesign</code>           | 22.41s   |
|   28 | <code>gemini/gemini-3.1-flash-tts-preview</code>            | 25.25s   |
|   29 | <code>deepinfra/XiaomiMiMo/MiMo-V2.5-tts</code>             | 26.73s   |
|   30 | <code>deepinfra/ResembleAI/chatterbox-turbo</code>          | 49.92s   |
|   31 | <code>minimax/speech-2.8-turbo</code>                       | 58.12s   |
|   32 | <code>minimax/speech-2.8-hd</code>                          | 100.53s  |
|   33 | <code>deepinfra/ResembleAI/chatterbox-multilingual</code>   | 103.94s  |
|   34 | <code>openai/tts-1</code>                                   | 305.30s  |

### Automated Quality

Unavailable: No roundtrip WER was available for service providers. Duration, bitrate, and file size are not used as automated quality proxies.

### Human Quality

Unavailable: No humanSpeechScore from voice-quality-report.json was available for service providers. Duration, bitrate, and file size are not used as human quality proxies.

### Provider Detail

| Provider                                                    | Quality Evidence | Processing Time | Monetary Cost |
| ----------------------------------------------------------- | ---------------- | --------------: | ------------: |
| <code>cartesia/sonic-3</code>                               | n/a              |           7.07s |       $0.0169 |
| <code>cartesia/sonic-3.5</code>                             | n/a              |           4.56s |       $0.0169 |
| <code>cartesia/sonic-3.5-2026-05-04</code>                  | n/a              |           3.48s |       $0.0169 |
| <code>deepgram/aura-2-thalia-en</code>                      | n/a              |          15.74s |       $0.0136 |
| <code>deepinfra/Qwen/Qwen3-TTS</code>                       | n/a              |          19.67s |       $0.0091 |
| <code>deepinfra/Qwen/Qwen3-TTS-VoiceDesign</code>           | n/a              |          22.41s |       $0.0091 |
| <code>deepinfra/ResembleAI/chatterbox-multilingual</code>   | n/a              |         103.94s |       $0.0005 |
| <code>deepinfra/ResembleAI/chatterbox-turbo</code>          | n/a              |          49.92s |       $0.0005 |
| <code>deepinfra/XiaomiMiMo/MiMo-V2.5-tts</code>             | n/a              |          26.73s |         $0.00 |
| <code>deepinfra/XiaomiMiMo/MiMo-V2.5-tts-voicedesign</code> | n/a              |          16.88s |         $0.00 |
| <code>elevenlabs/eleven_flash_v2_5</code>                   | n/a              |           0.97s |       $0.0226 |
| <code>elevenlabs/eleven_multilingual_v2</code>              | n/a              |           4.70s |       $0.0453 |
| <code>elevenlabs/eleven_v3</code>                           | n/a              |          15.75s |       $0.0453 |
| <code>fish/fish-speech-1.5</code>                           | n/a              |           6.54s |       $0.0226 |
| <code>fish/s1</code>                                        | n/a              |           6.20s |       $0.0226 |
| <code>fish/s2-pro</code>                                    | n/a              |           6.85s |       $0.0453 |
| <code>fish/voice-design-1</code>                            | n/a              |           7.82s |       $0.0906 |
| <code>gemini/gemini-3.1-flash-tts-preview</code>            | n/a              |          25.25s |       $0.0095 |
| <code>grok/grok-tts</code>                                  | n/a              |          12.48s |       $0.0068 |
| <code>groq/canopylabs/orpheus-v1-english</code>             | n/a              |           7.08s |       $0.0100 |
| <code>hume/octave-2</code>                                  | n/a              |           5.40s |       $0.0679 |
| <code>inworld/realtime-tts-2</code>                         | n/a              |           9.40s |       $0.0113 |
| <code>inworld/realtime-tts-2-flash</code>                   | n/a              |           5.63s |       $0.0068 |
| <code>minimax/speech-2.8-hd</code>                          | n/a              |         100.53s |       $0.0453 |
| <code>minimax/speech-2.8-turbo</code>                       | n/a              |          58.12s |       $0.0272 |
| <code>mistral/voxtral-mini-tts-2603</code>                  | n/a              |           6.02s |       $0.0072 |
| <code>openai/gpt-4o-mini-tts</code>                         | n/a              |           5.91s |       $0.0057 |
| <code>openai/gpt-4o-mini-tts-2025-12-15</code>              | n/a              |           5.93s |       $0.0057 |
| <code>openai/tts-1</code>                                   | n/a              |         305.30s |       $0.0068 |
| <code>openai/tts-1-hd</code>                                | n/a              |           7.15s |       $0.0136 |
| <code>replicate/jaaari/kokoro-82m</code>                    | n/a              |           2.97s |       $0.0002 |
| <code>speechify/simba-3.0</code>                            | n/a              |           4.38s |       $0.0045 |
| <code>speechify/simba-3.2</code>                            | n/a              |           3.70s |       $0.0045 |
| <code>speechify/simba-english</code>                        | n/a              |           6.49s |       $0.0045 |

## Notes

- Best cloud service: `replicate/jaaari/kokoro-82m` scored 38.99/100.
- The cheapest cloud providers were `deepinfra/XiaomiMiMo/MiMo-V2.5-tts-voicedesign` and `deepinfra/XiaomiMiMo/MiMo-V2.5-tts` at 0.0000¢ ($0.0000).
- Fastest cloud service: `elevenlabs/eleven_flash_v2_5` at 0.97s.
- No roundtrip STT data was available. Existing local/cloud ranking used a composite of speaking rate naturalness (60%), cost (20%), and speed (20%); overall ranking used neutral 50/100 accuracy components for providers without roundtrip data.
