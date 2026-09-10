# voice audition

Synthesize the pre-approval audition set.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## audition

```bash
bun autoshow voice audition <registration-id> [flags]
```

The set includes a neutral sample, the required representative line, emotional-contrast lines, a pronunciation sample, and a comparison passage. Remove `--price` only when you intend to purchase the synthesis.

### Options

| Flag | Description |
| --- | --- |
| `--generation-id <sha256>` | Optional unless more than one generation could match |
| `--representative-line <text>` | Required representative script line for the audition set |
| `--takes <n>` | Takes per audition passage, 1-5; default `1` |
| `--max-cents <n>` | Maximum authorized provider spend in cents |
| `--approve` | Approve the auditioned generation in the same run |
| `--actor-id <id>` | Required when `--approve` is set |
| `--price` | Validate and estimate without provider calls or artifact writes |

### Examples

```bash
bun autoshow voice audition vr_ID --representative-line "We leave at dawn." --price
bun autoshow voice audition vr_ID --generation-id GENERATION_SHA256 --representative-line "We leave at dawn." --approve --actor-id casting_editor
```

Next: [approve](./07-approve.md).
