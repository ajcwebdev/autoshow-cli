# voice consent

Create an immutable protected consent record or revoke its locator. Omitted actions remain denied.

```bash
bun autoshow voice consent hero --provenance-ref release:hero-v1 --allow upload,new-synthesis,retention,deletion --actor-id casting_editor
bun autoshow voice consent --revoke protected-consent:v1:STORE:ASSET:SHA256 --reason "Authorization withdrawn" --actor-id casting_editor
```

A grant requires the subject, opaque `--provenance-ref`, `--actor-id`, and at least one comma-separated `--allow` action: `upload`, `new-synthesis`, `cache-reuse`, `resume`, `export`, `retention`, or `deletion`. Optional `--evidence` stays in protected storage. `--actor-namespace` accepts `local-user` (default), `project-role`, or `automation`; keep actor/provenance references free of contact PII.

Use the returned `protected-consent:v1:...` locator with consent-gated commands. Revocation requires `--reason` and `--actor-id`, rejects a subject or `--allow`, and makes the locator unusable. `--price` reports $0 without writes or provider calls; revocation planning validates locator syntax only.

See [clone](05-clone.md) for sample consent requirements.
