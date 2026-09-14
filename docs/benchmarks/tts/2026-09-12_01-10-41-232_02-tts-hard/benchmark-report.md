# 02-tts-hard — TTS benchmark

All 11 models succeeded. Single-voice synthesis; no rerun was performed during archive reorganization.

[Manifest](./manifest.json) · [Batch comparison](../2026-09-12-benchmark-report.md)

| Provider/model                    | Processing s | Audio s | Estimated cost USD | Audio                                                      |
| --------------------------------- | -----------: | ------: | -----------------: | ---------------------------------------------------------- |
| elevenlabs/eleven_v3              |        18.66 |   36.32 |           $0.04520 | [WAV](./02-tts-hard-elevenlabs-eleven_v3.wav)              |
| grok/grok-tts                     |         6.41 |   35.04 |           $0.00678 | [WAV](./02-tts-hard-grok-grok-tts.wav)                     |
| mistral/voxtral-mini-tts-2603     |        10.33 |   35.92 |           $0.00723 | [WAV](./02-tts-hard-mistral-voxtral-mini-tts-2603.wav)     |
| openai/gpt-4o-mini-tts-2025-12-15 |        10.61 |   35.20 |           $0.00570 | [WAV](./02-tts-hard-openai-gpt-4o-mini-tts-2025-12-15.wav) |
| speechify/simba-3.2               |         9.53 |   30.17 |           $0.00452 | [WAV](./02-tts-hard-speechify-simba-3.2.wav)               |
| hume/octave-1                     |        22.23 |   37.42 |           $0.06780 | [WAV](./02-tts-hard-hume-octave-1.wav)                     |
| hume/octave-2                     |        17.97 |   37.80 |           $0.06780 | [WAV](./02-tts-hard-hume-octave-2.wav)                     |
| cartesia/sonic-3.5-2026-05-04     |         6.95 |   28.40 |           $0.01689 | [WAV](./02-tts-hard-cartesia-sonic-3.5-2026-05-04.wav)     |
| cartesia/sonic-3.6-2026-08-27     |        10.52 |   29.04 |           $0.01689 | [WAV](./02-tts-hard-cartesia-sonic-3.6-2026-08-27.wav)     |
| inworld/realtime-tts-2            |         9.42 |   28.84 |           $0.01130 | [WAV](./02-tts-hard-inworld-realtime-tts-2.wav)            |
| inworld/realtime-tts-2-flash      |        11.05 |   29.26 |           $0.00678 | [WAV](./02-tts-hard-inworld-realtime-tts-2-flash.wav)      |

Costs are render-plan estimates, not confirmed provider charges. Processing times include concurrent scheduling effects. Automated and human quality scores are unavailable. See the batch comparison for commands, methodology, verification, and original-manifest provenance.
