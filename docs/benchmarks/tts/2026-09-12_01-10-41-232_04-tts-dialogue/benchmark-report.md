# 04-tts-dialogue — TTS benchmark

All 11 models succeeded. Single-voice synthesis; no rerun was performed during archive reorganization.

[Manifest](./manifest.json) · [Batch comparison](../2026-09-12-benchmark-report.md)

| Provider/model                    | Processing s | Audio s | Estimated cost USD | Audio                                                          |
| --------------------------------- | -----------: | ------: | -----------------: | -------------------------------------------------------------- |
| elevenlabs/eleven_v3              |        29.62 |   30.56 |           $0.04490 | [WAV](./04-tts-dialogue-elevenlabs-eleven_v3.wav)              |
| grok/grok-tts                     |        15.45 |   28.07 |           $0.00673 | [WAV](./04-tts-dialogue-grok-grok-tts.wav)                     |
| mistral/voxtral-mini-tts-2603     |        15.94 |   31.52 |           $0.00718 | [WAV](./04-tts-dialogue-mistral-voxtral-mini-tts-2603.wav)     |
| openai/gpt-4o-mini-tts-2025-12-15 |        15.85 |   30.60 |           $0.00566 | [WAV](./04-tts-dialogue-openai-gpt-4o-mini-tts-2025-12-15.wav) |
| speechify/simba-3.2               |        19.28 |   27.82 |           $0.00449 | [WAV](./04-tts-dialogue-speechify-simba-3.2.wav)               |
| hume/octave-1                     |        56.56 |   42.34 |           $0.06735 | [WAV](./04-tts-dialogue-hume-octave-1.wav)                     |
| hume/octave-2                     |        61.14 |   27.50 |           $0.06735 | [WAV](./04-tts-dialogue-hume-octave-2.wav)                     |
| cartesia/sonic-3.5-2026-05-04     |        26.59 |   24.48 |           $0.01678 | [WAV](./04-tts-dialogue-cartesia-sonic-3.5-2026-05-04.wav)     |
| cartesia/sonic-3.6-2026-08-27     |        29.82 |   26.32 |           $0.01678 | [WAV](./04-tts-dialogue-cartesia-sonic-3.6-2026-08-27.wav)     |
| inworld/realtime-tts-2            |        27.07 |   28.48 |           $0.01123 | [WAV](./04-tts-dialogue-inworld-realtime-tts-2.wav)            |
| inworld/realtime-tts-2-flash      |        28.98 |   26.92 |           $0.00673 | [WAV](./04-tts-dialogue-inworld-realtime-tts-2-flash.wav)      |

Costs are render-plan estimates, not confirmed provider charges. Processing times include concurrent scheduling effects. Automated and human quality scores are unavailable. See the batch comparison for commands, methodology, verification, and original-manifest provenance.
