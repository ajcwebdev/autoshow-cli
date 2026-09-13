# voice retire

Retire or revoke a registration generation and remove it from the current index.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## retire

```bash
bun autoshow voice retire <registration-id> [flags]
```

With `--reason`, the generation is revoked instead of retired. Neither action calls a provider or deletes a remote resource. Use [delete](./09-delete.md) to delete a remote provider resource.

### Options

| Flag | Description |
| --- | --- |
| `--generation-id <sha256>` | Optional unless more than one generation could match |
| `--reason <text>` | Revoke instead of retire and record a non-sensitive reason |
| `--price` | Validate and estimate without provider calls or artifact writes |

### Examples

```bash
bun autoshow voice retire vr_ID
bun autoshow voice retire vr_ID --generation-id GENERATION_SHA256
bun autoshow voice retire vr_ID --reason "Casting changed"
```

Next: [delete](./09-delete.md).
