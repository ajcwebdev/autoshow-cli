# voice clone

Create a protected consent-gated instant provider voice clone.

See the [`voice` overview](./00-voice-overview.md) for catalogs, artifacts, and the full flow.

## clone

```bash
bun autoshow voice clone <subject-key> [flags]
```

Store [consent](./02-consent.md) first and pass its locator as `--consent-ref`. Clone is instant only. Providers without an instant API use the provider console, then [import](./03-import.md) the approved ID with `voice import --voice-id`. If a previous Fish clone is still in progress, the next `clone` completes it without recreating the voice. If that completion is ambiguous, pass `--reconcile`. Remove `--price` only when you intend to execute the provider mutation.

### Options

| Flag | Description |
| --- | --- |
| `--provider <name>` | Voice provider: `elevenlabs`, `inworld`, `fish`, `cartesia`, or `speechify` |
| `--model <model>` | Provider TTS model used by this registration |
| `--profile <key>` | Casting profile key |
| `--voice-name <name>` | Desired provider account voice name |
| `--sample <path>` | Authorized local clone sample; repeatable for instant cloning |
| `--authorization-ref <ref>` | Opaque authorization record for the clone samples |
| `--description <text>` | Optional provider-safe voice description |
| `--consent-ref <ref>` | Protected consent-record reference |
| `--consent-name <name>` | Speechify clone consent full name |
| `--consent-email <email>` | Speechify clone consent email |
| `--locale <locale>` | Speechify clone locale |
| `--gender <gender>` | Speechify clone gender: `male`, `female`, or `not_specified` |
| `--provenance-ref <ref>` | Opaque non-secret provenance record reference |
| `--reconcile` | Complete an ambiguous Fish provisioning journal without recreating the voice |
| `--price` | Validate and estimate without provider calls or artifact writes |

### Examples

```bash
bun autoshow voice clone hero --provider elevenlabs --model eleven_v3 --voice-name HeroClone --sample input/voices/hero.wav --authorization-ref release:hero-v1 --consent-ref protected-consent:v1:STORE:ASSET:SHA256 --provenance-ref project:casting --price
bun autoshow voice clone hero --provider cartesia --model sonic-3.5-2026-05-04 --voice-name HeroClone --sample input/voices/hero.wav --authorization-ref release:hero-v1 --consent-ref protected-consent:v1:STORE:ASSET:SHA256 --provenance-ref project:casting --price
bun autoshow voice clone hero --provider speechify --model simba-3.2 --voice-name HeroClone --sample input/voices/hero.wav --consent-name "Authorized Speaker" --consent-email speaker@example.com --authorization-ref release:hero-v1 --consent-ref protected-consent:v1:STORE:ASSET:SHA256 --provenance-ref project:casting --price
bun autoshow voice clone hero --provider fish --model s2.1-pro --voice-name HeroClone --sample input/voices/hero.wav --authorization-ref release:hero-v1 --consent-ref protected-consent:v1:STORE:ASSET:SHA256 --provenance-ref project:casting --price
```

Next: [audition](./06-audition.md).
