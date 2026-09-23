# voice

Manage durable provider voice registrations separately from speech synthesis. Use this command for both standalone and comic character voices.

## Outline

- [Overview](#overview)
- [Setup](#setup)
- [Typical Flow](#typical-flow)
- [Artifacts](#artifacts)
- [Pricing](#pricing)
- [Command Docs](#command-docs)

## Overview

```bash
bun autoshow voice <subcommand> [flags]
```

Available actions are `list`, `consent`, `import`, `design`, `clone`, `audition`, `approve`, `retire`, and `delete`. Bare `voice` runs `list`.

Import, local listing, approval, retirement, and audition support ElevenLabs, Grok, Mistral, OpenAI, Speechify, Hume, Cartesia, and Inworld. Remote catalog listing and delete support all except OpenAI. Design supports ElevenLabs, Hume, and Inworld. Clone supports ElevenLabs, Grok, Mistral, Cartesia, and Inworld.

Author profiles in `input/characters/character-voices.json`. Profiles are independent of the visual character catalog. A minimal catalog is:

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

Hosted voice providers need the same API keys as TTS:

```bash
ELEVENLABS_API_KEY=...
XAI_API_KEY=...
MISTRAL_API_KEY=...
OPENAI_API_KEY=...
SPEECHIFY_API_KEY=...
HUME_API_KEY=...
INWORLD_API_KEY=...
CARTESIA_API_KEY=...
```

## Typical Flow

1. Store [consent](./02-consent.md) before clone or other consent-gated work.
2. [List](./01-list.md) provider or account catalogs, or [import](./03-import.md) an existing voice ID.
3. Optionally [design](./04-design.md) candidates and save one with `--save`, or [clone](./05-clone.md) from local samples.
4. [Audition](./06-audition.md) the draft registration, then [approve](./07-approve.md) it.
5. [Retire](./08-retire.md) or [delete](./09-delete.md) when the registration should no longer be current.

## Artifacts

The command writes its registration catalog and current index beside the authored profiles. These files are not timestamped `output/` runs:

- `input/characters/character-voice-registrations.json`
- `input/characters/character-voice-current.json`

Retired registrations remain in the catalog. Only approved voices are current.

## Pricing

Every voice operation accepts `--price`. Price mode performs no provider calls and writes no files.

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
