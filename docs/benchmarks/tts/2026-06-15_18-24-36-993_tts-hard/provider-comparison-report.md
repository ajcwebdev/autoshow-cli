# TTS Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/tts/2026-06-15_18-24-36-993_tts-hard`
- Total providers: 15 (0 local, 15 service)
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
| 1 | <code>speechify/simba-english</code> | $0.0161 |
| 2 | <code>openai/gpt-4o-mini-tts</code> | $0.0203 |
| 3 | <code>grok/grok-tts</code> | $0.0242 |
| 4 | <code>openai/tts-1</code> | $0.0242 |
| 5 | <code>mistral/voxtral-mini-tts-2603</code> | $0.0258 |
| 6 | <code>gemini/gemini-3.1-flash-tts-preview</code> | $0.0339 |
| 7 | <code>groq/canopylabs/orpheus-v1-english</code> | $0.0355 |
| 8 | <code>deepgram/aura-2-thalia-en</code> | $0.0484 |
| 9 | <code>openai/tts-1-hd</code> | $0.0484 |
| 10 | <code>cartesia/sonic-3</code> | $0.0603 |
| 11 | <code>cartesia/sonic-3.5</code> | $0.0603 |
| 12 | <code>minimax/speech-2.8-turbo</code> | $0.0968 |
| 13 | <code>elevenlabs/eleven_v3</code> | $0.1613 |
| 14 | <code>minimax/speech-2.8-hd</code> | $0.1613 |
| 15 | <code>hume/octave-2</code> | $0.2419 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>openai/tts-1-hd</code> | 12.06s |
| 2 | <code>mistral/voxtral-mini-tts-2603</code> | 12.17s |
| 3 | <code>openai/tts-1</code> | 12.83s |
| 4 | <code>speechify/simba-english</code> | 13.32s |
| 5 | <code>cartesia/sonic-3.5</code> | 16.63s |
| 6 | <code>hume/octave-2</code> | 18.60s |
| 7 | <code>groq/canopylabs/orpheus-v1-english</code> | 23.75s |
| 8 | <code>cartesia/sonic-3</code> | 24.58s |
| 9 | <code>grok/grok-tts</code> | 43.78s |
| 10 | <code>minimax/speech-2.8-turbo</code> | 53.08s |
| 11 | <code>deepgram/aura-2-thalia-en</code> | 59.92s |
| 12 | <code>gemini/gemini-3.1-flash-tts-preview</code> | 69.41s |
| 13 | <code>elevenlabs/eleven_v3</code> | 77.81s |
| 14 | <code>minimax/speech-2.8-hd</code> | 80.31s |
| 15 | <code>openai/gpt-4o-mini-tts</code> | 520.22s |

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
| <code>deepgram/aura-2-thalia-en</code> | 16.61% roundtrip WER | 59.92s | $0.0484 |
| <code>elevenlabs/eleven_v3</code> | 10.73% roundtrip WER | 77.81s | $0.1613 |
| <code>gemini/gemini-3.1-flash-tts-preview</code> | 13.49% roundtrip WER | 69.41s | $0.0339 |
| <code>grok/grok-tts</code> | 15.92% roundtrip WER | 43.78s | $0.0242 |
| <code>groq/canopylabs/orpheus-v1-english</code> | 21.11% roundtrip WER | 23.75s | $0.0355 |
| <code>hume/octave-2</code> | 14.53% roundtrip WER | 18.60s | $0.2419 |
| <code>minimax/speech-2.8-hd</code> | 17.99% roundtrip WER | 80.31s | $0.1613 |
| <code>minimax/speech-2.8-turbo</code> | 21.45% roundtrip WER | 53.08s | $0.0968 |
| <code>mistral/voxtral-mini-tts-2603</code> | 16.96% roundtrip WER | 12.17s | $0.0258 |
| <code>openai/gpt-4o-mini-tts</code> | 15.57% roundtrip WER | 520.22s | $0.0203 |
| <code>openai/tts-1</code> | 15.57% roundtrip WER | 12.83s | $0.0242 |
| <code>openai/tts-1-hd</code> | 16.26% roundtrip WER | 12.06s | $0.0484 |
| <code>speechify/simba-english</code> | 12.80% roundtrip WER | 13.32s | $0.0161 |

## Notes

- Best cloud service: `elevenlabs/eleven_v3` scored 89.27/100.
- The cheapest cloud provider was `speechify/simba-english` at 1.6130¢ ($0.0161).
- Fastest cloud service: `openai/tts-1-hd` at 12.06s.
