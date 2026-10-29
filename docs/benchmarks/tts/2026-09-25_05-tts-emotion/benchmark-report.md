# Emotion and delivery benchmark — 2026-09-25

Seven cases completed synthesis: six original cases and Eleven v4 added on October 29. Results describe transport, decoded audio integrity, recorded time, and cost. Different native inputs and mechanisms are not ranked against each other.

The October 29 v4 addition explicitly selected `eleven_v4` and stability `0.5`, keeping the five documented delivery tags inside submitted text and storing canonical spoken words separately. Its final mono 16 kHz PCM WAV fully decoded: 21.280 seconds, 5.094 seconds recorded generation/assembly time, and $0.02360 computed character cost. These measurements establish execution and integrity; they do not establish spoken correctness or audible emotion effects. Earlier recordings and their historical assessments remain unchanged.

> October 26 storage update: the user approved the MP3 playback copies and deletion of the final WAVs. The October 15 ASR and signal measurements describe the original WAVs; the current MP3s have not been reassessed.

> October 15 assessment: all six original WAV recordings received full local decoding and Whisper small.en roundtrip screening. Subjective voice-quality and audible emotion/delivery ratings are excluded and unscored at the user's instruction; no controls-quality pass is asserted.

> OpenAI has no case in the existing controls plans; it was included in all four narration inputs.

| Case                                          | Provider/model                   | Execution | Audio seconds | Cost USD | Audio                                                                                                  |
| --------------------------------------------- | -------------------------------- | --------- | ------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| elevenlabs-eleven-v3-tags                     | elevenlabs/eleven_v3             | succeeded | 22.000        | 0.02950  | [MP3](elevenlabs-eleven-v3-tags/elevenlabs-eleven-v3-tags.mp3)                                         |
| elevenlabs-eleven-v4-tags                     | elevenlabs/eleven_v4             | succeeded | 21.280        | 0.02360  | [WAV](elevenlabs-eleven-v4-tags/elevenlabs-eleven-v4-tags.wav)                                         |
| gemini-gemini-3.8-flash-lite-tts-instructions | gemini/gemini-3.8-flash-lite-tts | succeeded | 19.520        | 0.00379  | [MP3](gemini-gemini-3.8-flash-lite-tts-instructions/gemini-gemini-3.8-flash-lite-tts-instructions.mp3) |
| gemini-gemini-3.8-flash-tts-instructions      | gemini/gemini-3.8-flash-tts      | succeeded | 20.160        | 0.00585  | [MP3](gemini-gemini-3.8-flash-tts-instructions/gemini-gemini-3.8-flash-tts-instructions.mp3)           |
| grok-grok-tts-delivery                        | grok/grok-tts                    | succeeded | 13.190        | 0.00387  | [MP3](grok-grok-tts-delivery/grok-grok-tts-delivery.mp3)                                               |
| inworld-realtime-tts-2-instructions           | inworld/realtime-tts-2           | succeeded | 16.420        | 0.00400  | [MP3](inworld-realtime-tts-2-instructions/inworld-realtime-tts-2-instructions.mp3)                     |
| soniox-tts-rt-v2-emotion-tags                 | soniox/tts-rt-v2                 | succeeded | 14.592        | 0.00286  | [MP3](soniox-tts-rt-v2-emotion-tags/soniox-tts-rt-v2-emotion-tags.mp3)                                 |

Each case retains its input, native-control settings and source documentation in `controls.json`, its canonical `manifest.json`, selected render/timeline records, an approved MP3 playback copy, and compressed source audio. The original WAV identities remain preserved in the manifests and render records. Audio remains local and is excluded from Git. Cost uses recorded provider usage where available and usage estimates otherwise; it is not a confirmed invoice. The generation measurements above retain their September 25 values.

See the [offline assessment](../assessment.md) for exact selected-file identities, ASR WER/CER, discrepancy traces, and the adjacent checksummed transcript archive. Five cases have no strict normalized ASR differences; Gemini Flash's transcript has one insertion. These are recognizer results, not confirmed synthesis defects or proof of correct pronunciation. Four cases retain separate turn windows; the combined ElevenLabs and Grok cases have explicit per-turn measurement limitations. Human listening was excluded rather than inferred from audio integrity or successful transport.
