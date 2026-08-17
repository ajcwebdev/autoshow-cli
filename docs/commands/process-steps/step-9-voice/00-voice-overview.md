# voice

Manage durable provider voice registrations separately from speech synthesis. The comic-native `comic reference-voice` command delegates to the same implementation and protected store.

## Outline

- [Overview](#overview)
- [Setup](#setup)
- [Typical Flow](#typical-flow)
- [Protected and Ordinary Artifacts](#protected-and-ordinary-artifacts)
- [Voice Price Safety](#voice-price-safety)
- [Command Docs](#command-docs)

## Overview

```bash
bun autoshow voice <subcommand> [flags]
bun autoshow comic reference-voice <subcommand> [flags]
```

Available actions are `list`, `consent`, `import`, `design`, `clone`, `audition`, `approve`, `retire`, and `delete`. Bare `voice` and `comic reference-voice` run `list`. Run `bun autoshow voice <action> --help` for the exact action flags.

`voice` manages only these synthesis models: ElevenLabs `eleven_v3`, Inworld `realtime-tts-2`, Fish `s2.1-pro`, Cartesia `sonic-3.5-2026-05-04`, and Speechify `simba-3.2`. Every other implemented TTS model stays compatible with [`tts`](../step-4-tts/text-to-speech-and-voice.md) and uses a single existing stock, designed, or cloned voice ID. fal.ai Maya remains synthesis-only until it exposes a durable voice port.

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

`--price` modes perform local validation and estimate only. They make no provider calls and write neither protected nor ordinary artifacts.

## Typical Flow

1. Store [consent](./02-consent.md) before clone or other consent-gated work.
2. [List](./01-list.md) provider or account catalogs, or [import](./03-import.md) an existing voice ID.
3. Optionally [design](./04-design.md) candidates and save one with `--save`, or [clone](./05-clone.md) from protected samples.
4. [Audition](./06-audition.md) the draft registration, then [approve](./07-approve.md) it.
5. [List](./01-list.md) the local catalog or one registration.
6. Interrupted Fish creates complete automatically when unambiguous. Pass `--reconcile` on `design --save`, `clone`, `delete`, or `list <id>` when the journal is ambiguous.
7. [Retire](./08-retire.md) or [delete](./09-delete.md) when the registration should leave the current index. Use `voice consent --revoke` to revoke a consent locator.

## Protected and Ordinary Artifacts

Protected reference, preview, audition, consent, and reconciliation bytes live under the registered owner-only runtime store. Policies are content-addressed, workspaces are disposable, and the protected root must be disjoint from ordinary output roots.

Ordinary character artifacts contain only strict versioned metadata and opaque protected-asset locators:

- `input/characters/character-voices.json`
- `input/characters/character-voice-registrations.json`
- `input/characters/character-voice-current.json`
- `input/characters/voice-candidates/<candidate-id>.json`
- `input/characters/voice-references/<subject>/<provider>/<registration>/<generation>/registration-snapshot.json`
- `input/characters/voice-references/<subject>/<provider>/<registration>/<generation>/audition-manifest.json`

Registration and audition generations are create-only and content-identified. The catalog preserves every prior generation; the current index contains only approved, ready registrations.

## Voice Price Safety

Management `--price` modes perform local validation and estimate only. They make no provider calls and write neither protected nor ordinary artifacts. Voice Design reports a numeric preview estimate from the exact provider, creation model, character count, and candidate count; ElevenLabs, Fish, and Inworld charge the preview text once. Materialization reports zero estimated provider cost because the supported design flows include saving the selected resource. Ordinary `tts`, `write`, resume, configuration loading, and synthesis price paths cannot express provider resource creation.

Provider prices and eligibility can change. Treat the estimate as a preflight derived from AutoShow's dated pricing configuration and use the provider console when account-specific terms matter.

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
