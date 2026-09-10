# TTS Provider Comparison Report

## Summary

- Run directory: `.`
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

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>deepinfra/XiaomiMiMo/MiMo-V2.5-tts</code> | $0.00 |
| 2 | <code>deepinfra/XiaomiMiMo/MiMo-V2.5-tts-voicedesign</code> | $0.00 |
| 3 | <code>deepinfra/ResembleAI/chatterbox-multilingual</code> | $0.0001 |
| 4 | <code>deepinfra/ResembleAI/chatterbox-turbo</code> | $0.0001 |
| 5 | <code>replicate/jaaari/kokoro-82m</code> | $0.0002 |
| 6 | <code>speechify/simba-3.0</code> | $0.0009 |
| 7 | <code>speechify/simba-3.2</code> | $0.0009 |
| 8 | <code>speechify/simba-english</code> | $0.0009 |
| 9 | <code>openai/gpt-4o-mini-tts</code> | $0.0011 |
| 10 | <code>openai/gpt-4o-mini-tts-2025-12-15</code> | $0.0011 |
| 11 | <code>grok/grok-tts</code> | $0.0013 |
| 12 | <code>inworld/realtime-tts-2-flash</code> | $0.0013 |
| 13 | <code>openai/tts-1</code> | $0.0013 |
| 14 | <code>mistral/voxtral-mini-tts-2603</code> | $0.0014 |
| 15 | <code>deepinfra/Qwen/Qwen3-TTS</code> | $0.0017 |
| 16 | <code>deepinfra/Qwen/Qwen3-TTS-VoiceDesign</code> | $0.0017 |
| 17 | <code>gemini/gemini-3.1-flash-tts-preview</code> | $0.0018 |
| 18 | <code>inworld/realtime-tts-2</code> | $0.0022 |
| 19 | <code>deepgram/aura-2-thalia-en</code> | $0.0026 |
| 20 | <code>openai/tts-1-hd</code> | $0.0026 |
| 21 | <code>cartesia/sonic-3</code> | $0.0033 |
| 22 | <code>cartesia/sonic-3.5</code> | $0.0033 |
| 23 | <code>cartesia/sonic-3.5-2026-05-04</code> | $0.0033 |
| 24 | <code>elevenlabs/eleven_flash_v2_5</code> | $0.0043 |
| 25 | <code>fish/fish-speech-1.5</code> | $0.0043 |
| 26 | <code>fish/s1</code> | $0.0043 |
| 27 | <code>minimax/speech-2.8-turbo</code> | $0.0052 |
| 28 | <code>elevenlabs/eleven_multilingual_v2</code> | $0.0087 |
| 29 | <code>elevenlabs/eleven_v3</code> | $0.0087 |
| 30 | <code>fish/s2-pro</code> | $0.0087 |
| 31 | <code>minimax/speech-2.8-hd</code> | $0.0087 |
| 32 | <code>hume/octave-2</code> | $0.0130 |
| 33 | <code>fish/voice-design-1</code> | $0.0174 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>elevenlabs/eleven_flash_v2_5</code> | 0.34s |
| 2 | <code>cartesia/sonic-3.5</code> | 0.84s |
| 3 | <code>speechify/simba-3.2</code> | 0.96s |
| 4 | <code>speechify/simba-3.0</code> | 1.12s |
| 5 | <code>elevenlabs/eleven_multilingual_v2</code> | 1.13s |
| 6 | <code>cartesia/sonic-3.5-2026-05-04</code> | 1.23s |
| 7 | <code>cartesia/sonic-3</code> | 1.34s |
| 8 | <code>hume/octave-2</code> | 1.64s |
| 9 | <code>speechify/simba-english</code> | 1.67s |
| 10 | <code>openai/gpt-4o-mini-tts</code> | 1.89s |
| 11 | <code>grok/grok-tts</code> | 2.47s |
| 12 | <code>openai/tts-1</code> | 2.59s |
| 13 | <code>mistral/voxtral-mini-tts-2603</code> | 2.63s |
| 14 | <code>openai/gpt-4o-mini-tts-2025-12-15</code> | 2.64s |
| 15 | <code>deepgram/aura-2-thalia-en</code> | 2.69s |
| 16 | <code>fish/s1</code> | 2.95s |
| 17 | <code>fish/fish-speech-1.5</code> | 3.08s |
| 18 | <code>openai/tts-1-hd</code> | 3.28s |
| 19 | <code>elevenlabs/eleven_v3</code> | 3.29s |
| 20 | <code>fish/voice-design-1</code> | 3.37s |
| 21 | <code>fish/s2-pro</code> | 3.52s |
| 22 | <code>gemini/gemini-3.1-flash-tts-preview</code> | 4.75s |
| 23 | <code>inworld/realtime-tts-2-flash</code> | 4.90s |
| 24 | <code>replicate/jaaari/kokoro-82m</code> | 5.55s |
| 25 | <code>inworld/realtime-tts-2</code> | 6.40s |
| 26 | <code>deepinfra/Qwen/Qwen3-TTS-VoiceDesign</code> | 7.32s |
| 27 | <code>deepinfra/ResembleAI/chatterbox-turbo</code> | 8.57s |
| 28 | <code>deepinfra/XiaomiMiMo/MiMo-V2.5-tts</code> | 9.70s |
| 29 | <code>deepinfra/XiaomiMiMo/MiMo-V2.5-tts-voicedesign</code> | 10.24s |
| 30 | <code>deepinfra/Qwen/Qwen3-TTS</code> | 10.65s |
| 31 | <code>deepinfra/ResembleAI/chatterbox-multilingual</code> | 14.03s |
| 32 | <code>minimax/speech-2.8-turbo</code> | 21.30s |
| 33 | <code>minimax/speech-2.8-hd</code> | 188.85s |

### Automated Quality

Unavailable: No roundtrip WER was available for service providers. Duration, bitrate, and file size are not used as automated quality proxies.

### Human Quality

Unavailable: No humanSpeechScore from voice-quality-report.json was available for service providers. Duration, bitrate, and file size are not used as human quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| <code>cartesia/sonic-3</code> | n/a | 1.34s | $0.0033 |
| <code>cartesia/sonic-3.5</code> | n/a | 0.84s | $0.0033 |
| <code>cartesia/sonic-3.5-2026-05-04</code> | n/a | 1.23s | $0.0033 |
| <code>deepgram/aura-2-thalia-en</code> | n/a | 2.69s | $0.0026 |
| <code>deepinfra/Qwen/Qwen3-TTS</code> | n/a | 10.65s | $0.0017 |
| <code>deepinfra/Qwen/Qwen3-TTS-VoiceDesign</code> | n/a | 7.32s | $0.0017 |
| <code>deepinfra/ResembleAI/chatterbox-multilingual</code> | n/a | 14.03s | $0.0001 |
| <code>deepinfra/ResembleAI/chatterbox-turbo</code> | n/a | 8.57s | $0.0001 |
| <code>deepinfra/XiaomiMiMo/MiMo-V2.5-tts</code> | n/a | 9.70s | $0.00 |
| <code>deepinfra/XiaomiMiMo/MiMo-V2.5-tts-voicedesign</code> | n/a | 10.24s | $0.00 |
| <code>elevenlabs/eleven_flash_v2_5</code> | n/a | 0.34s | $0.0043 |
| <code>elevenlabs/eleven_multilingual_v2</code> | n/a | 1.13s | $0.0087 |
| <code>elevenlabs/eleven_v3</code> | n/a | 3.29s | $0.0087 |
| <code>fish/fish-speech-1.5</code> | n/a | 3.08s | $0.0043 |
| <code>fish/s1</code> | n/a | 2.95s | $0.0043 |
| <code>fish/s2-pro</code> | n/a | 3.52s | $0.0087 |
| <code>fish/voice-design-1</code> | n/a | 3.37s | $0.0174 |
| <code>gemini/gemini-3.1-flash-tts-preview</code> | n/a | 4.75s | $0.0018 |
| <code>grok/grok-tts</code> | n/a | 2.47s | $0.0013 |
| <code>hume/octave-2</code> | n/a | 1.64s | $0.0130 |
| <code>inworld/realtime-tts-2</code> | n/a | 6.40s | $0.0022 |
| <code>inworld/realtime-tts-2-flash</code> | n/a | 4.90s | $0.0013 |
| <code>minimax/speech-2.8-hd</code> | n/a | 188.85s | $0.0087 |
| <code>minimax/speech-2.8-turbo</code> | n/a | 21.30s | $0.0052 |
| <code>mistral/voxtral-mini-tts-2603</code> | n/a | 2.63s | $0.0014 |
| <code>openai/gpt-4o-mini-tts</code> | n/a | 1.89s | $0.0011 |
| <code>openai/gpt-4o-mini-tts-2025-12-15</code> | n/a | 2.64s | $0.0011 |
| <code>openai/tts-1</code> | n/a | 2.59s | $0.0013 |
| <code>openai/tts-1-hd</code> | n/a | 3.28s | $0.0026 |
| <code>replicate/jaaari/kokoro-82m</code> | n/a | 5.55s | $0.0002 |
| <code>speechify/simba-3.0</code> | n/a | 1.12s | $0.0009 |
| <code>speechify/simba-3.2</code> | n/a | 0.96s | $0.0009 |
| <code>speechify/simba-english</code> | n/a | 1.67s | $0.0009 |

## Notes

- Best cloud service: `speechify/simba-3.2` scored 39.59/100.
- The cheapest cloud providers were `deepinfra/XiaomiMiMo/MiMo-V2.5-tts` and `deepinfra/XiaomiMiMo/MiMo-V2.5-tts-voicedesign` at 0.0000¢ ($0.0000).
- Fastest cloud service: `elevenlabs/eleven_flash_v2_5` at 0.34s.
- No roundtrip STT data was available. Existing local/cloud ranking used a composite of speaking rate naturalness (60%), cost (20%), and speed (20%); overall ranking used neutral 50/100 accuracy components for providers without roundtrip data.
