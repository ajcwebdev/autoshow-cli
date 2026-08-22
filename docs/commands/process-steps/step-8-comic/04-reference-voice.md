# comic reference-voice

`reference-voice` is the comic-native alias of the shared [`voice`](../step-9-voice/00-voice-overview.md) management surface. It creates, imports, auditions, approves, and retires durable character voice registrations. It never generates scene audio.

See the [`comic` overview](./00-comic-overview.md) for catalogs, runtime paths, and the full walkthrough.

## Outline

- [reference-voice](#reference-voice)
  - [Examples](#examples)
  - [Behavior](#behavior)

## reference-voice

```bash
bun autoshow comic reference-voice <subcommand> [flags]
```

Actions match `voice`: `list`, `consent`, `import`, `design`, `clone`, `audition`, `approve`, `retire`, and `delete`. Bare `comic reference-voice` runs `list`. Clone is instant only; providers without an instant API use the provider console, then `comic reference-voice import --voice-id`.

Each action has the same flags as the matching `voice` command. Run `bun autoshow comic reference-voice <action> --help` for the exact flags.

### Examples

```bash
bun autoshow comic reference-voice import hero --provider elevenlabs --model eleven_v3 --voice-id hpp4J3VqNfWAUOO0d1Us --provenance-ref project:casting
bun autoshow comic reference-voice audition vr_123 --representative-line "We leave at dawn." --price
bun autoshow comic reference-voice approve vr_123 --actor-id editor
```

### Behavior

- Every speaking subject used by [generate-audio](./05-generate-audio.md) must have one approved current registration for each selected provider/model/profile.
- `generate-audio` never creates, clones, approves, or deletes voices during synthesis.
- Voice catalogs stay under `input/characters/`.

Next: [generate-audio](./05-generate-audio.md).
