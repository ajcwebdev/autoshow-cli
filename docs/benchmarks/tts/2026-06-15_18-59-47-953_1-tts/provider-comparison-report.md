# TTS Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/tts/2026-06-15_18-59-47-953_1-tts`
- Total providers: 21 (0 local, 21 service)
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
| 1 | <code>speechify/simba-3.0</code> | $0.0009 |
| 2 | <code>speechify/simba-3.2</code> | $0.0009 |
| 3 | <code>speechify/simba-english</code> | $0.0009 |
| 4 | <code>openai/gpt-4o-mini-tts</code> | $0.0011 |
| 5 | <code>openai/gpt-4o-mini-tts-2025-12-15</code> | $0.0011 |
| 6 | <code>grok/grok-tts</code> | $0.0013 |
| 7 | <code>openai/tts-1</code> | $0.0013 |
| 8 | <code>mistral/voxtral-mini-tts-2603</code> | $0.0014 |
| 9 | <code>gemini/gemini-3.1-flash-tts-preview</code> | $0.0018 |
| 10 | <code>groq/canopylabs/orpheus-v1-english</code> | $0.0019 |
| 11 | <code>deepgram/aura-2-thalia-en</code> | $0.0026 |
| 12 | <code>openai/tts-1-hd</code> | $0.0026 |
| 13 | <code>cartesia/sonic-3</code> | $0.0033 |
| 14 | <code>cartesia/sonic-3.5</code> | $0.0033 |
| 15 | <code>cartesia/sonic-3.5-2026-05-04</code> | $0.0033 |
| 16 | <code>elevenlabs/eleven_flash_v2_5</code> | $0.0043 |
| 17 | <code>minimax/speech-2.8-turbo</code> | $0.0052 |
| 18 | <code>elevenlabs/eleven_multilingual_v2</code> | $0.0087 |
| 19 | <code>elevenlabs/eleven_v3</code> | $0.0087 |
| 20 | <code>minimax/speech-2.8-hd</code> | $0.0087 |
| 21 | <code>hume/octave-2</code> | $0.0130 |

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
| 11 | <code>groq/canopylabs/orpheus-v1-english</code> | 2.08s |
| 12 | <code>grok/grok-tts</code> | 2.47s |
| 13 | <code>openai/tts-1</code> | 2.59s |
| 14 | <code>mistral/voxtral-mini-tts-2603</code> | 2.63s |
| 15 | <code>openai/gpt-4o-mini-tts-2025-12-15</code> | 2.64s |
| 16 | <code>deepgram/aura-2-thalia-en</code> | 2.69s |
| 17 | <code>openai/tts-1-hd</code> | 3.28s |
| 18 | <code>elevenlabs/eleven_v3</code> | 3.29s |
| 19 | <code>gemini/gemini-3.1-flash-tts-preview</code> | 4.75s |
| 20 | <code>minimax/speech-2.8-turbo</code> | 21.30s |
| 21 | <code>minimax/speech-2.8-hd</code> | 188.85s |

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
| <code>elevenlabs/eleven_flash_v2_5</code> | n/a | 0.34s | $0.0043 |
| <code>elevenlabs/eleven_multilingual_v2</code> | n/a | 1.13s | $0.0087 |
| <code>elevenlabs/eleven_v3</code> | n/a | 3.29s | $0.0087 |
| <code>gemini/gemini-3.1-flash-tts-preview</code> | n/a | 4.75s | $0.0018 |
| <code>grok/grok-tts</code> | n/a | 2.47s | $0.0013 |
| <code>groq/canopylabs/orpheus-v1-english</code> | n/a | 2.08s | $0.0019 |
| <code>hume/octave-2</code> | n/a | 1.64s | $0.0130 |
| <code>minimax/speech-2.8-hd</code> | n/a | 188.85s | $0.0087 |
| <code>minimax/speech-2.8-turbo</code> | n/a | 21.30s | $0.0052 |
| <code>mistral/voxtral-mini-tts-2603</code> | n/a | 2.63s | $0.0014 |
| <code>openai/gpt-4o-mini-tts</code> | n/a | 1.89s | $0.0011 |
| <code>openai/gpt-4o-mini-tts-2025-12-15</code> | n/a | 2.64s | $0.0011 |
| <code>openai/tts-1</code> | n/a | 2.59s | $0.0013 |
| <code>openai/tts-1-hd</code> | n/a | 3.28s | $0.0026 |
| <code>speechify/simba-3.0</code> | n/a | 1.12s | $0.0009 |
| <code>speechify/simba-3.2</code> | n/a | 0.96s | $0.0009 |
| <code>speechify/simba-english</code> | n/a | 1.67s | $0.0009 |

## Notes

- Best cloud service: `speechify/simba-3.2` scored 39.59/100.
- The cheapest cloud providers were `speechify/simba-3.2`, `speechify/simba-3.0`, and `speechify/simba-english` at 0.0870¢ ($0.0009).
- Fastest cloud service: `elevenlabs/eleven_flash_v2_5` at 0.34s.
- No roundtrip STT data was available. Existing local/cloud ranking used a composite of speaking rate naturalness (60%), cost (20%), and speed (20%); overall ranking used neutral 50/100 accuracy components for providers without roundtrip data.
