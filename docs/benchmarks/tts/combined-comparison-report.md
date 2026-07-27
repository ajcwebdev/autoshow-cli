# TTS Combined Provider Comparison Report

## Summary

- Combines four TTS benchmark runs in this directory, each scoring the **same 15 third-party service models** against a different input of escalating demand.
- Aggregation: **mean rank per metric** — providers are ranked within each run, then ranks are averaged across the runs where that metric has data (lower is better).
- Price/speed/quality are kept as **independent surfaces**; no blended overall leaderboard is produced (matching the per-run reports).
- All 15 providers are third-party services; there are no local (zero-cost) models, so local rankings are empty by design.
- Generated: 2026-06-16.

### Runs combined

| Run | Input file | Input size | Quality data |
| --- | --- | ---: | --- |
| `2026-06-15_18-51-16-094_0-tts-short` | `0-tts-short.txt` | 16 chars | automated WER + humanSpeechScore |
| `2026-06-15_18-59-47-953_1-tts` | `1-tts.md` | 87 chars | none (WER n/a) |
| `2026-06-15_18-28-56-715_tts-long` | `tts-long.md` | 466 chars | automated WER |
| `2026-06-15_18-24-36-993_tts-hard` | `tts-hard.txt` | 1706 chars | automated WER |

Per-run column order in the tables below is: **short / 1-tts / long / hard**.

## Method

- **Mean rank** = average of a provider's within-run ranks across the runs where the metric is available; ties broken alphabetically by provider key.
- **Coverage** — Price: 4 runs. Speed: 4 runs. Automated Quality: 3 runs (`1-tts` produced no roundtrip WER and is excluded). Human Quality: 1 run (`0-tts-short` only).
- Price uses reported monetary cost; speed uses processing time; automated quality uses roundtrip-WER-derived accuracy; human quality uses `humanSpeechScore` from `voice-quality-report.json`.
- Duration, bitrate, and file size are **not** used as quality, speed, or price proxies.

## Price (combined)

Lower mean rank = cheaper across runs. Per-run cost columns shown for transparency (cost scales with input length).

| Rank | Provider | Mean rank | Per-run ranks (short / 1-tts / long / hard) | Per-run cost (short / 1-tts / long / hard) |
| ---: | --- | ---: | --- | --- |
| 1 | <code>speechify/simba-english</code> | 1.0 | 1 / 1 / 1 / 1 | $0.0002 / $0.0009 / $0.0045 / $0.0161 |
| 2 | <code>openai/gpt-4o-mini-tts</code> | 3.0 | 3 / 3 / 3 / 3 | $0.0002 / $0.0011 / $0.0057 / $0.0203 |
| 3 | <code>grok/grok-tts</code> | 4.25 | 5 / 4 / 4 / 4 | $0.0003 / $0.0013 / $0.0068 / $0.0242 |
| 4 | <code>openai/tts-1</code> | 4.75 | 4 / 5 / 5 / 5 | $0.0003 / $0.0013 / $0.0068 / $0.0242 |
| 5 | <code>mistral/voxtral-mini-tts-2603</code> | 6.0 | 6 / 6 / 6 / 6 | $0.0003 / $0.0014 / $0.0072 / $0.0258 |
| 6 | <code>gemini/gemini-3.1-flash-tts-preview</code> | 7.0 | 7 / 7 / 7 / 7 | $0.0004 / $0.0018 / $0.0095 / $0.0339 |
| 7 | <code>groq/canopylabs/orpheus-v1-english</code> | 8.0 | 8 / 8 / 8 / 8 | $0.0004 / $0.0019 / $0.0100 / $0.0355 |
| 8 | <code>deepgram/aura-2-thalia-en</code> | 9.25 | 10 / 9 / 9 / 9 | $0.0005 / $0.0026 / $0.0136 / $0.0484 |
| 9 | <code>openai/tts-1-hd</code> | 9.75 | 9 / 10 / 10 / 10 | $0.0005 / $0.0026 / $0.0136 / $0.0484 |
| 10 | <code>cartesia/sonic-3</code> | 11.0 | 11 / 11 / 11 / 11 | $0.0006 / $0.0033 / $0.0169 / $0.0603 |
| 11 | <code>cartesia/sonic-3.5</code> | 12.0 | 12 / 12 / 12 / 12 | $0.0006 / $0.0033 / $0.0169 / $0.0603 |
| 12 | <code>minimax/speech-2.8-turbo</code> | 13.0 | 13 / 13 / 13 / 13 | $0.0010 / $0.0052 / $0.0272 / $0.0968 |
| 13 | <code>elevenlabs/eleven_v3</code> | 14.0 | 14 / 14 / 14 / 14 | $0.0017 / $0.0087 / $0.0453 / $0.1613 |
| 14 | <code>minimax/speech-2.8-hd</code> | 15.0 | 15 / 15 / 15 / 15 | $0.0017 / $0.0087 / $0.0453 / $0.1613 |
| 15 | <code>hume/octave-2</code> | 16.0 | 16 / 16 / 16 / 16 | $0.0026 / $0.0130 / $0.0679 / $0.2419 |

## Speed (combined)

Lower mean rank = faster across runs. Per-run processing-time columns shown for transparency (note the large outliers).

| Rank | Provider | Mean rank | Per-run ranks (short / 1-tts / long / hard) | Per-run time (short / 1-tts / long / hard) |
| ---: | --- | ---: | --- | --- |
| 1 | <code>cartesia/sonic-3.5</code> | 2.25 | 1 / 1 / 1 / 6 | 0.38s / 0.84s / 4.56s / 16.63s |
| 2 | <code>hume/octave-2</code> | 5.0 | 7 / 4 / 2 / 7 | 1.15s / 1.64s / 5.40s / 18.60s |
| 3 | <code>cartesia/sonic-3</code> | 5.25 | 2 / 3 / 7 / 9 | 0.50s / 1.34s / 7.07s / 24.58s |
| 4 | <code>groq/canopylabs/orpheus-v1-english</code> | 6.5 | 3 / 7 / 8 / 8 | 0.53s / 2.08s / 7.08s / 23.75s |
| 5 | <code>mistral/voxtral-mini-tts-2603</code> | 6.75 | 10 / 10 / 5 / 2 | 1.62s / 2.63s / 6.02s / 12.17s |
| 6 | <code>speechify/simba-english</code> | 7.0 | 12 / 5 / 6 / 5 | 2.01s / 1.67s / 6.49s / 13.32s |
| 7 | <code>grok/grok-tts</code> | 8.0 | 4 / 8 / 10 / 10 | 0.75s / 2.47s / 12.48s / 43.78s |
| 8 | <code>openai/gpt-4o-mini-tts</code> | 8.5 | 8 / 6 / 4 / 16 | 1.25s / 1.89s / 5.91s / 520.22s |
| 9 | <code>openai/tts-1-hd</code> | 9.0 | 14 / 12 / 9 / 1 | 2.58s / 3.28s / 7.15s / 12.06s |
| 10 | <code>openai/tts-1</code> | 9.5 | 9 / 9 / 16 / 4 | 1.47s / 2.59s / 305.30s / 12.83s |
| 11 | <code>deepgram/aura-2-thalia-en</code> | 9.75 | 5 / 11 / 11 / 12 | 0.91s / 2.69s / 15.74s / 59.92s |
| 12 | <code>elevenlabs/eleven_v3</code> | 11.25 | 6 / 13 / 12 / 14 | 0.99s / 3.29s / 15.75s / 77.81s |
| 13 | <code>gemini/gemini-3.1-flash-tts-preview</code> | 13.25 | 13 / 14 / 13 / 13 | 2.06s / 4.75s / 25.25s / 69.41s |
| 14 | <code>minimax/speech-2.8-turbo</code> | 14.0 | 16 / 15 / 14 / 11 | 48.53s / 21.30s / 58.12s / 53.08s |
| 15 | <code>minimax/speech-2.8-hd</code> | 15.25 | 15 / 16 / 15 / 15 | 24.04s / 188.85s / 100.53s / 80.31s |

## Automated Quality (combined)

Roundtrip-WER-derived accuracy. Mean rank over **3 runs** (`short`, `long`, `hard`); `1-tts` had no WER and is excluded. Per-run column order here is **short / long / hard**.

| Rank | Provider | Mean rank | Per-run ranks (short / long / hard) | Per-run accuracy (short / long / hard) |
| ---: | --- | ---: | --- | --- |
| 1 | <code>cartesia/sonic-3.5</code> | 3.0 | 1 / 6 / 2 | 100.00 accuracy (0.00% roundtrip WER) / 78.95 accuracy (21.05% roundtrip WER) / 87.20 accuracy (12.80% roundtrip WER) |
| 2 | <code>gemini/gemini-3.1-flash-tts-preview</code> | 5.33 | 4 / 7 / 5 | 100.00 accuracy (0.00% roundtrip WER) / 78.95 accuracy (21.05% roundtrip WER) / 86.51 accuracy (13.49% roundtrip WER) |
| 3 | <code>elevenlabs/eleven_v3</code> | 5.67 | 3 / 13 / 1 | 100.00 accuracy (0.00% roundtrip WER) / 69.74 accuracy (30.26% roundtrip WER) / 89.27 accuracy (10.73% roundtrip WER) |
| 4 | <code>grok/grok-tts</code> | 6.33 | 5 / 5 / 9 | 100.00 accuracy (0.00% roundtrip WER) / 80.26 accuracy (19.74% roundtrip WER) / 84.08 accuracy (15.92% roundtrip WER) |
| 5 | <code>openai/gpt-4o-mini-tts</code> | 6.67 | 10 / 3 / 7 | 100.00 accuracy (0.00% roundtrip WER) / 81.58 accuracy (18.42% roundtrip WER) / 84.43 accuracy (15.57% roundtrip WER) |
| 6 | <code>hume/octave-2</code> | 7.0 | 7 / 8 / 6 | 100.00 accuracy (0.00% roundtrip WER) / 77.63 accuracy (22.37% roundtrip WER) / 85.47 accuracy (14.53% roundtrip WER) |
| 7 | <code>minimax/speech-2.8-hd</code> | 7.67 | 8 / 2 / 13 | 100.00 accuracy (0.00% roundtrip WER) / 81.58 accuracy (18.42% roundtrip WER) / 82.01 accuracy (17.99% roundtrip WER) |
| 8 | <code>minimax/speech-2.8-turbo</code> | 8.33 | 9 / 1 / 15 | 100.00 accuracy (0.00% roundtrip WER) / 84.21 accuracy (15.79% roundtrip WER) / 78.55 accuracy (21.45% roundtrip WER) |
| 9 | <code>speechify/simba-english</code> | 8.33 | 13 / 9 / 3 | 100.00 accuracy (0.00% roundtrip WER) / 77.63 accuracy (22.37% roundtrip WER) / 87.20 accuracy (12.80% roundtrip WER) |
| 10 | <code>openai/tts-1-hd</code> | 8.67 | 12 / 4 / 10 | 100.00 accuracy (0.00% roundtrip WER) / 81.58 accuracy (18.42% roundtrip WER) / 83.74 accuracy (16.26% roundtrip WER) |
| 11 | <code>cartesia/sonic-3</code> | 9.67 | 15 / 10 / 4 | 66.67 accuracy (33.33% roundtrip WER) / 76.32 accuracy (23.68% roundtrip WER) / 86.51 accuracy (13.49% roundtrip WER) |
| 12 | <code>deepgram/aura-2-thalia-en</code> | 9.67 | 2 / 16 / 11 | 100.00 accuracy (0.00% roundtrip WER) / 68.42 accuracy (31.58% roundtrip WER) / 83.39 accuracy (16.61% roundtrip WER) |
| 13 | <code>groq/canopylabs/orpheus-v1-english</code> | 10.33 | 6 / 11 / 14 | 100.00 accuracy (0.00% roundtrip WER) / 73.68 accuracy (26.32% roundtrip WER) / 78.89 accuracy (21.11% roundtrip WER) |
| 14 | <code>openai/tts-1</code> | 11.33 | 11 / 15 / 8 | 100.00 accuracy (0.00% roundtrip WER) / 69.74 accuracy (30.26% roundtrip WER) / 84.43 accuracy (15.57% roundtrip WER) |
| 15 | <code>mistral/voxtral-mini-tts-2603</code> | 14.0 | 16 / 14 / 12 | 66.67 accuracy (33.33% roundtrip WER) / 69.74 accuracy (30.26% roundtrip WER) / 83.04 accuracy (16.96% roundtrip WER) |

## Human Quality (single run)

`humanSpeechScore` from `voice-quality-report.json`. **Available for `0-tts-short` only** — a 16-character smoke-test phrase. Read as directional, not a verdict; the spread is narrow (~76–92) and a 3-word phrase gives intelligibility little to discriminate on.

| Rank | Provider | humanSpeechScore (0-tts-short) |
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

## Cross-run read

- **Cheapest, consistently:** `speechify/simba-english` ranks 1 on price in every run (mean rank 1.0), followed by `openai/gpt-4o-mini-tts`. `hume/octave-2` is the most expensive in all four runs (mean rank 16.0).
- **Fastest, consistently:** the two `cartesia/sonic-3` variants lead on speed (sonic-3.5 mean rank 2.25), with `speechify` close behind. The two `minimax` models are persistent latency outliers (e.g. `minimax/speech-2.8-hd` 188.85s on `1-tts`, 100.53s on `long`).
- **Latency landmines:** `openai/tts-1` spiked to 305.30s on `long` and `openai/gpt-4o-mini-tts` to 520.22s on `hard`, despite both being fast (1–3s) on shorter inputs — single-run spikes that mean rank smooths but worth noting.
- **Automated quality:** `cartesia/sonic-3.5` has the best mean accuracy rank (3.0) across short/long/hard, with `elevenlabs/eleven_v3` and `openai/gpt-4o-mini-tts` also strong. WER ordering shifts substantially between the long and hard texts, so no provider dominates accuracy across all difficulties.
- **Human quality** is informative for one short phrase only (`openai/tts-1-hd` and `speechify/simba-english` top it); it should not be generalized to long-form narration.
- Per-run detail (full evidence tables, consensus notes) lives in each run's `provider-comparison-report.{md,json}`.
