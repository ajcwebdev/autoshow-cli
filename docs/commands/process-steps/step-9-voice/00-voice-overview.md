# voice

Manage durable provider voice registrations separately from speech synthesis. `comic reference-voice` is the comic-native alias of the same command surface.

## Outline

- [Overview](#overview)
- [Setup](#setup)
- [Typical Flow](#typical-flow)
- [Artifacts](#artifacts)
- [Voice Price Safety](#voice-price-safety)
- [Command Docs](#command-docs)

## Overview

```bash
bun autoshow voice <subcommand> [flags]
bun autoshow comic reference-voice <subcommand> [flags]
```

Available actions are `list`, `consent`, `import`, `design`, `clone`, `audition`, `approve`, `retire`, and `delete`. Bare `voice` and `comic reference-voice` run `list`. Run `bun autoshow voice <action> --help` for the exact action flags.

`voice` manages only these synthesis models: ElevenLabs `eleven_v3`, Inworld `realtime-tts-2`, Fish `s2.1-pro`, Cartesia `sonic-3.5-2026-05-04`, and Speechify `simba-3.2`. Every other implemented TTS model stays compatible with [`tts`](../step-4-tts/text-to-speech-and-voice.md) and uses a single existing stock, designed, or cloned voice ID.

Voice management reads authored profiles from `input/characters/character-voices.json`. Profiles are independent of the visual character catalog. A minimal catalog is:

```json
{
  "schemaVersion": 1,
  "briefs": [
    {
      "subjectKey": "hero",
      "profileKey": "default",
      "language": "en",
      "locale": "en-US",
      "timbre": "warm and grounded",
      "mannerisms": [],
      "prohibitedCaricatures": [],
      "pronunciations": [],
      "allowedOrigins": ["provider-stock", "saved-reference"]
    }
  ]
}
```

## Setup

Hosted voice-management providers need the same API keys as TTS:

```bash
ELEVENLABS_API_KEY=...
INWORLD_API_KEY=...
FISH_API_KEY=...
CARTESIA_API_KEY=...
SPEECHIFY_API_KEY=...
```

`--price` estimates cost without provider calls or writes.

## Typical Flow

1. Store [consent](./02-consent.md) before clone or other consent-gated work.
2. [List](./01-list.md) provider or account catalogs, or [import](./03-import.md) an existing voice ID.
3. Optionally [design](./04-design.md) candidates and save one with `--save`, or [clone](./05-clone.md) from local samples.
4. [Audition](./06-audition.md) the draft registration, then [approve](./07-approve.md) it.
5. [List](./01-list.md) the local catalog or one registration.
6. [Retire](./08-retire.md) or [delete](./09-delete.md) when the registration should leave the current index. Use `voice consent --revoke` to revoke a consent locator.

If a Fish create is interrupted, the next matching `design --save`, `clone`, `delete`, or `list <id>` completes it when the saved state is unambiguous. Pass `--reconcile` when the CLI reports the state as ambiguous.

## Artifacts

Sample audio, previews, auditions, and consent records stay in a separate owner-only store, not under ordinary project output.

Project files under `input/characters/` hold metadata and locators for those protected assets:

- `input/characters/character-voices.json`
- `input/characters/character-voice-registrations.json`
- `input/characters/character-voice-current.json`
- `input/characters/voice-candidates/<candidate-id>.json`
- `input/characters/voice-references/<subject>/<provider>/<registration>/<generation>/registration-snapshot.json`
- `input/characters/voice-references/<subject>/<provider>/<registration>/<generation>/audition-manifest.json`

The catalog keeps every prior generation. The current index contains only approved, ready registrations.

## Voice Price Safety

`design --price` reports a preview estimate from the synthesis model's character rate and the preview text length, plus the provider, creation model, and candidate count. ElevenLabs, Fish, and Inworld charge the preview text once, so the candidate count does not multiply the estimate. `design --save --price` reports zero estimated provider cost because the supported design flows include saving the selected resource.

Provider prices and eligibility can change. Treat the estimate as a preflight from AutoShow's dated pricing configuration and use the provider console when account-specific terms matter.

## Command Docs

- [list](./01-list.md)
- [consent](./02-consent.md)
- [import](./03-import.md)
- [design](./04-design.md)
- [clone](./05-clone.md)
- [audition](./06-audition.md)
- [approve](./07-approve.md)
- [retire](./08-retire.md)
- [delete](./09-delete.md)
