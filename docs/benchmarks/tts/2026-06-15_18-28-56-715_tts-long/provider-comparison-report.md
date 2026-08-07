# TTS Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/tts/2026-06-15_18-28-56-715_tts-long`
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
| 1 | <code>speechify/simba-3.0</code> | $0.0045 |
| 2 | <code>speechify/simba-3.2</code> | $0.0045 |
| 3 | <code>speechify/simba-english</code> | $0.0045 |
| 4 | <code>openai/gpt-4o-mini-tts</code> | $0.0057 |
| 5 | <code>openai/gpt-4o-mini-tts-2025-12-15</code> | $0.0057 |
| 6 | <code>grok/grok-tts</code> | $0.0068 |
| 7 | <code>openai/tts-1</code> | $0.0068 |
| 8 | <code>mistral/voxtral-mini-tts-2603</code> | $0.0072 |
| 9 | <code>gemini/gemini-3.1-flash-tts-preview</code> | $0.0095 |
| 10 | <code>groq/canopylabs/orpheus-v1-english</code> | $0.0100 |
| 11 | <code>deepgram/aura-2-thalia-en</code> | $0.0136 |
| 12 | <code>openai/tts-1-hd</code> | $0.0136 |
| 13 | <code>cartesia/sonic-3</code> | $0.0169 |
| 14 | <code>cartesia/sonic-3.5</code> | $0.0169 |
| 15 | <code>cartesia/sonic-3.5-2026-05-04</code> | $0.0169 |
| 16 | <code>elevenlabs/eleven_flash_v2_5</code> | $0.0226 |
| 17 | <code>minimax/speech-2.8-turbo</code> | $0.0272 |
| 18 | <code>elevenlabs/eleven_multilingual_v2</code> | $0.0453 |
| 19 | <code>elevenlabs/eleven_v3</code> | $0.0453 |
| 20 | <code>minimax/speech-2.8-hd</code> | $0.0453 |
| 21 | <code>hume/octave-2</code> | $0.0679 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>elevenlabs/eleven_flash_v2_5</code> | 0.97s |
| 2 | <code>cartesia/sonic-3.5-2026-05-04</code> | 3.48s |
| 3 | <code>speechify/simba-3.2</code> | 3.70s |
| 4 | <code>speechify/simba-3.0</code> | 4.38s |
| 5 | <code>cartesia/sonic-3.5</code> | 4.56s |
| 6 | <code>elevenlabs/eleven_multilingual_v2</code> | 4.70s |
| 7 | <code>hume/octave-2</code> | 5.40s |
| 8 | <code>openai/gpt-4o-mini-tts</code> | 5.91s |
| 9 | <code>openai/gpt-4o-mini-tts-2025-12-15</code> | 5.93s |
| 10 | <code>mistral/voxtral-mini-tts-2603</code> | 6.02s |
| 11 | <code>speechify/simba-english</code> | 6.49s |
| 12 | <code>cartesia/sonic-3</code> | 7.07s |
| 13 | <code>groq/canopylabs/orpheus-v1-english</code> | 7.08s |
| 14 | <code>openai/tts-1-hd</code> | 7.15s |
| 15 | <code>grok/grok-tts</code> | 12.48s |
| 16 | <code>deepgram/aura-2-thalia-en</code> | 15.74s |
| 17 | <code>elevenlabs/eleven_v3</code> | 15.75s |
| 18 | <code>gemini/gemini-3.1-flash-tts-preview</code> | 25.25s |
| 19 | <code>minimax/speech-2.8-turbo</code> | 58.12s |
| 20 | <code>minimax/speech-2.8-hd</code> | 100.53s |
| 21 | <code>openai/tts-1</code> | 305.30s |

### Automated Quality

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>minimax/speech-2.8-turbo</code> | 84.21 accuracy (15.79% roundtrip WER) |
| 2 | <code>minimax/speech-2.8-hd</code> | 81.58 accuracy (18.42% roundtrip WER) |
| 3 | <code>openai/gpt-4o-mini-tts</code> | 81.58 accuracy (18.42% roundtrip WER) |
| 4 | <code>openai/tts-1-hd</code> | 81.58 accuracy (18.42% roundtrip WER) |
| 5 | <code>grok/grok-tts</code> | 80.26 accuracy (19.74% roundtrip WER) |
| 6 | <code>cartesia/sonic-3.5</code> | 78.95 accuracy (21.05% roundtrip WER) |
| 7 | <code>gemini/gemini-3.1-flash-tts-preview</code> | 78.95 accuracy (21.05% roundtrip WER) |
| 8 | <code>hume/octave-2</code> | 77.63 accuracy (22.37% roundtrip WER) |
| 9 | <code>speechify/simba-english</code> | 77.63 accuracy (22.37% roundtrip WER) |
| 10 | <code>cartesia/sonic-3</code> | 76.32 accuracy (23.68% roundtrip WER) |
| 11 | <code>groq/canopylabs/orpheus-v1-english</code> | 73.68 accuracy (26.32% roundtrip WER) |
| 12 | <code>elevenlabs/eleven_v3</code> | 69.74 accuracy (30.26% roundtrip WER) |
| 13 | <code>mistral/voxtral-mini-tts-2603</code> | 69.74 accuracy (30.26% roundtrip WER) |
| 14 | <code>openai/tts-1</code> | 69.74 accuracy (30.26% roundtrip WER) |
| 15 | <code>deepgram/aura-2-thalia-en</code> | 68.42 accuracy (31.58% roundtrip WER) |

### Human Quality

Unavailable: No humanSpeechScore from voice-quality-report.json was available for service providers. Duration, bitrate, and file size are not used as human quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| <code>cartesia/sonic-3</code> | 23.68% roundtrip WER | 7.07s | $0.0169 |
| <code>cartesia/sonic-3.5</code> | 21.05% roundtrip WER | 4.56s | $0.0169 |
| <code>cartesia/sonic-3.5-2026-05-04</code> | n/a | 3.48s | $0.0169 |
| <code>deepgram/aura-2-thalia-en</code> | 31.58% roundtrip WER | 15.74s | $0.0136 |
| <code>elevenlabs/eleven_flash_v2_5</code> | n/a | 0.97s | $0.0226 |
| <code>elevenlabs/eleven_multilingual_v2</code> | n/a | 4.70s | $0.0453 |
| <code>elevenlabs/eleven_v3</code> | 30.26% roundtrip WER | 15.75s | $0.0453 |
| <code>gemini/gemini-3.1-flash-tts-preview</code> | 21.05% roundtrip WER | 25.25s | $0.0095 |
| <code>grok/grok-tts</code> | 19.74% roundtrip WER | 12.48s | $0.0068 |
| <code>groq/canopylabs/orpheus-v1-english</code> | 26.32% roundtrip WER | 7.08s | $0.0100 |
| <code>hume/octave-2</code> | 22.37% roundtrip WER | 5.40s | $0.0679 |
| <code>minimax/speech-2.8-hd</code> | 18.42% roundtrip WER | 100.53s | $0.0453 |
| <code>minimax/speech-2.8-turbo</code> | 15.79% roundtrip WER | 58.12s | $0.0272 |
| <code>mistral/voxtral-mini-tts-2603</code> | 30.26% roundtrip WER | 6.02s | $0.0072 |
| <code>openai/gpt-4o-mini-tts</code> | 18.42% roundtrip WER | 5.91s | $0.0057 |
| <code>openai/gpt-4o-mini-tts-2025-12-15</code> | n/a | 5.93s | $0.0057 |
| <code>openai/tts-1</code> | 30.26% roundtrip WER | 305.30s | $0.0068 |
| <code>openai/tts-1-hd</code> | 18.42% roundtrip WER | 7.15s | $0.0136 |
| <code>speechify/simba-3.0</code> | n/a | 4.38s | $0.0045 |
| <code>speechify/simba-3.2</code> | n/a | 3.70s | $0.0045 |
| <code>speechify/simba-english</code> | 22.37% roundtrip WER | 6.49s | $0.0045 |

## Notes

- Best cloud service: `minimax/speech-2.8-turbo` scored 84.21/100.
- The cheapest cloud providers were `speechify/simba-english`, `speechify/simba-3.2`, and `speechify/simba-3.0` at 0.4530¢ ($0.0045).
- Fastest cloud service: `elevenlabs/eleven_flash_v2_5` at 0.97s.
- No roundtrip STT data was available. Existing local/cloud ranking used a composite of speaking rate naturalness (60%), cost (20%), and speed (20%); overall ranking used neutral 50/100 accuracy components for providers without roundtrip data.
