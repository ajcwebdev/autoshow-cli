# Speed and pauses benchmark — 2026-09-25

Eight existing cases were synthesized successfully. Results describe transport, decoded audio integrity, recorded time, and cost. Numeric speed, qualitative pacing, requested timed SSML breaks, and qualitative pause tags remain distinct native mechanisms; these cases are not ranked against each other.

> October 15 assessment: all eight retained recordings received local ASR screening and signal analysis. Separate turn windows support descriptive measurements in six cases. Subjective voice-quality and audible-control ratings are excluded and unscored at the user's instruction; signal gaps and reference-word throughput do not establish semantic pause accuracy or calibrated numeric-speed effects.

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

Each case retains its input, native-control settings and source documentation in `controls.json`, its canonical `manifest.json`, selected render/timeline records, final WAV, and compressed source audio. Audio remains local and is excluded from Git. Cost uses recorded provider usage where available and usage estimates otherwise; it is not a confirmed invoice. The generation measurements above retain their September 25 values.

See the [offline assessment](../assessment.md) for strict WER/CER, a separately labeled counting-number-fold comparison, per-turn reference-word throughput, threshold-based gaps, identities, and exact transcripts. Grok numeric's strict 35.71% WER consists of word/digit substitutions and becomes 0% under the limited supplemental counting fold. The ASR omits the final “Then I speak” in Grok tags and both Soniox cases; these remain screening discrepancies rather than confirmed synthesis omissions. Grok tags and Inworld steering tags combine the lines into a single retained turn, limiting per-line measurements.

Silence measurements use -40 dB and an 80 ms minimum. The Inworld instructions case has longest internal below-threshold gaps of 1.122 and 2.789 seconds in turns requesting 0.5- and 2-second SSML breaks. Those gaps include natural speech pauses and are not verified semantic break lengths. Per-turn reference-word throughput uses expected words and differing self-describing lines; omissions can inflate it, and the recordings do not supply an identical-text speed-calibration baseline.
