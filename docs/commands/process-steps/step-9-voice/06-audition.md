# voice audition

Synthesize and protect the canonical pre-approval audition set.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## Outline

- [audition](#audition)

## audition

```bash
bun autoshow voice audition <registration-id> [flags]
```

Auditioning synthesizes a protected canonical set containing neutral, representative, emotional contrast, pronunciation, and comparison passages. It is a provider-backed action unless `--price` is supplied.

### Options

| Flag                         | Description                                                     |
| ---------------------------- | --------------------------------------------------------------- |
| `--generation-id <sha256>`   | Optional unless more than one generation could match            |
| `--representative-line <text>` | Representative script line for the audition set               |
| `--takes <n>`                | Takes per audition passage (1-5)                                |
| `--max-cents <n>`            | Maximum authorized provider spend in cents                      |
| `--approve`                  | Approve the auditioned generation in the same run               |
| `--actor-id <id>`            | Required when `--approve` is set                                |
| `--price`                    | Validate and estimate without provider calls or artifact writes |

### Examples

```bash
bun autoshow voice audition vr_ID --representative-line "We leave at dawn." --takes 1 --price
bun autoshow voice audition vr_ID --generation-id GENERATION_SHA256 --representative-line "We leave at dawn." --approve --actor-id casting_editor
```

Next: [approve](./07-approve.md).
