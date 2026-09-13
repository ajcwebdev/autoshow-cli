# Emotion, delivery and instruction benchmark: detailed instructions

> **Eleven v3 benchmark defect:** User listening review: the Eleven v3 recording speaks instruction prose, beginning with “as if sharing a private secret.” This case fails spoken-text correctness despite successful API execution and valid audio files.

Fresh synthesis completed. All final WAVs decoded successfully and stored hashes matched. [Listen to the recordings](./listen.html). 5 cases, five simple spoken lines per case. [Exact plan](./benchmark-plan.json) · [Other suite](../2026-09-12_06-tts-speed-pauses/benchmark-report.md).

The user requested longer, more detailed instructions wherever supported. Hume Octave 1 uses free-form acting descriptions. Inworld uses either the request instruction field or one complete inline instruction per line. Eleven v3 was incorrectly given long prose inside inline tags. These tags are not equivalent to a separate free-form instruction field; this construction needs replacement. Numeric speed, fixed tags and SSML on other models retain their existing syntax. Hume Octave 2 has no acting-description support. Nonverbal cues remain excluded. Emotion prompts focus on tone, pitch, articulation and intent; timing prompts keep emotion, pitch and volume steady while changing pace or explicit pauses.

Support checked on 2026-09-12: [Hume acting instructions](https://dev.hume.ai/docs/text-to-speech-tts/acting-instructions), [Inworld steering](https://docs.inworld.ai/tts/capabilities/steering), [Eleven v3 audio tags](https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue). Longer tags are an adherence experiment, not a guarantee of correct delivery.

## Scope and cost

This suite is estimated at $0.11752. Both suites together were preflighted at $0.40863 in new synthesis; the shared cumulative estimate is $1.00302. All 16 cases were synthesized afresh, including unchanged controls, as requested. No existing recordings were overwritten by this run. Existing model exclusions remain in force. No ambiguous redispatch was used. Request counts are recorded below.

Executed with the user-approved $1.01 cumulative ceiling:

```bash
bun src/tools/tts-controls-benchmark.ts --suite all --run --approved-budget-cents 101
```

## Verification

The price-only preflight passes all 137 commands after updating renamed fixture paths. `bun run check` passed. All 151 targeted local tests passed, including mocked dispatch checks that verify the expanded instructions reach the native provider request fields unchanged. All final audio and cached speech slots passed SHA-256 verification. Every final WAV decoded with ffmpeg. There are no human listening scores; audible instruction adherence still needs listening review.

## Measured execution

5 successful cases. Render-plan synthesis estimate for this suite: $0.11741. Conservative cumulative spending ledger for the related controls work: $1.00302. These are estimates, not confirmed provider charges.

| Case | Audio seconds | Requests | Estimated USD | Audio |
| --- | ---: | ---: | ---: | --- |
| hume-octave-1-acting | 17.57 | 5 | $0.02400 | [WAV](./hume-octave-1-acting/speech.wav) · [Manifest](./hume-octave-1-acting/manifest.json) |
| elevenlabs-eleven-v3-tags | 33.44 | 1 | $0.07490 | [WAV](./elevenlabs-eleven-v3-tags/speech.wav) · [Manifest](./elevenlabs-eleven-v3-tags/manifest.json) |
| grok-grok-tts-delivery | 12.39 | 1 | $0.00385 | [WAV](./grok-grok-tts-delivery/speech.wav) · [Manifest](./grok-grok-tts-delivery/manifest.json) |
| cartesia-sonic-3.6-2026-08-27-ssml | 13.76 | 5 | $0.01065 | [WAV](./cartesia-sonic-3.6-2026-08-27-ssml/speech.wav) · [Manifest](./cartesia-sonic-3.6-2026-08-27-ssml/manifest.json) |
| inworld-realtime-tts-2-instructions | 16.88 | 5 | $0.00400 | [WAV](./inworld-realtime-tts-2-instructions/speech.wav) · [Manifest](./inworld-realtime-tts-2-instructions/manifest.json) |

## Cases

### hume/octave-1 — acting

[Provider documentation](https://dev.hume.ai/docs/text-to-speech-tts/acting-instructions). Estimated $0.02400.

1. Spoken input: I sound calm. All is well.

   Request control: `{"hume":{"description":"Speak with calm reassurance, as if telling a close friend that everything is safe. Use a warm, settled tone, smooth articulation, and gentle falling inflection. Let the comfort be clear in the voice while keeping every word easy to hear. Say only the supplied words. Keep this as speech throughout."}}`

2. Spoken input: I sound excited! This is great news!

   Request control: `{"hume":{"description":"Speak with bright excitement, as if sharing good news that means a great deal to you. Use a lively, smiling tone and clear upward pitch movement. Put joyful emphasis on the good news and let the final words sound eager and pleased. Say only the supplied words. Keep this as speech throughout."}}`

3. Spoken input: I sound sad. I miss my friend.

   Request control: `{"hume":{"description":"Speak with sincere sadness, as if telling a close friend that you miss someone dear. Use a subdued, heavy tone and a gently falling pitch. Make the feeling tender and personal, with clear words and restrained vocal energy. Say only the supplied words. Keep this as speech throughout."}}`

4. Spoken input: I sound angry. That is not fair!

   Request control: `{"hume":{"description":"Speak with controlled anger, as if firmly telling someone that they have treated you unfairly. Use a tense, forceful tone and crisp consonants. Stress the words about unfairness and make the ending sound firm and final. Say only the supplied words. Keep this as speech throughout."}}`

5. Spoken input: I sound afraid. Please stay with me.

   Request control: `{"hume":{"description":"Speak with clear fear, as if asking someone you trust to stay close when you feel unsafe. Use a tense, uncertain tone with a slight tremble in the spoken words. Give the final request a vulnerable, pleading inflection. Say only the supplied words. Keep this as speech throughout."}}`


### elevenlabs/eleven_v3 — tags

[Provider documentation](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices). Estimated $0.07500.

1. Spoken input: [whispering softly and intimately, as if sharing a private secret with one trusted friend; every word clear and close] I am whispering. This is just for you.

2. Spoken input: [dryly sarcastic and unimpressed, with a pointed ironic lift on great and a flat weary finish] I sound sarcastic. Oh, great. More work. Just what I need.

3. Spoken input: [brightly excited and delighted by wonderful news, with a smiling voice and eager upward inflection] I sound excited! This is GREAT news! I cannot wait!

4. Spoken input: [firmly angry about unfair treatment, with tense forceful words and a decisive final no] I sound angry. That is not fair! I said no!

5. Spoken input: [deeply sad and missing a dear friend, with a subdued tender voice and gently falling inflection] I sound sad. I miss my friend. I wish they were here.


### grok/grok-tts — delivery

[Provider documentation](https://docs.x.ai/developers/model-capabilities/audio/text-to-speech). Estimated $0.00387.

1. Spoken input: &lt;whisper&gt;I am whispering. This is just for you.&lt;/whisper&gt;

2. Spoken input: &lt;loud&gt;I speak loudly. Please hear me.&lt;/loud&gt;

3. Spoken input: &lt;higher-pitch&gt;My voice has a high pitch.&lt;/higher-pitch&gt;

4. Spoken input: &lt;lower-pitch&gt;My voice has a low pitch.&lt;/lower-pitch&gt;

5. Spoken input: &lt;emphasis&gt;I stress this word: NOW.&lt;/emphasis&gt;


### cartesia/sonic-3.6-2026-08-27 — ssml

[Provider documentation](https://docs.cartesia.ai/build-with-cartesia/capability-guides/volume-speed-emotion.md). Estimated $0.01065.

1. Spoken input: &lt;emotion value="calm"/&gt; I sound calm. All is well.

2. Spoken input: &lt;emotion value="excited"/&gt; I sound excited! This is great news!

3. Spoken input: &lt;emotion value="sad"/&gt; I sound sad. I miss my friend.

4. Spoken input: &lt;emotion value="angry"/&gt; I sound angry. That is not fair!

5. Spoken input: &lt;emotion value="scared"/&gt; I sound afraid. Please stay with me.


### inworld/realtime-tts-2 — instructions

[Provider documentation](https://docs.inworld.ai/tts/capabilities/steering.md). Estimated $0.00400.

1. Spoken input: I sound calm. All is well.

   Request control: `{"inworld":{"steeringPrompt":"Speak with calm reassurance, as if telling a close friend that everything is safe. Use a warm, settled tone, smooth articulation, and gentle falling inflection. Let the comfort be clear in the voice while keeping every word easy to hear. Say only the supplied words. Keep this as speech throughout."}}`

2. Spoken input: I sound excited! This is great news!

   Request control: `{"inworld":{"steeringPrompt":"Speak with bright excitement, as if sharing good news that means a great deal to you. Use a lively, smiling tone and clear upward pitch movement. Put joyful emphasis on the good news and let the final words sound eager and pleased. Say only the supplied words. Keep this as speech throughout."}}`

3. Spoken input: I sound sad. I miss my friend.

   Request control: `{"inworld":{"steeringPrompt":"Speak with sincere sadness, as if telling a close friend that you miss someone dear. Use a subdued, heavy tone and a gently falling pitch. Make the feeling tender and personal, with clear words and restrained vocal energy. Say only the supplied words. Keep this as speech throughout."}}`

4. Spoken input: I sound angry. That is not fair!

   Request control: `{"inworld":{"steeringPrompt":"Speak with controlled anger, as if firmly telling someone that they have treated you unfairly. Use a tense, forceful tone and crisp consonants. Stress the words about unfairness and make the ending sound firm and final. Say only the supplied words. Keep this as speech throughout."}}`

5. Spoken input: I sound afraid. Please stay with me.

   Request control: `{"inworld":{"steeringPrompt":"Speak with clear fear, as if asking someone you trust to stay close when you feel unsafe. Use a tense, uncertain tone with a slight tremble in the spoken words. Give the final request a vulnerable, pleading inflection. Say only the supplied words. Keep this as speech throughout."}}`

