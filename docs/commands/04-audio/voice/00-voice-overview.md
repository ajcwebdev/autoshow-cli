# voice

Manage reusable provider voices for standalone TTS and comic dialogue. `tts` uses existing voices; it never creates them.

## Overview

```bash
bun autoshow voice <subcommand> [flags]
```

Bare `voice` lists local registrations. Actions are [list](01-list.md), [consent](02-consent.md), [import](03-import.md), [design](04-design.md), [clone](05-clone.md), [audition](06-audition.md), [approve](07-approve.md), [retire](08-retire.md), and [delete](09-delete.md).

Import, local management, and audition support Gemini, ElevenLabs, Soniox, Grok, OpenAI, and Inworld. Remote catalogs and deletion support Gemini, ElevenLabs, Grok, and Inworld. Design supports Gemini, ElevenLabs, and Inworld; cloning additionally supports Grok. Registrations and approvals bind a synthesis model; account access and expiry can still block use.

Author voice briefs in `input/characters/character-voices.json`, independently of visual references:

```json
{
  "schemaVersion": 1,
  "briefs": [{
    "subjectKey": "hero",
    "profileKey": "default",
    "language": "en",
    "locale": "en-US",
    "timbre": "warm and grounded",
    "mannerisms": [],
    "prohibitedCaricatures": [],
    "pronunciations": [],
    "allowedOrigins": ["provider-stock", "saved-reference"]
  }]
}
```

## Typical flow

Record consent for gated operations, import an existing ID or design/clone a voice, audition the draft, then approve it. Stock imports become current immediately. Other origins need audition and approval. Use the provider credentials listed in the [TTS guide](../tts/overview.md#environment).

## Artifacts and pricing

`character-voice-registrations.json` preserves generations; `character-voice-current.json` selects approved current voices per subject/provider/model/profile. Both live beside the briefs, relocated with `--characters-root`. Consent, samples, and audition audio use protected runtime storage outside output runs. Retirement preserves catalog history.

Every action accepts `--price`, with no provider calls or writes. Planning may still require existing briefs, registrations, consent, and samples. Gemini design/clone operation prices remain unknown. `--generation-id` selects an exact generation; omission uses the current or unique latest match and rejects ambiguity. Run `voice <subcommand> --help` for full flags.
