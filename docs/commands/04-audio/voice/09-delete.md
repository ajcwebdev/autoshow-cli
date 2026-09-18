# voice delete

Delete a project-owned remote provider voice.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## delete

```bash
bun autoshow voice delete <registration-id> [flags]
```
`delete` only works for a ready voice this project owns. If another current registration still uses the same provider voice, [retire](./08-retire.md) that registration first. Hume deletion also requires `--expected-name` with the exact current Hume voice name.

### Options

| Flag                       | Description                                                     |
| -------------------------- | --------------------------------------------------------------- |
| `--generation-id <sha256>` | Optional unless more than one generation could match            |
| `--confirm-voice-id <id>`  | Required exact provider resource ID confirmation                |
| `--expected-name <name>`   | Exact current Hume voice name required for Hume deletion        |
| `--reconcile`              | Finish an interrupted voice create without creating a new voice |
| `--price`                  | Validate and estimate without provider calls or artifact writes |

### Examples

```bash
bun autoshow voice delete vr_ID --generation-id GENERATION_SHA256 --confirm-voice-id EXACT_RESOURCE_ID --price
```