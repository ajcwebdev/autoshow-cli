# Speed and pauses benchmark — 2026-09-25

Eight existing cases were synthesized successfully. Results describe transport, decoded audio integrity, recorded time, and cost. Numeric speed, qualitative pacing, requested timed SSML breaks, and qualitative pause tags remain distinct native mechanisms; these cases are not ranked against each other.

> Spoken-text correctness and audible control effectiveness remain unassessed. Successful execution and valid WAVs do not establish a controls-quality pass. Exact pause lengths and numeric-speed effects have not been measured.

> The existing ElevenLabs pacing case was skipped because its exact tags were unverified for eleven_v3. OpenAI has no case in the existing controls plans. Both providers were included in all four narration inputs.

| Case                                          | Provider/model                   | Execution | Audio seconds | Cost USD | Audio                                                                                                  |
| --------------------------------------------- | -------------------------------- | --------- | ------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| gemini-gemini-3.8-flash-lite-tts-instructions | gemini/gemini-3.8-flash-lite-tts | succeeded | 33.200        | 0.00642  | [WAV](gemini-gemini-3.8-flash-lite-tts-instructions/gemini-gemini-3.8-flash-lite-tts-instructions.wav) |
| gemini-gemini-3.8-flash-tts-instructions      | gemini/gemini-3.8-flash-tts      | succeeded | 33.200        | 0.00962  | [WAV](gemini-gemini-3.8-flash-tts-instructions/gemini-gemini-3.8-flash-tts-instructions.wav)           |
| grok-grok-tts-numeric                         | grok/grok-tts                    | succeeded | 21.576        | 0.00341  | [WAV](grok-grok-tts-numeric/grok-grok-tts-numeric.wav)                                                 |
| grok-grok-tts-tags                            | grok/grok-tts                    | succeeded | 20.315        | 0.00387  | [WAV](grok-grok-tts-tags/grok-grok-tts-tags.wav)                                                       |
| inworld-realtime-tts-2-instructions           | inworld/realtime-tts-2           | succeeded | 25.300        | 0.00617  | [WAV](inworld-realtime-tts-2-instructions/inworld-realtime-tts-2-instructions.wav)                     |
| inworld-realtime-tts-2-steering-tags          | inworld/realtime-tts-2           | succeeded | 25.200        | 0.03762  | [WAV](inworld-realtime-tts-2-steering-tags/inworld-realtime-tts-2-steering-tags.wav)                   |
| soniox-tts-rt-v2-numeric                      | soniox/tts-rt-v2                 | succeeded | 27.392        | 0.00518  | [WAV](soniox-tts-rt-v2-numeric/soniox-tts-rt-v2-numeric.wav)                                           |
| soniox-tts-rt-v2-pacing-tags                  | soniox/tts-rt-v2                 | succeeded | 23.552        | 0.00451  | [WAV](soniox-tts-rt-v2-pacing-tags/soniox-tts-rt-v2-pacing-tags.wav)                                   |

Each case retains its input, native-control settings and source documentation in `controls.json`, its canonical `manifest.json`, selected render/timeline records, final WAV, and compressed source audio. Audio remains local and is excluded from Git. Cost uses recorded provider usage where available and usage estimates otherwise; it is not a confirmed invoice. No human quality or roundtrip transcription assessment was performed.
