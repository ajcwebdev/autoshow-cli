# voice approve

Approve an auditioned registration and make its profile current.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## approve

```bash
bun autoshow voice approve <registration-id> [flags]
```

The registration must already be a ready, auditioned generation. Consent-bound voices also require current consent permitting new synthesis. Approval is local and does not call a provider. One subject can keep a separate current approval for each provider, model, and profile.

### Options

| Flag                       | Description                                                                  |
| -------------------------- | ---------------------------------------------------------------------------- |
| `--generation-id <sha256>` | Defaults to the current or unique latest generation; required when ambiguous |
| `--actor-id <id>`          | Required opaque approving actor ID                                           |
| `--price`                  | Validate and estimate without provider calls or artifact writes              |

### Examples

```bash
bun autoshow voice approve vr_ID --generation-id GENERATION_SHA256 --actor-id casting_editor
```

Next: [retire](./08-retire.md).
