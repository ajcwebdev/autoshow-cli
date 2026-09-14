# voice retire

Retire or revoke a registration so it is no longer current.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## retire

```bash
bun autoshow voice retire <registration-id> [flags]
```

Retire and revoke are local and do not call a provider or delete a remote resource. Use [delete](./09-delete.md) to delete a remote provider resource.

### Options

| Flag                       | Description                                                     |
| -------------------------- | --------------------------------------------------------------- |
| `--generation-id <sha256>` | Optional unless more than one generation could match            |
| `--reason <text>`          | Revoke instead of retire and record a non-sensitive reason      |
| `--price`                  | Validate and estimate without provider calls or artifact writes |

### Examples

```bash
bun autoshow voice retire vr_ID
bun autoshow voice retire vr_ID --generation-id GENERATION_SHA256
bun autoshow voice retire vr_ID --reason "Casting changed"
```

Next: [delete](./09-delete.md).
