# voice list

```bash
bun autoshow voice list [registration-id] [flags]
```

No arguments lists the local catalog/current index without provider calls. A registration ID inspects one voice; `--generation-id` resolves ambiguity. `--live` checks remote readiness where supported. Inspection may complete known interrupted creation; `--reconcile` attempts ambiguous recovery without creating another voice. `--price` keeps inspection local and never completes creation.

`--provider` selects a remote catalog and cannot accompany a registration ID. Supported providers: Gemini, ElevenLabs, Grok, and Inworld. `--source account` is the default; `provider-library` selects stock voices and ElevenLabs alone accepts `shared-library`. `--cursor` passes an opaque pagination token. Source/cursor require a provider; live/reconcile require a registration ID.

```bash
bun autoshow voice list
bun autoshow voice list vr_ID --live
bun autoshow voice list --provider elevenlabs --source shared-library --cursor OPAQUE_CURSOR
bun autoshow voice list --provider inworld --source provider-library --price
```

See [voice](00-voice-overview.md) for artifacts and generation selection.
