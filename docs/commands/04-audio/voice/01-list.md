# voice list

List the local catalog, one registration, or a provider catalog.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## list

```bash
bun autoshow voice list [registration-id] [flags]
```

With no arguments, `list` prints the local registration catalog and current index. That listing never calls a provider.

With a registration id, `list` inspects that registration. `--live` checks whether the provider still has the voice. `--price` keeps the read local even when `--live` is set. Inspecting one registration also finishes an interrupted voice creation when the outcome is already known, without creating the voice again. If that outcome is ambiguous, pass `--reconcile`. `--price` does not finish it.

With `--provider`, `list` prints a provider or account catalog. `--provider` cannot be combined with a registration id.

### Options

| Flag                       | Description                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| `--generation-id <sha256>` | Optional unless more than one generation could match                                                    |
| `--live`                   | Opt-in provider readiness check for one registration                                                    |
| `--provider <name>`        | Remote catalog provider: `elevenlabs`, `grok`, `mistral`, `speechify`, `hume`, `cartesia`, or `inworld` |
| `--source <source>`        | Catalog source: `account`, `provider-library`, or `shared-library`; default `account`                   |
| `--cursor <cursor>`        | Opaque provider pagination cursor                                                                       |
| `--reconcile`              | Complete an ambiguous provider provisioning journal without recreating the voice                        |
| `--price`                  | Validate and estimate without provider calls or artifact writes                                         |

### Examples

```bash
bun autoshow voice list
bun autoshow voice list vr_ID
bun autoshow voice list vr_ID --live
bun autoshow voice list vr_ID --generation-id GENERATION_SHA256
bun autoshow voice list --provider elevenlabs
bun autoshow voice list --provider elevenlabs --source shared-library --cursor OPAQUE_CURSOR
bun autoshow voice list --provider cartesia --source provider-library --price
```

Next: [consent](./02-consent.md).
