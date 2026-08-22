# voice retire

Retire or revoke a registration generation and remove it from the current index.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## Outline

- [retire](#retire)

## retire

```bash
bun autoshow voice retire <registration-id> [flags]
```

Without `--reason`, `retire` removes the generation from the current index. It is local: it does not call a provider and does not delete remote resources.

With `--reason`, the same command revokes the generation instead. It records the reason and can flag protected assets for later cleanup. It still does not delete remote resources. Use [delete](./09-delete.md) to delete a remote provider resource.

### Options

| Flag | Description |
| --- | --- |
| `--generation-id <sha256>` | Optional unless more than one generation could match |
| `--reason <text>` | Revoke instead of retire and record a non-sensitive reason |

### Examples

```bash
bun autoshow voice retire vr_ID
bun autoshow voice retire vr_ID --generation-id GENERATION_SHA256
bun autoshow voice retire vr_ID --reason "Casting changed"
```

Next: [delete](./09-delete.md).
