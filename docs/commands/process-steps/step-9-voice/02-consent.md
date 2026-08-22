# voice consent

Create a protected consent policy record with explicit per-action grants, or revoke an existing locator. Omitted grant actions default to denied. Contact PII must not be used as the actor or provenance reference.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## Outline

- [consent](#consent)

## consent

```bash
bun autoshow voice consent [subject-key] [flags]
```

Grant requires `<subject-key>` plus `--allow` with at least one explicit action. Revoke uses `--revoke <consent-ref>` and `--reason`. `--revoke` cannot be combined with `--allow` or a subject key.

Consent records cannot be edited. After revoke, the original locator fails every consent-gated action.

### Options

| Flag | Description |
| --- | --- |
| `--provenance-ref <ref>` | Opaque non-secret provenance record reference |
| `--allow <grants>` | Comma-separated grants: `upload`, `new-synthesis`, `cache-reuse`, `resume`, `export`, `retention`, `deletion` |
| `--evidence <file>` | Optional consent evidence file kept only in the protected store |
| `--revoke <consent-ref>` | Protected consent-record locator to revoke |
| `--reason <text>` | Required non-sensitive revocation reason when `--revoke` is set |
| `--actor-namespace <ns>` | Audit actor namespace: `local-user`, `project-role`, or `automation` |
| `--actor-id <id>` | Opaque audit actor ID |
| `--price` | Validate and estimate without provider calls or artifact writes |

### Examples

```bash
bun autoshow voice consent hero --provenance-ref release:hero-v1 --allow upload,new-synthesis,retention,deletion --actor-id casting_editor
bun autoshow voice consent --revoke protected-consent:v1:STORE:ASSET:SHA256 --reason "Authorization withdrawn" --actor-id casting_editor
```

A grant prints an opaque `protected-consent:v1:...` locator. Use that locator with [clone](./05-clone.md) and other consent-gated actions.

Next: [import](./03-import.md).
