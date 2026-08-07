# TTS Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/tts/2026-06-15_18-51-16-094_0-tts-short`
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
| 1 | <code>speechify/simba-3.0</code> | $0.0002 |
| 2 | <code>speechify/simba-3.2</code> | $0.0002 |
| 3 | <code>speechify/simba-english</code> | $0.0002 |
| 4 | <code>openai/gpt-4o-mini-tts</code> | $0.0002 |
| 5 | <code>openai/gpt-4o-mini-tts-2025-12-15</code> | $0.0002 |
| 6 | <code>openai/tts-1</code> | $0.0003 |
| 7 | <code>grok/grok-tts</code> | $0.0003 |
| 8 | <code>mistral/voxtral-mini-tts-2603</code> | $0.0003 |
| 9 | <code>gemini/gemini-3.1-flash-tts-preview</code> | $0.0004 |
| 10 | <code>groq/canopylabs/orpheus-v1-english</code> | $0.0004 |
| 11 | <code>openai/tts-1-hd</code> | $0.0005 |
| 12 | <code>deepgram/aura-2-thalia-en</code> | $0.0005 |
| 13 | <code>cartesia/sonic-3</code> | $0.0006 |
| 14 | <code>cartesia/sonic-3.5</code> | $0.0006 |
| 15 | <code>cartesia/sonic-3.5-2026-05-04</code> | $0.0006 |
| 16 | <code>elevenlabs/eleven_flash_v2_5</code> | $0.0009 |
| 17 | <code>minimax/speech-2.8-turbo</code> | $0.0010 |
| 18 | <code>elevenlabs/eleven_multilingual_v2</code> | $0.0017 |
| 19 | <code>elevenlabs/eleven_v3</code> | $0.0017 |
| 20 | <code>minimax/speech-2.8-hd</code> | $0.0017 |
| 21 | <code>hume/octave-2</code> | $0.0026 |

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
| 13 | <code>openai/gpt-4o-mini-tts</code> | 1.25s |
| 14 | <code>openai/tts-1</code> | 1.47s |
| 15 | <code>mistral/voxtral-mini-tts-2603</code> | 1.62s |
| 16 | <code>speechify/simba-english</code> | 2.01s |
| 17 | <code>gemini/gemini-3.1-flash-tts-preview</code> | 2.06s |
| 18 | <code>openai/tts-1-hd</code> | 2.58s |
| 19 | <code>openai/gpt-4o-mini-tts-2025-12-15</code> | 2.88s |
| 20 | <code>minimax/speech-2.8-hd</code> | 24.04s |
| 21 | <code>minimax/speech-2.8-turbo</code> | 48.53s |

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
| <code>elevenlabs/eleven_flash_v2_5</code> | n/a | 0.15s | $0.0009 |
| <code>elevenlabs/eleven_multilingual_v2</code> | n/a | 0.87s | $0.0017 |
| <code>elevenlabs/eleven_v3</code> | 84.17 humanSpeechScore | 0.99s | $0.0017 |
| <code>gemini/gemini-3.1-flash-tts-preview</code> | 83.31 humanSpeechScore | 2.06s | $0.0004 |
| <code>grok/grok-tts</code> | 85.83 humanSpeechScore | 0.75s | $0.0003 |
| <code>groq/canopylabs/orpheus-v1-english</code> | 84.50 humanSpeechScore | 0.53s | $0.0004 |
| <code>hume/octave-2</code> | 91.35 humanSpeechScore | 1.15s | $0.0026 |
| <code>minimax/speech-2.8-hd</code> | 87.64 humanSpeechScore | 24.04s | $0.0017 |
| <code>minimax/speech-2.8-turbo</code> | 90.71 humanSpeechScore | 48.53s | $0.0010 |
| <code>mistral/voxtral-mini-tts-2603</code> | 75.84 humanSpeechScore | 1.62s | $0.0003 |
| <code>openai/gpt-4o-mini-tts</code> | 77.78 humanSpeechScore | 1.25s | $0.0002 |
| <code>openai/gpt-4o-mini-tts-2025-12-15</code> | n/a | 2.88s | $0.0002 |
| <code>openai/tts-1</code> | 88.96 humanSpeechScore | 1.47s | $0.0003 |
| <code>openai/tts-1-hd</code> | 91.75 humanSpeechScore | 2.58s | $0.0005 |
| <code>speechify/simba-3.0</code> | n/a | 0.70s | $0.0002 |
| <code>speechify/simba-3.2</code> | n/a | 0.59s | $0.0002 |
| <code>speechify/simba-english</code> | 91.72 humanSpeechScore | 2.01s | $0.0002 |

## Notes

- Best cloud service: `openai/tts-1-hd` scored 91.75/100.
- The cheapest cloud providers were `speechify/simba-english`, `speechify/simba-3.2`, and `speechify/simba-3.0` at 0.0170¢ ($0.0002).
- Fastest cloud service: `elevenlabs/eleven_flash_v2_5` at 0.15s.
- Voice quality scores from voice-quality-report.json were used as the primary quality metric (human speech quality: 55% naturalness + 45% speech quality).
