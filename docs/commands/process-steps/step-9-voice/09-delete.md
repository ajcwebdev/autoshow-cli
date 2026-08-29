# voice delete

Delete a project-owned remote provider voice and record the registration as deleted.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## delete

```bash
bun autoshow voice delete <registration-id> [flags]
```

`delete` removes the remote provider voice. It only works for a ready voice this project owns. `--confirm-voice-id` is required and must match that exact provider voice ID. If another current registration still uses the same provider voice, [retire](./08-retire.md) or revoke that registration first.

If a previous supported create is still in progress, `delete` finishes it first when the outcome is unambiguous. If a Fish or Grok completion is ambiguous, pass `--reconcile`. Hume deletion additionally requires the exact current remote name as `--expected-name` so the CLI can prove the mutable-name target before deletion.

### Options

| Flag | Description |
| --- | --- |
| `--generation-id <sha256>` | Optional unless more than one generation could match |
| `--confirm-voice-id <id>` | Required exact provider voice ID confirmation |
| `--expected-name <name>` | Required exact current remote name for Hume deletion |
| `--reconcile` | Complete an ambiguous provider provisioning journal without recreating the voice |
| `--price` | Validate and estimate without provider calls or artifact writes |

### Examples

```bash
bun autoshow voice delete vr_ID --generation-id GENERATION_SHA256 --confirm-voice-id EXACT_RESOURCE_ID --price
```
