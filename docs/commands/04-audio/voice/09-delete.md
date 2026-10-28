# voice delete

Delete a project-owned remote provider voice.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## delete

```bash
bun autoshow voice delete <registration-id> [flags]
```

`delete` requires a ready, deletion-eligible remote voice owned by this project. If another current registration shares that provider voice, [retire](./08-retire.md) the other registration first.

### Options

| Flag                       | Description                                                         |
| -------------------------- | ------------------------------------------------------------------- |
| `--generation-id <sha256>` | Optional unless more than one generation could match                |
| `--confirm-voice-id <id>`  | Required exact provider resource ID confirmation                    |
| `--reconcile`              | Finish ambiguous provisioning without creating the voice again      |
| `--price`                  | Check resource eligibility and confirmation without calls or writes |

### Examples

```bash
bun autoshow voice delete vr_ID --generation-id GENERATION_SHA256 --confirm-voice-id EXACT_RESOURCE_ID --price
```
