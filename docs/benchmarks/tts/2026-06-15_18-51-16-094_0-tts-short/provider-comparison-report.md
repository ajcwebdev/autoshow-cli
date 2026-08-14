# TTS Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/tts/2026-06-15_18-51-16-094_0-tts-short`
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

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>deepinfra/XiaomiMiMo/MiMo-V2.5-tts</code> | $0.00 |
| 2 | <code>deepinfra/XiaomiMiMo/MiMo-V2.5-tts-voicedesign</code> | $0.00 |
| 3 | <code>deepinfra/ResembleAI/chatterbox-multilingual</code> | $0.0000 |
| 4 | <code>deepinfra/ResembleAI/chatterbox-turbo</code> | $0.0000 |
| 5 | <code>speechify/simba-3.0</code> | $0.0002 |
| 6 | <code>speechify/simba-3.2</code> | $0.0002 |
| 7 | <code>speechify/simba-english</code> | $0.0002 |
| 8 | <code>openai/gpt-4o-mini-tts</code> | $0.0002 |
| 9 | <code>openai/gpt-4o-mini-tts-2025-12-15</code> | $0.0002 |
| 10 | <code>replicate/jaaari/kokoro-82m</code> | $0.0002 |
| 11 | <code>openai/tts-1</code> | $0.0003 |
| 12 | <code>grok/grok-tts</code> | $0.0003 |
| 13 | <code>inworld/realtime-tts-2-flash</code> | $0.0003 |
| 14 | <code>mistral/voxtral-mini-tts-2603</code> | $0.0003 |
| 15 | <code>deepinfra/Qwen/Qwen3-TTS</code> | $0.0003 |
| 16 | <code>deepinfra/Qwen/Qwen3-TTS-VoiceDesign</code> | $0.0003 |
| 17 | <code>gemini/gemini-3.1-flash-tts-preview</code> | $0.0004 |
| 18 | <code>groq/canopylabs/orpheus-v1-english</code> | $0.0004 |
| 19 | <code>inworld/realtime-tts-2</code> | $0.0004 |
| 20 | <code>openai/tts-1-hd</code> | $0.0005 |
| 21 | <code>deepgram/aura-2-thalia-en</code> | $0.0005 |
| 22 | <code>cartesia/sonic-3</code> | $0.0006 |
| 23 | <code>cartesia/sonic-3.5</code> | $0.0006 |
| 24 | <code>cartesia/sonic-3.5-2026-05-04</code> | $0.0006 |
| 25 | <code>elevenlabs/eleven_flash_v2_5</code> | $0.0009 |
| 26 | <code>fish/fish-speech-1.5</code> | $0.0009 |
| 27 | <code>fish/s1</code> | $0.0009 |
| 28 | <code>minimax/speech-2.8-turbo</code> | $0.0010 |
| 29 | <code>elevenlabs/eleven_multilingual_v2</code> | $0.0017 |
| 30 | <code>elevenlabs/eleven_v3</code> | $0.0017 |
| 31 | <code>fish/s2-pro</code> | $0.0017 |
| 32 | <code>minimax/speech-2.8-hd</code> | $0.0017 |
| 33 | <code>hume/octave-2</code> | $0.0026 |
| 34 | <code>fish/voice-design-1</code> | $0.0034 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>elevenlabs/eleven_flash_v2_5</code> | 0.15s |
| 2 | <code>cartesia/sonic-3.5-2026-05-04</code> | 0.25s |
| 3 | <code>cartesia/sonic-3.5</code> | 0.38s |
| 4 | <code>cartesia/sonic-3</code> | 0.50s |
| 5 | <code>groq/canopylabs/orpheus-v1-english</code> | 0.53s |
| 6 | <code>speechify/simba-3.2</code> | 0.59s |
| 7 | <code>speechify/simba-3.0</code> | 0.70s |
| 8 | <code>grok/grok-tts</code> | 0.75s |
| 9 | <code>elevenlabs/eleven_multilingual_v2</code> | 0.87s |
| 10 | <code>deepgram/aura-2-thalia-en</code> | 0.91s |
| 11 | <code>elevenlabs/eleven_v3</code> | 0.99s |
| 12 | <code>hume/octave-2</code> | 1.15s |
| 13 | <code>fish/s2-pro</code> | 1.20s |
| 14 | <code>openai/gpt-4o-mini-tts</code> | 1.25s |
| 15 | <code>openai/tts-1</code> | 1.47s |
| 16 | <code>fish/fish-speech-1.5</code> | 1.49s |
| 17 | <code>mistral/voxtral-mini-tts-2603</code> | 1.62s |
| 18 | <code>fish/s1</code> | 1.92s |
| 19 | <code>speechify/simba-english</code> | 2.01s |
| 20 | <code>gemini/gemini-3.1-flash-tts-preview</code> | 2.06s |
| 21 | <code>fish/voice-design-1</code> | 2.20s |
| 22 | <code>inworld/realtime-tts-2</code> | 2.48s |
| 23 | <code>openai/tts-1-hd</code> | 2.58s |
| 24 | <code>openai/gpt-4o-mini-tts-2025-12-15</code> | 2.88s |
| 25 | <code>deepinfra/Qwen/Qwen3-TTS</code> | 5.15s |
| 26 | <code>deepinfra/Qwen/Qwen3-TTS-VoiceDesign</code> | 5.53s |
| 27 | <code>inworld/realtime-tts-2-flash</code> | 5.88s |
| 28 | <code>deepinfra/ResembleAI/chatterbox-turbo</code> | 7.33s |
| 29 | <code>replicate/jaaari/kokoro-82m</code> | 7.98s |
| 30 | <code>deepinfra/XiaomiMiMo/MiMo-V2.5-tts</code> | 8.34s |
| 31 | <code>deepinfra/XiaomiMiMo/MiMo-V2.5-tts-voicedesign</code> | 9.51s |
| 32 | <code>deepinfra/ResembleAI/chatterbox-multilingual</code> | 12.33s |
| 33 | <code>minimax/speech-2.8-hd</code> | 24.04s |
| 34 | <code>minimax/speech-2.8-turbo</code> | 48.53s |

### Automated Quality

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>cartesia/sonic-3.5</code> | 100.00 accuracy (0.00% roundtrip WER) |
| 2 | <code>deepgram/aura-2-thalia-en</code> | 100.00 accuracy (0.00% roundtrip WER) |
| 3 | <code>elevenlabs/eleven_v3</code> | 100.00 accuracy (0.00% roundtrip WER) |
| 4 | <code>gemini/gemini-3.1-flash-tts-preview</code> | 100.00 accuracy (0.00% roundtrip WER) |
| 5 | <code>grok/grok-tts</code> | 100.00 accuracy (0.00% roundtrip WER) |
| 6 | <code>groq/canopylabs/orpheus-v1-english</code> | 100.00 accuracy (0.00% roundtrip WER) |
| 7 | <code>hume/octave-2</code> | 100.00 accuracy (0.00% roundtrip WER) |
| 8 | <code>minimax/speech-2.8-hd</code> | 100.00 accuracy (0.00% roundtrip WER) |
| 9 | <code>minimax/speech-2.8-turbo</code> | 100.00 accuracy (0.00% roundtrip WER) |
| 10 | <code>openai/gpt-4o-mini-tts</code> | 100.00 accuracy (0.00% roundtrip WER) |
| 11 | <code>openai/tts-1</code> | 100.00 accuracy (0.00% roundtrip WER) |
| 12 | <code>openai/tts-1-hd</code> | 100.00 accuracy (0.00% roundtrip WER) |
| 13 | <code>speechify/simba-english</code> | 100.00 accuracy (0.00% roundtrip WER) |
| 14 | <code>cartesia/sonic-3</code> | 66.67 accuracy (33.33% roundtrip WER) |
| 15 | <code>mistral/voxtral-mini-tts-2603</code> | 66.67 accuracy (33.33% roundtrip WER) |

### Human Quality

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>openai/tts-1-hd</code> | 91.75 humanSpeechScore |
| 2 | <code>speechify/simba-english</code> | 91.72 humanSpeechScore |
| 3 | <code>hume/octave-2</code> | 91.35 humanSpeechScore |
| 4 | <code>minimax/speech-2.8-turbo</code> | 90.71 humanSpeechScore |
| 5 | <code>deepgram/aura-2-thalia-en</code> | 89.08 humanSpeechScore |
| 6 | <code>openai/tts-1</code> | 88.96 humanSpeechScore |
| 7 | <code>minimax/speech-2.8-hd</code> | 87.64 humanSpeechScore |
| 8 | <code>grok/grok-tts</code> | 85.83 humanSpeechScore |
| 9 | <code>groq/canopylabs/orpheus-v1-english</code> | 84.50 humanSpeechScore |
| 10 | <code>elevenlabs/eleven_v3</code> | 84.17 humanSpeechScore |
| 11 | <code>gemini/gemini-3.1-flash-tts-preview</code> | 83.31 humanSpeechScore |
| 12 | <code>cartesia/sonic-3.5</code> | 82.68 humanSpeechScore |
| 13 | <code>cartesia/sonic-3</code> | 80.15 humanSpeechScore |
| 14 | <code>openai/gpt-4o-mini-tts</code> | 77.78 humanSpeechScore |
| 15 | <code>mistral/voxtral-mini-tts-2603</code> | 75.84 humanSpeechScore |

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| <code>cartesia/sonic-3</code> | 80.15 humanSpeechScore | 0.50s | $0.0006 |
| <code>cartesia/sonic-3.5</code> | 82.68 humanSpeechScore | 0.38s | $0.0006 |
| <code>cartesia/sonic-3.5-2026-05-04</code> | n/a | 0.25s | $0.0006 |
| <code>deepgram/aura-2-thalia-en</code> | 89.08 humanSpeechScore | 0.91s | $0.0005 |
| <code>deepinfra/Qwen/Qwen3-TTS</code> | n/a | 5.15s | $0.0003 |
| <code>deepinfra/Qwen/Qwen3-TTS-VoiceDesign</code> | n/a | 5.53s | $0.0003 |
| <code>deepinfra/ResembleAI/chatterbox-multilingual</code> | n/a | 12.33s | $0.0000 |
| <code>deepinfra/ResembleAI/chatterbox-turbo</code> | n/a | 7.33s | $0.0000 |
| <code>deepinfra/XiaomiMiMo/MiMo-V2.5-tts</code> | n/a | 8.34s | $0.00 |
| <code>deepinfra/XiaomiMiMo/MiMo-V2.5-tts-voicedesign</code> | n/a | 9.51s | $0.00 |
| <code>elevenlabs/eleven_flash_v2_5</code> | n/a | 0.15s | $0.0009 |
| <code>elevenlabs/eleven_multilingual_v2</code> | n/a | 0.87s | $0.0017 |
| <code>elevenlabs/eleven_v3</code> | 84.17 humanSpeechScore | 0.99s | $0.0017 |
| <code>fish/fish-speech-1.5</code> | n/a | 1.49s | $0.0009 |
| <code>fish/s1</code> | n/a | 1.92s | $0.0009 |
| <code>fish/s2-pro</code> | n/a | 1.20s | $0.0017 |
| <code>fish/voice-design-1</code> | n/a | 2.20s | $0.0034 |
| <code>gemini/gemini-3.1-flash-tts-preview</code> | 83.31 humanSpeechScore | 2.06s | $0.0004 |
| <code>grok/grok-tts</code> | 85.83 humanSpeechScore | 0.75s | $0.0003 |
| <code>groq/canopylabs/orpheus-v1-english</code> | 84.50 humanSpeechScore | 0.53s | $0.0004 |
| <code>hume/octave-2</code> | 91.35 humanSpeechScore | 1.15s | $0.0026 |
| <code>inworld/realtime-tts-2</code> | n/a | 2.48s | $0.0004 |
| <code>inworld/realtime-tts-2-flash</code> | n/a | 5.88s | $0.0003 |
| <code>minimax/speech-2.8-hd</code> | 87.64 humanSpeechScore | 24.04s | $0.0017 |
| <code>minimax/speech-2.8-turbo</code> | 90.71 humanSpeechScore | 48.53s | $0.0010 |
| <code>mistral/voxtral-mini-tts-2603</code> | 75.84 humanSpeechScore | 1.62s | $0.0003 |
| <code>openai/gpt-4o-mini-tts</code> | 77.78 humanSpeechScore | 1.25s | $0.0002 |
| <code>openai/gpt-4o-mini-tts-2025-12-15</code> | n/a | 2.88s | $0.0002 |
| <code>openai/tts-1</code> | 88.96 humanSpeechScore | 1.47s | $0.0003 |
| <code>openai/tts-1-hd</code> | 91.75 humanSpeechScore | 2.58s | $0.0005 |
| <code>replicate/jaaari/kokoro-82m</code> | n/a | 7.98s | $0.0002 |
| <code>speechify/simba-3.0</code> | n/a | 0.70s | $0.0002 |
| <code>speechify/simba-3.2</code> | n/a | 0.59s | $0.0002 |
| <code>speechify/simba-english</code> | 91.72 humanSpeechScore | 2.01s | $0.0002 |

## Notes

- Best cloud service: `openai/tts-1-hd` scored 91.75/100.
- The cheapest cloud providers were `deepinfra/XiaomiMiMo/MiMo-V2.5-tts` and `deepinfra/XiaomiMiMo/MiMo-V2.5-tts-voicedesign` at 0.0000¢ ($0.0000).
- Fastest cloud service: `elevenlabs/eleven_flash_v2_5` at 0.15s.
- Voice quality scores from voice-quality-report.json were used as the primary quality metric (human speech quality: 55% naturalness + 45% speech quality).
