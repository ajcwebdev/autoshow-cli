# 00-tts-shortest — TTS benchmark

All 11 models succeeded. Single-voice synthesis; no rerun was performed during archive reorganization.

[Manifest](./manifest.json) · [Batch comparison](../2026-09-12-benchmark-report.md)

| Provider/model                    | Processing s | Audio s | Estimated cost USD | Audio                                                          |
| --------------------------------- | -----------: | ------: | -----------------: | -------------------------------------------------------------- |
| elevenlabs/eleven_v3              |         1.34 |    1.04 |           $0.00160 | [WAV](./00-tts-shortest-elevenlabs-eleven_v3.wav)              |
| grok/grok-tts                     |         0.68 |    1.59 |           $0.00024 | [WAV](./00-tts-shortest-grok-grok-tts.wav)                     |
| mistral/voxtral-mini-tts-2603     |         1.88 |    2.40 |           $0.00026 | [WAV](./00-tts-shortest-mistral-voxtral-mini-tts-2603.wav)     |
| openai/gpt-4o-mini-tts-2025-12-15 |         2.04 |    1.70 |           $0.00020 | [WAV](./00-tts-shortest-openai-gpt-4o-mini-tts-2025-12-15.wav) |
| speechify/simba-3.2               |         3.10 |    1.37 |           $0.00016 | [WAV](./00-tts-shortest-speechify-simba-3.2.wav)               |
| hume/octave-1                     |         2.30 |    1.63 |           $0.00240 | [WAV](./00-tts-shortest-hume-octave-1.wav)                     |
| hume/octave-2                     |         3.23 |    1.20 |           $0.00240 | [WAV](./00-tts-shortest-hume-octave-2.wav)                     |
| cartesia/sonic-3.5-2026-05-04     |         1.14 |    1.20 |           $0.00060 | [WAV](./00-tts-shortest-cartesia-sonic-3.5-2026-05-04.wav)     |
| cartesia/sonic-3.6-2026-08-27     |         2.32 |    1.20 |           $0.00060 | [WAV](./00-tts-shortest-cartesia-sonic-3.6-2026-08-27.wav)     |
| inworld/realtime-tts-2            |         0.85 |    1.50 |           $0.00040 | [WAV](./00-tts-shortest-inworld-realtime-tts-2.wav)            |
| inworld/realtime-tts-2-flash      |         1.10 |    1.44 |           $0.00024 | [WAV](./00-tts-shortest-inworld-realtime-tts-2-flash.wav)      |

Costs are render-plan estimates, not confirmed provider charges. Processing times include concurrent scheduling effects. Automated and human quality scores are unavailable. See the batch comparison for commands, methodology, verification, and original-manifest provenance.
