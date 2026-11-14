# voice approve

Approve a ready, auditioned registration and make it current for its subject/provider/model/profile.

```bash
bun autoshow voice approve vr_ID --generation-id GENERATION_SHA256 --actor-id casting_editor
```

An opaque `--actor-id` is required. Omit `--generation-id` only when the current or unique latest generation is unambiguous. Consent-bound voices need current permission for new synthesis. Approval is local; `--price` validates readiness without calls or writes.

[Retire](08-retire.md) removes a registration from the current index without deleting it.
