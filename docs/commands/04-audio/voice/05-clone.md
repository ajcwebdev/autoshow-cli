# voice clone

Create a consent-gated instant provider voice clone.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## clone

```bash
bun autoshow voice clone <subject-key> [flags]
```

Create a voice brief for the subject and profile as shown in the [overview](./00-voice-overview.md#overview). Store [consent](./02-consent.md) with `upload` and `new-synthesis` granted, and pass its locator as `--consent-ref`.

Gemini additionally requires `--consent-audio`: a separate recording of the provider's consent statement. Both recordings must decode completely; the reference must last 10–30 seconds, and the consent recording must have a positive duration. Both enter protected storage before upload, and the clone creates a persistent provider voice. Gemini clone pricing is unknown. Follow the provider's [voice replication consent contract](https://ai.google.dev/gemini-api/docs/voice-replication).

```bash
bun autoshow voice clone hero --provider gemini --model gemini-3.8-flash-lite-tts --voice-name HeroClone --sample input/voices/hero.wav --consent-audio input/voices/hero-consent.wav --authorization-ref release:hero-v1 --consent-ref protected-consent:v1:STORE:ASSET:SHA256 --provenance-ref project:casting --price
```

### Options

| Flag                        | Description                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `--provider <name>`         | Clone provider: `gemini`, `elevenlabs`, `grok`, or `inworld`                                                   |
| `--model <model>`           | Provider TTS model used by this registration                                                                   |
| `--profile <key>`           | Casting profile key                                                                                            |
| `--voice-name <name>`       | Desired provider account voice name                                                                            |
| `--sample <path>`           | Authorized local sample; repeatable for ElevenLabs/Inworld, one for Gemini/Grok; Grok allows up to 120 seconds |
| `--authorization-ref <ref>` | Opaque authorization record for the clone samples                                                              |
| `--description <text>`      | Optional provider-safe voice description                                                                       |
| `--consent-audio <path>`    | Separate recorded consent statement required for Gemini                                                        |
| `--consent-ref <ref>`       | Protected consent-record reference                                                                             |
| `--provenance-ref <ref>`    | Opaque non-secret provenance record reference                                                                  |
| `--reconcile`               | Finish an ambiguous clone without creating the voice again                                                     |
| `--price`                   | Validate and estimate without provider calls or artifact writes                                                |

### Examples

```bash
bun autoshow voice clone hero --provider elevenlabs --model eleven_v3 --voice-name HeroClone --sample input/voices/hero.wav --authorization-ref release:hero-v1 --consent-ref protected-consent:v1:STORE:ASSET:SHA256 --provenance-ref project:casting --price
```

Next: [audition](./06-audition.md).
