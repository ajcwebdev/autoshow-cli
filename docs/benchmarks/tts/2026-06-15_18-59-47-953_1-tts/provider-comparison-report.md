# TTS Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/tts/2026-06-15_18-59-47-953_1-tts`
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
| 1 | <code>speechify/simba-english</code> | $0.0009 |
| 2 | <code>openai/gpt-4o-mini-tts</code> | $0.0011 |
| 3 | <code>grok/grok-tts</code> | $0.0013 |
| 4 | <code>openai/tts-1</code> | $0.0013 |
| 5 | <code>mistral/voxtral-mini-tts-2603</code> | $0.0014 |
| 6 | <code>gemini/gemini-3.1-flash-tts-preview</code> | $0.0018 |
| 7 | <code>groq/canopylabs/orpheus-v1-english</code> | $0.0019 |
| 8 | <code>deepgram/aura-2-thalia-en</code> | $0.0026 |
| 9 | <code>openai/tts-1-hd</code> | $0.0026 |
| 10 | <code>cartesia/sonic-3</code> | $0.0033 |
| 11 | <code>cartesia/sonic-3.5</code> | $0.0033 |
| 12 | <code>minimax/speech-2.8-turbo</code> | $0.0052 |
| 13 | <code>elevenlabs/eleven_v3</code> | $0.0087 |
| 14 | <code>minimax/speech-2.8-hd</code> | $0.0087 |
| 15 | <code>hume/octave-2</code> | $0.0130 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>cartesia/sonic-3.5</code> | 0.84s |
| 2 | <code>cartesia/sonic-3</code> | 1.34s |
| 3 | <code>hume/octave-2</code> | 1.64s |
| 4 | <code>speechify/simba-english</code> | 1.67s |
| 5 | <code>openai/gpt-4o-mini-tts</code> | 1.89s |
| 6 | <code>groq/canopylabs/orpheus-v1-english</code> | 2.08s |
| 7 | <code>grok/grok-tts</code> | 2.47s |
| 8 | <code>openai/tts-1</code> | 2.59s |
| 9 | <code>mistral/voxtral-mini-tts-2603</code> | 2.63s |
| 10 | <code>deepgram/aura-2-thalia-en</code> | 2.69s |
| 11 | <code>openai/tts-1-hd</code> | 3.28s |
| 12 | <code>elevenlabs/eleven_v3</code> | 3.29s |
| 13 | <code>gemini/gemini-3.1-flash-tts-preview</code> | 4.75s |
| 14 | <code>minimax/speech-2.8-turbo</code> | 21.30s |
| 15 | <code>minimax/speech-2.8-hd</code> | 188.85s |

### Automated Quality

Unavailable: No roundtrip WER was available for service providers. Duration, bitrate, and file size are not used as automated quality proxies.

### Human Quality

Unavailable: No humanSpeechScore from voice-quality-report.json was available for service providers. Duration, bitrate, and file size are not used as human quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| <code>cartesia/sonic-3</code> | n/a | 1.34s | $0.0033 |
| <code>cartesia/sonic-3.5</code> | n/a | 0.84s | $0.0033 |
| <code>deepgram/aura-2-thalia-en</code> | n/a | 2.69s | $0.0026 |
| <code>elevenlabs/eleven_v3</code> | n/a | 3.29s | $0.0087 |
| <code>gemini/gemini-3.1-flash-tts-preview</code> | n/a | 4.75s | $0.0018 |
| <code>grok/grok-tts</code> | n/a | 2.47s | $0.0013 |
| <code>groq/canopylabs/orpheus-v1-english</code> | n/a | 2.08s | $0.0019 |
| <code>hume/octave-2</code> | n/a | 1.64s | $0.0130 |
| <code>minimax/speech-2.8-hd</code> | n/a | 188.85s | $0.0087 |
| <code>minimax/speech-2.8-turbo</code> | n/a | 21.30s | $0.0052 |
| <code>mistral/voxtral-mini-tts-2603</code> | n/a | 2.63s | $0.0014 |
| <code>openai/gpt-4o-mini-tts</code> | n/a | 1.89s | $0.0011 |
| <code>openai/tts-1</code> | n/a | 2.59s | $0.0013 |
| <code>openai/tts-1-hd</code> | n/a | 3.28s | $0.0026 |
| <code>speechify/simba-english</code> | n/a | 1.67s | $0.0009 |

## Notes

- Best cloud service: `speechify/simba-english`.
- The cheapest cloud provider was `speechify/simba-english` at 0.0870¢ ($0.0009).
- Fastest cloud service: `cartesia/sonic-3.5` at 0.84s.
- No roundtrip STT data was available. Existing local/cloud ranking used a composite of speaking rate naturalness (60%), cost (20%), and speed (20%); overall ranking used neutral 50/100 accuracy components for providers without roundtrip data.
