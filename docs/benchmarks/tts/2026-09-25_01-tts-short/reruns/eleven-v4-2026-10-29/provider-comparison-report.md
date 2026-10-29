# TTS Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/tts/2026-09-25_01-tts-short/reruns/eleven-v4-2026-10-29`
- Total providers: 1 (0 local, 1 service)
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

| Rank | Provider                          | Evidence |
| ---- | --------------------------------- | -------- |
| 1    | <code>elevenlabs/eleven_v4</code> | $0.0070  |

### Speed

| Rank | Provider                          | Evidence |
| ---- | --------------------------------- | -------- |
| 1    | <code>elevenlabs/eleven_v4</code> | 1.71s    |

### Automated Quality

Unavailable: No roundtrip WER was available for service providers. Duration, bitrate, and file size are not used as automated quality proxies.

### Human Quality

Unavailable: No humanSpeechScore from voice-quality-report.json was available for service providers. Duration, bitrate, and file size are not used as human quality proxies.

### Provider Detail

| Provider                          | Quality Evidence | Processing Time | Monetary Cost |
| --------------------------------- | ---------------- | --------------- | ------------- |
| <code>elevenlabs/eleven_v4</code> | n/a              | 1.71s           | $0.0070       |

## Notes

- The cheapest cloud provider was `elevenlabs/eleven_v4` at 0.6960¢ ($0.0070).
- Fastest cloud service: `elevenlabs/eleven_v4` at 1.71s.
- No assessment evidence was available. Spoken-text accuracy and perceptual quality remain unassessed; duration, cost, and speed do not establish quality.
