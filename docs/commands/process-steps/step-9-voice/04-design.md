# voice design

Generate bounded provider voice candidates, or save exactly one selected candidate.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## design

```bash
bun autoshow voice design [subject-key] [flags]
```

Voice design is a two-step operation for ElevenLabs, MiniMax, Hume, and Inworld. Without `--save`, `design` creates unapproved candidates. `--save <candidate-id>` creates exactly one selected provider resource. Never infer `--save` from `--candidates 1`. ElevenLabs remix requires `--source-voice-id` and `--eligibility-snapshot-hash`.

`--save` cannot be combined with preview flags (`--description`, `--preview-text`, `--candidates`, `--seed`, `--source-voice-id`, `--creation-model`). A saved registration must still pass [audition](./06-audition.md) and [approve](./07-approve.md) before comic rendering can use it. Ambiguous journals refuse until you pass `--reconcile`. Remove `--price` only when you intend to purchase provider previews or save one candidate.

### Options

| Flag | Description |
| --- | --- |
| `--provider <name>` | Design provider: `elevenlabs`, `minimax`, `hume`, or `inworld` |
| `--model <model>` | Provider TTS model used by this registration |
| `--profile <key>` | Casting profile key |
| `--creation-model <model>` | Provider model used only to create candidates |
| `--description <text>` | Provider voice design/remix description |
| `--preview-text <text>` | 100-1000 character preview passage |
| `--candidates <n>` | Bounded candidate count |
| `--seed <n>` | Optional non-negative deterministic seed |
| `--source-voice-id <id>` | ElevenLabs remix source voice ID |
| `--eligibility-snapshot-hash <sha>` | ElevenLabs remix eligibility snapshot SHA-256 |
| `--save <candidate-id>` | Candidate ID to save as a durable provider voice |
| `--subject-key <key>` | Canonical character or role key when `--save` is set |
| `--voice-name <name>` | Desired provider account voice name when `--save` is set |
| `--provenance-ref <ref>` | Opaque non-secret provenance record reference when `--save` is set |
| `--consent-ref <ref>` | Protected consent-record reference when `--save` is set |
| `--reconcile` | Complete an ambiguous provider provisioning journal without recreating the voice |
| `--price` | Validate and estimate without provider calls or artifact writes |

### Examples

```bash
bun autoshow voice design hero --provider elevenlabs --model eleven_v3 --creation-model eleven_ttv_v3 --description "Warm, weathered guide" --preview-text "A representative passage of at least one hundred characters that exercises the intended voice in one full sentence." --price
bun autoshow voice design hero --provider inworld --model realtime-tts-2 --creation-model realtime-tts-2 --description "Warm, weathered guide with a grounded midrange" --preview-text "A representative passage." --price
bun autoshow voice design --save CANDIDATE_ID --provider elevenlabs --subject-key hero --voice-name HeroGuide --provenance-ref project:casting --price
```

Next: [clone](./05-clone.md).
