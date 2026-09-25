# 01-tts-short — TTS benchmark

9 retained model results; 9 succeeded. Single-voice synthesis. Updated from selected manifest artifacts on 2026-09-25 without provider calls.

[Manifest](./manifest.json) · [Batch comparison](../2026-09-12-benchmark-report.md)

| Provider/model                    | Execution | Recorded s      | Audio s | Cost USD | Cost basis      | Audio                                                       |
| --------------------------------- | --------- | --------------- | ------- | -------- | --------------- | ----------------------------------------------------------- |
| elevenlabs/eleven_v3              | succeeded | 3.48            | 5.680   | $0.00870 | computed usage  | [WAV](./01-tts-short-elevenlabs-eleven_v3.wav)              |
| grok/grok-tts                     | succeeded | 1.70            | 5.511   | $0.00130 | computed usage  | [WAV](./01-tts-short-grok-grok-tts.wav)                     |
| mistral/voxtral-mini-tts-2603     | succeeded | 4.35            | 6.240   | $0.00139 | computed usage  | [WAV](./01-tts-short-mistral-voxtral-mini-tts-2603.wav)     |
| openai/gpt-4o-mini-tts-2025-12-15 | succeeded | 3.67            | 5.400   | $0.00110 | computed usage  | [WAV](./01-tts-short-openai-gpt-4o-mini-tts-2025-12-15.wav) |
| speechify/simba-3.2               | succeeded | 4.62            | 5.720   | $0.00087 | computed usage  | [WAV](./01-tts-short-speechify-simba-3.2.wav)               |
| inworld/realtime-tts-2            | succeeded | 2.50            | 5.280   | $0.00217 | computed usage  | [WAV](./01-tts-short-inworld-realtime-tts-2.wav)            |
| gemini/gemini-3.8-flash-tts       | succeeded | 5.35            | 6.096   | $0.00192 | provider usage  | [WAV](./01-tts-short-gemini-gemini-3.8-flash-tts.wav)       |
| gemini/gemini-3.8-flash-lite-tts  | succeeded | 0.08 (recovery) | 5.784   | $0.00117 | estimated usage | [WAV](./01-tts-short-gemini-gemini-3.8-flash-lite-tts.wav)  |
| soniox/tts-rt-v2                  | succeeded | 5.14            | 6.288   | $0.00125 | estimated usage | [WAV](./01-tts-short-soniox-tts-rt-v2.wav)                  |

Costs retain their recorded basis. Local recovery time is excluded from generation rankings. Automated and human quality scores are unavailable. Hash verification and decoded metadata establish artifact integrity, not spoken-text correctness or perceptual quality.
