# Speed and pauses benchmark: detailed instructions

> **Eleven v3 benchmark defect:** The Eleven v3 case uses the same unvalidated long-prose tag construction as the emotion case, which failed spoken-text correctness in user listening review. This timing case is unverified and must not be treated as evidence of correct control handling.

9 retained cases. This is a standalone benchmark with its own plan and results, displayed within the TTS dashboard tab. Each case uses its documented provider controls; request success and valid audio do not establish audible-control or spoken-text correctness. [Listen](./listen.html) · [Historical plan](./benchmark-plan.json) · [Benchmark index](../2026-09-12-benchmark-report.md)

## Scope and cost

The selected retained results total $0.14525, using the recorded cost basis shown below. These values are not a refund or a reconstruction of all historical spending. The original controls work used an approved $1.01 cumulative ceiling. Existing recordings were reused; this update made no provider calls. The historical plan preserves retained original cases. Per-case manifests, render records, and exact request files are no longer retained; the table preserves the recorded measurements at their published precision.

## Measured execution

| Provider/model                   | Execution | Recorded s | Audio s | Cost USD | Cost basis      | Audio                                                                  |
| -------------------------------- | --------- | ---------- | ------- | -------- | --------------- | ---------------------------------------------------------------------- |
| elevenlabs/eleven_v3             | succeeded | 9.13       | 14.480  | $0.06900 | computed usage  | [WAV](./elevenlabs-eleven-v3-pacing-tags/speech.wav)                   |
| gemini/gemini-3.8-flash-lite-tts | succeeded | 22.04      | 34.840  | $0.00674 | provider usage  | [WAV](./gemini-gemini-3.8-flash-lite-tts-instructions/speech.wav)      |
| gemini/gemini-3.8-flash-tts      | succeeded | 24.93      | 30.840  | $0.00894 | provider usage  | [WAV](./gemini-gemini-3.8-flash-tts-instructions/speech.wav)           |
| grok/grok-tts                    | succeeded | 4.24       | 22.808  | $0.00341 | computed usage  | [WAV](./grok-grok-tts-numeric/speech.wav)                              |
| grok/grok-tts                    | succeeded | 3.07       | 21.756  | $0.00387 | computed usage  | [WAV](./grok-grok-tts-tags/speech.wav)                                 |
| inworld/realtime-tts-2           | succeeded | 6.66       | 26.140  | $0.00617 | computed usage  | [WAV](./inworld-realtime-tts-2-instructions/speech.wav)                |
| inworld/realtime-tts-2           | succeeded | 5.27       | 24.580  | $0.03762 | computed usage  | [WAV](./inworld-realtime-tts-2-steering-tags/speech.wav)               |
| soniox/tts-rt-v2                 | succeeded | 21.16      | 26.453  | $0.00501 | estimated usage | [WAV](./soniox-tts-rt-v2-numeric/soniox-tts-rt-v2-numeric.wav)         |
| soniox/tts-rt-v2                 | succeeded | 18.49      | 23.381  | $0.00448 | estimated usage | [WAV](./soniox-tts-rt-v2-pacing-tags/soniox-tts-rt-v2-pacing-tags.wav) |

## Verification

Historical verification checked selected audio and render hashes and read duration/format with ffprobe. The original per-case verification records are now unavailable. The retained recordings were probed again locally, and their current hashes and these report bytes are preserved in the dashboard evidence linked from the batch comparison. Earlier listening defects remain recorded above. No new listening assessment was performed.

## Cases

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
