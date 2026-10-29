# voice import

Register an existing provider voice without creating a remote resource.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## import

```bash
bun autoshow voice import <subject-key> [flags]
```

The subject and profile must have an existing voice brief. A `provider-stock` import becomes current immediately; other origins still need [audition](./06-audition.md) and [approve](./07-approve.md). Gemini imports inspect the voice using configured credentials to determine its origin and account scope; other providers require `--account-scope-hash` for non-stock origins.

### Options

| Flag                         | Description                                                                                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--provider <name>`          | Required voice provider: `gemini`, `elevenlabs`, `soniox`, `grok`, `openai`, or `inworld`                                                                       |
| `--model <model>`            | Required provider TTS model used by this registration                                                                                                           |
| `--profile <key>`            | Casting profile key; default `default`                                                                                                                          |
| `--voice-id <id>`            | Required existing provider voice ID                                                                                                                             |
| `--origin <origin>`          | Voice origin: `provider-stock`, `designed`, `remixed`, `instant-clone`, `professional-clone`, `imported-custom`, or `saved-reference`; default `provider-stock` |
| `--provenance-ref <ref>`     | Required opaque non-secret provenance record reference                                                                                                          |
| `--consent-ref <ref>`        | Protected consent-record reference when consent is required                                                                                                     |
| `--account-scope-hash <sha>` | Required lowercase SHA-256 account scope for non-stock voices, except when Gemini verifies it                                                                   |
| `--price`                    | Validate and estimate without provider calls or artifact writes                                                                                                 |

### Examples

```bash
bun autoshow voice import hero --provider elevenlabs --model eleven_v3 --voice-id hpp4J3VqNfWAUOO0d1Us --provenance-ref project:casting
```

Next: [design](./04-design.md).
