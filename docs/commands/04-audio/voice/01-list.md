# voice list

List the local catalog, one registration, or a provider catalog.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## list

```bash
bun autoshow voice list [registration-id] [flags]
```

`list` has three read modes. With no arguments it prints the local registration catalog and the current index for each subject, provider, model, and profile. That listing never calls a provider.

With a registration id it inspects that registration. `--live` checks whether the provider still has the voice. `--price` keeps the read local even when `--live` is set.

If a supported provisioning journal is unambiguous, `list <id>` completes it without recreating the voice. Ambiguous Grok journals refuse until you pass `--reconcile`. `--price` and bare `voice list` never complete a journal.

With `--provider` it lists a provider or account catalog. `--provider` cannot be combined with a registration id. `--price` validates the catalog request without reading the provider.

### Options

| Flag | Description |
| --- | --- |
| `--generation-id <sha256>` | Optional unless more than one generation could match |
| `--live` | Opt-in provider readiness check for one registration |
| `--provider <name>` | Remote catalog provider: every active provider except `openai` |
| `--source <source>` | Catalog source: `account`, `provider-library`, or `shared-library`; default `account` |
| `--cursor <cursor>` | Opaque provider pagination cursor |
| `--reconcile` | Complete an ambiguous provider provisioning journal without recreating the voice |
| `--price` | Validate and estimate without provider calls or artifact writes |

### Examples

```bash
bun autoshow voice list
bun autoshow voice list vr_ID
bun autoshow voice list vr_ID --live
bun autoshow voice list vr_ID --generation-id GENERATION_SHA256 --price
bun autoshow voice list --provider elevenlabs --source account
bun autoshow voice list --provider elevenlabs --source shared-library --cursor OPAQUE_CURSOR
bun autoshow voice list --provider cartesia --source provider-library --cursor OPAQUE_CURSOR
```

Next: [consent](./02-consent.md).
