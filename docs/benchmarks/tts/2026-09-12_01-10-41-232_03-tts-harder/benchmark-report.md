# 03-tts-harder — TTS benchmark

8 retained model results; 8 succeeded. Single-voice synthesis. Updated from selected manifest artifacts on 2026-09-25 without provider calls.

[Manifest](./manifest.json) · [Batch comparison](../2026-09-12-benchmark-report.md)

| Provider/model                    | Execution | Recorded s      | Audio s | Cost USD | Cost basis      | Audio                                                        |
| --------------------------------- | --------- | --------------- | ------- | -------- | --------------- | ------------------------------------------------------------ |
| elevenlabs/eleven_v3              | succeeded | 55.72           | 133.680 | $0.16130 | computed usage  | [WAV](./03-tts-harder-elevenlabs-eleven_v3.wav)              |
| grok/grok-tts                     | succeeded | 23.54           | 134.711 | $0.02420 | computed usage  | [WAV](./03-tts-harder-grok-grok-tts.wav)                     |
| mistral/voxtral-mini-tts-2603     | succeeded | 20.67           | 119.810 | $0.02581 | computed usage  | [WAV](./03-tts-harder-mistral-voxtral-mini-tts-2603.wav)     |
| openai/gpt-4o-mini-tts-2025-12-15 | succeeded | 27.11           | 116.650 | $0.02032 | computed usage  | [WAV](./03-tts-harder-openai-gpt-4o-mini-tts-2025-12-15.wav) |
| inworld/realtime-tts-2            | succeeded | 33.41           | 118.180 | $0.04032 | computed usage  | [WAV](./03-tts-harder-inworld-realtime-tts-2.wav)            |
| gemini/gemini-3.8-flash-tts       | succeeded | 24.72           | 139.339 | $0.04060 | provider usage  | [WAV](./03-tts-harder-gemini-gemini-3.8-flash-tts.wav)       |
| gemini/gemini-3.8-flash-lite-tts  | succeeded | 0.20 (recovery) | 144.667 | $0.02050 | estimated usage | [WAV](./03-tts-harder-gemini-gemini-3.8-flash-lite-tts.wav)  |
| soniox/tts-rt-v2                  | succeeded | 54.63           | 153.638 | $0.02913 | estimated usage | [WAV](./03-tts-harder-soniox-tts-rt-v2.wav)                  |

Costs retain their recorded basis. Local recovery time is excluded from generation rankings. Automated and human quality scores are unavailable. Hash verification and decoded metadata establish artifact integrity, not spoken-text correctness or perceptual quality.
