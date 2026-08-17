# voice approve

Atomically approve an auditioned registration and make its profile current.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## Outline

- [approve](#approve)

## approve

```bash
bun autoshow voice approve <registration-id> [flags]
```

Approval appends a new content-identified registration generation and atomically advances the sole current pointer for `(subject, provider, provider model, profile)`. This model-qualified key permits one subject to hold independent approved model selections that refer to the same provider voice resource. Approval does not create a scene snapshot.

### Options

| Flag                       | Description                                     |
| -------------------------- | ----------------------------------------------- |
| `--generation-id <sha256>` | Optional unless more than one generation could match |
| `--actor-id <id>`          | Opaque approving actor ID                       |

### Examples

```bash
bun autoshow voice approve vr_ID --generation-id AUDITIONED_GENERATION_SHA256 --actor-id casting_editor
```

Next: [retire](./08-retire.md).
