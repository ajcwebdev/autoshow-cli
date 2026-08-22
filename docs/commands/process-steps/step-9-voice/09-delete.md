# voice delete

Delete a project-owned remote provider voice and record the registration as deleted.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## delete

```bash
bun autoshow voice delete <registration-id> [flags]
```

`delete` removes the remote provider voice. It only works for a ready voice this project owns. `--confirm-voice-id` is required and must match that exact provider voice ID. If another current registration still uses the same provider voice, [retire](./08-retire.md) or revoke that registration first.

If a previous Fish create is still in progress, `delete` finishes it first when the outcome is unambiguous. If that completion is ambiguous, pass `--reconcile`.

### Options

| Flag | Description |
| --- | --- |
| `--generation-id <sha256>` | Optional unless more than one generation could match |
| `--confirm-voice-id <id>` | Required exact provider voice ID confirmation |
| `--reconcile` | Complete an ambiguous Fish provisioning journal without recreating the voice |
| `--price` | Validate and estimate without provider calls or artifact writes |

### Examples

```bash
bun autoshow voice delete vr_ID --generation-id GENERATION_SHA256 --confirm-voice-id EXACT_RESOURCE_ID --price
```
