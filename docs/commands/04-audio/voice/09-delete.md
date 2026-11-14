# voice delete

Explicitly delete a ready, eligibility-checked, project-owned remote voice and tombstone its registration.

```bash
bun autoshow voice delete vr_ID --generation-id GENERATION_SHA256 --confirm-voice-id EXACT_RESOURCE_ID --price
```

Supported providers: Gemini, ElevenLabs, Grok, and Inworld. `--confirm-voice-id` must exactly match the registered provider resource ID. Retire other current registrations sharing that resource first. Use `--generation-id` when ambiguous; `--reconcile` recovers interrupted provisioning without creating another voice.

`--price` checks local eligibility and confirmation without calls or writes. Remove it only to perform the deletion; [retirement](08-retire.md) alone never deletes a remote voice.
