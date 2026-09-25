# voice design

Generate voice candidates or save one selected candidate.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## design

```bash
bun autoshow voice design [subject-key] [flags]
```

Without `--save`, `design` creates preview candidates. `--save <candidate-id>` saves exactly one provider voice and cannot be combined with `--description`, `--preview-text`, `--candidates`, `--seed`, `--source-voice-id`, or `--creation-model`. ElevenLabs remix requires `--source-voice-id` and `--eligibility-snapshot-hash`. `--reconcile` is valid only with `--save`. Remove `--price` only when you intend to purchase previews or save a candidate.

Gemini creates a persistent resource during candidate generation. Supply `--voice-name` then; saving adopts that resource and requires the same name. Its creation model defaults to the selected synthesis model. The default is one candidate; larger counts create individually journaled resources. Seed and remix are unsupported. Google's returned sample remains the design preview. Optional `--preview-text` purchases a separate protected synthesis preview. Design operation pricing is unknown; price output reports that separately from estimated preview synthesis. Ambiguous creation blocks automatic recreation. [Voice design contract](https://ai.google.dev/gemini-api/docs/voice-design).

```bash
bun autoshow voice design hero --provider gemini --model gemini-3.8-flash-lite-tts --voice-name HeroGuide --description "Warm, measured narrator." --price
bun autoshow voice design --save CANDIDATE_ID --provider gemini --subject-key hero --voice-name HeroGuide --provenance-ref project:casting --price
```

### Options

| Flag                                | Description                                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--provider <name>`                 | Design provider: `gemini`, `elevenlabs`, or `inworld`                                                                                            |
| `--model <model>`                   | Provider TTS model used by this registration                                                                                                     |
| `--profile <key>`                   | Casting profile key                                                                                                                              |
| `--creation-model <model>`          | Provider model used only to create candidates                                                                                                    |
| `--description <text>`              | Provider voice design/remix description                                                                                                          |
| `--preview-text <text>`             | Preview passage; ElevenLabs requires 100-1000 characters, Gemini uses its returned sample unless supplied; other providers require nonempty text |
| `--candidates <n>`                  | Bounded candidate count                                                                                                                          |
| `--seed <n>`                        | Optional non-negative deterministic seed                                                                                                         |
| `--source-voice-id <id>`            | ElevenLabs remix source voice ID                                                                                                                 |
| `--eligibility-snapshot-hash <sha>` | Lowercase SHA-256 required with `--source-voice-id` for an ElevenLabs remix                                                                      |
| `--save <candidate-id>`             | Candidate ID to save as a provider voice                                                                                                         |
| `--subject-key <key>`               | Canonical character or role key when `--save` is set                                                                                             |
| `--voice-name <name>`               | Desired provider account voice name when `--save` is set                                                                                         |
| `--provenance-ref <ref>`            | Opaque non-secret provenance record reference when `--save` is set                                                                               |
| `--consent-ref <ref>`               | Protected consent-record reference when `--save` is set                                                                                          |
| `--reconcile`                       | Finish an ambiguous save without creating the voice again                                                                                        |
| `--price`                           | Validate and estimate without provider calls or artifact writes                                                                                  |

### Examples

```bash
bun autoshow voice design hero --provider elevenlabs --model eleven_v3 --creation-model eleven_ttv_v3 --description "Warm, weathered guide" --preview-text "The trail opens into a quiet valley at sunrise. Keep your voice warm and steady as you guide the group toward the old wooden bridge ahead." --price
bun autoshow voice design hero --provider inworld --model realtime-tts-2 --creation-model realtime-tts-2 --description "Warm, weathered guide with a grounded midrange" --preview-text "A representative passage." --price
bun autoshow voice design --save CANDIDATE_ID --provider elevenlabs --subject-key hero --voice-name HeroGuide --provenance-ref project:casting --price
```

Next: [clone](./05-clone.md).
