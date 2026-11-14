# comic generate-audio

Render dialogue from [approved voice registrations](../../04-audio/voice/00-voice-overview.md), with optional authored effects. Use [setup](./00-comic-overview.md#setup) variables and an existing reviewed scene for price planning.

## Options

- `--provider provider[=model]`: repeatable; omitted selects the cheapest hosted TTS target. `--all-providers` needs approvals for every selected target.
- `--profile`: casting profile, default `default`. Every speaking subject needs an approved registration for the exact provider/model/profile.
- `--mode auto|native|segmented`: default auto. Native requires a supported provider/scene; segmented synthesizes separate turns. Both ElevenLabs `eleven_v3` and `eleven_v4`, plus eligible Gemini dialogue, support native rendering. Overlaps and radio/intercom/telephone/computer effects require segmented rendering.
- `--delivery-policy strict|best-effort`: default strict; unsupported authored delivery either fails or is recorded and ignored.
- `--pacing-profile none|loose-comedy`: default none; loose-comedy adds a short inter-turn gap. Authored beat/pause directions produce fixed silence.
- `--role "LABEL=role:key"` or `LABEL=voice:key`: repeatable mapping for uncatalogued/compound labels; mapping a compound label to one subject removes its implicit overlap.
- `--max-generation-slots N`: checkpoint after limited outstanding slots per target, without a final WAV; use segmented mode.
- `--allow-ambiguous-redispatch`: explicitly permit repurchasing unresolved dialogue whose original request may already be billed. It does not unblock ambiguous effects.
- `--sfx-provider elevenlabs=eleven_text_to_sound_v2`: independent effect target, with no paid default. `--soundscape-timing-policy strict|proportional` defaults strict.
- `--step-concurrency tts-chunk=N` and `sfx=N` cap requests; SFX defaults to 2. [Shared TTS concurrency](../../04-audio/tts/overview.md) controls target-dependent limits; `--provider-concurrency` defaults to 7 and hosted mode to ramp.
- `--slideshow`: preflight reviewed visuals/encoding before synthesis, then render locally after completion. Price mode and generation checkpoints skip rendering.
- `--price`: plan remaining work without calls or writes; requires an existing scene run.

## Examples

The Harborlight scene needs approved `papa-bear` and `mira` voices. Include auditions, dialogue, and possible billed retries in the related estimate:

```bash
bun --no-env-file autoshow comic generate-audio "$SCRIPT" --provider elevenlabs=eleven_v3 --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-audio "$SCRIPT" --provider elevenlabs=eleven_v3 --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-audio "$SCRIPT" --provider elevenlabs=eleven_v3 --slideshow --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

The combined alternative needs all canonical panels; completed compatible dialogue is reused. Effects/role variants require a separately edited script, refreshed structure/scene/prompts, and matching approvals. They are not present in the supplied example.

## Sound effects

Author `**SFX:**`, `**VOCAL SFX:**`, or `**AMBIENCE:**` blocks, or inline `[[SFX: ...]]` / `[[VOCAL SFX: ...]]`. Ordinary visual staging creates no sound. Cues are required unless the prompt starts with `OPTIONAL`.

```markdown
**SFX:** {duration: 2.5s, gain: -3dB, pan: -0.4} A lantern latch clicks shut.
```

Duration accepts 0.5–30 seconds; explicit durations make estimates predictable. Gain changes mixing; pan ranges from -1 to 1. Blocks bind to source boundaries, inline cues to spoken offsets, and ambience spans the resolved scene unless paired `from`/`to` controls choose `scene-start`, `scene-end`, `previous-line-end`, or `next-line-start` (start cannot be scene-end; end cannot be scene-start). Timing resolves on the final dialogue clock: strict mode fails without exact evidence, while proportional records an estimate for mid-turn placement. Negative starts add pre-roll; late cues extend the scene.

Select `--sfx-provider` unless compatible retained work already pins it. Empty sound intent performs no SFX setup. Sound-only scenes make no TTS request; scenes without either speech or sound finish locally. Required cue failure prevents master publication; optional failures are recorded. Changing prompt/model buys new work; changing placement, gain, pan, or mastering reuses clips.

## Behavior

A missing/empty `--output-dir` can initialize a scene run; a populated incompatible directory fails. Price planning never initializes one. Voice bindings are immutable snapshots, never silent fallbacks or implicit voice provisioning. [Provider-specific delivery markup](../../04-audio/tts/overview.md) remains distinct from spoken text and request-level instructions.

Dialogue masters are 48 kHz stereo 24-bit PCM WAV at `audio/final/<target-key>.wav`; effect mixes use `<target-key>.soundscape.wav`, with retained semantic stems. Completed compatible audio remixes locally at zero provider cost. Preserve checkpoints and interrupted work.

[`resume`](../../00-setup-and-utilities/resume.md#comic-recovery) restores the recorded request and reuses completed slots. Its execution is not capped by the original invocation's generation-slot checkpoint limit. Unresolved admitted dialogue needs explicit redispatch authorization again; SFX cannot use that TTS-only flag.
