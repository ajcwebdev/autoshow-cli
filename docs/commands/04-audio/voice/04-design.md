# voice design

Create preview candidates, then save one selected candidate. Both stages require an existing subject/profile brief; `--profile` defaults to `default`.

```bash
bun autoshow voice design hero --provider elevenlabs --model eleven_v4 --creation-model eleven_ttv_v3 --description "Warm, weathered guide" --preview-text "The trail opens into a quiet valley at sunrise. Keep your voice warm and steady as you guide the group toward the old wooden bridge ahead." --price
bun autoshow voice design hero --save CANDIDATE_ID --provider elevenlabs --voice-name HeroGuide --provenance-ref project:casting --price
```

## Creation

Supply the subject, `--provider`, synthesis `--model`, and `--description`:

- **ElevenLabs:** synthesis `eleven_v3` or `eleven_v4`; required `--creation-model eleven_ttv_v3|eleven_multilingual_ttv_v2`. Description 20–1000 characters; required preview text 100–1000. `--candidates` 1–3, default 3; optional nonnegative integer `--seed`. Remix requires both `--source-voice-id` and lowercase SHA-256 `--eligibility-snapshot-hash`.
- **Inworld:** synthesis/creation model `realtime-tts-2`; `--creation-model` required. Description 30–250 characters and nonempty `--preview-text`; candidates 1–3, default 1. No seed or remix.
- **Gemini:** either Gemini 3.8 TTS synthesis model; creation model defaults to it and must match. Require `--voice-name` and a nonempty description; candidates 1–20, default 1. No seed/remix. Candidate generation creates persistent resources; returned samples are design previews. Optional `--preview-text` buys separate synthesis previews. Design operation pricing is unknown, separate from estimated preview synthesis.

```bash
bun autoshow voice design hero --provider gemini --model gemini-3.8-flash-lite-tts --voice-name HeroGuide --description "Warm, measured narrator." --price
bun autoshow voice design hero --provider inworld --model realtime-tts-2 --creation-model realtime-tts-2 --description "Warm, weathered guide with a grounded midrange" --preview-text "A representative passage." --price
```

## Saving

`--save` requires the subject, candidate ID, matching provider, `--voice-name`, and `--provenance-ref`; provide consent when required. The stored candidate supplies its synthesis model. Saving Gemini adopts the existing resource and must keep its original name. Ambiguous Gemini creation blocks automatic recreation until reconciliation.

Do not combine saving with description, preview text, candidate count, seed, source voice, or creation model. `--reconcile` is valid only with saving and recovers ambiguous work without recreating the voice. `--price` performs no calls or writes; remove it only for intended candidate creation or saving.
