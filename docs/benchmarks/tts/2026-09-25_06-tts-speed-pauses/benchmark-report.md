# Speed and pauses benchmark — 2026-09-25

Eight existing cases were synthesized successfully. Results describe transport, decoded audio integrity, recorded time, and cost. Numeric speed, qualitative pacing, requested timed SSML breaks, and qualitative pause tags remain distinct native mechanisms; these cases are not ranked against each other.

> October 26 storage update: the user approved the MP3 playback copies and deletion of the final WAVs. The October 15 ASR and signal measurements describe the original WAVs; the current MP3s have not been reassessed.

> October 15 assessment: all eight original WAV recordings received local ASR screening and signal analysis. Separate turn windows support descriptive measurements in six cases. Subjective voice-quality and audible-control ratings are excluded and unscored at the user's instruction; signal gaps and reference-word throughput do not establish semantic pause accuracy or calibrated numeric-speed effects.

> The existing ElevenLabs pacing case was skipped because its exact tags were unverified for eleven_v3. OpenAI has no case in the existing controls plans. Both providers were included in all four narration inputs.

| Case                                          | Provider/model                   | Execution | Audio seconds | Cost USD | Audio                                                                                                  |
| --------------------------------------------- | -------------------------------- | --------- | ------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| gemini-gemini-3.8-flash-lite-tts-instructions | gemini/gemini-3.8-flash-lite-tts | succeeded | 33.200        | 0.00642  | [MP3](gemini-gemini-3.8-flash-lite-tts-instructions/gemini-gemini-3.8-flash-lite-tts-instructions.mp3) |
| gemini-gemini-3.8-flash-tts-instructions      | gemini/gemini-3.8-flash-tts      | succeeded | 33.200        | 0.00962  | [MP3](gemini-gemini-3.8-flash-tts-instructions/gemini-gemini-3.8-flash-tts-instructions.mp3)           |
| grok-grok-tts-numeric                         | grok/grok-tts                    | succeeded | 21.576        | 0.00341  | [MP3](grok-grok-tts-numeric/grok-grok-tts-numeric.mp3)                                                 |
| grok-grok-tts-tags                            | grok/grok-tts                    | succeeded | 20.315        | 0.00387  | [MP3](grok-grok-tts-tags/grok-grok-tts-tags.mp3)                                                       |
| inworld-realtime-tts-2-instructions           | inworld/realtime-tts-2           | succeeded | 25.300        | 0.00617  | [MP3](inworld-realtime-tts-2-instructions/inworld-realtime-tts-2-instructions.mp3)                     |
| inworld-realtime-tts-2-steering-tags          | inworld/realtime-tts-2           | succeeded | 25.200        | 0.03762  | [MP3](inworld-realtime-tts-2-steering-tags/inworld-realtime-tts-2-steering-tags.mp3)                   |
| soniox-tts-rt-v2-numeric                      | soniox/tts-rt-v2                 | succeeded | 27.392        | 0.00518  | [MP3](soniox-tts-rt-v2-numeric/soniox-tts-rt-v2-numeric.mp3)                                           |
| soniox-tts-rt-v2-pacing-tags                  | soniox/tts-rt-v2                 | succeeded | 23.552        | 0.00451  | [MP3](soniox-tts-rt-v2-pacing-tags/soniox-tts-rt-v2-pacing-tags.mp3)                                   |

Each case retains its input, native-control settings and source documentation in `controls.json`, its canonical `manifest.json`, selected render/timeline records, an approved MP3 playback copy, and compressed source audio. The original WAV identities remain preserved in the manifests and render records. Audio remains local and is excluded from Git. Cost uses recorded provider usage where available and usage estimates otherwise; it is not a confirmed invoice. The generation measurements above retain their September 25 values.

See the [offline assessment](../assessment.md) for strict WER/CER, a separately labeled counting-number-fold comparison, per-turn reference-word throughput, threshold-based gaps, identities, and exact transcripts. Grok numeric's strict 35.71% WER consists of word/digit substitutions and becomes 0% under the limited supplemental counting fold. The ASR omits the final “Then I speak” in Grok tags and both Soniox cases; these remain screening discrepancies rather than confirmed synthesis omissions. Grok tags and Inworld steering tags combine the lines into a single retained turn, limiting per-line measurements.

Silence measurements use -40 dB and an 80 ms minimum. The Inworld instructions case has longest internal below-threshold gaps of 1.122 and 2.789 seconds in turns requesting 0.5- and 2-second SSML breaks. Those gaps include natural speech pauses and are not verified semantic break lengths. Per-turn reference-word throughput uses expected words and differing self-describing lines; omissions can inflate it, and the recordings do not supply an identical-text speed-calibration baseline.
