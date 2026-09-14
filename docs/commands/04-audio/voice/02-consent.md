# voice consent

Create a protected consent record with explicit per-action grants, or revoke an existing locator.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## consent

```bash
bun autoshow voice consent [subject-key] [flags]
```

Grant requires `<subject-key>` plus `--allow` with at least one explicit action. Omitted actions stay denied. `--revoke` cannot be combined with `--allow` or a subject key.

Consent records cannot be edited. A grant prints a `protected-consent:v1:...` locator for [clone](./05-clone.md) and other `--consent-ref` commands; after revoke, that locator is rejected. Do not put contact PII in `--actor-id` or `--provenance-ref`.

### Options

| Flag                     | Description                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `--provenance-ref <ref>` | Opaque non-secret provenance record reference                                                                 |
| `--allow <grants>`       | Comma-separated grants: `upload`, `new-synthesis`, `cache-reuse`, `resume`, `export`, `retention`, `deletion` |
| `--evidence <file>`      | Optional consent evidence file                                                                                |
| `--revoke <consent-ref>` | Protected consent-record locator to revoke                                                                    |
| `--reason <text>`        | Required non-sensitive revocation reason when `--revoke` is set                                               |
| `--actor-namespace <ns>` | Actor namespace: `local-user`, `project-role`, or `automation`; default `local-user`                          |
| `--actor-id <id>`        | Opaque actor ID                                                                                               |
| `--price`                | Validate and estimate without provider calls or artifact writes                                               |

### Examples

```bash
bun autoshow voice consent hero --provenance-ref release:hero-v1 --allow upload,new-synthesis,retention,deletion --actor-id casting_editor
bun autoshow voice consent --revoke protected-consent:v1:STORE:ASSET:SHA256 --reason "Authorization withdrawn" --actor-id casting_editor
```

Next: [import](./03-import.md).
