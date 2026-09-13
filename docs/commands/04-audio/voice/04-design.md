# voice design

Generate bounded provider voice candidates, or save exactly one selected candidate.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## design

```bash
bun autoshow voice design [subject-key] [flags]
```

Voice design is a two-step operation for ElevenLabs, Hume, and Inworld. Without `--save`, `design` creates unapproved candidates. `--save <candidate-id>` creates exactly one selected provider voice and cannot be combined with preview flags (`--description`, `--preview-text`, `--candidates`, `--seed`, `--source-voice-id`, `--creation-model`). ElevenLabs remix requires `--source-voice-id` and `--eligibility-snapshot-hash`. `--reconcile` is only valid with `--save`. Remove `--price` only when you intend to purchase provider previews or save one candidate.

### Options

| Flag | Description |
| --- | --- |
| `--provider <name>` | Design provider: `elevenlabs`, `hume`, or `inworld` |
| `--model <model>` | Provider TTS model used by this registration |
| `--profile <key>` | Casting profile key |
| `--creation-model <model>` | Provider model used only to create candidates |
| `--description <text>` | Provider voice design/remix description |
| `--preview-text <text>` | Preview passage; ElevenLabs requires 100-1000 characters, other design providers require nonempty text |
| `--candidates <n>` | Bounded candidate count |
| `--seed <n>` | Optional non-negative deterministic seed |
| `--source-voice-id <id>` | ElevenLabs remix source voice ID |
| `--eligibility-snapshot-hash <sha>` | Dated ElevenLabs remix eligibility proof SHA-256 |
| `--save <candidate-id>` | Candidate ID to save as a provider voice |
| `--subject-key <key>` | Canonical character or role key when `--save` is set |
| `--voice-name <name>` | Desired provider account voice name when `--save` is set |
| `--provenance-ref <ref>` | Opaque non-secret provenance record reference when `--save` is set |
| `--consent-ref <ref>` | Protected consent-record reference when `--save` is set |
| `--reconcile` | Complete an ambiguous provider provisioning journal without recreating the voice |
| `--price` | Validate and estimate without provider calls or artifact writes |

### Examples

```bash
bun autoshow voice design hero --provider elevenlabs --model eleven_v3 --creation-model eleven_ttv_v3 --description "Warm, weathered guide" --preview-text "The trail opens into a quiet valley at sunrise. Keep your voice warm and steady as you guide the group toward the old wooden bridge ahead." --price
bun autoshow voice design hero --provider inworld --model realtime-tts-2 --creation-model realtime-tts-2 --description "Warm, weathered guide with a grounded midrange" --preview-text "A representative passage." --price
bun autoshow voice design --save CANDIDATE_ID --provider elevenlabs --subject-key hero --voice-name HeroGuide --provenance-ref project:casting --price
```

Next: [clone](./05-clone.md).
