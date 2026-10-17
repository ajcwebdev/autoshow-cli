# voice design

Generate voice candidates or save one selected candidate.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## design

```bash
bun autoshow voice design [subject-key] [flags]
```

Without `--save`, `design` creates preview candidates. `--save <candidate-id>` saves exactly one provider voice and cannot be combined with `--description`, `--preview-text`, `--candidates`, `--seed`, `--source-voice-id`, or `--creation-model`. ElevenLabs remix requires `--source-voice-id` and `--eligibility-snapshot-hash`. `--reconcile` is valid only with `--save`. Remove `--price` only when you intend to purchase previews or save a candidate.

Pass the subject key positionally for both creation and saving. The hidden `--subject-key <key>` compatibility alias remains accepted when saving; supplying a different positional key and alias is rejected. Saving uses the stored candidate's synthesis model and does not require `--model`.

Gemini creates a persistent resource during candidate generation. Supply `--voice-name` then; saving adopts that resource and requires the same name. Its creation model defaults to the selected synthesis model. The default is one candidate; larger counts create individually journaled resources. Seed and remix are unsupported. Google's returned sample remains the design preview. Optional `--preview-text` purchases a separate protected synthesis preview. Design operation pricing is unknown; price output reports that separately from estimated preview synthesis. Ambiguous creation blocks automatic recreation. [Voice design contract](https://ai.google.dev/gemini-api/docs/voice-design).

```bash
bun autoshow voice design hero --provider gemini --model gemini-3.8-flash-lite-tts --voice-name HeroGuide --description "Warm, measured narrator." --price
bun autoshow voice design hero --save CANDIDATE_ID --provider gemini --voice-name HeroGuide --provenance-ref project:casting --price
```

### Options

| Flag                                | Description                                                                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--provider <name>`                 | Design provider: `gemini`, `elevenlabs`, or `inworld`                                                                                               |
| `--model <model>`                   | Required for creation: Gemini `gemini-3.8-flash-tts` or `gemini-3.8-flash-lite-tts`, ElevenLabs `eleven_v3`, Inworld `realtime-tts-2`; no default   |
| `--profile <key>`                   | Casting profile key; default `default`                                                                                                              |
| `--creation-model <model>`          | ElevenLabs `eleven_ttv_v3` or `eleven_multilingual_ttv_v2`, Inworld `realtime-tts-2`; required except Gemini, which defaults to the synthesis model |
| `--description <text>`              | Required description: 20-1000 characters for ElevenLabs, 30-250 for Inworld, nonempty for Gemini                                                    |
| `--preview-text <text>`             | Preview passage; ElevenLabs requires 100-1000 characters, Gemini uses its returned sample unless supplied; other providers require nonempty text    |
| `--candidates <n>`                  | Integer 1-3 for ElevenLabs/Inworld, 1-20 for Gemini; default `3` for ElevenLabs, `1` otherwise                                                      |
| `--seed <n>`                        | Optional non-negative integer deterministic seed; ElevenLabs only, omitted by default                                                               |
| `--source-voice-id <id>`            | ElevenLabs remix source voice ID                                                                                                                    |
| `--eligibility-snapshot-hash <sha>` | Lowercase SHA-256 required with `--source-voice-id` for an ElevenLabs remix                                                                         |
| `--save <candidate-id>`             | Candidate ID to save as a provider voice                                                                                                            |
| `--voice-name <name>`               | Required when saving; also required during Gemini creation and must match when saved                                                                |
| `--provenance-ref <ref>`            | Opaque non-secret provenance record reference when `--save` is set                                                                                  |
| `--consent-ref <ref>`               | Protected consent-record reference when `--save` is set                                                                                             |
| `--reconcile`                       | Finish an ambiguous save without creating the voice again                                                                                           |
| `--price`                           | Validate and estimate without provider calls or artifact writes                                                                                     |

### Examples

```bash
bun autoshow voice design hero --provider elevenlabs --model eleven_v3 --creation-model eleven_ttv_v3 --description "Warm, weathered guide" --preview-text "The trail opens into a quiet valley at sunrise. Keep your voice warm and steady as you guide the group toward the old wooden bridge ahead." --price
bun autoshow voice design hero --provider inworld --model realtime-tts-2 --creation-model realtime-tts-2 --description "Warm, weathered guide with a grounded midrange" --preview-text "A representative passage." --price
bun autoshow voice design hero --save CANDIDATE_ID --provider elevenlabs --voice-name HeroGuide --provenance-ref project:casting --price
```

Next: [clone](./05-clone.md).
