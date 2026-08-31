# voice import

Register an existing provider voice without creating a remote resource.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## import

```bash
bun autoshow voice import <subject-key> [flags]
```

A `provider-stock` import becomes current immediately. Other origins require `--account-scope-hash` and still need [audition](./06-audition.md) and [approve](./07-approve.md).

### Options

| Flag | Description |
| --- | --- |
| `--provider <name>` | Any of the 11 active TTS providers |
| `--model <model>` | Provider TTS model used by this registration |
| `--profile <key>` | Casting profile key; default `default` |
| `--voice-id <id>` | Existing provider voice ID |
| `--origin <origin>` | Voice origin: `provider-stock`, `designed`, `remixed`, `instant-clone`, `professional-clone`, `imported-custom`, or `saved-reference`; default `provider-stock` |
| `--provenance-ref <ref>` | Opaque non-secret provenance record reference |
| `--consent-ref <ref>` | Protected consent-record reference when consent is required |
| `--account-scope-hash <sha>` | Required for every origin other than `provider-stock` |
| `--price` | Validate and estimate without provider calls or artifact writes |

### Examples

```bash
bun autoshow voice import hero --provider elevenlabs --model eleven_v3 --voice-id hpp4J3VqNfWAUOO0d1Us --provenance-ref project:casting
```

Next: [design](./04-design.md).
