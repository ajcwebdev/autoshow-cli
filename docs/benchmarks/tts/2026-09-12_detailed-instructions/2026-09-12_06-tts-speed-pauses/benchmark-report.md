# Speed and pause benchmark: detailed instructions

> **Eleven v3 benchmark defect:** The Eleven v3 case uses the same unvalidated long-prose tag construction as the emotion case, which failed spoken-text correctness in user listening review. This timing case is unverified and must not be treated as evidence of correct control handling.

Fresh synthesis completed. All final WAVs decoded successfully and stored hashes matched. [Listen to the recordings](./listen.html). 11 cases, five simple spoken lines per case. [Exact plan](./benchmark-plan.json) · [Other suite](../2026-09-12_05-tts-emotion/benchmark-report.md).

The user requested longer, more detailed instructions wherever supported. Hume Octave 1 uses free-form acting descriptions. Inworld uses either the request instruction field or one complete inline instruction per line. Eleven v3 was incorrectly given long prose inside inline tags. These tags are not equivalent to a separate free-form instruction field; this construction needs replacement. Numeric speed, fixed tags and SSML on other models retain their existing syntax. Hume Octave 2 has no acting-description support. Nonverbal cues remain excluded. Emotion prompts focus on tone, pitch, articulation and intent; timing prompts keep emotion, pitch and volume steady while changing pace or explicit pauses.

Support checked on 2026-09-12: [Hume acting instructions](https://dev.hume.ai/docs/text-to-speech-tts/acting-instructions), [Inworld steering](https://docs.inworld.ai/tts/capabilities/steering), [Eleven v3 audio tags](https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue). Longer tags are an adherence experiment, not a guarantee of correct delivery.

## Scope and cost

This suite is estimated at $0.29111. Both suites together were preflighted at $0.40863 in new synthesis; the shared cumulative estimate is $1.00302. All 16 cases were synthesized afresh, including unchanged controls, as requested. No existing recordings were overwritten by this run. Existing model exclusions remain in force. No ambiguous redispatch was used. Request counts are recorded below.

Executed with the user-approved $1.01 cumulative ceiling:

```bash
bun src/tools/tts-controls-benchmark.ts --suite all --run --approved-budget-cents 101
```

## Verification

The price-only preflight passes all 137 commands after updating renamed fixture paths. `bun run check` passed. All 151 targeted local tests passed, including mocked dispatch checks that verify the expanded instructions reach the native provider request fields unchanged. All final audio and cached speech slots passed SHA-256 verification. Every final WAV decoded with ffmpeg. There are no human listening scores; audible instruction adherence still needs listening review.

## Measured execution

11 successful cases. Render-plan synthesis estimate for this suite: $0.29097. Conservative cumulative spending ledger for the related controls work: $1.00302. These are estimates, not confirmed provider charges.

| Case | Audio seconds | Requests | Estimated USD | Audio |
| --- | ---: | ---: | ---: | --- |
| hume-octave-1-numeric-trailing | 21.17 | 5 | $0.02835 | [WAV](./hume-octave-1-numeric-trailing/speech.wav) · [Manifest](./hume-octave-1-numeric-trailing/manifest.json) |
| hume-octave-1-inline-pauses | 27.48 | 5 | $0.03795 | [WAV](./hume-octave-1-inline-pauses/speech.wav) · [Manifest](./hume-octave-1-inline-pauses/manifest.json) |
| hume-octave-2-numeric-trailing | 20.26 | 1 | $0.03645 | [WAV](./hume-octave-2-numeric-trailing/speech.wav) · [Manifest](./hume-octave-2-numeric-trailing/manifest.json) |
| hume-octave-2-inline-pauses | 22.87 | 1 | $0.04605 | [WAV](./hume-octave-2-inline-pauses/speech.wav) · [Manifest](./hume-octave-2-inline-pauses/manifest.json) |
| elevenlabs-eleven-v3-pacing-tags | 14.48 | 1 | $0.06890 | [WAV](./elevenlabs-eleven-v3-pacing-tags/speech.wav) · [Manifest](./elevenlabs-eleven-v3-pacing-tags/manifest.json) |
| grok-grok-tts-numeric | 22.81 | 5 | $0.00340 | [WAV](./grok-grok-tts-numeric/speech.wav) · [Manifest](./grok-grok-tts-numeric/manifest.json) |
| grok-grok-tts-tags | 21.76 | 1 | $0.00385 | [WAV](./grok-grok-tts-tags/speech.wav) · [Manifest](./grok-grok-tts-tags/manifest.json) |
| cartesia-sonic-3.6-2026-08-27-numeric | 26.26 | 5 | $0.00923 | [WAV](./cartesia-sonic-3.6-2026-08-27-numeric/speech.wav) · [Manifest](./cartesia-sonic-3.6-2026-08-27-numeric/manifest.json) |
| cartesia-sonic-3.6-2026-08-27-ssml | 26.18 | 5 | $0.01301 | [WAV](./cartesia-sonic-3.6-2026-08-27-ssml/speech.wav) · [Manifest](./cartesia-sonic-3.6-2026-08-27-ssml/manifest.json) |
| inworld-realtime-tts-2-steering-tags | 24.58 | 1 | $0.03760 | [WAV](./inworld-realtime-tts-2-steering-tags/speech.wav) · [Manifest](./inworld-realtime-tts-2-steering-tags/manifest.json) |
| inworld-realtime-tts-2-instructions | 26.14 | 5 | $0.00617 | [WAV](./inworld-realtime-tts-2-instructions/speech.wav) · [Manifest](./inworld-realtime-tts-2-instructions/manifest.json) |

## Timing diagnostics

Whole-turn words/minute includes natural silence and different self-describing labels. It is a screening proxy, not a measurement of the identical counting phrase or a strict speed-multiplier test. Only cases with five timed turn boundaries are shown. No audio has been stretched or trimmed to improve these results.

| Case | Normal WPM | Slow WPM | Fast WPM | Screening result |
| --- | ---: | ---: | ---: | --- |
| hume-octave-1-numeric-trailing | 102.2 | 99.5 | 392.2 | Slow < normal < fast |
| hume-octave-2-numeric-trailing | 91.9 | 133.3 | 192.0 | Review: ordering differs |
| grok-grok-tts-numeric | 131.4 | 68.1 | 164.8 | Slow < normal < fast |
| cartesia-sonic-3.6-2026-08-27-numeric | 114.6 | 72.3 | 96.8 | Review: ordering differs |
| cartesia-sonic-3.6-2026-08-27-ssml | 116.2 | 68.2 | 100.0 | Review: ordering differs |
| inworld-realtime-tts-2-instructions | 105.8 | 63.0 | 143.7 | Slow < normal < fast |

## Cases

### hume/octave-1 — numeric-trailing

[Provider documentation](https://dev.hume.ai/docs/text-to-speech-tts/acting-instructions). Estimated $0.02835.

1. Spoken input: I speak slowly. One, two, three, four, five.

   Request control: `{"hume":{"speed":0.75,"trailingSilence":0}}`

2. Spoken input: I speak fast. One, two, three, four, five.

   Request control: `{"hume":{"speed":1.25,"trailingSilence":0}}`

3. Spoken input: A short pause comes next.

   Request control: `{"hume":{"speed":1,"trailingSilence":0.5}}`

4. Spoken input: A long pause comes next.

   Request control: `{"hume":{"speed":1,"trailingSilence":2}}`

5. Spoken input: I speak at a normal pace. One, two, three, four, five.

   Request control: `{"hume":{"speed":1,"trailingSilence":0}}`


### hume/octave-1 — inline-pauses

[Provider documentation](https://dev.hume.ai/docs/text-to-speech-tts/acting-instructions). Estimated $0.03795.

1. Spoken input: I speak at a normal pace. One, two, three, four, five.

   Request control: `{"hume":{"speed":1,"trailingSilence":0}}`

2. Spoken input: I pause here. [pause] Then I speak.

   Request control: `{"hume":{"speed":1,"trailingSilence":0}}`

3. Spoken input: I take a long pause here. [long pause] Then I speak.

   Request control: `{"hume":{"speed":1,"trailingSilence":0}}`

4. Spoken input: I pause here. [pause] Then I count. One, two, three.

   Request control: `{"hume":{"speed":1,"trailingSilence":0}}`

5. Spoken input: I speak at a normal pace again. One, two, three, four, five.

   Request control: `{"hume":{"speed":1,"trailingSilence":0}}`


### hume/octave-2 — numeric-trailing

[Provider documentation](https://dev.hume.ai/docs/text-to-speech-tts/acting-instructions). Estimated $0.03645.

1. Spoken input: I speak slowly. One, two, three, four, five.

   Request control: `{"hume":{"speed":0.75,"trailingSilence":0}}`

2. Spoken input: I speak fast. One, two, three, four, five.

   Request control: `{"hume":{"speed":1.25,"trailingSilence":0}}`

3. Spoken input: A short pause comes next.

   Request control: `{"hume":{"speed":1,"trailingSilence":0.5}}`

4. Spoken input: A long pause comes next.

   Request control: `{"hume":{"speed":1,"trailingSilence":2}}`

5. Spoken input: I speak at a normal pace. One, two, three, four, five.

   Request control: `{"hume":{"speed":1,"trailingSilence":0}}`


### hume/octave-2 — inline-pauses

[Provider documentation](https://dev.hume.ai/docs/text-to-speech-tts/acting-instructions). Estimated $0.04605.

1. Spoken input: I speak at a normal pace. One, two, three, four, five.

   Request control: `{"hume":{"speed":1,"trailingSilence":0}}`

2. Spoken input: I pause here. [pause] Then I speak.

   Request control: `{"hume":{"speed":1,"trailingSilence":0}}`

3. Spoken input: I take a long pause here. [long pause] Then I speak.

   Request control: `{"hume":{"speed":1,"trailingSilence":0}}`

4. Spoken input: I pause here. [pause] Then I count. One, two, three.

   Request control: `{"hume":{"speed":1,"trailingSilence":0}}`

5. Spoken input: I speak at a normal pace again. One, two, three, four, five.

   Request control: `{"hume":{"speed":1,"trailingSilence":0}}`


### elevenlabs/eleven_v3 — pacing-tags

[Provider documentation](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices). Estimated $0.06900.

1. Spoken input: [normal conversational pace, evenly spaced clear words, neutral pitch and steady volume] I speak at a normal pace. One, two, three, four, five.

2. Spoken input: [slow deliberate delivery, each number clearly drawn out, neutral pitch and steady volume] I speak slowly. One, two, three, four, five.

3. Spoken input: [fast brisk delivery, numbers following closely but clearly, neutral pitch and steady volume] I speak fast. One, two, three, four, five.

4. Spoken input: [normal conversational pace, evenly spaced clear words, neutral pitch and steady volume] I pause here. [short pause] Then I speak.

5. Spoken input: [normal conversational pace, evenly spaced clear words, neutral pitch and steady volume] I take a long pause here. [long pause] Then I speak.


### grok/grok-tts — numeric

[Provider documentation](https://docs.x.ai/developers/model-capabilities/audio/text-to-speech). Estimated $0.00341.

1. Spoken input: I speak at a normal pace. One, two, three, four, five.

   Request control: `{"grok":{"speed":1}}`

2. Spoken input: I speak slowly. One, two, three, four, five.

   Request control: `{"grok":{"speed":0.75}}`

3. Spoken input: I speak fast. One, two, three, four, five.

   Request control: `{"grok":{"speed":1.25}}`

4. Spoken input: I pause here. [pause] Then I speak.

   Request control: `{"grok":{"speed":1}}`

5. Spoken input: I take a long pause here. [long-pause] Then I speak.

   Request control: `{"grok":{"speed":1}}`


### grok/grok-tts — tags

[Provider documentation](https://docs.x.ai/developers/model-capabilities/audio/text-to-speech). Estimated $0.00387.

1. Spoken input: I speak at a normal pace. One, two, three, four, five.

2. Spoken input: &lt;slow&gt;I speak slowly. One, two, three, four, five.&lt;/slow&gt;

3. Spoken input: &lt;fast&gt;I speak fast. One, two, three, four, five.&lt;/fast&gt;

4. Spoken input: I pause here. [pause] Then I speak.

5. Spoken input: I take a long pause here. [long-pause] Then I speak.


### cartesia/sonic-3.6-2026-08-27 — numeric

[Provider documentation](https://docs.cartesia.ai/build-with-cartesia/capability-guides/volume-speed-emotion.md). Estimated $0.00923.

1. Spoken input: I speak at a normal pace. One, two, three, four, five.

   Request control: `{"cartesia":{"speed":1}}`

2. Spoken input: I speak slowly. One, two, three, four, five.

   Request control: `{"cartesia":{"speed":0.75}}`

3. Spoken input: I speak fast. One, two, three, four, five.

   Request control: `{"cartesia":{"speed":1.25}}`

4. Spoken input: I pause here. &lt;break time="500ms"/&gt; Then I speak.

   Request control: `{"cartesia":{"speed":1}}`

5. Spoken input: I take a long pause here. &lt;break time="2s"/&gt; Then I speak.

   Request control: `{"cartesia":{"speed":1}}`


### cartesia/sonic-3.6-2026-08-27 — ssml

[Provider documentation](https://docs.cartesia.ai/build-with-cartesia/capability-guides/volume-speed-emotion.md). Estimated $0.01301.

1. Spoken input: &lt;speed ratio="1"/&gt; I speak at a normal pace. One, two, three, four, five.

2. Spoken input: &lt;speed ratio="0.75"/&gt; I speak slowly. One, two, three, four, five.

3. Spoken input: &lt;speed ratio="1.25"/&gt; I speak fast. One, two, three, four, five.

4. Spoken input: &lt;speed ratio="1"/&gt; I pause here. &lt;break time="500ms"/&gt; Then I speak.

5. Spoken input: &lt;speed ratio="1"/&gt; I take a long pause here. &lt;break time="2s"/&gt; Then I speak.


### inworld/realtime-tts-2 — steering-tags

[Provider documentation](https://docs.inworld.ai/tts/capabilities/steering.md). Estimated $0.03762.

1. Spoken input: [Speak at an ordinary, comfortable conversational pace. Give each number in the counting phrase clear articulation and even spacing. Keep the pitch, emotion, and volume neutral and steady throughout the line.] I speak at a normal pace. One, two, three, four, five.

2. Spoken input: [Speak at a clearly slow, deliberate pace, noticeably slower than an ordinary conversation. Lengthen the spoken words and give each number room to be heard without inserting a long silence between numbers. Keep the pitch, emotion, and volume neutral and steady.] I speak slowly. One, two, three, four, five.

3. Spoken input: [Speak at a clearly fast, brisk pace, noticeably faster than an ordinary conversation. Move promptly from one number to the next while keeping every number distinct and understandable. Keep the pitch, emotion, and volume neutral and steady.] I speak fast. One, two, three, four, five.

4. Spoken input: [Return to an ordinary, comfortable conversational pace for the words on both sides of the break. Keep the pitch, emotion, and volume neutral and steady. Let the explicit break tag set the silence, then resume the same normal delivery without an extra dramatic pause.] I pause here. &lt;break time="500ms"/&gt; Then I speak.

5. Spoken input: [Return to an ordinary, comfortable conversational pace for the words on both sides of the break. Keep the pitch, emotion, and volume neutral and steady. Let the explicit break tag set the silence, then resume the same normal delivery without an extra dramatic pause.] I take a long pause here. &lt;break time="2s"/&gt; Then I speak.


### inworld/realtime-tts-2 — instructions

[Provider documentation](https://docs.inworld.ai/tts/capabilities/steering.md). Estimated $0.00617.

1. Spoken input: I speak at a normal pace. One, two, three, four, five.

   Request control: `{"inworld":{"steeringPrompt":"Speak at an ordinary, comfortable conversational pace. Give each number in the counting phrase clear articulation and even spacing. Keep the pitch, emotion, and volume neutral and steady throughout the line. Say only the supplied words."}}`

2. Spoken input: I speak slowly. One, two, three, four, five.

   Request control: `{"inworld":{"steeringPrompt":"Speak at a clearly slow, deliberate pace, noticeably slower than an ordinary conversation. Lengthen the spoken words and give each number room to be heard without inserting a long silence between numbers. Keep the pitch, emotion, and volume neutral and steady. Say only the supplied words."}}`

3. Spoken input: I speak fast. One, two, three, four, five.

   Request control: `{"inworld":{"steeringPrompt":"Speak at a clearly fast, brisk pace, noticeably faster than an ordinary conversation. Move promptly from one number to the next while keeping every number distinct and understandable. Keep the pitch, emotion, and volume neutral and steady. Say only the supplied words."}}`

4. Spoken input: I pause here. &lt;break time="500ms"/&gt; Then I speak.

   Request control: `{"inworld":{"steeringPrompt":"Return to an ordinary, comfortable conversational pace for the words on both sides of the break. Keep the pitch, emotion, and volume neutral and steady. Let the explicit break tag set the silence, then resume the same normal delivery without an extra dramatic pause. Say only the supplied words."}}`

5. Spoken input: I take a long pause here. &lt;break time="2s"/&gt; Then I speak.

   Request control: `{"inworld":{"steeringPrompt":"Return to an ordinary, comfortable conversational pace for the words on both sides of the break. Keep the pitch, emotion, and volume neutral and steady. Let the explicit break tag set the silence, then resume the same normal delivery without an extra dramatic pause. Say only the supplied words."}}`

