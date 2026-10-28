# voice list

List the local catalog, one registration, or a provider catalog.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## list

```bash
bun autoshow voice list [registration-id] [flags]
```

With no arguments, `list` prints the local registration catalog and current index. That listing never calls a provider.

With a registration id, `list` inspects that registration. `--live` checks whether the provider still has the voice where remote inspection is supported. `--price` keeps the read local even when `--live` is set. Inspection can finish an interrupted voice creation when the result is already known. For an ambiguous result, `--reconcile` attempts recovery without creating another voice. `--price` does not finish interrupted creation.

With `--provider`, `list` prints a provider or account catalog. `--provider` cannot be combined with a registration id.

### Options

| Flag                       | Description                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| `--generation-id <sha256>` | Optional unless more than one generation could match                                                |
| `--live`                   | Provider readiness check; requires a registration ID and supported remote inspection                |
| `--provider <name>`        | Remote catalog provider: `gemini`, `elevenlabs`, `grok`, or `inworld`                               |
| `--source <source>`        | Requires `--provider`; `account` (default), `provider-library`, or ElevenLabs-only `shared-library` |
| `--cursor <cursor>`        | Provider pagination cursor; requires `--provider`                                                   |
| `--reconcile`              | Recover interrupted voice creation; requires a registration ID                                      |
| `--price`                  | Validate and estimate without provider calls or artifact writes                                     |

### Examples

```bash
bun autoshow voice list
bun autoshow voice list vr_ID
bun autoshow voice list vr_ID --live
bun autoshow voice list vr_ID --generation-id GENERATION_SHA256
bun autoshow voice list --provider elevenlabs
bun autoshow voice list --provider elevenlabs --source shared-library --cursor OPAQUE_CURSOR
bun autoshow voice list --provider inworld --source provider-library --price
```

Next: [consent](./02-consent.md).
