# voice approve

Approve an auditioned registration and make it current.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## approve

```bash
bun autoshow voice approve <registration-id> [flags]
```

Approval makes that registration current for the subject, provider, model, and profile. One subject can hold independent current approvals per model, even when those approvals use the same provider voice.

### Options

| Flag | Description |
| --- | --- |
| `--generation-id <sha256>` | Optional unless more than one generation could match |
| `--actor-id <id>` | Required opaque approving actor ID |
| `--price` | Validate and estimate without provider calls or artifact writes |

### Examples

```bash
bun autoshow voice approve vr_ID --generation-id GENERATION_SHA256 --actor-id casting_editor
```

Next: [retire](./08-retire.md).
