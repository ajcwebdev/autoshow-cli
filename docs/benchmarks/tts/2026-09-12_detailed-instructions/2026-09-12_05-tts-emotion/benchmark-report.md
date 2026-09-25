# Emotion and delivery benchmark: detailed instructions

> **Eleven v3 benchmark defect:** User listening review: the Eleven v3 recording speaks instruction prose, beginning with “as if sharing a private secret.” This case fails spoken-text correctness despite successful API execution and valid audio files.

6 retained cases. Each case uses its documented provider controls; request success and valid audio do not establish audible-control or spoken-text correctness. [Listen](./listen.html) · [Historical plan](./benchmark-plan.json) · [Batch comparison](../../2026-09-12-benchmark-report.md)

## Scope and cost

The selected retained results total $0.09537, using the recorded cost basis shown below. These values are not a refund or a reconstruction of all historical spending. The original controls work used an approved $1.01 cumulative ceiling. Existing recordings were reused; this update made no provider calls. The historical plan preserves retained original cases. Per-case manifests, render records, and exact request files are no longer retained; the table preserves the recorded measurements at their published precision.

## Measured execution

| Provider/model                   | Execution | Recorded s | Audio s | Cost USD | Cost basis      | Audio                                                                    |
| -------------------------------- | --------- | ---------- | ------- | -------- | --------------- | ------------------------------------------------------------------------ |
| elevenlabs/eleven_v3             | succeeded | 15.71      | 33.440  | $0.07500 | computed usage  | [WAV](./elevenlabs-eleven-v3-tags/speech.wav)                            |
| gemini/gemini-3.8-flash-lite-tts | succeeded | 19.84      | 20.280  | $0.00393 | provider usage  | [WAV](./gemini-gemini-3.8-flash-lite-tts-instructions/speech.wav)        |
| gemini/gemini-3.8-flash-tts      | succeeded | 20.37      | 19.960  | $0.00580 | provider usage  | [WAV](./gemini-gemini-3.8-flash-tts-instructions/speech.wav)             |
| grok/grok-tts                    | succeeded | 2.12       | 12.390  | $0.00387 | computed usage  | [WAV](./grok-grok-tts-delivery/speech.wav)                               |
| inworld/realtime-tts-2           | succeeded | 5.21       | 16.880  | $0.00400 | computed usage  | [WAV](./inworld-realtime-tts-2-instructions/speech.wav)                  |
| soniox/tts-rt-v2                 | succeeded | 11.03      | 14.080  | $0.00276 | estimated usage | [WAV](./soniox-tts-rt-v2-emotion-tags/soniox-tts-rt-v2-emotion-tags.wav) |

## Verification

Historical verification checked selected audio and render hashes and read duration/format with ffprobe. The original per-case verification records are now unavailable. The retained recordings were probed again locally, and their current hashes and these report bytes are preserved in the dashboard evidence linked from the batch comparison. Earlier listening defects remain recorded above. No new listening assessment was performed.

## Cases

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
