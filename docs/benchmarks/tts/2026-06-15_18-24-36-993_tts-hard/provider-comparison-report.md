# TTS Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/tts/2026-06-15_18-24-36-993_tts-hard`
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
| 1 | <code>speechify/simba-3.0</code> | $0.0161 |
| 2 | <code>speechify/simba-3.2</code> | $0.0161 |
| 3 | <code>speechify/simba-english</code> | $0.0161 |
| 4 | <code>openai/gpt-4o-mini-tts</code> | $0.0203 |
| 5 | <code>openai/gpt-4o-mini-tts-2025-12-15</code> | $0.0203 |
| 6 | <code>grok/grok-tts</code> | $0.0242 |
| 7 | <code>openai/tts-1</code> | $0.0242 |
| 8 | <code>mistral/voxtral-mini-tts-2603</code> | $0.0258 |
| 9 | <code>gemini/gemini-3.1-flash-tts-preview</code> | $0.0339 |
| 10 | <code>groq/canopylabs/orpheus-v1-english</code> | $0.0355 |
| 11 | <code>deepgram/aura-2-thalia-en</code> | $0.0484 |
| 12 | <code>openai/tts-1-hd</code> | $0.0484 |
| 13 | <code>cartesia/sonic-3</code> | $0.0603 |
| 14 | <code>cartesia/sonic-3.5</code> | $0.0603 |
| 15 | <code>cartesia/sonic-3.5-2026-05-04</code> | $0.0603 |
| 16 | <code>elevenlabs/eleven_flash_v2_5</code> | $0.0806 |
| 17 | <code>minimax/speech-2.8-turbo</code> | $0.0968 |
| 18 | <code>elevenlabs/eleven_multilingual_v2</code> | $0.1613 |
| 19 | <code>elevenlabs/eleven_v3</code> | $0.1613 |
| 20 | <code>minimax/speech-2.8-hd</code> | $0.1613 |
| 21 | <code>hume/octave-2</code> | $0.2419 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>elevenlabs/eleven_flash_v2_5</code> | 4.28s |
| 2 | <code>openai/tts-1-hd</code> | 12.06s |
| 3 | <code>mistral/voxtral-mini-tts-2603</code> | 12.17s |
| 4 | <code>openai/tts-1</code> | 12.83s |
| 5 | <code>cartesia/sonic-3.5-2026-05-04</code> | 13.14s |
| 6 | <code>speechify/simba-english</code> | 13.32s |
| 7 | <code>speechify/simba-3.2</code> | 14.51s |
| 8 | <code>speechify/simba-3.0</code> | 15.02s |
| 9 | <code>cartesia/sonic-3.5</code> | 16.63s |
| 10 | <code>elevenlabs/eleven_multilingual_v2</code> | 17.13s |
| 11 | <code>hume/octave-2</code> | 18.60s |
| 12 | <code>openai/gpt-4o-mini-tts-2025-12-15</code> | 19.15s |
| 13 | <code>groq/canopylabs/orpheus-v1-english</code> | 23.75s |
| 14 | <code>cartesia/sonic-3</code> | 24.58s |
| 15 | <code>grok/grok-tts</code> | 43.78s |
| 16 | <code>minimax/speech-2.8-turbo</code> | 53.08s |
| 17 | <code>deepgram/aura-2-thalia-en</code> | 59.92s |
| 18 | <code>gemini/gemini-3.1-flash-tts-preview</code> | 69.41s |
| 19 | <code>elevenlabs/eleven_v3</code> | 77.81s |
| 20 | <code>minimax/speech-2.8-hd</code> | 80.31s |
| 21 | <code>openai/gpt-4o-mini-tts</code> | 520.22s |

### Automated Quality

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>elevenlabs/eleven_v3</code> | 89.27 accuracy (10.73% roundtrip WER) |
| 2 | <code>cartesia/sonic-3.5</code> | 87.20 accuracy (12.80% roundtrip WER) |
| 3 | <code>speechify/simba-english</code> | 87.20 accuracy (12.80% roundtrip WER) |
| 4 | <code>cartesia/sonic-3</code> | 86.51 accuracy (13.49% roundtrip WER) |
| 5 | <code>gemini/gemini-3.1-flash-tts-preview</code> | 86.51 accuracy (13.49% roundtrip WER) |
| 6 | <code>hume/octave-2</code> | 85.47 accuracy (14.53% roundtrip WER) |
| 7 | <code>openai/gpt-4o-mini-tts</code> | 84.43 accuracy (15.57% roundtrip WER) |
| 8 | <code>openai/tts-1</code> | 84.43 accuracy (15.57% roundtrip WER) |
| 9 | <code>grok/grok-tts</code> | 84.08 accuracy (15.92% roundtrip WER) |
| 10 | <code>openai/tts-1-hd</code> | 83.74 accuracy (16.26% roundtrip WER) |
| 11 | <code>deepgram/aura-2-thalia-en</code> | 83.39 accuracy (16.61% roundtrip WER) |
| 12 | <code>mistral/voxtral-mini-tts-2603</code> | 83.04 accuracy (16.96% roundtrip WER) |
| 13 | <code>minimax/speech-2.8-hd</code> | 82.01 accuracy (17.99% roundtrip WER) |
| 14 | <code>groq/canopylabs/orpheus-v1-english</code> | 78.89 accuracy (21.11% roundtrip WER) |
| 15 | <code>minimax/speech-2.8-turbo</code> | 78.55 accuracy (21.45% roundtrip WER) |

### Human Quality

Unavailable: No humanSpeechScore from voice-quality-report.json was available for service providers. Duration, bitrate, and file size are not used as human quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| <code>cartesia/sonic-3</code> | 13.49% roundtrip WER | 24.58s | $0.0603 |
| <code>cartesia/sonic-3.5</code> | 12.80% roundtrip WER | 16.63s | $0.0603 |
| <code>cartesia/sonic-3.5-2026-05-04</code> | n/a | 13.14s | $0.0603 |
| <code>deepgram/aura-2-thalia-en</code> | 16.61% roundtrip WER | 59.92s | $0.0484 |
| <code>elevenlabs/eleven_flash_v2_5</code> | n/a | 4.28s | $0.0806 |
| <code>elevenlabs/eleven_multilingual_v2</code> | n/a | 17.13s | $0.1613 |
| <code>elevenlabs/eleven_v3</code> | 10.73% roundtrip WER | 77.81s | $0.1613 |
| <code>gemini/gemini-3.1-flash-tts-preview</code> | 13.49% roundtrip WER | 69.41s | $0.0339 |
| <code>grok/grok-tts</code> | 15.92% roundtrip WER | 43.78s | $0.0242 |
| <code>groq/canopylabs/orpheus-v1-english</code> | 21.11% roundtrip WER | 23.75s | $0.0355 |
| <code>hume/octave-2</code> | 14.53% roundtrip WER | 18.60s | $0.2419 |
| <code>minimax/speech-2.8-hd</code> | 17.99% roundtrip WER | 80.31s | $0.1613 |
| <code>minimax/speech-2.8-turbo</code> | 21.45% roundtrip WER | 53.08s | $0.0968 |
| <code>mistral/voxtral-mini-tts-2603</code> | 16.96% roundtrip WER | 12.17s | $0.0258 |
| <code>openai/gpt-4o-mini-tts</code> | 15.57% roundtrip WER | 520.22s | $0.0203 |
| <code>openai/gpt-4o-mini-tts-2025-12-15</code> | n/a | 19.15s | $0.0203 |
| <code>openai/tts-1</code> | 15.57% roundtrip WER | 12.83s | $0.0242 |
| <code>openai/tts-1-hd</code> | 16.26% roundtrip WER | 12.06s | $0.0484 |
| <code>speechify/simba-3.0</code> | n/a | 15.02s | $0.0161 |
| <code>speechify/simba-3.2</code> | n/a | 14.51s | $0.0161 |
| <code>speechify/simba-english</code> | 12.80% roundtrip WER | 13.32s | $0.0161 |

## Notes

- Best cloud service: `elevenlabs/eleven_v3` scored 89.27/100.
- The cheapest cloud providers were `speechify/simba-english`, `speechify/simba-3.2`, and `speechify/simba-3.0` at 1.6130¢ ($0.0161).
- Fastest cloud service: `elevenlabs/eleven_flash_v2_5` at 4.28s.
- No roundtrip STT data was available. Existing local/cloud ranking used a composite of speaking rate naturalness (60%), cost (20%), and speed (20%); overall ranking used neutral 50/100 accuracy components for providers without roundtrip data.
