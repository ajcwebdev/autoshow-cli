# voice retire

Retire or revoke a registration generation and remove it from the current index.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## Outline

- [retire](#retire)

## retire

```bash
bun autoshow voice retire <registration-id> [flags]
```

Without `--reason`, `retire` is a local append-preserving transition. It removes the exact approved generation from the current index and does not delete remote resources.

With `--reason`, the same command runs today's revoke transition: it records the reason and moves protected assets to `deletion-required` when the registration policy requires it. It still does not silently delete remote resources. Remote delete stays on [delete](./09-delete.md). `retire --reason` is the only revocation spelling; the former `revoke` subcommand was removed.

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
