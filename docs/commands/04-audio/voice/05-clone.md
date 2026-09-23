# voice clone

Create a consent-gated instant provider voice clone.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## clone

```bash
bun autoshow voice clone <subject-key> [flags]
```

Store [consent](./02-consent.md) first, with `upload` and `new-synthesis` granted, and pass its locator as `--consent-ref`. Hume cloning is completed in the Hume platform and then registered with [import](./03-import.md).

### Options

| Flag                        | Description                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `--provider <name>`         | Clone provider: `elevenlabs`, `grok`, `mistral`, `cartesia`, or `inworld`                                         |
| `--model <model>`           | Provider TTS model used by this registration                                                                      |
| `--profile <key>`           | Casting profile key                                                                                               |
| `--voice-name <name>`       | Desired provider account voice name                                                                               |
| `--sample <path>`           | Authorized local clone sample; repeatable for ElevenLabs and Inworld, exactly one for Grok, Mistral, and Cartesia |
| `--authorization-ref <ref>` | Opaque authorization record for the clone samples                                                                 |
| `--description <text>`      | Optional provider-safe voice description                                                                          |
| `--consent-ref <ref>`       | Protected consent-record reference                                                                                |
| `--provenance-ref <ref>`    | Opaque non-secret provenance record reference                                                                     |
| `--reconcile`               | Finish an ambiguous clone without creating the voice again                                                        |
| `--price`                   | Validate and estimate without provider calls or artifact writes                                                   |

### Examples

```bash
bun autoshow voice clone hero --provider elevenlabs --model eleven_v3 --voice-name HeroClone --sample input/voices/hero.wav --authorization-ref release:hero-v1 --consent-ref protected-consent:v1:STORE:ASSET:SHA256 --provenance-ref project:casting --price
```

Next: [audition](./06-audition.md).
