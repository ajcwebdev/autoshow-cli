# voice import

Register an existing provider voice without creating a remote resource.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## Outline

- [import](#import)

## import

```bash
bun autoshow voice import <subject-key> [flags]
```

### Options

| Flag                         | Description                                                                 |
| ---------------------------- | --------------------------------------------------------------------------- |
| `--provider <name>`          | Voice provider: `elevenlabs`, `inworld`, `fish`, `cartesia`, or `speechify` |
| `--model <model>`            | Provider TTS model used by this registration                                |
| `--profile <key>`            | Casting profile key; default `default`                                      |
| `--voice-id <id>`            | Existing provider voice ID                                                  |
| `--origin <origin>`          | Voice origin such as `provider-stock` or `saved-reference`                  |
| `--provenance-ref <ref>`     | Opaque non-secret provenance record reference                               |
| `--consent-ref <ref>`        | Protected consent-record reference when consent is required                 |
| `--account-scope-hash <sha>` | Required SHA-256 account scope for account-namespaced voices                |
| `--capability-fixture-hash <sha>` | Optional pinned local capability fixture SHA-256                       |
| `--price`                    | Validate and estimate without provider calls or artifact writes             |

### Examples

```bash
bun autoshow voice import hero --provider elevenlabs --model eleven_v3 --voice-id hpp4J3VqNfWAUOO0d1Us --origin provider-stock --provenance-ref project:casting
```

Next: [design](./04-design.md).
