# voice retire

Remove a registration generation from the current index while preserving catalog history.

```bash
bun autoshow voice retire vr_ID
bun autoshow voice retire vr_ID --generation-id GENERATION_SHA256 --reason "Casting changed"
```

Without `--reason`, retire locally. With a non-sensitive reason, mark it revoked instead. Omitted generation IDs use an unambiguous current/unique latest match. Neither action calls a provider or deletes remote resources. `--price` makes no changes.

Use [delete](09-delete.md) for eligible remote resources; consent revocation is a separate [consent](02-consent.md) action.
