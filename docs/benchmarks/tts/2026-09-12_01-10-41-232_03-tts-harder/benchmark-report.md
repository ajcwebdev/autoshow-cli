# 03-tts-harder — TTS benchmark

All 11 models succeeded. Single-voice synthesis; no rerun was performed during archive reorganization.

[Manifest](./manifest.json) · [Batch comparison](../2026-09-12-benchmark-report.md)

| Provider/model                    | Processing s | Audio s | Estimated cost USD | Audio                                                        |
| --------------------------------- | -----------: | ------: | -----------------: | ------------------------------------------------------------ |
| elevenlabs/eleven_v3              |        55.72 |  133.68 |           $0.16120 | [WAV](./03-tts-harder-elevenlabs-eleven_v3.wav)              |
| grok/grok-tts                     |        23.54 |  134.71 |           $0.02418 | [WAV](./03-tts-harder-grok-grok-tts.wav)                     |
| mistral/voxtral-mini-tts-2603     |        20.67 |  119.81 |           $0.02579 | [WAV](./03-tts-harder-mistral-voxtral-mini-tts-2603.wav)     |
| openai/gpt-4o-mini-tts-2025-12-15 |        27.11 |  116.65 |           $0.02031 | [WAV](./03-tts-harder-openai-gpt-4o-mini-tts-2025-12-15.wav) |
| speechify/simba-3.2               |        30.19 |  110.39 |           $0.01612 | [WAV](./03-tts-harder-speechify-simba-3.2.wav)               |
| hume/octave-1                     |        76.18 |  156.89 |           $0.24180 | [WAV](./03-tts-harder-hume-octave-1.wav)                     |
| hume/octave-2                     |        41.13 |  138.12 |           $0.24180 | [WAV](./03-tts-harder-hume-octave-2.wav)                     |
| cartesia/sonic-3.5-2026-05-04     |        23.66 |  117.12 |           $0.06025 | [WAV](./03-tts-harder-cartesia-sonic-3.5-2026-05-04.wav)     |
| cartesia/sonic-3.6-2026-08-27     |        29.59 |  120.80 |           $0.06025 | [WAV](./03-tts-harder-cartesia-sonic-3.6-2026-08-27.wav)     |
| inworld/realtime-tts-2            |        33.41 |  118.18 |           $0.04030 | [WAV](./03-tts-harder-inworld-realtime-tts-2.wav)            |
| inworld/realtime-tts-2-flash      |        22.10 |  102.98 |           $0.02418 | [WAV](./03-tts-harder-inworld-realtime-tts-2-flash.wav)      |

Costs are render-plan estimates, not confirmed provider charges. Processing times include concurrent scheduling effects. Automated and human quality scores are unavailable. See the batch comparison for commands, methodology, verification, and original-manifest provenance.
