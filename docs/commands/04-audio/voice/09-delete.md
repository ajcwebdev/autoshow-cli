# voice delete

Delete a project-owned remote provider voice.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## delete

```bash
bun autoshow voice delete <registration-id> [flags]
```

`delete` works only for a ready voice this project owns. If another current registration still uses that provider voice, [retire](./08-retire.md) it first.

### Options

| Flag                       | Description                                                         |
| -------------------------- | ------------------------------------------------------------------- |
| `--generation-id <sha256>` | Optional unless more than one generation could match                |
| `--confirm-voice-id <id>`  | Required exact provider resource ID confirmation                    |
| `--expected-name <name>`   | Exact current Hume voice name required for Hume deletion            |
| `--reconcile`              | Finish an ambiguous voice creation without creating the voice again |
| `--price`                  | Validate and estimate without provider calls or artifact writes     |

### Examples

```bash
bun autoshow voice delete vr_ID --generation-id GENERATION_SHA256 --confirm-voice-id EXACT_RESOURCE_ID --price
```
