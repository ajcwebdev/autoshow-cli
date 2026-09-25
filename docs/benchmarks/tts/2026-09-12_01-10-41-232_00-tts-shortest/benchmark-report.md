# 00-tts-shortest — TTS benchmark

9 retained model results; 9 succeeded. Single-voice synthesis. Updated from selected manifest artifacts on 2026-09-25 without provider calls.

[Manifest](./manifest.json) · [Batch comparison](../2026-09-12-benchmark-report.md)

| Provider/model                    | Execution | Recorded s      | Audio s | Cost USD | Cost basis      | Audio                                                          |
| --------------------------------- | --------- | --------------- | ------- | -------- | --------------- | -------------------------------------------------------------- |
| elevenlabs/eleven_v3              | succeeded | 1.34            | 1.040   | $0.00170 | computed usage  | [WAV](./00-tts-shortest-elevenlabs-eleven_v3.wav)              |
| grok/grok-tts                     | succeeded | 0.68            | 1.590   | $0.00026 | computed usage  | [WAV](./00-tts-shortest-grok-grok-tts.wav)                     |
| mistral/voxtral-mini-tts-2603     | succeeded | 1.88            | 2.400   | $0.00027 | computed usage  | [WAV](./00-tts-shortest-mistral-voxtral-mini-tts-2603.wav)     |
| openai/gpt-4o-mini-tts-2025-12-15 | succeeded | 2.04            | 1.700   | $0.00021 | computed usage  | [WAV](./00-tts-shortest-openai-gpt-4o-mini-tts-2025-12-15.wav) |
| speechify/simba-3.2               | succeeded | 3.10            | 1.370   | $0.00017 | computed usage  | [WAV](./00-tts-shortest-speechify-simba-3.2.wav)               |
| inworld/realtime-tts-2            | succeeded | 0.85            | 1.500   | $0.00043 | computed usage  | [WAV](./00-tts-shortest-inworld-realtime-tts-2.wav)            |
| gemini/gemini-3.8-flash-tts       | succeeded | 3.52            | 1.207   | $0.00049 | provider usage  | [WAV](./00-tts-shortest-gemini-gemini-3.8-flash-tts.wav)       |
| gemini/gemini-3.8-flash-lite-tts  | succeeded | 0.07 (recovery) | 1.543   | $0.00028 | estimated usage | [WAV](./00-tts-shortest-gemini-gemini-3.8-flash-lite-tts.wav)  |
| soniox/tts-rt-v2                  | succeeded | 1.09            | 1.119   | $0.00025 | estimated usage | [WAV](./00-tts-shortest-soniox-tts-rt-v2.wav)                  |

Costs retain their recorded basis. Local recovery time is excluded from generation rankings. Automated and human quality scores are unavailable. Hash verification and decoded metadata establish artifact integrity, not spoken-text correctness or perceptual quality.
