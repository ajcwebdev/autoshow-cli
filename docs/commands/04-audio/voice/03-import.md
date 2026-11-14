# voice import

Register an existing provider voice without creating a remote resource.

```bash
bun autoshow voice import hero --provider elevenlabs --model eleven_v3 --voice-id hpp4J3VqNfWAUOO0d1Us --provenance-ref project:casting
```

Requires an existing subject/profile brief, `--provider`, a supported synthesis `--model`, `--voice-id`, and opaque `--provenance-ref`. All active [TTS providers](../tts/overview.md#tts-services) support import. `--profile` defaults to `default`.

`--origin` accepts `provider-stock`, `designed`, `remixed`, `instant-clone`, `professional-clone`, `imported-custom`, or `saved-reference`. It defaults to stock except Gemini `voice_...` IDs, which default to imported custom. Stock imports become approved/current immediately; other origins require [audition](06-audition.md) and [approval](07-approve.md).

Non-stock voices require a lowercase SHA-256 `--account-scope-hash`, except Gemini verifies origin/scope with configured credentials. Supply `--consent-ref` when required. `--price` validates locally without inspecting the remote voice or writing registration files.
