# voice list

List the local catalog, one registration, or a provider catalog.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## Outline

- [list](#list)

## list

```bash
bun autoshow voice list [registration-id] [flags]
```

`list` has three read modes. With no arguments it prints the append-preserved registration catalog and the current approved pointer for each `(subject, provider, provider model, profile)`. That local dump never calls a provider.

With a registration id it inspects that generation. `--generation-id` is optional unless more than one generation could match. `--live` opts into a read-only provider readiness check for a ready resource. `--price` stays static-only and never implies `--live`. If that registration has an unambiguous Fish provisioning journal, `list <id>` completes it without recreating the voice. Ambiguous journals refuse until you pass `--reconcile`, matching TTS `--tts-allow-ambiguous-redispatch`. Bare `voice list` never completes a journal.

With `--provider` it pages a provider or account catalog. `--provider` cannot be combined with a registration id. `--price` validates the catalog operation and reports the dated capability fixture without reading the provider.

`status`, `inspect`, and `discover` remain hidden aliases. `voice inspect <id>` still performs today's live provider GET.

### Options

| Flag | Description |
| --- | --- |
| `--generation-id <sha256>` | Optional unless more than one generation could match |
| `--live` | Opt-in provider readiness check for one registration |
| `--provider <name>` | Voice provider: `elevenlabs`, `inworld`, `fish`, `cartesia`, or `speechify` |
| `--source <source>` | Catalog source: `account`, `provider-library`, or `shared-library` |
| `--cursor <cursor>` | Opaque provider pagination cursor |
| `--reconcile` | Complete an ambiguous Fish provisioning journal without recreating the voice |
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
bun autoshow voice list --provider fish --source account --price
bun autoshow voice list --provider speechify --source account --price
bun autoshow voice list --provider inworld --source account --price
```

Next: [consent](./02-consent.md).
