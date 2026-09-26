# Emotion and delivery benchmark — 2026-09-25

Six existing cases were synthesized successfully. Results describe transport, decoded audio integrity, recorded time, and cost. Different native inputs and mechanisms are not ranked against each other.

> Spoken-text correctness and audible control effectiveness remain unassessed. Successful execution and valid WAVs do not establish a controls-quality pass.

> OpenAI has no case in the existing controls plans; it was included in all four narration inputs.

| Case                                          | Provider/model                   | Execution | Audio seconds | Cost USD | Audio                                                                                                  |
| --------------------------------------------- | -------------------------------- | --------- | ------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| elevenlabs-eleven-v3-tags                     | elevenlabs/eleven_v3             | succeeded | 22.000        | 0.02950  | [WAV](elevenlabs-eleven-v3-tags/elevenlabs-eleven-v3-tags.wav)                                         |
| gemini-gemini-3.8-flash-lite-tts-instructions | gemini/gemini-3.8-flash-lite-tts | succeeded | 19.520        | 0.00379  | [WAV](gemini-gemini-3.8-flash-lite-tts-instructions/gemini-gemini-3.8-flash-lite-tts-instructions.wav) |
| gemini-gemini-3.8-flash-tts-instructions      | gemini/gemini-3.8-flash-tts      | succeeded | 20.160        | 0.00585  | [WAV](gemini-gemini-3.8-flash-tts-instructions/gemini-gemini-3.8-flash-tts-instructions.wav)           |
| grok-grok-tts-delivery                        | grok/grok-tts                    | succeeded | 13.190        | 0.00387  | [WAV](grok-grok-tts-delivery/grok-grok-tts-delivery.wav)                                               |
| inworld-realtime-tts-2-instructions           | inworld/realtime-tts-2           | succeeded | 16.420        | 0.00400  | [WAV](inworld-realtime-tts-2-instructions/inworld-realtime-tts-2-instructions.wav)                     |
| soniox-tts-rt-v2-emotion-tags                 | soniox/tts-rt-v2                 | succeeded | 14.592        | 0.00286  | [WAV](soniox-tts-rt-v2-emotion-tags/soniox-tts-rt-v2-emotion-tags.wav)                                 |

Each case retains its input, native-control settings and source documentation in `controls.json`, its canonical `manifest.json`, selected render/timeline records, final WAV, and compressed source audio. Audio remains local and is excluded from Git. Cost uses recorded provider usage where available and usage estimates otherwise; it is not a confirmed invoice. No human quality or roundtrip transcription assessment was performed.
