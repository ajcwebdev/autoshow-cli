# Retained TTS recordings: offline assessment

This report retains the original 42 WAV assessments below and adds 6 Eleven v4 WAV assessments in the dated extension at the end (48 total). The original report and byte-identical evidence ZIP are preserved inside assessment.evidence.zip under history/. Historical rows retain their measured WAV hashes; approved MP3 playback copies were not re-assessed. The archive records and verifies the metadata-only narration-manifest rebindings.

Updated 2026-10-16T12:57:29.495Z. The retained assessment covers 42 selected recordings (4.386 audio hours) with installed Whisper small.en and local ffmpeg. No provider calls, model downloads, or new synthesis.

[Checksummed original transcripts, source snapshots, complete differences, measurements, and provenance](assessment.evidence.zip) contains assessment.json, transcripts/*.txt, exact raw transcripts/*.whisper.json, inputs/*.txt and SHA256SUMS. Per-case transcript paths below refer to entries in this archive.

Storage update 2026-10-26: the user approved the MP3 playback copies and deletion of the 42 original WAVs. All ASR scores and signal measurements below still describe the original WAV hashes printed in each entry. Playback links now select hash-bound MP3 derivatives in `audio-delivery.json`; those derivatives have not been reassessed. The original checksummed assessment evidence is unchanged.

## Method and limits

October 16 correction: emotion/delivery cases retain descriptive per-turn silence measurements, but only speed/pause cases receive pause-condition interpretations. Existing transcripts, ASR scores, waveform measurements and audio/source identities are unchanged; no ASR rerun was needed.

Unicode NFKC, lower-case, curly apostrophes folded, punctuation/hyphens/apostrophes become spaces, Unicode letters/digits/diacritics retained, whitespace collapsed. Strict WER keeps digits literal; no number expansion or pronunciation guessing. Controls use saved spokenLines excluding native tags and narrator labels; narration uses the exact input text. WER uses token Levenshtein S+D+I / reference words; CER uses normalized Unicode code-point Levenshtein including spaces. Speed/pause cases additionally show a separately labeled counting-number-fold WER: only normalized tokens exactly 1, 2, 3, 4, 5 become one, two, three, four, five in both strings; no other numbers or words change. Strict scores and exact transcripts are preserved, and omissions remain counted.

- One English-only local ASR engine; recognition errors and number expansion can create differences unrelated to TTS errors. No reference prompt supplied.
- The user explicitly excluded subjective ratings. Human listening, pronunciation ratings, speaker-identity ratings, emotion, seam/prosody ratings and perceptual quality remain excluded and unscored for every recording; no human listening is claimed.
- Reference-word throughput divides expected words by the amplitude-trimmed waveform window, not independently verified spoken words; omissions can inflate it. The self-describing lines differ, and there is no repeated identical-text baseline. Ordering is descriptive screening, not proof of numeric speed calibration.
- Silence means below -40 dB for at least 80 ms; fricatives/breaths/noise and threshold sensitivity affect boundaries. Longest internal gaps are not automatically the requested semantic pause.
- Historical provider cost/usage and request identities are preserved; historical OpenAI character estimates are not retrospectively corrected.

- OpenAI controls absent from the inherited plans; no synthesis purchased.
- Eleven v3 pacing skipped because exact native tags were unverified; no fallback tags or synthesis added.
- Earlier Eleven v3 pilot output/2026-09-18_tts-delivery-pilot is absent in the bounded local check; maintained docs/benchmarks/tts has no separate compatible pilot. Selected Eleven narration/emotion remain included; missing pilot evidence is excluded rather than repurchased.

All accepted recordings receive an automated assessment below. Subjective listening ratings are excluded and unscored by the user's instruction for every recording; no controls or perceptual quality pass is asserted.

## Selected recordings

| Case                                                                                                                                                                           | Provider/model                    | Suite        | WER    | CER    | S/D/I     | Disposition                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | ------------ | ------ | ------ | --------- | ------------------------------------ |
| [2026-09-25_01-tts-short](#narration--2026-09-25_01-tts-short--elevenlabs-eleven-v3)                                                                                           | elevenlabs/eleven_v3              | narration    | 0.00%  | 0.00%  | 0/0/0     | No normalized ASR differences        |
| [2026-09-25_01-tts-short](#narration--2026-09-25_01-tts-short--gemini-gemini-3.8-flash-tts)                                                                                    | gemini/gemini-3.8-flash-tts       | narration    | 6.67%  | 1.16%  | 1/0/0     | ASR differences require adjudication |
| [2026-09-25_01-tts-short](#narration--2026-09-25_01-tts-short--gemini-gemini-3.8-flash-lite-tts)                                                                               | gemini/gemini-3.8-flash-lite-tts  | narration    | 0.00%  | 0.00%  | 0/0/0     | No normalized ASR differences        |
| [2026-09-25_01-tts-short](#narration--2026-09-25_01-tts-short--inworld-realtime-tts-2)                                                                                         | inworld/realtime-tts-2            | narration    | 0.00%  | 0.00%  | 0/0/0     | No normalized ASR differences        |
| [2026-09-25_01-tts-short](#narration--2026-09-25_01-tts-short--openai-gpt-4o-mini-tts-2025-12-15)                                                                              | openai/gpt-4o-mini-tts-2025-12-15 | narration    | 0.00%  | 0.00%  | 0/0/0     | No normalized ASR differences        |
| [2026-09-25_01-tts-short](#narration--2026-09-25_01-tts-short--soniox-tts-rt-v2)                                                                                               | soniox/tts-rt-v2                  | narration    | 0.00%  | 0.00%  | 0/0/0     | No normalized ASR differences        |
| [2026-09-25_01-tts-short](#narration--2026-09-25_01-tts-short--grok-grok-tts)                                                                                                  | grok/grok-tts                     | narration    | 0.00%  | 0.00%  | 0/0/0     | No normalized ASR differences        |
| [2026-09-25_02-tts-hard](#narration--2026-09-25_02-tts-hard--elevenlabs-eleven-v3)                                                                                             | elevenlabs/eleven_v3              | narration    | 15.63% | 3.55%  | 10/0/0    | ASR differences require adjudication |
| [2026-09-25_02-tts-hard](#narration--2026-09-25_02-tts-hard--gemini-gemini-3.8-flash-tts)                                                                                      | gemini/gemini-3.8-flash-tts       | narration    | 18.75% | 4.03%  | 12/0/0    | ASR differences require adjudication |
| [2026-09-25_02-tts-hard](#narration--2026-09-25_02-tts-hard--gemini-gemini-3.8-flash-lite-tts)                                                                                 | gemini/gemini-3.8-flash-lite-tts  | narration    | 17.19% | 4.03%  | 11/0/0    | ASR differences require adjudication |
| [2026-09-25_02-tts-hard](#narration--2026-09-25_02-tts-hard--soniox-tts-rt-v2)                                                                                                 | soniox/tts-rt-v2                  | narration    | 18.75% | 4.74%  | 12/0/0    | ASR differences require adjudication |
| [2026-09-25_02-tts-hard](#narration--2026-09-25_02-tts-hard--grok-grok-tts)                                                                                                    | grok/grok-tts                     | narration    | 17.19% | 4.03%  | 11/0/0    | ASR differences require adjudication |
| [2026-09-25_02-tts-hard](#narration--2026-09-25_02-tts-hard--openai-gpt-4o-mini-tts-2025-12-15)                                                                                | openai/gpt-4o-mini-tts-2025-12-15 | narration    | 15.63% | 2.84%  | 9/1/0     | ASR differences require adjudication |
| [2026-09-25_02-tts-hard](#narration--2026-09-25_02-tts-hard--inworld-realtime-tts-2)                                                                                           | inworld/realtime-tts-2            | narration    | 10.94% | 2.37%  | 7/0/0     | ASR differences require adjudication |
| [2026-09-25_03-tts-harder](#narration--2026-09-25_03-tts-harder--elevenlabs-eleven-v3)                                                                                         | elevenlabs/eleven_v3              | narration    | 10.95% | 4.43%  | 26/4/1    | ASR differences require adjudication |
| [2026-09-25_03-tts-harder](#narration--2026-09-25_03-tts-harder--gemini-gemini-3.8-flash-tts)                                                                                  | gemini/gemini-3.8-flash-tts       | narration    | 12.72% | 5.91%  | 28/3/5    | ASR differences require adjudication |
| [2026-09-25_03-tts-harder](#narration--2026-09-25_03-tts-harder--gemini-gemini-3.8-flash-lite-tts)                                                                             | gemini/gemini-3.8-flash-lite-tts  | narration    | 10.60% | 3.36%  | 25/2/3    | ASR differences require adjudication |
| [2026-09-25_03-tts-harder](#narration--2026-09-25_03-tts-harder--soniox-tts-rt-v2)                                                                                             | soniox/tts-rt-v2                  | narration    | 13.07% | 4.97%  | 31/2/4    | ASR differences require adjudication |
| [2026-09-25_03-tts-harder](#narration--2026-09-25_03-tts-harder--grok-grok-tts)                                                                                                | grok/grok-tts                     | narration    | 10.25% | 3.96%  | 24/2/3    | ASR differences require adjudication |
| [2026-09-25_03-tts-harder](#narration--2026-09-25_03-tts-harder--openai-gpt-4o-mini-tts-2025-12-15)                                                                            | openai/gpt-4o-mini-tts-2025-12-15 | narration    | 12.37% | 3.90%  | 30/3/2    | ASR differences require adjudication |
| [2026-09-25_03-tts-harder](#narration--2026-09-25_03-tts-harder--inworld-realtime-tts-2)                                                                                       | inworld/realtime-tts-2            | narration    | 15.90% | 7.45%  | 34/10/1   | ASR differences require adjudication |
| [2026-09-25_04-tts-long](#narration--2026-09-25_04-tts-long--elevenlabs-eleven-v3)                                                                                             | elevenlabs/eleven_v3              | narration    | 2.67%  | 1.31%  | 120/9/21  | ASR differences require adjudication |
| [2026-09-25_04-tts-long](#narration--2026-09-25_04-tts-long--gemini-gemini-3.8-flash-tts)                                                                                      | gemini/gemini-3.8-flash-tts       | narration    | 2.73%  | 1.14%  | 131/15/7  | ASR differences require adjudication |
| [2026-09-25_04-tts-long](#narration--2026-09-25_04-tts-long--gemini-gemini-3.8-flash-lite-tts)                                                                                 | gemini/gemini-3.8-flash-lite-tts  | narration    | 2.50%  | 0.99%  | 115/24/1  | ASR differences require adjudication |
| [2026-09-25_04-tts-long](#narration--2026-09-25_04-tts-long--soniox-tts-rt-v2)                                                                                                 | soniox/tts-rt-v2                  | narration    | 2.55%  | 1.10%  | 122/10/11 | ASR differences require adjudication |
| [2026-09-25_04-tts-long](#narration--2026-09-25_04-tts-long--grok-grok-tts)                                                                                                    | grok/grok-tts                     | narration    | 2.82%  | 1.30%  | 122/18/18 | ASR differences require adjudication |
| [2026-09-25_04-tts-long](#narration--2026-09-25_04-tts-long--openai-gpt-4o-mini-tts-2025-12-15)                                                                                | openai/gpt-4o-mini-tts-2025-12-15 | narration    | 2.60%  | 1.36%  | 106/31/9  | ASR differences require adjudication |
| [2026-09-25_04-tts-long](#narration--2026-09-25_04-tts-long--inworld-realtime-tts-2)                                                                                           | inworld/realtime-tts-2            | narration    | 2.51%  | 1.20%  | 112/17/12 | ASR differences require adjudication |
| [2026-09-25_05-tts-emotion/elevenlabs-eleven-v3-tags](#emotion--elevenlabs-eleven-v3-tags--elevenlabs-eleven-v3)                                                               | elevenlabs/eleven_v3              | emotion      | 0.00%  | 0.00%  | 0/0/0     | No normalized ASR differences        |
| [2026-09-25_05-tts-emotion/gemini-gemini-3.8-flash-lite-tts-instructions](#emotion--gemini-gemini-3.8-flash-lite-tts-instructions--gemini-gemini-3.8-flash-lite-tts)           | gemini/gemini-3.8-flash-lite-tts  | emotion      | 0.00%  | 0.00%  | 0/0/0     | No normalized ASR differences        |
| [2026-09-25_05-tts-emotion/gemini-gemini-3.8-flash-tts-instructions](#emotion--gemini-gemini-3.8-flash-tts-instructions--gemini-gemini-3.8-flash-tts)                          | gemini/gemini-3.8-flash-tts       | emotion      | 2.94%  | 1.95%  | 0/0/1     | ASR differences require adjudication |
| [2026-09-25_05-tts-emotion/grok-grok-tts-delivery](#emotion--grok-grok-tts-delivery--grok-grok-tts)                                                                            | grok/grok-tts                     | emotion      | 0.00%  | 0.00%  | 0/0/0     | No normalized ASR differences        |
| [2026-09-25_05-tts-emotion/inworld-realtime-tts-2-instructions](#emotion--inworld-realtime-tts-2-instructions--inworld-realtime-tts-2)                                         | inworld/realtime-tts-2            | emotion      | 0.00%  | 0.00%  | 0/0/0     | No normalized ASR differences        |
| [2026-09-25_05-tts-emotion/soniox-tts-rt-v2-emotion-tags](#emotion--soniox-tts-rt-v2-emotion-tags--soniox-tts-rt-v2)                                                           | soniox/tts-rt-v2                  | emotion      | 0.00%  | 0.00%  | 0/0/0     | No normalized ASR differences        |
| [2026-09-25_06-tts-speed-pauses/gemini-gemini-3.8-flash-lite-tts-instructions](#speed-pauses--gemini-gemini-3.8-flash-lite-tts-instructions--gemini-gemini-3.8-flash-lite-tts) | gemini/gemini-3.8-flash-lite-tts  | speed-pauses | 4.76%  | 5.85%  | 0/0/2     | ASR differences require adjudication |
| [2026-09-25_06-tts-speed-pauses/gemini-gemini-3.8-flash-tts-instructions](#speed-pauses--gemini-gemini-3.8-flash-tts-instructions--gemini-gemini-3.8-flash-tts)                | gemini/gemini-3.8-flash-tts       | speed-pauses | 0.00%  | 0.00%  | 0/0/0     | No normalized ASR differences        |
| [2026-09-25_06-tts-speed-pauses/grok-grok-tts-numeric](#speed-pauses--grok-grok-tts-numeric--grok-grok-tts)                                                                    | grok/grok-tts                     | speed-pauses | 35.71% | 30.32% | 15/0/0    | ASR differences require adjudication |
| [2026-09-25_06-tts-speed-pauses/grok-grok-tts-tags](#speed-pauses--grok-grok-tts-tags--grok-grok-tts)                                                                          | grok/grok-tts                     | speed-pauses | 7.14%  | 6.91%  | 0/3/0     | ASR differences require adjudication |
| [2026-09-25_06-tts-speed-pauses/inworld-realtime-tts-2-instructions](#speed-pauses--inworld-realtime-tts-2-instructions--inworld-realtime-tts-2)                               | inworld/realtime-tts-2            | speed-pauses | 2.38%  | 0.53%  | 1/0/0     | ASR differences require adjudication |
| [2026-09-25_06-tts-speed-pauses/inworld-realtime-tts-2-steering-tags](#speed-pauses--inworld-realtime-tts-2-steering-tags--inworld-realtime-tts-2)                             | inworld/realtime-tts-2            | speed-pauses | 0.00%  | 0.00%  | 0/0/0     | No normalized ASR differences        |
| [2026-09-25_06-tts-speed-pauses/soniox-tts-rt-v2-numeric](#speed-pauses--soniox-tts-rt-v2-numeric--soniox-tts-rt-v2)                                                           | soniox/tts-rt-v2                  | speed-pauses | 7.14%  | 6.91%  | 0/3/0     | ASR differences require adjudication |
| [2026-09-25_06-tts-speed-pauses/soniox-tts-rt-v2-pacing-tags](#speed-pauses--soniox-tts-rt-v2-pacing-tags--soniox-tts-rt-v2)                                                   | soniox/tts-rt-v2                  | speed-pauses | 42.86% | 37.23% | 15/3/0    | ASR differences require adjudication |

<a id="narration--2026-09-25_01-tts-short--elevenlabs-eleven-v3"></a>
### 2026-09-25_01-tts-short — elevenlabs/eleven_v3

[Approved MP3 playback](2026-09-25_01-tts-short/speech-elevenlabs-eleven_v3.mp3); [manifest](2026-09-25_01-tts-short/manifest.json); source: input/examples/tts/01-tts-short.md. Assessed original WAV SHA-256: `310aae9320a76f1c005145a486b9e6e467859fcc85bdf41c95e5d3b9e176e090`. Input SHA-256: `7ee6b18343ea3080272910139a472f9b40262e41a5d9c23bea454a0866fc87a1`. Render: `54a4383eabfda31b33e1df28a7623bcb2c0a3e2dd26f3cd0e90d2f0cfb376ff2`; result: `fe9a6c6607c05a722ce62f77962ad85b5cff9cd2a378d7a76b094cf5ba9696c6`. Transcript: `transcripts/narration--2026-09-25_01-tts-short--elevenlabs-eleven-v3.txt` (SHA-256 `3fcb4b2372f9d907a0395f95726ae7c4c24bc620b00c9bf4f21f40f49507cb00`).

Full waveform decoding succeeded. ASR WER 0.00%, CER 0.00%, substitutions/deletions/insertions 0/0/0 over 15 reference words. No normalized ASR differences. These differences are ASR evidence, not confirmed synthesis errors.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_01-tts-short--gemini-gemini-3.8-flash-tts"></a>
### 2026-09-25_01-tts-short — gemini/gemini-3.8-flash-tts

[Approved MP3 playback](2026-09-25_01-tts-short/speech-gemini-gemini-3.8-flash-tts.mp3); [manifest](2026-09-25_01-tts-short/manifest.json); source: input/examples/tts/01-tts-short.md. Assessed original WAV SHA-256: `c7d021541600a805cdd0f6710794920af3bbe051a4b297fbe7d80e5ebe823990`. Input SHA-256: `7ee6b18343ea3080272910139a472f9b40262e41a5d9c23bea454a0866fc87a1`. Render: `6d3114166aba5a84cadab7bdfb13e7e80c2399a58920f094ef79d10393ff1fef`; result: `7306b85b1952477533eb1dc698071a69908ae52fefa951138190f49f9fd9b0dd`. Transcript: `transcripts/narration--2026-09-25_01-tts-short--gemini-gemini-3.8-flash-tts.txt` (SHA-256 `3d7cb49eadccb88e7721df4ffe558f5defa4ba55e20b21d138f486c00d1af790`).

Full waveform decoding succeeded. ASR WER 6.67%, CER 1.16%, substitutions/deletions/insertions 1/0/0 over 15 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: substitution "autoshow" → "autoshot". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_01-tts-short--gemini-gemini-3.8-flash-lite-tts"></a>
### 2026-09-25_01-tts-short — gemini/gemini-3.8-flash-lite-tts

[Approved MP3 playback](2026-09-25_01-tts-short/speech-gemini-gemini-3.8-flash-lite-tts.mp3); [manifest](2026-09-25_01-tts-short/manifest.json); source: input/examples/tts/01-tts-short.md. Assessed original WAV SHA-256: `c4b43e1c457bb17a6698b71e3c47c0fc5ae58b90d592fb8b585316adc61948a5`. Input SHA-256: `7ee6b18343ea3080272910139a472f9b40262e41a5d9c23bea454a0866fc87a1`. Render: `05e16e1560c59e4eaa90a687a697c8b45b97edd326c5ebdeaa24966ad9351b9f`; result: `4325fcdbab83d0d4c21ff270bb29f37d36f3be1459a894f8e0cdba23d4e083c5`. Transcript: `transcripts/narration--2026-09-25_01-tts-short--gemini-gemini-3.8-flash-lite-tts.txt` (SHA-256 `40e5145e286b0793a6adc1bf8991f2f81247ee3741e97c9bc964d3e2ce907ed3`).

Full waveform decoding succeeded. ASR WER 0.00%, CER 0.00%, substitutions/deletions/insertions 0/0/0 over 15 reference words. No normalized ASR differences. These differences are ASR evidence, not confirmed synthesis errors.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_01-tts-short--inworld-realtime-tts-2"></a>
### 2026-09-25_01-tts-short — inworld/realtime-tts-2

[Approved MP3 playback](2026-09-25_01-tts-short/speech-inworld-realtime-tts-2.mp3); [manifest](2026-09-25_01-tts-short/manifest.json); source: input/examples/tts/01-tts-short.md. Assessed original WAV SHA-256: `5b542f804be1f1d415bb9115626be3d5ebb17e549a6e3af9c43e162bee1c7ee1`. Input SHA-256: `7ee6b18343ea3080272910139a472f9b40262e41a5d9c23bea454a0866fc87a1`. Render: `f910d4a40cacc450f55797cf725f4f4e999a4524fe0b2573c41bce68913897f1`; result: `12e89d163be3edff799cbeda361863920a0ec8d129fb4f5a0db4e95f08ecc8f4`. Transcript: `transcripts/narration--2026-09-25_01-tts-short--inworld-realtime-tts-2.txt` (SHA-256 `3fcb4b2372f9d907a0395f95726ae7c4c24bc620b00c9bf4f21f40f49507cb00`).

Full waveform decoding succeeded. ASR WER 0.00%, CER 0.00%, substitutions/deletions/insertions 0/0/0 over 15 reference words. No normalized ASR differences. These differences are ASR evidence, not confirmed synthesis errors.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_01-tts-short--openai-gpt-4o-mini-tts-2025-12-15"></a>
### 2026-09-25_01-tts-short — openai/gpt-4o-mini-tts-2025-12-15

[Approved MP3 playback](2026-09-25_01-tts-short/reruns/timing-2026-09-25/speech-openai-gpt-4o-mini-tts-2025-12-15.mp3); [manifest](2026-09-25_01-tts-short/reruns/timing-2026-09-25/manifest.json); source: input/examples/tts/01-tts-short.md. Assessed original WAV SHA-256: `ff6cfd98efd1240b26a3334397aa4082a8ecd5e1e6800df3dae17e990367d5f0`. Input SHA-256: `7ee6b18343ea3080272910139a472f9b40262e41a5d9c23bea454a0866fc87a1`. Render: `630114ee264cea9748bf880ad741b64df57639d6003a88bd30c0387286512d2b`; result: `9767cc4f8ff2576db36e430574ff4a3af7482f6506da8dff3a078b95117d6e14`. Transcript: `transcripts/narration--2026-09-25_01-tts-short--openai-gpt-4o-mini-tts-2025-12-15.txt` (SHA-256 `40e5145e286b0793a6adc1bf8991f2f81247ee3741e97c9bc964d3e2ce907ed3`).

Full waveform decoding succeeded. ASR WER 0.00%, CER 0.00%, substitutions/deletions/insertions 0/0/0 over 15 reference words. No normalized ASR differences. These differences are ASR evidence, not confirmed synthesis errors.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_01-tts-short--soniox-tts-rt-v2"></a>
### 2026-09-25_01-tts-short — soniox/tts-rt-v2

[Approved MP3 playback](2026-09-25_01-tts-short/reruns/timing-2026-09-25/speech-soniox-tts-rt-v2.mp3); [manifest](2026-09-25_01-tts-short/reruns/timing-2026-09-25/manifest.json); source: input/examples/tts/01-tts-short.md. Assessed original WAV SHA-256: `126b35229804009e543b854f2fb4cd44bb8af01b5b8d2c211662982af73240ee`. Input SHA-256: `7ee6b18343ea3080272910139a472f9b40262e41a5d9c23bea454a0866fc87a1`. Render: `0728651a5f601857fee004e1424d9efc884cb52591bd7cc74d698279a5dca05d`; result: `8ab839230ef1bc436fc3c1cc9f9e4dfb5659d574302e8dc15a109eb8adcfe1d5`. Transcript: `transcripts/narration--2026-09-25_01-tts-short--soniox-tts-rt-v2.txt` (SHA-256 `40e5145e286b0793a6adc1bf8991f2f81247ee3741e97c9bc964d3e2ce907ed3`).

Full waveform decoding succeeded. ASR WER 0.00%, CER 0.00%, substitutions/deletions/insertions 0/0/0 over 15 reference words. No normalized ASR differences. These differences are ASR evidence, not confirmed synthesis errors.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_01-tts-short--grok-grok-tts"></a>
### 2026-09-25_01-tts-short — grok/grok-tts

[Approved MP3 playback](2026-09-25_01-tts-short/reruns/timing-2026-09-25/speech-grok-grok-tts.mp3); [manifest](2026-09-25_01-tts-short/reruns/timing-2026-09-25/manifest.json); source: input/examples/tts/01-tts-short.md. Assessed original WAV SHA-256: `8443dbf99afb4e74a00cad4e17379959d32f4a74dbfead798ba5af158b73b4d0`. Input SHA-256: `7ee6b18343ea3080272910139a472f9b40262e41a5d9c23bea454a0866fc87a1`. Render: `4bedff6eb30c7cb12973524b66ebcfdac030ff1ed8c381b6fc09c825a56499f2`; result: `b5aab16b3930cf81bff924ea57fff7c842d690c7ed65ab654732ded6c4e9dddd`. Transcript: `transcripts/narration--2026-09-25_01-tts-short--grok-grok-tts.txt` (SHA-256 `3fcb4b2372f9d907a0395f95726ae7c4c24bc620b00c9bf4f21f40f49507cb00`).

Full waveform decoding succeeded. ASR WER 0.00%, CER 0.00%, substitutions/deletions/insertions 0/0/0 over 15 reference words. No normalized ASR differences. These differences are ASR evidence, not confirmed synthesis errors.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_02-tts-hard--elevenlabs-eleven-v3"></a>
### 2026-09-25_02-tts-hard — elevenlabs/eleven_v3

[Approved MP3 playback](2026-09-25_02-tts-hard/speech-elevenlabs-eleven_v3.mp3); [manifest](2026-09-25_02-tts-hard/manifest.json); source: input/examples/tts/02-tts-hard.md. Assessed original WAV SHA-256: `f6968ad47220baed4015b8aeeec1a95d9e91913e015036c7268885c19e1e6b18`. Input SHA-256: `333a0292c213dd8e4497f9bcd99cacbb6a66217f3c8f330505989a56a8ca1a23`. Render: `0a8a4b12e84cf0bd69f5e3d9335dc612e2992bf8f279c994ee67183a02bbc9c1`; result: `151d3121fb67ff9e39402af751b45f57070b0d275941d0741f531a751d5b7a62`. Transcript: `transcripts/narration--2026-09-25_02-tts-hard--elevenlabs-eleven-v3.txt` (SHA-256 `00e5f70cd387fd1efdff689b1692705b8f36eb4a253fa4e4e01ecba651905483`).

Full waveform decoding succeeded. ASR WER 15.63%, CER 3.55%, substitutions/deletions/insertions 10/0/0 over 64 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: substitution "queued" → "cued"; substitution "crêpes" → "crepes"; substitution "piñatas" → "pinatas"; substitution "jalapeños" → "jalapenos"; substitution "façades" → "facades"; substitution "naïve" → "naive"; substitution "résumés" → "resumes"; substitution "pâté" → "pate"; substitution "crème" → "creme"; substitution "brûlée" → "brulee". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_02-tts-hard--gemini-gemini-3.8-flash-tts"></a>
### 2026-09-25_02-tts-hard — gemini/gemini-3.8-flash-tts

[Approved MP3 playback](2026-09-25_02-tts-hard/speech-gemini-gemini-3.8-flash-tts.mp3); [manifest](2026-09-25_02-tts-hard/manifest.json); source: input/examples/tts/02-tts-hard.md. Assessed original WAV SHA-256: `5feb940aaba5c2a49e2124b502a7990e600f0b65f200eea73b17115ca57e9883`. Input SHA-256: `333a0292c213dd8e4497f9bcd99cacbb6a66217f3c8f330505989a56a8ca1a23`. Render: `6e29bdbdc5f351113ed5557c176a98dac55a566573e4b52dc2e1992e9ad9385e`; result: `a8ea448b800c5b640434c49bf5348368df2b5a7c4b0a28d7d0de3ca8ba09ce21`. Transcript: `transcripts/narration--2026-09-25_02-tts-hard--gemini-gemini-3.8-flash-tts.txt` (SHA-256 `53620f3ee0025f46588c2cf50ec0642e2d33b4bf4e45cb9219d4598091cb43be`).

Full waveform decoding succeeded. ASR WER 18.75%, CER 4.03%, substitutions/deletions/insertions 12/0/0 over 64 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: substitution "29" → "29th"; substitution "isthmus" → "ithsmus"; substitution "crêpes" → "crepes"; substitution "soufflés" → "souffles"; substitution "piñatas" → "pinatas"; substitution "jalapeños" → "jalapenos"; substitution "façades" → "facades"; substitution "naïve" → "naive"; substitution "résumés" → "resumes"; substitution "pâté" → "pate"; substitution "crème" → "creme"; substitution "brûlée" → "brulee". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_02-tts-hard--gemini-gemini-3.8-flash-lite-tts"></a>
### 2026-09-25_02-tts-hard — gemini/gemini-3.8-flash-lite-tts

[Approved MP3 playback](2026-09-25_02-tts-hard/speech-gemini-gemini-3.8-flash-lite-tts.mp3); [manifest](2026-09-25_02-tts-hard/manifest.json); source: input/examples/tts/02-tts-hard.md. Assessed original WAV SHA-256: `482a933d0cc15832d3acbce1d6925b6d36513950e0b1860ce9a9b5f0225ce43b`. Input SHA-256: `333a0292c213dd8e4497f9bcd99cacbb6a66217f3c8f330505989a56a8ca1a23`. Render: `082c186ddf75e92565925b99fc9caac8acf3fcbd0764948758bc804b57875b8f`; result: `c95dc1955f331dcadd9e572446e56ed3693043005dc833a2da51bd0ca266fdfa`. Transcript: `transcripts/narration--2026-09-25_02-tts-hard--gemini-gemini-3.8-flash-lite-tts.txt` (SHA-256 `acb8cf9df34d0bc5c3ad6d4d367fabb0a418fbbb029e64a9781a48b0746097b6`).

Full waveform decoding succeeded. ASR WER 17.19%, CER 4.03%, substitutions/deletions/insertions 11/0/0 over 64 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: substitution "29" → "29th"; substitution "ejiofor" → "ejifor"; substitution "crêpes" → "crepes"; substitution "soufflés" → "souffles"; substitution "piñatas" → "pinatas"; substitution "façades" → "facades"; substitution "naïve" → "naive"; substitution "résumés" → "resumes"; substitution "pâté" → "pate"; substitution "crème" → "creme"; substitution "brûlée" → "roule". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_02-tts-hard--soniox-tts-rt-v2"></a>
### 2026-09-25_02-tts-hard — soniox/tts-rt-v2

[Approved MP3 playback](2026-09-25_02-tts-hard/speech-soniox-tts-rt-v2.mp3); [manifest](2026-09-25_02-tts-hard/manifest.json); source: input/examples/tts/02-tts-hard.md. Assessed original WAV SHA-256: `9dbfefd4ed32e0855600511a326bb15250226844dba687daf6773353512cbd21`. Input SHA-256: `333a0292c213dd8e4497f9bcd99cacbb6a66217f3c8f330505989a56a8ca1a23`. Render: `35c68fb542ddb3d81b7ed95415f1c1a4e92b3c6414994a39d9e5bab80a0a7c85`; result: `a08bf8a52aa7afed79ffe097aff082a8201e2a5c74bfa05d3cdc45da9395d50c`. Transcript: `transcripts/narration--2026-09-25_02-tts-hard--soniox-tts-rt-v2.txt` (SHA-256 `8f4bb340d404dbd2cc8ad13c313beccb907a1b46119c8968a17c2a2577b15a1e`).

Full waveform decoding succeeded. ASR WER 18.75%, CER 4.74%, substitutions/deletions/insertions 12/0/0 over 64 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: substitution "chiwetel" → "chewettle"; substitution "ejiofor" → "egeofor"; substitution "crêpes" → "crepes"; substitution "soufflés" → "souffle"; substitution "piñatas" → "pinatas"; substitution "jalapeños" → "jalapenos"; substitution "façades" → "facades"; substitution "naïve" → "naive"; substitution "résumés" → "resume"; substitution "pâté" → "pate"; substitution "crème" → "creme"; substitution "brûlée" → "brulee". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_02-tts-hard--grok-grok-tts"></a>
### 2026-09-25_02-tts-hard — grok/grok-tts

[Approved MP3 playback](2026-09-25_02-tts-hard/speech-grok-grok-tts.mp3); [manifest](2026-09-25_02-tts-hard/manifest.json); source: input/examples/tts/02-tts-hard.md. Assessed original WAV SHA-256: `3497807ab499b08e1c29d191e2e8cabbe806ec77839c4798717145ef9dfe4c90`. Input SHA-256: `333a0292c213dd8e4497f9bcd99cacbb6a66217f3c8f330505989a56a8ca1a23`. Render: `02b60ebcab32e795f9c8fc6e756df134bcb62c790f39386ca99cb139dea840b5`; result: `22790fd9e48e6c1d19b3ed02eb2b7452e3c970c8223326bff9b365b10ae7cc13`. Transcript: `transcripts/narration--2026-09-25_02-tts-hard--grok-grok-tts.txt` (SHA-256 `4003b493f8f54d8b1e8458bb769957a59fa76aea8903f92ba50f167536134772`).

Full waveform decoding succeeded. ASR WER 17.19%, CER 4.03%, substitutions/deletions/insertions 11/0/0 over 64 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: substitution "chiwetel" → "tewetel"; substitution "ejiofor" → "eggiofor"; substitution "crêpes" → "crepes"; substitution "soufflés" → "souffles"; substitution "piñatas" → "pinatas"; substitution "façades" → "facades"; substitution "naïve" → "naive"; substitution "résumés" → "resumes"; substitution "pâté" → "pate"; substitution "crème" → "creme"; substitution "brûlée" → "brulee". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_02-tts-hard--openai-gpt-4o-mini-tts-2025-12-15"></a>
### 2026-09-25_02-tts-hard — openai/gpt-4o-mini-tts-2025-12-15

[Approved MP3 playback](2026-09-25_02-tts-hard/speech-openai-gpt-4o-mini-tts-2025-12-15.mp3); [manifest](2026-09-25_02-tts-hard/manifest.json); source: input/examples/tts/02-tts-hard.md. Assessed original WAV SHA-256: `3fbde90b3fac64117673ce3d4197bb700628034a3b919b951ab2c08ae7f80a0f`. Input SHA-256: `333a0292c213dd8e4497f9bcd99cacbb6a66217f3c8f330505989a56a8ca1a23`. Render: `82347b147b8f284cb615c95dbbbdfe6a0601dfce482eb8328574b6a228b87e07`; result: `1e2813980530b6ddbd8ec1d6542786319b61127fcce6f00270b034f86b0413b8`. Transcript: `transcripts/narration--2026-09-25_02-tts-hard--openai-gpt-4o-mini-tts-2025-12-15.txt` (SHA-256 `23a52190f3796e65e3e1cfcf19ee08ee03162fe64d058baf57ccaf4c17a9adae`).

Full waveform decoding succeeded. ASR WER 15.63%, CER 2.84%, substitutions/deletions/insertions 9/1/0 over 64 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: deletion "12" → ""; substitution "06" → "1206"; substitution "29" → "29th"; substitution "crêpes" → "crepes"; substitution "soufflés" → "souffles"; substitution "piñatas" → "pinatas"; substitution "façades" → "facades"; substitution "naïve" → "naive"; substitution "résumés" → "resumes"; substitution "pâté" → "pate". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_02-tts-hard--inworld-realtime-tts-2"></a>
### 2026-09-25_02-tts-hard — inworld/realtime-tts-2

[Approved MP3 playback](2026-09-25_02-tts-hard/speech-inworld-realtime-tts-2.mp3); [manifest](2026-09-25_02-tts-hard/manifest.json); source: input/examples/tts/02-tts-hard.md. Assessed original WAV SHA-256: `cd76f235bd1fe7e42097678d8243d381ba84c5d68e5604e56ff59f62e275c93e`. Input SHA-256: `333a0292c213dd8e4497f9bcd99cacbb6a66217f3c8f330505989a56a8ca1a23`. Render: `51d266629200c060dc56df284bc0206e168639f787def9a7f4d2e793c284bdc5`; result: `cc4d1953e5c190d9a429de38ac403e06049a1244ea05b72cfc33b7e5fac31476`. Transcript: `transcripts/narration--2026-09-25_02-tts-hard--inworld-realtime-tts-2.txt` (SHA-256 `ec3c70c7c217a2303e1746dc29484e0258a2a51961b80dfe5debc698b68ff186`).

Full waveform decoding succeeded. ASR WER 10.94%, CER 2.37%, substitutions/deletions/insertions 7/0/0 over 64 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: substitution "crêpes" → "crepes"; substitution "façades" → "facades"; substitution "naïve" → "naive"; substitution "résumés" → "resumes"; substitution "pâté" → "pate"; substitution "crème" → "creme"; substitution "brûlée" → "brulee". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_03-tts-harder--elevenlabs-eleven-v3"></a>
### 2026-09-25_03-tts-harder — elevenlabs/eleven_v3

[Approved MP3 playback](2026-09-25_03-tts-harder/speech-elevenlabs-eleven_v3.mp3); [manifest](2026-09-25_03-tts-harder/manifest.json); source: input/examples/tts/03-tts-harder.txt. Assessed original WAV SHA-256: `0acd67dcc91b8e31d915bf4edd311070e6f73e6da509ef441645377e690a6c72`. Input SHA-256: `366d95903eadea04b50f9eb9235a9ae3d76e8abf8b14a8fd5a681b700d504d94`. Render: `83194ac478ff06d43b88dc7d1130244e0cd6a0004be8cfc717f67242678cbe16`; result: `975c5be78ea6d4bc2090ddbf0de077a82df0df8622c0fef5845e16fc68ae58aa`. Transcript: `transcripts/narration--2026-09-25_03-tts-harder--elevenlabs-eleven-v3.txt` (SHA-256 `fa1f1c6c8f65136b20823ddb37d56f218ca32ac2352fdeb4dcbe1b4acf918287`).

Full waveform decoding succeeded. ASR WER 10.95%, CER 4.43%, substitutions/deletions/insertions 26/4/1 over 283 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: substitution "4" → "4th"; substitution "anaïs" → "anais"; substitution "résumé" → "resume"; substitution "xiǎomí" → "xiaoming"; substitution "professor" → "senator"; substitution "maría" → "maria"; deletion "días" → ""; deletion "ça" → ""; substitution "va" → "dias"; substitution "grüß" → "savas"; substitution "gott" → "gruscote"; substitution "jalapeño" → "jalapeno". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_03-tts-harder--gemini-gemini-3.8-flash-tts"></a>
### 2026-09-25_03-tts-harder — gemini/gemini-3.8-flash-tts

[Approved MP3 playback](2026-09-25_03-tts-harder/speech-gemini-gemini-3.8-flash-tts.mp3); [manifest](2026-09-25_03-tts-harder/manifest.json); source: input/examples/tts/03-tts-harder.txt. Assessed original WAV SHA-256: `66e28a2e0be954154f0005644b49c7e1efdc57f83f0da88fc85fec612d439896`. Input SHA-256: `366d95903eadea04b50f9eb9235a9ae3d76e8abf8b14a8fd5a681b700d504d94`. Render: `94d543b1eb07b3c3caf73b32403cd4825bddd32d52434d6bb938a2b4dd541922`; result: `553390cac69b166892158189272a5e3b7e606dd9fd857ba93aa8c318800cbd75`. Transcript: `transcripts/narration--2026-09-25_03-tts-harder--gemini-gemini-3.8-flash-tts.txt` (SHA-256 `faca61d45326bba3d3a592338786a93293c1fd17428c5883c2e55a20745c4492`).

Full waveform decoding succeeded. ASR WER 12.72%, CER 5.91%, substitutions/deletions/insertions 28/3/5 over 283 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: substitution "anaïs" → "anise"; substitution "no" → "number"; substitution "résumé" → "resume"; substitution "xiǎomí" → "xiaomi"; insertion "" → "pounds"; insertion "" → "and"; insertion "" → "cents"; substitution "maría" → "maria"; substitution "josé" → "jose"; deletion "días" → ""; deletion "ça" → ""; substitution "va" → "dias". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_03-tts-harder--gemini-gemini-3.8-flash-lite-tts"></a>
### 2026-09-25_03-tts-harder — gemini/gemini-3.8-flash-lite-tts

[Approved MP3 playback](2026-09-25_03-tts-harder/speech-gemini-gemini-3.8-flash-lite-tts.mp3); [manifest](2026-09-25_03-tts-harder/manifest.json); source: input/examples/tts/03-tts-harder.txt. Assessed original WAV SHA-256: `0d3ba80139663724a2321f3a5f6a83ee6b90a250143492f51a08f27fcabbc64f`. Input SHA-256: `366d95903eadea04b50f9eb9235a9ae3d76e8abf8b14a8fd5a681b700d504d94`. Render: `881ae52cac94a8868726735003060028120e17c1b2a6130f84a894087959de50`; result: `85518cab22822d4705ae935e291cbcd57440cf55bf37a37e5ac124f7cbd7f8a0`. Transcript: `transcripts/narration--2026-09-25_03-tts-harder--gemini-gemini-3.8-flash-lite-tts.txt` (SHA-256 `ed4eb6376ffa708a9d21bcdeba9e1c8fd7711527daeb37b30e8a12860c766213`).

Full waveform decoding succeeded. ASR WER 10.60%, CER 3.36%, substitutions/deletions/insertions 25/2/3 over 283 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: substitution "anaïs" → "anais"; substitution "résumé" → "resume"; substitution "xiǎomí" → "xiaomi"; substitution "nguyen" → "nuyen"; substitution "maría" → "maria"; substitution "josé" → "jose"; deletion "ça" → ""; deletion "va" → ""; substitution "grüß" → "sava"; substitution "gott" → "gruscat"; substitution "jalapeño" → "jalapeno"; substitution "açai" → "acai". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_03-tts-harder--soniox-tts-rt-v2"></a>
### 2026-09-25_03-tts-harder — soniox/tts-rt-v2

[Approved MP3 playback](2026-09-25_03-tts-harder/speech-soniox-tts-rt-v2.mp3); [manifest](2026-09-25_03-tts-harder/manifest.json); source: input/examples/tts/03-tts-harder.txt. Assessed original WAV SHA-256: `cb2e76c3efedf141cf4a76d9a36fb3b74446cb6c76b6115b66a08c4889891780`. Input SHA-256: `366d95903eadea04b50f9eb9235a9ae3d76e8abf8b14a8fd5a681b700d504d94`. Render: `50fae12ca50d82185d1e5081f78618fe27556ebe821969f367329a6553ab67c1`; result: `8b1fc0619b7ff87b8267fd92bff46f28e7af05d35ab900e62eba2286c714e2b1`. Transcript: `transcripts/narration--2026-09-25_03-tts-harder--soniox-tts-rt-v2.txt` (SHA-256 `7eebe666777df14fa8823b011ea0909334f6ef37b60110097f0f47e35660e0e3`).

Full waveform decoding succeeded. ASR WER 13.07%, CER 4.97%, substitutions/deletions/insertions 31/2/4 over 283 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: substitution "anaïs" → "anayas"; substitution "no" → "number"; substitution "résumé" → "resume"; substitution "xiǎomí" → "xiaming"; substitution "nguyen" → "wen"; insertion "" → "4"; substitution "42" → "2"; substitution "maría" → "maria"; substitution "josé" → "jose"; deletion "días" → ""; deletion "ça" → ""; substitution "va" → "dias". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_03-tts-harder--grok-grok-tts"></a>
### 2026-09-25_03-tts-harder — grok/grok-tts

[Approved MP3 playback](2026-09-25_03-tts-harder/speech-grok-grok-tts.mp3); [manifest](2026-09-25_03-tts-harder/manifest.json); source: input/examples/tts/03-tts-harder.txt. Assessed original WAV SHA-256: `c5dc6c9ebdc53ffbf4066c992e5372981f16e0af728ed719c11c1bc3e55cb634`. Input SHA-256: `366d95903eadea04b50f9eb9235a9ae3d76e8abf8b14a8fd5a681b700d504d94`. Render: `18b86957bdb6cea4ac000d3fcd30850f90974629e0cfee9a0d0f8893859b6a50`; result: `9098163f4f5331a698c4aac68d7d54c619113af41f80028b33890b085c48de84`. Transcript: `transcripts/narration--2026-09-25_03-tts-harder--grok-grok-tts.txt` (SHA-256 `6fd2956343db05501106de4516fb49d5f2eccc17dab0dd6a05edf13dc7637cbf`).

Full waveform decoding succeeded. ASR WER 10.25%, CER 3.96%, substitutions/deletions/insertions 24/2/3 over 283 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: insertion "" → "anna"; substitution "anaïs" → "ease"; substitution "no" → "number"; substitution "résumé" → "resume"; insertion "" → "shao"; substitution "xiǎomí" → "mi"; substitution "maría" → "maria"; substitution "josé" → "jose"; deletion "días" → ""; deletion "ça" → ""; substitution "va" → "dias"; substitution "grüß" → "sava". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_03-tts-harder--openai-gpt-4o-mini-tts-2025-12-15"></a>
### 2026-09-25_03-tts-harder — openai/gpt-4o-mini-tts-2025-12-15

[Approved MP3 playback](2026-09-25_03-tts-harder/speech-openai-gpt-4o-mini-tts-2025-12-15.mp3); [manifest](2026-09-25_03-tts-harder/manifest.json); source: input/examples/tts/03-tts-harder.txt. Assessed original WAV SHA-256: `bb511e7e6864163daa4513f3b0edc8fa224f7c1712abbc3125659e913c2371a1`. Input SHA-256: `366d95903eadea04b50f9eb9235a9ae3d76e8abf8b14a8fd5a681b700d504d94`. Render: `c6ffee51cf1760838cd998b5f5e64b5ce558eebf64478803f6fa4a6d5d4d8ce3`; result: `86a91a9ccdba441618153c4a9dc43af1e9840ee98f92c7ac498a82974567ef3c`. Transcript: `transcripts/narration--2026-09-25_03-tts-harder--openai-gpt-4o-mini-tts-2025-12-15.txt` (SHA-256 `c191c5da5c00a9fec920caf8623d0d5fedf5d8a71a0f3d5e827d353701d197ea`).

Full waveform decoding succeeded. ASR WER 12.37%, CER 3.90%, substitutions/deletions/insertions 30/3/2 over 283 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: substitution "4" → "4th"; substitution "anaïs" → "anais"; substitution "no" → "number"; substitution "bass" → "base"; substitution "résumé" → "resume"; substitution "xiǎomí" → "xiaomi"; substitution "nguyen" → "nien"; substitution "polish" → "polished"; deletion "ph" → ""; substitution "d" → "phd"; substitution "maría" → "maria"; substitution "josé" → "jose". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_03-tts-harder--inworld-realtime-tts-2"></a>
### 2026-09-25_03-tts-harder — inworld/realtime-tts-2

[Approved MP3 playback](2026-09-25_03-tts-harder/speech-inworld-realtime-tts-2.mp3); [manifest](2026-09-25_03-tts-harder/manifest.json); source: input/examples/tts/03-tts-harder.txt. Assessed original WAV SHA-256: `83d10abe8f873bb676f9f8535bfc31403fbaae677079e9f025710106a26c9157`. Input SHA-256: `366d95903eadea04b50f9eb9235a9ae3d76e8abf8b14a8fd5a681b700d504d94`. Render: `7f8d010cf7817570c0d48105cc5e21e79ddd869b2236ea7de475b54dbe016c6f`; result: `fcf6ba66bba535f256875a98cf216452c93a626661ef925553750874deebda18`. Transcript: `transcripts/narration--2026-09-25_03-tts-harder--inworld-realtime-tts-2.txt` (SHA-256 `c3a301d686e97ae4e53eafabcf34d32d5e9ac2df27d95b5e2891c326679d40ba`).

Full waveform decoding succeeded. ASR WER 15.90%, CER 7.45%, substitutions/deletions/insertions 34/10/1 over 283 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: substitution "anaïs" → "anais"; substitution "no" → "number"; substitution "résumé" → "resume"; substitution "asked" → "ask"; substitution "xiǎomí" → "xiaoming"; substitution "nguyen" → "winen"; deletion "89" → ""; deletion "unless" → ""; deletion "the" → ""; deletion "london" → ""; deletion "office" → ""; deletion "meant" → "". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_04-tts-long--elevenlabs-eleven-v3"></a>
### 2026-09-25_04-tts-long — elevenlabs/eleven_v3

[Approved MP3 playback](2026-09-25_04-tts-long/speech-elevenlabs-eleven_v3.mp3); [manifest](2026-09-25_04-tts-long/manifest.json); source: input/examples/tts/04-tts-long.txt. Assessed original WAV SHA-256: `dd50e2e57ab62ffefe76b3c1ae838b7df3fd71a69b6125ca7c2b9cd32007e261`. Input SHA-256: `a5eff588bb530fbfdf9c8890f74369e604b364b1501a0c2a4ecd22851358e8bb`. Render: `914475a0550030642dae66a4f2441279f94f86ec4905fea9e4652efbda33428a`; result: `3f6e872378d85514acbec6179fa2789308c1ff04a0c9ad4da9a8e56aa539eff6`. Transcript: `transcripts/narration--2026-09-25_04-tts-long--elevenlabs-eleven-v3.txt` (SHA-256 `804d2a38543a923f49565a303fa397f848cae762de83c83aa84e93332f4d9610`).

Full waveform decoding succeeded. ASR WER 2.67%, CER 1.31%, substitutions/deletions/insertions 120/9/21 over 5608 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: substitution "ferry" → "fairy"; deletion "p" → ""; substitution "m" → "pm"; substitution "15" → "15th"; substitution "forty" → "40"; substitution "niamh" → "nieve"; substitution "anika" → "annika"; substitution "niamh" → "nieve"; substitution "anika" → "annika"; substitution "anika" → "annika"; substitution "9" → "nine"; substitution "3" → "three". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_04-tts-long--gemini-gemini-3.8-flash-tts"></a>
### 2026-09-25_04-tts-long — gemini/gemini-3.8-flash-tts

[Approved MP3 playback](2026-09-25_04-tts-long/speech-gemini-gemini-3.8-flash-tts.mp3); [manifest](2026-09-25_04-tts-long/manifest.json); source: input/examples/tts/04-tts-long.txt. Assessed original WAV SHA-256: `4ae0c349561d0bbd9112b2308fe71eda3721286c54dbb9d627f96d7030578eaa`. Input SHA-256: `a5eff588bb530fbfdf9c8890f74369e604b364b1501a0c2a4ecd22851358e8bb`. Render: `8b506d9f48c2b895f628af2edd278c43d70fdb42aef08ec50e704b130506f577`; result: `fd133a536ea4172ec6bb3eafae55d9134e02854f3a78940babf5eddb5c653082`. Transcript: `transcripts/narration--2026-09-25_04-tts-long--gemini-gemini-3.8-flash-tts.txt` (SHA-256 `f51cb93d1a1622d24c286eedf33152931a105bd616ba7577f91cf40a406a72da`).

Full waveform decoding succeeded. ASR WER 2.73%, CER 1.14%, substitutions/deletions/insertions 131/15/7 over 5608 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: substitution "ferry" → "fairy"; substitution "15" → "15th"; substitution "and" → "an"; substitution "forty" → "40"; substitution "leila" → "layla"; substitution "rahman" → "raman"; deletion "niamh" → ""; substitution "o" → "nemo"; substitution "tomás" → "tomas"; substitution "anika" → "annika"; substitution "niamh" → "nee"; substitution "tomás" → "tomas". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_04-tts-long--gemini-gemini-3.8-flash-lite-tts"></a>
### 2026-09-25_04-tts-long — gemini/gemini-3.8-flash-lite-tts

[Approved MP3 playback](2026-09-25_04-tts-long/speech-gemini-gemini-3.8-flash-lite-tts.mp3); [manifest](2026-09-25_04-tts-long/manifest.json); source: input/examples/tts/04-tts-long.txt. Assessed original WAV SHA-256: `00af8a067c3c2640db5af3ff30fc7154c89b78ad3be98344eabd694e96f0410e`. Input SHA-256: `a5eff588bb530fbfdf9c8890f74369e604b364b1501a0c2a4ecd22851358e8bb`. Render: `8d9bf80f44120b9c08f2fd607a1fe7b19690e5baeca389a81ef3ef1de59c7256`; result: `c6d0d60d3726af0f32fb237d66a47675ff177a37fbd4cc08118ebc497914daae`. Transcript: `transcripts/narration--2026-09-25_04-tts-long--gemini-gemini-3.8-flash-lite-tts.txt` (SHA-256 `489d4a4aed6b88d9cbd69642ca99296d132580b0460abc8c3db3c35a32d1dcee`).

Full waveform decoding succeeded. ASR WER 2.50%, CER 0.99%, substitutions/deletions/insertions 115/24/1 over 5608 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: deletion "stopped" → ""; substitution "to" → "sobbed"; substitution "fasten" → "a"; substitution "her" → "fastener"; substitution "the" → "a"; substitution "forty" → "40"; substitution "niamh" → "neem"; substitution "tomás" → "tomas"; substitution "anika" → "annika"; substitution "niamh" → "neem"; substitution "tomás" → "tomas"; substitution "anika" → "annika". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_04-tts-long--soniox-tts-rt-v2"></a>
### 2026-09-25_04-tts-long — soniox/tts-rt-v2

[Approved MP3 playback](2026-09-25_04-tts-long/speech-soniox-tts-rt-v2.mp3); [manifest](2026-09-25_04-tts-long/manifest.json); source: input/examples/tts/04-tts-long.txt. Assessed original WAV SHA-256: `99e7b5f3e79d092cbcc04a3e9805677185288ef50194f1cadc90ac44fd223a9c`. Input SHA-256: `a5eff588bb530fbfdf9c8890f74369e604b364b1501a0c2a4ecd22851358e8bb`. Render: `f764273faa7a68d16b311efcc20d648b143691e4763b94b991a54f9923fb0ec7`; result: `dcefb7d54ba918469427ce272673672a0694205d82e05ac6d02639c04e143763`. Transcript: `transcripts/narration--2026-09-25_04-tts-long--soniox-tts-rt-v2.txt` (SHA-256 `48de96e7996f591bebc4f993f2eb01f8049f3492e8f37566cc3e6b86a456d351`).

Full waveform decoding succeeded. ASR WER 2.55%, CER 1.10%, substitutions/deletions/insertions 122/10/11 over 5608 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: deletion "p" → ""; substitution "m" → "pm"; substitution "15" → "15th"; substitution "forty" → "40"; deletion "niamh" → ""; substitution "o" → "nevo"; substitution "tomás" → "tomas"; substitution "niamh" → "nev"; substitution "tomás" → "tomas"; substitution "leila" → "layla"; substitution "leila" → "layla"; insertion "" → "twenty". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_04-tts-long--grok-grok-tts"></a>
### 2026-09-25_04-tts-long — grok/grok-tts

[Approved MP3 playback](2026-09-25_04-tts-long/speech-grok-grok-tts.mp3); [manifest](2026-09-25_04-tts-long/manifest.json); source: input/examples/tts/04-tts-long.txt. Assessed original WAV SHA-256: `86707d31940d4ae094fbfba218fcfceb1fdaab3f9ea85aa0e26acf3eb6744f99`. Input SHA-256: `a5eff588bb530fbfdf9c8890f74369e604b364b1501a0c2a4ecd22851358e8bb`. Render: `115158f5b8c2144814e6aba5eeded0d6c1fc9b5d8b1766b890bf1f606d2c05e0`; result: `aee9abb8ea25df83da86c574830d8469f8add75c172cfd3e7c094868101776c3`. Transcript: `transcripts/narration--2026-09-25_04-tts-long--grok-grok-tts.txt` (SHA-256 `54eee7fb739d6e4b4adf4aac709c3511af532db272ea73707b39d8d8f9268078`).

Full waveform decoding succeeded. ASR WER 2.82%, CER 1.30%, substitutions/deletions/insertions 122/18/18 over 5608 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: deletion "47" → ""; deletion "p" → ""; substitution "m" → "47pm"; substitution "15" → "15th"; substitution "forty" → "40"; substitution "niamh" → "neve"; substitution "tomás" → "tomas"; insertion "" → "as"; insertion "" → "she"; substitution "niamh" → "d"; substitution "tomás" → "tomas"; substitution "there" → "they". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_04-tts-long--openai-gpt-4o-mini-tts-2025-12-15"></a>
### 2026-09-25_04-tts-long — openai/gpt-4o-mini-tts-2025-12-15

[Approved MP3 playback](2026-09-25_04-tts-long/speech-openai-gpt-4o-mini-tts-2025-12-15.mp3); [manifest](2026-09-25_04-tts-long/manifest.json); source: input/examples/tts/04-tts-long.txt. Assessed original WAV SHA-256: `28f30b19359241da7cce0946db4e6681810722a52bf9577393181a878feb2547`. Input SHA-256: `a5eff588bb530fbfdf9c8890f74369e604b364b1501a0c2a4ecd22851358e8bb`. Render: `c834ac85004eada4a9f554a9db2129a99e395d989b0ceebe4560bd7feaf30ec4`; result: `9724185c91fa6ac0391b883e984aaa347628fff96111124596f780d7f3a4a26d`. Transcript: `transcripts/narration--2026-09-25_04-tts-long--openai-gpt-4o-mini-tts-2025-12-15.txt` (SHA-256 `4fbbf62212ddbad966af4c81b5e9f2e65a257ce8cc4b12835bdb2b37e54d0a9a`).

Full waveform decoding succeeded. ASR WER 2.60%, CER 1.36%, substitutions/deletions/insertions 106/31/9 over 5608 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: deletion "47" → ""; deletion "p" → ""; substitution "m" → "47pm"; substitution "15" → "15th"; substitution "forty" → "40"; substitution "rahman" → "raman"; substitution "neat" → "meat"; substitution "niamh" → "niam"; substitution "tomás" → "tomas"; substitution "anika" → "annika"; substitution "niamh" → "niam"; substitution "tomás" → "tomas". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_04-tts-long--inworld-realtime-tts-2"></a>
### 2026-09-25_04-tts-long — inworld/realtime-tts-2

[Approved MP3 playback](2026-09-25_04-tts-long/speech-inworld-realtime-tts-2.mp3); [manifest](2026-09-25_04-tts-long/manifest.json); source: input/examples/tts/04-tts-long.txt. Assessed original WAV SHA-256: `a1670f615b7e8a15492e6f94f5006deca316735b3f17f3e12249bcee513cda6b`. Input SHA-256: `a5eff588bb530fbfdf9c8890f74369e604b364b1501a0c2a4ecd22851358e8bb`. Render: `b20af7377fa1a3add1c3cbeea10804d853f41faac891b448054a50f903ecc4f8`; result: `dfe0c31b2022048c1e8de5c2c9efa3eab6f8ce54dd6ca7f2790b52a70b67c0a6`. Transcript: `transcripts/narration--2026-09-25_04-tts-long--inworld-realtime-tts-2.txt` (SHA-256 `f9d8b3d807e5848bc20074f75bb40a01b319d69df7f00a08c3e8d74cd3b2abdd`).

Full waveform decoding succeeded. ASR WER 2.51%, CER 1.20%, substitutions/deletions/insertions 112/17/12 over 5608 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: deletion "p" → ""; substitution "m" → "pm"; substitution "15" → "15th"; substitution "this" → "the"; substitution "forty" → "40"; substitution "leila" → "laila"; deletion "niamh" → ""; substitution "o" → "nevo"; substitution "tomás" → "tomas"; substitution "niamh" → "nev"; substitution "tomás" → "tomas"; substitution "leila" → "layla". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="emotion--elevenlabs-eleven-v3-tags--elevenlabs-eleven-v3"></a>
### 2026-09-25_05-tts-emotion/elevenlabs-eleven-v3-tags — elevenlabs/eleven_v3

[Approved MP3 playback](2026-09-25_05-tts-emotion/elevenlabs-eleven-v3-tags/elevenlabs-eleven-v3-tags.mp3); [manifest](2026-09-25_05-tts-emotion/elevenlabs-eleven-v3-tags/manifest.json); source: input/examples/tts/controls/emotion/elevenlabs-eleven-v3-tags.txt. Assessed original WAV SHA-256: `3e2336948b3da0adfe02292c9e9903c7ba4ea7e3475b0c7a68eddbce3deea43b`. Input SHA-256: `04eda224d6697caf0578ca21f8952f5025207702c2aa17c306f73c844b9a8e8d`. Render: `07cb963f30b60e747167b03d139aa3d9620bc84c22afea7ef16f570ab4dbb6b8`; result: `993a13ae7c7c24807554199af6088f372b38a19b75404130220556f827a67a44`. Transcript: `transcripts/emotion--elevenlabs-eleven-v3-tags--elevenlabs-eleven-v3.txt` (SHA-256 `24ac6905f0a1e527177dbdea76d2403a670ec3d9bc456f69e275a62afe840df9`).

Full waveform decoding succeeded. ASR WER 0.00%, CER 0.00%, substitutions/deletions/insertions 0/0/0 over 51 reference words. No normalized ASR differences. These differences are ASR evidence, not confirmed synthesis errors.

Native mechanism: tags. Five source lines share one assembled turn; per-line rate and exact pause attribution unavailable without acoustic alignment.

Below-threshold intervals: 13; total 6.423 seconds. Complete signal intervals are in assessment.json; these are not independently verified semantic pauses.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Audible native-control ratings; Emotional/delivery ratings; Perceptual quality ratings. Signal measurements only; subjective ratings excluded and unscored.

<a id="emotion--gemini-gemini-3.8-flash-lite-tts-instructions--gemini-gemini-3.8-flash-lite-tts"></a>
### 2026-09-25_05-tts-emotion/gemini-gemini-3.8-flash-lite-tts-instructions — gemini/gemini-3.8-flash-lite-tts

[Approved MP3 playback](2026-09-25_05-tts-emotion/gemini-gemini-3.8-flash-lite-tts-instructions/gemini-gemini-3.8-flash-lite-tts-instructions.mp3); [manifest](2026-09-25_05-tts-emotion/gemini-gemini-3.8-flash-lite-tts-instructions/manifest.json); source: input/examples/tts/controls/emotion/gemini-gemini-3.8-flash-lite-tts-instructions.txt. Assessed original WAV SHA-256: `51c54c0853bc33db84579c831b6c029129ed2b9f2dc5b1071b98e4a767d5b9a5`. Input SHA-256: `0f07f93c44f94368fdbf4cafd45b44baa40d4bc44d567fdb9b8b4524b68bd680`. Render: `6ee311fa996542346df8988491632ba81f5bbc1e1e1373ea10ecfa97a3d26d38`; result: `590e182e606bf126f6e42c32b87393a2d0201726ec61b96b6643009835d3b0f0`. Transcript: `transcripts/emotion--gemini-gemini-3.8-flash-lite-tts-instructions--gemini-gemini-3.8-flash-lite-tts.txt` (SHA-256 `68635c9ba1a2c4130c53dd221541ea9ca18deba0ce3f6f6caa8bd586f684a127`).

Full waveform decoding succeeded. ASR WER 0.00%, CER 0.00%, substitutions/deletions/insertions 0/0/0 over 34 reference words. No normalized ASR differences. These differences are ASR evidence, not confirmed synthesis errors.

Native mechanism: speech-metadata-style. The five lines have separate assembled-turn timing.

Below-threshold intervals: 14; total 6.736 seconds. Complete signal intervals are in assessment.json; these are not independently verified semantic pauses.

| Turn              | Trimmed seconds | Reference WPM | Longest internal silence |
| ----------------- | --------------- | ------------- | ------------------------ |
| dialogue-turn-001 | 2.370           | 151.92        | 0.543s                   |
| dialogue-turn-002 | 2.844           | 147.68        | 0.000s                   |
| dialogue-turn-003 | 3.587           | 117.08        | 1.193s                   |
| dialogue-turn-004 | 3.822           | 109.88        | 0.593s                   |
| dialogue-turn-005 | 3.674           | 114.33        | 0.660s                   |

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Audible native-control ratings; Emotional/delivery ratings; Perceptual quality ratings. Signal measurements only; subjective ratings excluded and unscored.

<a id="emotion--gemini-gemini-3.8-flash-tts-instructions--gemini-gemini-3.8-flash-tts"></a>
### 2026-09-25_05-tts-emotion/gemini-gemini-3.8-flash-tts-instructions — gemini/gemini-3.8-flash-tts

[Approved MP3 playback](2026-09-25_05-tts-emotion/gemini-gemini-3.8-flash-tts-instructions/gemini-gemini-3.8-flash-tts-instructions.mp3); [manifest](2026-09-25_05-tts-emotion/gemini-gemini-3.8-flash-tts-instructions/manifest.json); source: input/examples/tts/controls/emotion/gemini-gemini-3.8-flash-tts-instructions.txt. Assessed original WAV SHA-256: `d397a7f0ab4c4fd1fbc896c7f085fca979730545a582ab7eb73f13853c2ca646`. Input SHA-256: `0f07f93c44f94368fdbf4cafd45b44baa40d4bc44d567fdb9b8b4524b68bd680`. Render: `f2e5fe398678e866bb99f9086c3db7f52afcb7cbbba12c8dfe19a3c127bbf4f5`; result: `b27e799c87e672527ef5f345025d543dbec7f4f274262d1acc4a5010ea818a6d`. Transcript: `transcripts/emotion--gemini-gemini-3.8-flash-tts-instructions--gemini-gemini-3.8-flash-tts.txt` (SHA-256 `2b65b60618af2c843df94be0ea13336cc47903b269fa722709592406e098624f`).

Full waveform decoding succeeded. ASR WER 2.94%, CER 1.95%, substitutions/deletions/insertions 0/0/1 over 34 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: insertion "" → "so". Complete ordered differences are in assessment.json.

Native mechanism: speech-metadata-style. The five lines have separate assembled-turn timing.

Below-threshold intervals: 19; total 6.239 seconds. Complete signal intervals are in assessment.json; these are not independently verified semantic pauses.

| Turn              | Trimmed seconds | Reference WPM | Longest internal silence |
| ----------------- | --------------- | ------------- | ------------------------ |
| dialogue-turn-001 | 2.500           | 144.03        | 0.751s                   |
| dialogue-turn-002 | 3.198           | 131.35        | 0.145s                   |
| dialogue-turn-003 | 3.784           | 111.00        | 0.739s                   |
| dialogue-turn-004 | 3.442           | 122.02        | 0.448s                   |
| dialogue-turn-005 | 4.454           | 94.30         | 0.271s                   |

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Audible native-control ratings; Emotional/delivery ratings; Perceptual quality ratings. Signal measurements only; subjective ratings excluded and unscored.

<a id="emotion--grok-grok-tts-delivery--grok-grok-tts"></a>
### 2026-09-25_05-tts-emotion/grok-grok-tts-delivery — grok/grok-tts

[Approved MP3 playback](2026-09-25_05-tts-emotion/grok-grok-tts-delivery/grok-grok-tts-delivery.mp3); [manifest](2026-09-25_05-tts-emotion/grok-grok-tts-delivery/manifest.json); source: input/examples/tts/controls/emotion/grok-grok-tts-delivery.txt. Assessed original WAV SHA-256: `03b3722ca40cacba151ec4e3b2b3528b10a485a01eb5f7e94e51845f7417c3b4`. Input SHA-256: `84b59f2d3cde86d2bb350d7b83234fd45cf007b604b91109fbea379c1bceb26e`. Render: `08ab59ce763caa4690d7f8b8bf3c19a736c20c32c502d7823885d314ad1a3527`; result: `d9764eef37857fac9cf859cde312e3f339d52df65ae73b78e8b685125b40c0e0`. Transcript: `transcripts/emotion--grok-grok-tts-delivery--grok-grok-tts.txt` (SHA-256 `5c89350826906a709ced602c6a4a02d41f863d5a3a4c465b1c2d20df8e33d7d0`).

Full waveform decoding succeeded. ASR WER 0.00%, CER 0.00%, substitutions/deletions/insertions 0/0/0 over 31 reference words. No normalized ASR differences. These differences are ASR evidence, not confirmed synthesis errors.

Native mechanism: delivery. Five source lines share one assembled turn; per-line rate and exact pause attribution unavailable without acoustic alignment.

Below-threshold intervals: 12; total 3.547 seconds. Complete signal intervals are in assessment.json; these are not independently verified semantic pauses.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Audible native-control ratings; Emotional/delivery ratings; Perceptual quality ratings. Signal measurements only; subjective ratings excluded and unscored.

<a id="emotion--inworld-realtime-tts-2-instructions--inworld-realtime-tts-2"></a>
### 2026-09-25_05-tts-emotion/inworld-realtime-tts-2-instructions — inworld/realtime-tts-2

[Approved MP3 playback](2026-09-25_05-tts-emotion/inworld-realtime-tts-2-instructions/inworld-realtime-tts-2-instructions.mp3); [manifest](2026-09-25_05-tts-emotion/inworld-realtime-tts-2-instructions/manifest.json); source: input/examples/tts/controls/emotion/inworld-realtime-tts-2-instructions.txt. Assessed original WAV SHA-256: `fd87b23f45c015b9b76d3bb3abe237fcbcf2419d8dd8ef8d35c4e192400cb3a6`. Input SHA-256: `0f07f93c44f94368fdbf4cafd45b44baa40d4bc44d567fdb9b8b4524b68bd680`. Render: `a7f36541f80d7ae666c618780606b99324bf02cac4dff7be29285962678446bb`; result: `c803f22ecfa2c429284c0ed8901bff1fffc2ca4ba525ce522eff7f6946dff2ba`. Transcript: `transcripts/emotion--inworld-realtime-tts-2-instructions--inworld-realtime-tts-2.txt` (SHA-256 `db507dcc804420929b52edc361484d9fd9c11d1e544dab3e380f88b8a2eb3e2c`).

Full waveform decoding succeeded. ASR WER 0.00%, CER 0.00%, substitutions/deletions/insertions 0/0/0 over 34 reference words. No normalized ASR differences. These differences are ASR evidence, not confirmed synthesis errors.

Native mechanism: instructions. The five lines have separate assembled-turn timing.

Below-threshold intervals: 10; total 6.595 seconds. Complete signal intervals are in assessment.json; these are not independently verified semantic pauses.

| Turn              | Trimmed seconds | Reference WPM | Longest internal silence |
| ----------------- | --------------- | ------------- | ------------------------ |
| dialogue-turn-001 | 2.481           | 145.12        | 0.843s                   |
| dialogue-turn-002 | 2.721           | 154.38        | 0.453s                   |
| dialogue-turn-003 | 2.740           | 153.27        | 0.882s                   |
| dialogue-turn-004 | 2.616           | 160.55        | 0.518s                   |
| dialogue-turn-005 | 2.940           | 142.84        | 0.977s                   |

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Audible native-control ratings; Emotional/delivery ratings; Perceptual quality ratings. Signal measurements only; subjective ratings excluded and unscored.

<a id="emotion--soniox-tts-rt-v2-emotion-tags--soniox-tts-rt-v2"></a>
### 2026-09-25_05-tts-emotion/soniox-tts-rt-v2-emotion-tags — soniox/tts-rt-v2

[Approved MP3 playback](2026-09-25_05-tts-emotion/soniox-tts-rt-v2-emotion-tags/soniox-tts-rt-v2-emotion-tags.mp3); [manifest](2026-09-25_05-tts-emotion/soniox-tts-rt-v2-emotion-tags/manifest.json); source: input/examples/tts/controls/emotion/soniox-tts-rt-v2-emotion-tags.txt. Assessed original WAV SHA-256: `c07da417ea57e577a6c333e5cdbdda1dcb34c93d98eb5ab66a1a0697aa77ae48`. Input SHA-256: `f8d113d8578a378b1f0797b29f2b21ef104c2d32753d546ee66bceccd8982920`. Render: `6fedfc925c613dd8b1b1f832dba8fd3ef55a2b9e12c3c2018e410dae924a0616`; result: `5f9c62422fa8d3564f6ffc6f6297737de8dcfe96371cdf4c02d961f3436740c1`. Transcript: `transcripts/emotion--soniox-tts-rt-v2-emotion-tags--soniox-tts-rt-v2.txt` (SHA-256 `db507dcc804420929b52edc361484d9fd9c11d1e544dab3e380f88b8a2eb3e2c`).

Full waveform decoding succeeded. ASR WER 0.00%, CER 0.00%, substitutions/deletions/insertions 0/0/0 over 34 reference words. No normalized ASR differences. These differences are ASR evidence, not confirmed synthesis errors.

Native mechanism: Native inline emotion tags; five separate turns; no request-level instructions or timing controls.. The five lines have separate assembled-turn timing.

Below-threshold intervals: 11; total 3.954 seconds. Complete signal intervals are in assessment.json; these are not independently verified semantic pauses.

| Turn              | Trimmed seconds | Reference WPM | Longest internal silence |
| ----------------- | --------------- | ------------- | ------------------------ |
| dialogue-turn-001 | 2.387           | 150.84        | 0.647s                   |
| dialogue-turn-002 | 3.133           | 134.04        | 0.403s                   |
| dialogue-turn-003 | 2.644           | 158.83        | 0.523s                   |
| dialogue-turn-004 | 2.504           | 167.72        | 0.540s                   |
| dialogue-turn-005 | 2.835           | 148.16        | 0.646s                   |

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Audible native-control ratings; Emotional/delivery ratings; Perceptual quality ratings. Signal measurements only; subjective ratings excluded and unscored.

<a id="speed-pauses--gemini-gemini-3.8-flash-lite-tts-instructions--gemini-gemini-3.8-flash-lite-tts"></a>
### 2026-09-25_06-tts-speed-pauses/gemini-gemini-3.8-flash-lite-tts-instructions — gemini/gemini-3.8-flash-lite-tts

[Approved MP3 playback](2026-09-25_06-tts-speed-pauses/gemini-gemini-3.8-flash-lite-tts-instructions/gemini-gemini-3.8-flash-lite-tts-instructions.mp3); [manifest](2026-09-25_06-tts-speed-pauses/gemini-gemini-3.8-flash-lite-tts-instructions/manifest.json); source: input/examples/tts/controls/speed-pauses/gemini-gemini-3.8-flash-lite-tts-instructions.txt. Assessed original WAV SHA-256: `1d682916098f2ddf2706c853b232a7553efc6e511385fa803fce7587e4ababd6`. Input SHA-256: `eb7cb3a0595369fc9d1b89de0171c1d68630528a7ccfef04ca26fe26bf845105`. Render: `8a915d406ea3ca3b6a603a6654d4585af4f93003a3f5241ebd88da39449d3d9d`; result: `2f09a40308f1b5a41b6e5cbec1c78e315d40c0df0a0e60baa6f5d3eff7d25311`. Transcript: `transcripts/speed-pauses--gemini-gemini-3.8-flash-lite-tts-instructions--gemini-gemini-3.8-flash-lite-tts.txt` (SHA-256 `6babed669b891bf4c798311d65ac56c1784df4185409b579eac2a94356cc2082`).

Full waveform decoding succeeded. ASR WER 4.76%, CER 5.85%, substitutions/deletions/insertions 0/0/2 over 42 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: insertion "" → "long"; insertion "" → "pause". Complete ordered differences are in assessment.json.

Native mechanism: qualitative-pace-and-inline-pauses. The five lines have separate assembled-turn timing.

Supplemental counting-number-fold WER: 4.76%; substitutions/deletions/insertions 0/0/2. This limited spelling equivalence is separate from the strict score and preserves missing words.

Below-threshold intervals: 30; total 17.051 seconds. Complete signal intervals are in assessment.json; these are not independently verified semantic pauses.

| Turn              | Trimmed seconds | Reference WPM | Longest internal silence |
| ----------------- | --------------- | ------------- | ------------------------ |
| dialogue-turn-001 | 7.099           | 92.97         | 0.762s                   |
| dialogue-turn-002 | 11.355          | 42.27         | 1.275s                   |
| dialogue-turn-003 | 2.955           | 162.44        | 0.321s                   |
| dialogue-turn-004 | 2.384           | 151.01        | 0.581s                   |
| dialogue-turn-005 | 6.052           | 89.23         | 1.667s                   |

Slow < normal < fast reference-word throughput: consistent in signal measurements. This does not establish speech correctness or exact numeric calibration.

| Turn              | Mechanism       | Requested seconds | Longest internal gap | Delta seconds  |
| ----------------- | --------------- | ----------------- | -------------------- | -------------- |
| dialogue-turn-004 | qualitative cue | qualitative       | 0.581                | not applicable |
| dialogue-turn-005 | qualitative cue | qualitative       | 1.667                | not applicable |

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Audible native-control ratings; Emotional/delivery ratings; Perceptual quality ratings. Signal measurements only; subjective ratings excluded and unscored.

<a id="speed-pauses--gemini-gemini-3.8-flash-tts-instructions--gemini-gemini-3.8-flash-tts"></a>
### 2026-09-25_06-tts-speed-pauses/gemini-gemini-3.8-flash-tts-instructions — gemini/gemini-3.8-flash-tts

[Approved MP3 playback](2026-09-25_06-tts-speed-pauses/gemini-gemini-3.8-flash-tts-instructions/gemini-gemini-3.8-flash-tts-instructions.mp3); [manifest](2026-09-25_06-tts-speed-pauses/gemini-gemini-3.8-flash-tts-instructions/manifest.json); source: input/examples/tts/controls/speed-pauses/gemini-gemini-3.8-flash-tts-instructions.txt. Assessed original WAV SHA-256: `12f739b24da69b89347257b24f9765688d28cd81519e8f5e48bb93f432e07486`. Input SHA-256: `eb7cb3a0595369fc9d1b89de0171c1d68630528a7ccfef04ca26fe26bf845105`. Render: `67f968280a6cad08ab0dd7c34f7833c96ba9671ccd909900d2d3709efd7aeb7e`; result: `8ee39b5ffa7ef3907120c766181d98bc1ef5b558236b40a2912afbb274adab3d`. Transcript: `transcripts/speed-pauses--gemini-gemini-3.8-flash-tts-instructions--gemini-gemini-3.8-flash-tts.txt` (SHA-256 `7116ac8b1a404dea13e8dcddba8d81eeec1a88d9e8e7e8f405873f134ccc4347`).

Full waveform decoding succeeded. ASR WER 0.00%, CER 0.00%, substitutions/deletions/insertions 0/0/0 over 42 reference words. No normalized ASR differences. These differences are ASR evidence, not confirmed synthesis errors.

Native mechanism: qualitative-pace-and-inline-pauses. The five lines have separate assembled-turn timing.

Supplemental counting-number-fold WER: 0.00%; substitutions/deletions/insertions 0/0/0. This limited spelling equivalence is separate from the strict score and preserves missing words.

Below-threshold intervals: 28; total 18.040 seconds. Complete signal intervals are in assessment.json; these are not independently verified semantic pauses.

| Turn              | Trimmed seconds | Reference WPM | Longest internal silence |
| ----------------- | --------------- | ------------- | ------------------------ |
| dialogue-turn-001 | 6.606           | 99.91         | 0.612s                   |
| dialogue-turn-002 | 11.306          | 42.45         | 1.203s                   |
| dialogue-turn-003 | 3.604           | 133.18        | 0.477s                   |
| dialogue-turn-004 | 3.410           | 105.58        | 1.842s                   |
| dialogue-turn-005 | 5.128           | 105.31        | 2.889s                   |

Slow < normal < fast reference-word throughput: consistent in signal measurements. This does not establish speech correctness or exact numeric calibration.

| Turn              | Mechanism       | Requested seconds | Longest internal gap | Delta seconds  |
| ----------------- | --------------- | ----------------- | -------------------- | -------------- |
| dialogue-turn-004 | qualitative cue | qualitative       | 1.842                | not applicable |
| dialogue-turn-005 | qualitative cue | qualitative       | 2.889                | not applicable |

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Audible native-control ratings; Emotional/delivery ratings; Perceptual quality ratings. Signal measurements only; subjective ratings excluded and unscored.

<a id="speed-pauses--grok-grok-tts-numeric--grok-grok-tts"></a>
### 2026-09-25_06-tts-speed-pauses/grok-grok-tts-numeric — grok/grok-tts

[Approved MP3 playback](2026-09-25_06-tts-speed-pauses/grok-grok-tts-numeric/grok-grok-tts-numeric.mp3); [manifest](2026-09-25_06-tts-speed-pauses/grok-grok-tts-numeric/manifest.json); source: input/examples/tts/controls/speed-pauses/grok-grok-tts-numeric.txt. Assessed original WAV SHA-256: `a20be8083ec58784af2043c7c3deb5e9e181a4f52b7f6808a6524b280383075a`. Input SHA-256: `fec71d1bfda07d63318553a76f81071bb854c8c21d4f44d3049cabb6548a7ffa`. Render: `55540f6cb4c44ef90369e9179872d1b1cc16e2c8dce154fdd8fa9357e645de5f`; result: `e94beac048eb71de877863e65a68e38ee8e7735b557ffa3cc73e54a0d1c5ce11`. Transcript: `transcripts/speed-pauses--grok-grok-tts-numeric--grok-grok-tts.txt` (SHA-256 `1fe50c421ddd944bff7079f1b69b7f5af02b8bd92f186b92b2bf3e4516b18484`).

Full waveform decoding succeeded. ASR WER 35.71%, CER 30.32%, substitutions/deletions/insertions 15/0/0 over 42 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: substitution "one" → "1"; substitution "two" → "2"; substitution "three" → "3"; substitution "four" → "4"; substitution "five" → "5"; substitution "one" → "1"; substitution "two" → "2"; substitution "three" → "3"; substitution "four" → "4"; substitution "five" → "5"; substitution "one" → "1"; substitution "two" → "2". Complete ordered differences are in assessment.json.

Native mechanism: numeric. The five lines have separate assembled-turn timing.

Supplemental counting-number-fold WER: 0.00%; substitutions/deletions/insertions 0/0/0. This limited spelling equivalence is separate from the strict score and preserves missing words.

Below-threshold intervals: 26; total 8.248 seconds. Complete signal intervals are in assessment.json; these are not independently verified semantic pauses.

| Turn              | Trimmed seconds | Reference WPM | Longest internal silence |
| ----------------- | --------------- | ------------- | ------------------------ |
| dialogue-turn-001 | 4.608           | 143.22        | 0.402s                   |
| dialogue-turn-002 | 5.625           | 85.34         | 0.595s                   |
| dialogue-turn-003 | 2.741           | 175.12        | 0.220s                   |
| dialogue-turn-004 | 2.706           | 133.06        | 0.853s                   |
| dialogue-turn-005 | 4.372           | 123.53        | 2.078s                   |

Slow < normal < fast reference-word throughput: consistent in signal measurements. This does not establish speech correctness or exact numeric calibration.

| Turn              | Mechanism       | Requested seconds | Longest internal gap | Delta seconds  |
| ----------------- | --------------- | ----------------- | -------------------- | -------------- |
| dialogue-turn-004 | qualitative cue | qualitative       | 0.853                | not applicable |
| dialogue-turn-005 | qualitative cue | qualitative       | 2.078                | not applicable |

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Audible native-control ratings; Emotional/delivery ratings; Perceptual quality ratings. Signal measurements only; subjective ratings excluded and unscored.

<a id="speed-pauses--grok-grok-tts-tags--grok-grok-tts"></a>
### 2026-09-25_06-tts-speed-pauses/grok-grok-tts-tags — grok/grok-tts

[Approved MP3 playback](2026-09-25_06-tts-speed-pauses/grok-grok-tts-tags/grok-grok-tts-tags.mp3); [manifest](2026-09-25_06-tts-speed-pauses/grok-grok-tts-tags/manifest.json); source: input/examples/tts/controls/speed-pauses/grok-grok-tts-tags.txt. Assessed original WAV SHA-256: `b07d4ee7e271cf29eb5067b6234accfc795b5df503928095f17206989796d19f`. Input SHA-256: `88cb34babe407a1439c17c1919d3e1d04596022b2a477a7d3c8c6131855e127f`. Render: `729318eedb3ebc6c5cc0e355b150a40ab4910faabe9fb445fe9f2cacc7d17f87`; result: `10f0e6c815bb92c0d67afb89869c0af9d92f8be10c5763cdaabe8ad43441d313`. Transcript: `transcripts/speed-pauses--grok-grok-tts-tags--grok-grok-tts.txt` (SHA-256 `ff3a26d676aa8fe966672a0a2f016e814f8150ceae1ab20bd63fad0260a4dc72`).

Full waveform decoding succeeded. ASR WER 7.14%, CER 6.91%, substitutions/deletions/insertions 0/3/0 over 42 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: deletion "then" → ""; deletion "i" → ""; deletion "speak" → "". Complete ordered differences are in assessment.json.

Native mechanism: tags. Five source lines share one assembled turn; per-line rate and exact pause attribution unavailable without acoustic alignment.

Supplemental counting-number-fold WER: 7.14%; substitutions/deletions/insertions 0/3/0. This limited spelling equivalence is separate from the strict score and preserves missing words.

Below-threshold intervals: 21; total 8.156 seconds. Complete signal intervals are in assessment.json; these are not independently verified semantic pauses.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Audible native-control ratings; Emotional/delivery ratings; Perceptual quality ratings. Signal measurements only; subjective ratings excluded and unscored.

<a id="speed-pauses--inworld-realtime-tts-2-instructions--inworld-realtime-tts-2"></a>
### 2026-09-25_06-tts-speed-pauses/inworld-realtime-tts-2-instructions — inworld/realtime-tts-2

[Approved MP3 playback](2026-09-25_06-tts-speed-pauses/inworld-realtime-tts-2-instructions/inworld-realtime-tts-2-instructions.mp3); [manifest](2026-09-25_06-tts-speed-pauses/inworld-realtime-tts-2-instructions/manifest.json); source: input/examples/tts/controls/speed-pauses/inworld-realtime-tts-2-instructions.txt. Assessed original WAV SHA-256: `9c8e14fb3d69ec2a95873622fefcd3f72135e91d9f0d1834f3cc293ca6a72cae`. Input SHA-256: `347704f65124e4290a38a2a16c64b31073df0cd2bcfa4cfcf6453a4e48d40062`. Render: `d35a0c92df061224b990d71dbac1a35bad85084b369d87f17d86d8091d461b2e`; result: `bc8ab949fced47eed0a82a44b5e2ceb2467c42b23cfd1f0a6d4475651b5bf5d6`. Transcript: `transcripts/speed-pauses--inworld-realtime-tts-2-instructions--inworld-realtime-tts-2.txt` (SHA-256 `133e19b0ca58d40b389663d7b9769f4885d40706a6fdabfb45e3ab3718c48254`).

Full waveform decoding succeeded. ASR WER 2.38%, CER 0.53%, substitutions/deletions/insertions 1/0/0 over 42 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: substitution "then" → "when". Complete ordered differences are in assessment.json.

Native mechanism: instructions. The five lines have separate assembled-turn timing.

Supplemental counting-number-fold WER: 2.38%; substitutions/deletions/insertions 1/0/0. This limited spelling equivalence is separate from the strict score and preserves missing words.

Below-threshold intervals: 20; total 12.037 seconds. Complete signal intervals are in assessment.json; these are not independently verified semantic pauses.

| Turn              | Trimmed seconds | Reference WPM | Longest internal silence |
| ----------------- | --------------- | ------------- | ------------------------ |
| dialogue-turn-001 | 4.976           | 132.63        | 0.397s                   |
| dialogue-turn-002 | 7.017           | 68.40         | 0.747s                   |
| dialogue-turn-003 | 2.675           | 179.45        | 0.240s                   |
| dialogue-turn-004 | 2.546           | 141.42        | 1.122s                   |
| dialogue-turn-005 | 5.147           | 104.92        | 2.789s                   |

Slow < normal < fast reference-word throughput: consistent in signal measurements. This does not establish speech correctness or exact numeric calibration.

| Turn              | Mechanism          | Requested seconds | Longest internal gap | Delta seconds |
| ----------------- | ------------------ | ----------------- | -------------------- | ------------- |
| dialogue-turn-004 | exact SSML request | 0.500             | 1.122                | 0.622         |
| dialogue-turn-005 | exact SSML request | 2.000             | 2.789                | 0.789         |

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Audible native-control ratings; Emotional/delivery ratings; Perceptual quality ratings. Signal measurements only; subjective ratings excluded and unscored.

<a id="speed-pauses--inworld-realtime-tts-2-steering-tags--inworld-realtime-tts-2"></a>
### 2026-09-25_06-tts-speed-pauses/inworld-realtime-tts-2-steering-tags — inworld/realtime-tts-2

[Approved MP3 playback](2026-09-25_06-tts-speed-pauses/inworld-realtime-tts-2-steering-tags/inworld-realtime-tts-2-steering-tags.mp3); [manifest](2026-09-25_06-tts-speed-pauses/inworld-realtime-tts-2-steering-tags/manifest.json); source: input/examples/tts/controls/speed-pauses/inworld-realtime-tts-2-steering-tags.txt. Assessed original WAV SHA-256: `b071fcdf944f92de5edfe7a647ce565d7d5f0cae4edfbb8b4cc8c81b2cb9b2c3`. Input SHA-256: `5be6d05af9459360efbfb3455ff8b93e3a7a37a15c93e62007f38ecf14b5280d`. Render: `72186924e61d85a67609d1f7286e98b48b47b8cb8f9b1013aea411a98e8324a2`; result: `635af7008088cc42fd3870f01dac659a2e8301b7e15e057632dadcce8a2021d6`. Transcript: `transcripts/speed-pauses--inworld-realtime-tts-2-steering-tags--inworld-realtime-tts-2.txt` (SHA-256 `fe490e55cfa3f687d1d673bed7f3ab54d2911744e864805ac50194b999b1035c`).

Full waveform decoding succeeded. ASR WER 0.00%, CER 0.00%, substitutions/deletions/insertions 0/0/0 over 42 reference words. No normalized ASR differences. These differences are ASR evidence, not confirmed synthesis errors.

Native mechanism: steering-tags. Five source lines share one assembled turn; per-line rate and exact pause attribution unavailable without acoustic alignment.

Supplemental counting-number-fold WER: 0.00%; substitutions/deletions/insertions 0/0/0. This limited spelling equivalence is separate from the strict score and preserves missing words.

Below-threshold intervals: 24; total 12.420 seconds. Complete signal intervals are in assessment.json; these are not independently verified semantic pauses.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Audible native-control ratings; Emotional/delivery ratings; Perceptual quality ratings. Signal measurements only; subjective ratings excluded and unscored.

<a id="speed-pauses--soniox-tts-rt-v2-numeric--soniox-tts-rt-v2"></a>
### 2026-09-25_06-tts-speed-pauses/soniox-tts-rt-v2-numeric — soniox/tts-rt-v2

[Approved MP3 playback](2026-09-25_06-tts-speed-pauses/soniox-tts-rt-v2-numeric/soniox-tts-rt-v2-numeric.mp3); [manifest](2026-09-25_06-tts-speed-pauses/soniox-tts-rt-v2-numeric/manifest.json); source: input/examples/tts/controls/speed-pauses/soniox-tts-rt-v2-numeric.txt. Assessed original WAV SHA-256: `02793799f8525d85cc1b00f0d3795d53bafea879e347ee67e681bf3a8a639a1e`. Input SHA-256: `c82a2885ac2abbda5aa65e04e01142ff9d0809cc512f0a08e25081d214cc0aa4`. Render: `c0bcaa2eda2fb52c644f03857e8d2b06f2710ed95a67b2aeed712d4470369e27`; result: `3f979264a0b191b4db6f1fbead264e86284a16ee5c3b742fb8c7e9226573c06d`. Transcript: `transcripts/speed-pauses--soniox-tts-rt-v2-numeric--soniox-tts-rt-v2.txt` (SHA-256 `70b7d0894d13a7611c1ca58a4fef1d24fd6429990742654b71e62c9ccf79f7c3`).

Full waveform decoding succeeded. ASR WER 7.14%, CER 6.91%, substitutions/deletions/insertions 0/3/0 over 42 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: deletion "then" → ""; deletion "i" → ""; deletion "speak" → "". Complete ordered differences are in assessment.json.

Native mechanism: Native numeric speed 1, 0.7, 1.3, 1, 1; native qualitative pause tags on the final two turns.. The five lines have separate assembled-turn timing.

Supplemental counting-number-fold WER: 7.14%; substitutions/deletions/insertions 0/3/0. This limited spelling equivalence is separate from the strict score and preserves missing words.

Below-threshold intervals: 27; total 12.368 seconds. Complete signal intervals are in assessment.json; these are not independently verified semantic pauses.

| Turn              | Trimmed seconds | Reference WPM | Longest internal silence |
| ----------------- | --------------- | ------------- | ------------------------ |
| dialogue-turn-001 | 6.740           | 97.93         | 0.559s                   |
| dialogue-turn-002 | 8.946           | 53.66         | 0.893s                   |
| dialogue-turn-003 | 4.480           | 107.13        | 0.434s                   |
| dialogue-turn-004 | 2.806           | 128.29        | 1.295s                   |
| dialogue-turn-005 | 3.474           | 155.42        | 1.368s                   |

Slow < normal < fast reference-word throughput: consistent in signal measurements. This does not establish speech correctness or exact numeric calibration.

| Turn              | Mechanism       | Requested seconds | Longest internal gap | Delta seconds  |
| ----------------- | --------------- | ----------------- | -------------------- | -------------- |
| dialogue-turn-004 | qualitative cue | qualitative       | 1.295                | not applicable |
| dialogue-turn-005 | qualitative cue | qualitative       | 1.368                | not applicable |

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Audible native-control ratings; Emotional/delivery ratings; Perceptual quality ratings. Signal measurements only; subjective ratings excluded and unscored.

<a id="speed-pauses--soniox-tts-rt-v2-pacing-tags--soniox-tts-rt-v2"></a>
### 2026-09-25_06-tts-speed-pauses/soniox-tts-rt-v2-pacing-tags — soniox/tts-rt-v2

[Approved MP3 playback](2026-09-25_06-tts-speed-pauses/soniox-tts-rt-v2-pacing-tags/soniox-tts-rt-v2-pacing-tags.mp3); [manifest](2026-09-25_06-tts-speed-pauses/soniox-tts-rt-v2-pacing-tags/manifest.json); source: input/examples/tts/controls/speed-pauses/soniox-tts-rt-v2-pacing-tags.txt. Assessed original WAV SHA-256: `2928a77ff8d6658b56d172ea655afe16d4ea044f96a4d2c02ffe02eb7e344619`. Input SHA-256: `b5089bed8b2536c59a7b21cc4da51ce67cffbfba1f3bb002035d68715fa2a344`. Render: `d8693a3fcf1ee5e5af8ddf7193d9925f7afaa87ac884737dc78de62b5b5d9a29`; result: `e70a1e58163a47ea3a7126d2ae45fd7b8694d0450e829f1563b0295b431e12ab`. Transcript: `transcripts/speed-pauses--soniox-tts-rt-v2-pacing-tags--soniox-tts-rt-v2.txt` (SHA-256 `52d498ac28d27fc2ef4b5d08a36ab20c55fd1c706728119405fefeb8b6f2681f`).

Full waveform decoding succeeded. ASR WER 42.86%, CER 37.23%, substitutions/deletions/insertions 15/3/0 over 42 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: substitution "one" → "1"; substitution "two" → "2"; substitution "three" → "3"; substitution "four" → "4"; substitution "five" → "5"; substitution "one" → "1"; substitution "two" → "2"; substitution "three" → "3"; substitution "four" → "4"; substitution "five" → "5"; substitution "one" → "1"; substitution "two" → "2". Complete ordered differences are in assessment.json.

Native mechanism: Qualitative native pacing and pause tags; fixed numeric speed 1; pauses are not exact timed silence.. The five lines have separate assembled-turn timing.

Supplemental counting-number-fold WER: 7.14%; substitutions/deletions/insertions 0/3/0. This limited spelling equivalence is separate from the strict score and preserves missing words.

Below-threshold intervals: 24; total 10.263 seconds. Complete signal intervals are in assessment.json; these are not independently verified semantic pauses.

| Turn              | Trimmed seconds | Reference WPM | Longest internal silence |
| ----------------- | --------------- | ------------- | ------------------------ |
| dialogue-turn-001 | 5.066           | 130.28        | 0.377s                   |
| dialogue-turn-002 | 7.056           | 68.03         | 0.693s                   |
| dialogue-turn-003 | 4.221           | 113.71        | 0.643s                   |
| dialogue-turn-004 | 2.665           | 135.11        | 1.289s                   |
| dialogue-turn-005 | 3.574           | 151.10        | 1.351s                   |

Slow < normal < fast reference-word throughput: not consistently ordered in signal measurements. This does not establish speech correctness or exact numeric calibration.

| Turn              | Mechanism       | Requested seconds | Longest internal gap | Delta seconds  |
| ----------------- | --------------- | ----------------- | -------------------- | -------------- |
| dialogue-turn-004 | qualitative cue | qualitative       | 1.289                | not applicable |
| dialogue-turn-005 | qualitative cue | qualitative       | 1.351                | not applicable |

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Audible native-control ratings; Emotional/delivery ratings; Perceptual quality ratings. Signal measurements only; subjective ratings excluded and unscored.

## Reproduce

Inspect without writes: `bun src/tools/assess-tts-benchmarks.ts`. Run/reuse installed local ASR and update this report/archive: `bun src/tools/assess-tts-benchmarks.ts --run --concurrency 2`. Each cache key binds the audio, original input, expected spoken text, ASR engine hash, version and selected render; complete cached transcripts are reused. Cache and interrupted diagnostics remain under runtime/tts-benchmark-assessment/. No provider fallback or model download is implemented.

## Eleven v4 extension — 2026-10-29

Only six new Eleven v4 recordings received installed small.en ASR and full waveform decoding. Subjective ratings and audible control correctness remain excluded and unscored. The pause-only case uses qualitative tags; it is not a slow/fast or exact-timing test. Original archive SHA-256: `1ea84d0a4d1a003607a7d9eb5044738d246a86ec2e9460d45f4f0b93b0d99775`.

## Selected recordings

| Case                                                                                                                                   | Provider/model       | Suite        | WER    | CER   | S/D/I    | Disposition                          |
| -------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------ | ------ | ----- | -------- | ------------------------------------ |
| [2026-09-25_01-tts-short](#narration--2026-09-25_01-tts-short--elevenlabs-eleven-v4)                                                   | elevenlabs/eleven_v4 | narration    | 0.00%  | 0.00% | 0/0/0    | No normalized ASR differences        |
| [2026-09-25_02-tts-hard](#narration--2026-09-25_02-tts-hard--elevenlabs-eleven-v4)                                                     | elevenlabs/eleven_v4 | narration    | 10.94% | 2.13% | 7/0/0    | ASR differences require adjudication |
| [2026-09-25_03-tts-harder](#narration--2026-09-25_03-tts-harder--elevenlabs-eleven-v4)                                                 | elevenlabs/eleven_v4 | narration    | 10.25% | 3.69% | 25/3/1   | ASR differences require adjudication |
| [2026-09-25_04-tts-long](#narration--2026-09-25_04-tts-long--elevenlabs-eleven-v4)                                                     | elevenlabs/eleven_v4 | narration    | 2.37%  | 1.05% | 116/11/6 | ASR differences require adjudication |
| [2026-09-25_05-tts-emotion/elevenlabs-eleven-v4-tags](#emotion--elevenlabs-eleven-v4-tags--elevenlabs-eleven-v4)                       | elevenlabs/eleven_v4 | emotion      | 0.00%  | 0.00% | 0/0/0    | No normalized ASR differences        |
| [2026-09-25_06-tts-speed-pauses/elevenlabs-eleven-v4-pause-tags](#speed-pauses--elevenlabs-eleven-v4-pause-tags--elevenlabs-eleven-v4) | elevenlabs/eleven_v4 | speed-pauses | 0.00%  | 0.00% | 0/0/0    | No normalized ASR differences        |

<a id="narration--2026-09-25_01-tts-short--elevenlabs-eleven-v4"></a>
### 2026-09-25_01-tts-short — elevenlabs/eleven_v4

[Selected audio](2026-09-25_01-tts-short/reruns/eleven-v4-2026-10-29/speech-resume-d612656c0c6402ea3f3af3d0f59064f50d79e401ead2b3f8-attempt-1.wav); [manifest](2026-09-25_01-tts-short/reruns/eleven-v4-2026-10-29/manifest.json); source: input/examples/tts/01-tts-short.md. Measured WAV SHA-256: `ec912e0f67ea45090069285b4aabebfe076911ec8b08a47bbbd8084b228069db`. Input SHA-256: `7ee6b18343ea3080272910139a472f9b40262e41a5d9c23bea454a0866fc87a1`. Render: `82400e935c5719dd83292e63d98599a67c946793a0f3b43f929f0e3d06c88664`; result: `79d491ad9c10245fd6347a2da7d7e64d4f75eec1401f5b145b0c7a6660e64bcf`. Transcript: `transcripts/narration--2026-09-25_01-tts-short--elevenlabs-eleven-v4.txt` (SHA-256 `40e5145e286b0793a6adc1bf8991f2f81247ee3741e97c9bc964d3e2ce907ed3`).

Full waveform decoding succeeded. ASR WER 0.00%, CER 0.00%, substitutions/deletions/insertions 0/0/0 over 15 reference words. No normalized ASR differences. These differences are ASR evidence, not confirmed synthesis errors.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_02-tts-hard--elevenlabs-eleven-v4"></a>
### 2026-09-25_02-tts-hard — elevenlabs/eleven_v4

[Selected audio](2026-09-25_02-tts-hard/reruns/eleven-v4-2026-10-29/speech.wav); [manifest](2026-09-25_02-tts-hard/reruns/eleven-v4-2026-10-29/manifest.json); source: input/examples/tts/02-tts-hard.md. Measured WAV SHA-256: `571c1a83cdde30836558375b6137b3c8849b964e72355cd7b78ebd487ca4ba26`. Input SHA-256: `333a0292c213dd8e4497f9bcd99cacbb6a66217f3c8f330505989a56a8ca1a23`. Render: `ca5398b19b7747eaf06ab4a3c09dedbd81b7ba3b6c7bb32618bd8ef0009582e7`; result: `54503392813763639ef59605a9ca6a5d23563162801e10117192fe100952d094`. Transcript: `transcripts/narration--2026-09-25_02-tts-hard--elevenlabs-eleven-v4.txt` (SHA-256 `3930235ae9b011be799c86e664911e8574412d39da75e88d3be5a2b97ad85268`).

Full waveform decoding succeeded. ASR WER 10.94%, CER 2.13%, substitutions/deletions/insertions 7/0/0 over 64 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: substitution "crêpes" → "crepes"; substitution "jalapeños" → "jalapenos"; substitution "façades" → "facades"; substitution "naïve" → "naive"; substitution "résumés" → "resumes"; substitution "crème" → "creme"; substitution "brûlée" → "brulee". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_03-tts-harder--elevenlabs-eleven-v4"></a>
### 2026-09-25_03-tts-harder — elevenlabs/eleven_v4

[Selected audio](2026-09-25_03-tts-harder/reruns/eleven-v4-2026-10-29/speech.wav); [manifest](2026-09-25_03-tts-harder/reruns/eleven-v4-2026-10-29/manifest.json); source: input/examples/tts/03-tts-harder.txt. Measured WAV SHA-256: `4d63f0100d89c76401353814beafc33f2b8c5b8f8669b16a1a9fc84025c3b26a`. Input SHA-256: `366d95903eadea04b50f9eb9235a9ae3d76e8abf8b14a8fd5a681b700d504d94`. Render: `c3db10324351b48df9facb2aaddde01303cfc6818de2db5ee8c03dc80f419544`; result: `7e8071f6bf26ded83c6c0ec08b12d2247f49c816e77524668f85ba38e114dbd9`. Transcript: `transcripts/narration--2026-09-25_03-tts-harder--elevenlabs-eleven-v4.txt` (SHA-256 `3effb1733c8eb63dab1327c5188804e90dc51852ded11c10f572e6ae754bc22f`).

Full waveform decoding succeeded. ASR WER 10.25%, CER 3.69%, substitutions/deletions/insertions 25/3/1 over 283 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: substitution "anaïs" → "anais"; substitution "résumé" → "resume"; substitution "xiǎomí" → "xiaomi"; substitution "professor" → "dr"; substitution "maría" → "maria"; substitution "josé" → "jose"; deletion "ça" → ""; deletion "va" → ""; substitution "grüß" → "sava"; substitution "gott" → "gruzkot"; substitution "jalapeño" → "jalapeno"; substitution "pho" → "fur". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="narration--2026-09-25_04-tts-long--elevenlabs-eleven-v4"></a>
### 2026-09-25_04-tts-long — elevenlabs/eleven_v4

[Selected audio](2026-09-25_04-tts-long/reruns/eleven-v4-2026-10-29/speech.wav); [manifest](2026-09-25_04-tts-long/reruns/eleven-v4-2026-10-29/manifest.json); source: input/examples/tts/04-tts-long.txt. Measured WAV SHA-256: `c82d1fc8be1d3bffa4146803c5ff8661d74a9630f320771b26b38004aba2b340`. Input SHA-256: `a5eff588bb530fbfdf9c8890f74369e604b364b1501a0c2a4ecd22851358e8bb`. Render: `f4598f1728af9c94416219e4fdde8b40a82bf6b82c7d6751bf2cb5b1f65e35c5`; result: `234e15d185af829a82976efb17a288c23e9276b435f53bfe5629b0f927f8cbda`. Transcript: `transcripts/narration--2026-09-25_04-tts-long--elevenlabs-eleven-v4.txt` (SHA-256 `92e4012b8d5c7213c8f159728041c2ae3af0b896a5ac7b528e8e5acdce00ec18`).

Full waveform decoding succeeded. ASR WER 2.37%, CER 1.05%, substitutions/deletions/insertions 116/11/6 over 5608 reference words. ASR differences require adjudication. These differences are ASR evidence, not confirmed synthesis errors.

First differences: deletion "p" → ""; substitution "m" → "pm"; substitution "15" → "15th"; substitution "he" → "she"; substitution "forty" → "40"; insertion "" → "the"; substitution "dinner" → "opener"; substitution "niamh" → "neve"; substitution "tomás" → "tomas"; substitution "anika" → "annika"; substitution "niamh" → "neve"; substitution "tomás" → "tomas". Complete ordered differences are in assessment.json.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Perceptual quality ratings. Not a controls case.

<a id="emotion--elevenlabs-eleven-v4-tags--elevenlabs-eleven-v4"></a>
### 2026-09-25_05-tts-emotion/elevenlabs-eleven-v4-tags — elevenlabs/eleven_v4

[Selected audio](2026-09-25_05-tts-emotion/elevenlabs-eleven-v4-tags/elevenlabs-eleven-v4-tags.wav); [manifest](2026-09-25_05-tts-emotion/elevenlabs-eleven-v4-tags/manifest.json); source: input/examples/tts/controls/emotion/elevenlabs-eleven-v4-tags.txt. Measured WAV SHA-256: `b05bf394f948be1b0d683fd62641e191369926e42214e16b142dc452f7efc9cd`. Input SHA-256: `04eda224d6697caf0578ca21f8952f5025207702c2aa17c306f73c844b9a8e8d`. Render: `5dc3d4ed95ba44aefe81c7da3f0890e679b78bcdf110bfb669904c3186d31ebe`; result: `289a9cfa05cf3e56cb49ea33e9715e938b6d8dfc27903cce17f6224c72746304`. Transcript: `transcripts/emotion--elevenlabs-eleven-v4-tags--elevenlabs-eleven-v4.txt` (SHA-256 `a35621bfd42bab4314995254ffadcab54dcffd64a4f746bd3be9deb0fb18898d`).

Full waveform decoding succeeded. ASR WER 0.00%, CER 0.00%, substitutions/deletions/insertions 0/0/0 over 51 reference words. No normalized ASR differences. These differences are ASR evidence, not confirmed synthesis errors.

Native mechanism: Native inline delivery/emotion tags; canonical spoken words exclude tags; no request-level instructions.. Five source lines share one assembled turn; per-line rate and exact pause attribution unavailable without acoustic alignment.

Below-threshold intervals: 18; total 5.403 seconds. Complete signal intervals are in assessment.json; these are not independently verified semantic pauses.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Audible native-control ratings; Emotional/delivery ratings; Perceptual quality ratings. Signal measurements only; subjective ratings excluded and unscored.

<a id="speed-pauses--elevenlabs-eleven-v4-pause-tags--elevenlabs-eleven-v4"></a>
### 2026-09-25_06-tts-speed-pauses/elevenlabs-eleven-v4-pause-tags — elevenlabs/eleven_v4

[Selected audio](2026-09-25_06-tts-speed-pauses/elevenlabs-eleven-v4-pause-tags/elevenlabs-eleven-v4-pause-tags.wav); [manifest](2026-09-25_06-tts-speed-pauses/elevenlabs-eleven-v4-pause-tags/manifest.json); source: input/examples/tts/controls/speed-pauses/elevenlabs-eleven-v4-pause-tags.txt. Measured WAV SHA-256: `3a61857c47a6555b6fe3d0618ab05a1f75ceedf0bf067827a0d4d44501a631bd`. Input SHA-256: `800730c5be50d5ed5720858e7f3c3dbdc47bb233880ec606a799e67e3ee27b99`. Render: `34274a4a960ab6756187e6e111eb4b564b2f1d59d1851794479f124b965d1b98`; result: `630b5bd276026f11066be34d41caa335d802bb6c63f5991c392f88b885036ef2`. Transcript: `transcripts/speed-pauses--elevenlabs-eleven-v4-pause-tags--elevenlabs-eleven-v4.txt` (SHA-256 `7efb4f5e695aabd443df7a825b334d8a665183ef6ed73b7a8220d504e85414be`).

Full waveform decoding succeeded. ASR WER 0.00%, CER 0.00%, substitutions/deletions/insertions 0/0/0 over 51 reference words. No normalized ASR differences. These differences are ASR evidence, not confirmed synthesis errors.

Native mechanism: Native qualitative short/long pause tags only. Numeric speed, exact timed SSML, and unverified normal-pace/slow/fast tags are excluded.. Five source lines share one assembled turn; per-line rate and exact pause attribution unavailable without acoustic alignment.

Supplemental counting-number-fold WER: 0.00%; substitutions/deletions/insertions 0/0/0. This limited spelling equivalence is separate from the strict score and preserves missing words.

Below-threshold intervals: 23; total 9.933 seconds. Complete signal intervals are in assessment.json; these are not independently verified semantic pauses.

Human speech score: excluded and unscored. User-excluded dimensions: Pronunciation listening ratings; Speaker identity listening ratings; Seams and prosody ratings; Audible native-control ratings; Emotional/delivery ratings; Perceptual quality ratings. Signal measurements only; subjective ratings excluded and unscored.
