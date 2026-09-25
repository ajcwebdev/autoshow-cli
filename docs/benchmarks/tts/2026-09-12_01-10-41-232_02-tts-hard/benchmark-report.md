# 02-tts-hard — TTS benchmark

8 retained model results; 8 succeeded. Single-voice synthesis. Updated from selected manifest artifacts on 2026-09-25 without provider calls.

[Manifest](./manifest.json) · [Batch comparison](../2026-09-12-benchmark-report.md)

| Provider/model                    | Execution | Recorded s      | Audio s | Cost USD | Cost basis      | Audio                                                      |
| --------------------------------- | --------- | --------------- | ------- | -------- | --------------- | ---------------------------------------------------------- |
| elevenlabs/eleven_v3              | succeeded | 18.66           | 36.320  | $0.04530 | computed usage  | [WAV](./02-tts-hard-elevenlabs-eleven_v3.wav)              |
| grok/grok-tts                     | succeeded | 6.41            | 35.037  | $0.00679 | computed usage  | [WAV](./02-tts-hard-grok-grok-tts.wav)                     |
| mistral/voxtral-mini-tts-2603     | succeeded | 10.33           | 35.920  | $0.00725 | computed usage  | [WAV](./02-tts-hard-mistral-voxtral-mini-tts-2603.wav)     |
| openai/gpt-4o-mini-tts-2025-12-15 | succeeded | 10.61           | 35.200  | $0.00571 | computed usage  | [WAV](./02-tts-hard-openai-gpt-4o-mini-tts-2025-12-15.wav) |
| inworld/realtime-tts-2            | succeeded | 9.42            | 28.840  | $0.01132 | computed usage  | [WAV](./02-tts-hard-inworld-realtime-tts-2.wav)            |
| gemini/gemini-3.8-flash-tts       | succeeded | 0.08 (recovery) | 35.762  | $0.00862 | estimated usage | [WAV](./02-tts-hard-gemini-gemini-3.8-flash-tts.wav)       |
| gemini/gemini-3.8-flash-lite-tts  | succeeded | 13.48           | 40.640  | $0.00797 | provider usage  | [WAV](./02-tts-hard-gemini-gemini-3.8-flash-lite-tts.wav)  |
| soniox/tts-rt-v2                  | succeeded | 34.37           | 41.399  | $0.00797 | estimated usage | [WAV](./02-tts-hard-soniox-tts-rt-v2.wav)                  |

Costs retain their recorded basis. Local recovery time is excluded from generation rankings. Automated and human quality scores are unavailable. Hash verification and decoded metadata establish artifact integrity, not spoken-text correctness or perceptual quality.
