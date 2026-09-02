# voice clone

Create a protected consent-gated instant provider voice clone.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## clone

```bash
bun autoshow voice clone <subject-key> [flags]
```

Store [consent](./02-consent.md) first and pass its locator as `--consent-ref`. API cloning supports ElevenLabs, Grok, Mistral, Cartesia, and Inworld. Hume cloning is completed in the Hume platform and then registered with [import](./03-import.md). OpenAI and Speechify cloning are deferred because their current consent workflows do not fit the common lifecycle contract. Grok creates include a deterministic attempt marker so `--reconcile` can find an ambiguous create without redispatch. Mistral uses the same crash-safe journal under `voice clone`; there is no `save-reference` subcommand.

### Options

| Flag | Description |
| --- | --- |
| `--provider <name>` | Clone provider: `elevenlabs`, `grok`, `mistral`, `cartesia`, or `inworld` |
| `--model <model>` | Provider TTS model used by this registration |
| `--profile <key>` | Casting profile key |
| `--voice-name <name>` | Desired provider account voice name |
| `--sample <path>` | Authorized local clone sample; repeatable for instant cloning |
| `--authorization-ref <ref>` | Opaque authorization record for the clone samples |
| `--description <text>` | Optional provider-safe voice description |
| `--consent-ref <ref>` | Protected consent-record reference |
| `--provenance-ref <ref>` | Opaque non-secret provenance record reference |
| `--reconcile` | Complete an ambiguous provider provisioning journal without recreating the voice |
| `--price` | Validate and estimate without provider calls or artifact writes |

### Examples

```bash
bun autoshow voice clone hero --provider elevenlabs --model eleven_v3 --voice-name HeroClone --sample input/voices/hero.wav --authorization-ref release:hero-v1 --consent-ref protected-consent:v1:STORE:ASSET:SHA256 --provenance-ref project:casting --price
bun autoshow voice clone hero --provider cartesia --model sonic-3.5-2026-05-04 --voice-name HeroClone --sample input/voices/hero.wav --authorization-ref release:hero-v1 --consent-ref protected-consent:v1:STORE:ASSET:SHA256 --provenance-ref project:casting --price
bun autoshow voice clone hero --provider mistral --model voxtral-mini-tts-2603 --voice-name HeroClone --sample input/voices/hero.wav --authorization-ref release:hero-v1 --consent-ref protected-consent:v1:STORE:ASSET:SHA256 --provenance-ref project:casting --price
```

Next: [audition](./06-audition.md).
