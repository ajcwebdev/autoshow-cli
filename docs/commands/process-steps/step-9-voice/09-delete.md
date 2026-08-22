# voice delete

Explicitly delete an eligible project-owned managed voice and tombstone its registration.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## Outline

- [delete](#delete)

## delete

```bash
bun autoshow voice delete <registration-id> [flags]
```

`delete` is an explicit provider-mutating action for ready, eligibility-checked, project-owned ElevenLabs, Inworld, Fish, Cartesia, and Speechify remote resources and requires `--confirm-voice-id` to equal the exact resource ID. A resource cannot be deleted while another current model-qualified registration shares its provider/resource identity. ElevenLabs, Inworld, Cartesia, and Speechify re-check project ownership, the account namespace, and the registered account scope inside the provider adapter before the delete request; Fish re-checks only the exact resource identity. AutoShow first appends a local `deletion-pending` generation, then records a terminal deleted tombstone after the provider confirms deletion. If a Fish provisioning journal is still pending, `delete` completes an unambiguous journal first. Ambiguous journals refuse until you pass `--reconcile`.

### Options

| Flag | Description |
| --- | --- |
| `--generation-id <sha256>` | Optional unless more than one generation could match |
| `--confirm-voice-id <id>` | Exact provider resource ID confirmation |
| `--reconcile` | Complete an ambiguous Fish provisioning journal without recreating the voice |
| `--price` | Validate and estimate without provider calls or artifact writes |

### Examples

```bash
bun autoshow voice delete vr_ID --generation-id GENERATION_SHA256 --confirm-voice-id EXACT_RESOURCE_ID --price
```
