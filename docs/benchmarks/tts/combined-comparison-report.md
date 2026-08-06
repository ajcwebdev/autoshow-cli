# TTS Combined Provider Comparison Report

## Summary

- Combines four TTS benchmark runs and 21 historical/current third-party service model identities.
- Aggregation uses mean within-run rank per metric; price, speed, automated quality, and human quality remain independent surfaces.
- The six models added on 2026-08-06 have price and speed evidence across all runs but no new paid STT or audio-judge quality evidence.
- Generated: 2026-08-06.

## Price (combined)

Lower mean rank is cheaper across covered runs. Coverage: 4/4 runs (0-tts-short / 1-tts / long / hard).

| Rank | Provider | Mean rank | Per-run rank (value) |
| ---: | --- | ---: | --- |
| 1 | <code>speechify/simba-3.0</code> | 1.00 | 1 ($0.0002) / 1 ($0.0009) / 1 ($0.0045) / 1 ($0.0161) |
| 2 | <code>speechify/simba-3.2</code> | 2.00 | 2 ($0.0002) / 2 ($0.0009) / 2 ($0.0045) / 2 ($0.0161) |
| 3 | <code>speechify/simba-english</code> | 3.00 | 3 ($0.0002) / 3 ($0.0009) / 3 ($0.0045) / 3 ($0.0161) |
| 4 | <code>openai/gpt-4o-mini-tts</code> | 4.00 | 4 ($0.0002) / 4 ($0.0011) / 4 ($0.0057) / 4 ($0.0203) |
| 5 | <code>openai/gpt-4o-mini-tts-2025-12-15</code> | 5.00 | 5 ($0.0002) / 5 ($0.0011) / 5 ($0.0057) / 5 ($0.0203) |
| 6 | <code>grok/grok-tts</code> | 6.25 | 7 ($0.0003) / 6 ($0.0013) / 6 ($0.0068) / 6 ($0.0242) |
| 7 | <code>openai/tts-1</code> | 6.75 | 6 ($0.0003) / 7 ($0.0013) / 7 ($0.0068) / 7 ($0.0242) |
| 8 | <code>mistral/voxtral-mini-tts-2603</code> | 8.00 | 8 ($0.0003) / 8 ($0.0014) / 8 ($0.0072) / 8 ($0.0258) |
| 9 | <code>gemini/gemini-3.1-flash-tts-preview</code> | 9.00 | 9 ($0.0004) / 9 ($0.0018) / 9 ($0.0095) / 9 ($0.0339) |
| 10 | <code>groq/canopylabs/orpheus-v1-english</code> | 10.00 | 10 ($0.0004) / 10 ($0.0019) / 10 ($0.0100) / 10 ($0.0355) |
| 11 | <code>deepgram/aura-2-thalia-en</code> | 11.25 | 12 ($0.0005) / 11 ($0.0026) / 11 ($0.0136) / 11 ($0.0484) |
| 12 | <code>openai/tts-1-hd</code> | 11.75 | 11 ($0.0005) / 12 ($0.0026) / 12 ($0.0136) / 12 ($0.0484) |
| 13 | <code>cartesia/sonic-3</code> | 13.00 | 13 ($0.0006) / 13 ($0.0033) / 13 ($0.0169) / 13 ($0.0603) |
| 14 | <code>cartesia/sonic-3.5</code> | 14.00 | 14 ($0.0006) / 14 ($0.0033) / 14 ($0.0169) / 14 ($0.0603) |
| 15 | <code>cartesia/sonic-3.5-2026-05-04</code> | 15.00 | 15 ($0.0006) / 15 ($0.0033) / 15 ($0.0169) / 15 ($0.0603) |
| 16 | <code>elevenlabs/eleven_flash_v2_5</code> | 16.00 | 16 ($0.0009) / 16 ($0.0043) / 16 ($0.0226) / 16 ($0.0806) |
| 17 | <code>minimax/speech-2.8-turbo</code> | 17.00 | 17 ($0.0010) / 17 ($0.0052) / 17 ($0.0272) / 17 ($0.0968) |
| 18 | <code>elevenlabs/eleven_multilingual_v2</code> | 18.00 | 18 ($0.0017) / 18 ($0.0087) / 18 ($0.0453) / 18 ($0.1613) |
| 19 | <code>elevenlabs/eleven_v3</code> | 19.00 | 19 ($0.0017) / 19 ($0.0087) / 19 ($0.0453) / 19 ($0.1613) |
| 20 | <code>minimax/speech-2.8-hd</code> | 20.00 | 20 ($0.0017) / 20 ($0.0087) / 20 ($0.0453) / 20 ($0.1613) |
| 21 | <code>hume/octave-2</code> | 21.00 | 21 ($0.0026) / 21 ($0.0130) / 21 ($0.0679) / 21 ($0.2419) |

## Speed (combined)

Lower mean rank is faster across covered runs. Coverage: 4/4 runs (0-tts-short / 1-tts / long / hard).

| Rank | Provider | Mean rank | Per-run rank (value) |
| ---: | --- | ---: | --- |
| 1 | <code>elevenlabs/eleven_flash_v2_5</code> | 1.00 | 1 (0.15s) / 1 (0.34s) / 1 (0.97s) / 1 (4.28s) |
| 2 | <code>cartesia/sonic-3.5-2026-05-04</code> | 3.75 | 2 (0.25s) / 6 (1.23s) / 2 (3.48s) / 5 (13.14s) |
| 3 | <code>cartesia/sonic-3.5</code> | 4.75 | 3 (0.38s) / 2 (0.84s) / 5 (4.56s) / 9 (16.63s) |
| 4 | <code>speechify/simba-3.2</code> | 4.75 | 6 (0.59s) / 3 (0.96s) / 3 (3.70s) / 7 (14.51s) |
| 5 | <code>speechify/simba-3.0</code> | 5.75 | 7 (0.70s) / 4 (1.12s) / 4 (4.38s) / 8 (15.02s) |
| 6 | <code>elevenlabs/eleven_multilingual_v2</code> | 7.50 | 9 (0.87s) / 5 (1.13s) / 6 (4.70s) / 10 (17.13s) |
| 7 | <code>cartesia/sonic-3</code> | 9.25 | 4 (0.50s) / 7 (1.34s) / 12 (7.07s) / 14 (24.58s) |
| 8 | <code>hume/octave-2</code> | 9.50 | 12 (1.15s) / 8 (1.64s) / 7 (5.40s) / 11 (18.60s) |
| 9 | <code>groq/canopylabs/orpheus-v1-english</code> | 10.50 | 5 (0.53s) / 11 (2.08s) / 13 (7.08s) / 13 (23.75s) |
| 10 | <code>mistral/voxtral-mini-tts-2603</code> | 10.50 | 15 (1.62s) / 14 (2.63s) / 10 (6.02s) / 3 (12.17s) |
| 11 | <code>speechify/simba-english</code> | 10.50 | 16 (2.01s) / 9 (1.67s) / 11 (6.49s) / 6 (13.32s) |
| 12 | <code>grok/grok-tts</code> | 12.50 | 8 (0.75s) / 12 (2.47s) / 15 (12.48s) / 15 (43.78s) |
| 13 | <code>openai/tts-1-hd</code> | 12.75 | 18 (2.58s) / 17 (3.28s) / 14 (7.15s) / 2 (12.06s) |
| 14 | <code>openai/gpt-4o-mini-tts</code> | 13.00 | 13 (1.25s) / 10 (1.89s) / 8 (5.91s) / 21 (520.22s) |
| 15 | <code>openai/tts-1</code> | 13.00 | 14 (1.47s) / 13 (2.59s) / 21 (305.30s) / 4 (12.83s) |
| 16 | <code>openai/gpt-4o-mini-tts-2025-12-15</code> | 13.75 | 19 (2.88s) / 15 (2.64s) / 9 (5.93s) / 12 (19.15s) |
| 17 | <code>deepgram/aura-2-thalia-en</code> | 14.75 | 10 (0.91s) / 16 (2.69s) / 16 (15.74s) / 17 (59.92s) |
| 18 | <code>elevenlabs/eleven_v3</code> | 16.25 | 11 (0.99s) / 18 (3.29s) / 17 (15.75s) / 19 (77.81s) |
| 19 | <code>gemini/gemini-3.1-flash-tts-preview</code> | 18.00 | 17 (2.06s) / 19 (4.75s) / 18 (25.25s) / 18 (69.41s) |
| 20 | <code>minimax/speech-2.8-turbo</code> | 19.00 | 21 (48.53s) / 20 (21.30s) / 19 (58.12s) / 16 (53.08s) |
| 21 | <code>minimax/speech-2.8-hd</code> | 20.25 | 20 (24.04s) / 21 (188.85s) / 20 (100.53s) / 20 (80.31s) |

## Automated Quality (combined)

Higher roundtrip-WER-derived accuracy ranks first; only retained historical evidence is included. Coverage: 3/4 runs (0-tts-short / long / hard).

| Rank | Provider | Mean rank | Per-run rank (value) |
| ---: | --- | ---: | --- |
| 1 | <code>cartesia/sonic-3.5</code> | 3.00 | 1 (100.00 accuracy (0.00% roundtrip WER)) / 6 (78.95 accuracy (21.05% roundtrip WER)) / 2 (87.20 accuracy (12.80% roundtrip WER)) |
| 2 | <code>elevenlabs/eleven_v3</code> | 5.33 | 3 (100.00 accuracy (0.00% roundtrip WER)) / 12 (69.74 accuracy (30.26% roundtrip WER)) / 1 (89.27 accuracy (10.73% roundtrip WER)) |
| 3 | <code>gemini/gemini-3.1-flash-tts-preview</code> | 5.33 | 4 (100.00 accuracy (0.00% roundtrip WER)) / 7 (78.95 accuracy (21.05% roundtrip WER)) / 5 (86.51 accuracy (13.49% roundtrip WER)) |
| 4 | <code>grok/grok-tts</code> | 6.33 | 5 (100.00 accuracy (0.00% roundtrip WER)) / 5 (80.26 accuracy (19.74% roundtrip WER)) / 9 (84.08 accuracy (15.92% roundtrip WER)) |
| 5 | <code>openai/gpt-4o-mini-tts</code> | 6.67 | 10 (100.00 accuracy (0.00% roundtrip WER)) / 3 (81.58 accuracy (18.42% roundtrip WER)) / 7 (84.43 accuracy (15.57% roundtrip WER)) |
| 6 | <code>hume/octave-2</code> | 7.00 | 7 (100.00 accuracy (0.00% roundtrip WER)) / 8 (77.63 accuracy (22.37% roundtrip WER)) / 6 (85.47 accuracy (14.53% roundtrip WER)) |
| 7 | <code>minimax/speech-2.8-hd</code> | 7.67 | 8 (100.00 accuracy (0.00% roundtrip WER)) / 2 (81.58 accuracy (18.42% roundtrip WER)) / 13 (82.01 accuracy (17.99% roundtrip WER)) |
| 8 | <code>minimax/speech-2.8-turbo</code> | 8.33 | 9 (100.00 accuracy (0.00% roundtrip WER)) / 1 (84.21 accuracy (15.79% roundtrip WER)) / 15 (78.55 accuracy (21.45% roundtrip WER)) |
| 9 | <code>speechify/simba-english</code> | 8.33 | 13 (100.00 accuracy (0.00% roundtrip WER)) / 9 (77.63 accuracy (22.37% roundtrip WER)) / 3 (87.20 accuracy (12.80% roundtrip WER)) |
| 10 | <code>openai/tts-1-hd</code> | 8.67 | 12 (100.00 accuracy (0.00% roundtrip WER)) / 4 (81.58 accuracy (18.42% roundtrip WER)) / 10 (83.74 accuracy (16.26% roundtrip WER)) |
| 11 | <code>cartesia/sonic-3</code> | 9.33 | 14 (66.67 accuracy (33.33% roundtrip WER)) / 10 (76.32 accuracy (23.68% roundtrip WER)) / 4 (86.51 accuracy (13.49% roundtrip WER)) |
| 12 | <code>deepgram/aura-2-thalia-en</code> | 9.33 | 2 (100.00 accuracy (0.00% roundtrip WER)) / 15 (68.42 accuracy (31.58% roundtrip WER)) / 11 (83.39 accuracy (16.61% roundtrip WER)) |
| 13 | <code>groq/canopylabs/orpheus-v1-english</code> | 10.33 | 6 (100.00 accuracy (0.00% roundtrip WER)) / 11 (73.68 accuracy (26.32% roundtrip WER)) / 14 (78.89 accuracy (21.11% roundtrip WER)) |
| 14 | <code>openai/tts-1</code> | 11.00 | 11 (100.00 accuracy (0.00% roundtrip WER)) / 14 (69.74 accuracy (30.26% roundtrip WER)) / 8 (84.43 accuracy (15.57% roundtrip WER)) |
| 15 | <code>mistral/voxtral-mini-tts-2603</code> | 13.33 | 15 (66.67 accuracy (33.33% roundtrip WER)) / 13 (69.74 accuracy (30.26% roundtrip WER)) / 12 (83.04 accuracy (16.96% roundtrip WER)) |

## Human Quality (combined)

Higher humanSpeechScore ranks first; only retained historical evidence is included. Coverage: 1/4 runs (0-tts-short).

| Rank | Provider | Mean rank | Per-run rank (value) |
| ---: | --- | ---: | --- |
| 1 | <code>openai/tts-1-hd</code> | 1.00 | 1 (91.75 humanSpeechScore) |
| 2 | <code>speechify/simba-english</code> | 2.00 | 2 (91.72 humanSpeechScore) |
| 3 | <code>hume/octave-2</code> | 3.00 | 3 (91.35 humanSpeechScore) |
| 4 | <code>minimax/speech-2.8-turbo</code> | 4.00 | 4 (90.71 humanSpeechScore) |
| 5 | <code>deepgram/aura-2-thalia-en</code> | 5.00 | 5 (89.08 humanSpeechScore) |
| 6 | <code>openai/tts-1</code> | 6.00 | 6 (88.96 humanSpeechScore) |
| 7 | <code>minimax/speech-2.8-hd</code> | 7.00 | 7 (87.64 humanSpeechScore) |
| 8 | <code>grok/grok-tts</code> | 8.00 | 8 (85.83 humanSpeechScore) |
| 9 | <code>groq/canopylabs/orpheus-v1-english</code> | 9.00 | 9 (84.50 humanSpeechScore) |
| 10 | <code>elevenlabs/eleven_v3</code> | 10.00 | 10 (84.17 humanSpeechScore) |
| 11 | <code>gemini/gemini-3.1-flash-tts-preview</code> | 11.00 | 11 (83.31 humanSpeechScore) |
| 12 | <code>cartesia/sonic-3.5</code> | 12.00 | 12 (82.68 humanSpeechScore) |
| 13 | <code>cartesia/sonic-3</code> | 13.00 | 13 (80.15 humanSpeechScore) |
| 14 | <code>openai/gpt-4o-mini-tts</code> | 14.00 | 14 (77.78 humanSpeechScore) |
| 15 | <code>mistral/voxtral-mini-tts-2603</code> | 15.00 | 15 (75.84 humanSpeechScore) |
