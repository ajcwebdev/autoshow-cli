# comic generate-audio

`generate-audio` renders script dialogue and authored sound effects. Dialogue requires approved voice registrations from [`voice`](../../04-audio/voice/00-voice-overview.md).

Provider models and delivery markup are in [TTS](../../04-audio/tts/overview.md). See the [`comic` overview](./00-comic-overview.md) for catalogs, runtime paths, and the full walkthrough.

## Outline

- [generate-audio](#generate-audio)
  - [Options](#options)
  - [Examples](#examples)
  - [Behavior](#behavior)

## generate-audio

### Options

| Flag                                   | Description                                                                                               | Default         |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------- |
| `--provider <provider[=model]>`        | Select a TTS provider/model; repeatable                                                                   | cheapest hosted |
| `--sfx-provider <provider=model>`      | Sound-effect model: `elevenlabs=eleven_text_to_sound_v2`                                                  | none            |
| `--step-concurrency sfx=<count>`       | Max parallel sound-effect requests                                                                        | `2`             |
| `--provider-concurrency <count>`       | Max hosted provider/model targets in parallel                                                             | `7`             |
| `--step-concurrency tts-chunk=<count>` | Max parallel hosted TTS requests per provider; `2` with `--all-providers`, `50` for a Grok-only selection | `30`            |
| `--concurrency-mode <ramp\|immediate>` | Start hosted requests at one and raise them to the cap (`ramp`), or start at the cap (`immediate`)        | `ramp`          |
| `--soundscape-timing-policy <policy>`  | `strict` requires exact cue timing; `proportional` estimates mid-turn positions from dialogue duration    | `strict`        |
| `--all-providers`                      | Select every hosted TTS target                                                                            | `false`         |
| `--profile <key>`                      | Approved voice registration profile                                                                       | `default`       |
| `--mode <mode>`                        | `auto`, `native`, or `segmented`                                                                          | `auto`          |
| `--delivery-policy <policy>`           | `strict` rejects unsupported authored delivery; `best-effort` records it and continues                    | `strict`        |
| `--pacing-profile <profile>`           | `none`, or `loose-comedy` to add a short gap between turns                                                | `none`          |
| `--max-generation-slots <count>`       | Checkpoint after at most this many outstanding requests per TTS target; requires segmented rendering      | none            |
| `--allow-ambiguous-redispatch`         | Retry dialogue already sent to a provider that has no recoverable audio; this may purchase it again       | `false`         |
| `--role <label=subject>`               | Map an uncatalogued or compound label to `role:key` or `voice:key`; repeatable                            | none            |
| `--slideshow`                          | Render the synchronized still-panel MP4 after audio completes                                             | `false`         |
| `--price`                              | Plan remaining work and cost without provider calls or writes                                             | `false`         |

### Examples

Use the variables and fresh workspace from the [Harborlight setup](./00-comic-overview.md#setup). These examples share the same four-panel scene.

Prepare the four-panel scene and approved registrations for both `papa-bear` and `mira`, for every selected provider/model/profile. The source bundle supplies no voice approvals. Include auditions, dialogue, and possible billed retries in the walkthrough's batch estimate before dispatch.

The main target is ElevenLabs v3. The optional Grok comparison needs separate approved Grok registrations for both speakers.

```bash
bun --no-env-file autoshow comic generate-audio "$SCRIPT" --provider elevenlabs=eleven_v3 --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-audio "$SCRIPT" --provider elevenlabs=eleven_v3 --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-audio "$SCRIPT" --provider grok=grok-tts --mode segmented --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

The supplied scene has no effects or uncatalogued speakers. For either variant below, point `SCRIPT` and `RUN` at a separate edited script and workspace, rebuild its structured scene and panel prompts, and review source placement. Add an authored effect such as a lantern latch with an explicit duration for the SFX variant. For the role variant, add an offscreen `CAMP RADIO` line and approve `role:camp-radio` for the selected model. Include this additional generation and any auditions in the batch estimate.

```bash
bun --no-env-file autoshow comic generate-audio "$SCRIPT" --provider elevenlabs=eleven_v3 --sfx-provider elevenlabs=eleven_text_to_sound_v2 --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-audio "$SCRIPT" --provider elevenlabs=eleven_v3 --role "CAMP RADIO=role:camp-radio" --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Use the original `SCRIPT` and `RUN` for the combined audio/slideshow alternative. It needs all four compatible canonical panel images before synthesis, then renders the video locally. Compatible completed dialogue is reused.

```bash
bun --no-env-file autoshow comic generate-audio "$SCRIPT" --provider elevenlabs=eleven_v3 --slideshow --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

### Behavior

- `--output-dir` selects that directory. A populated directory must already be a scene run. A missing or empty directory starts a new scene run. `--price` requires an existing scene run and does not create a directory.
- Authored timing directions such as `(beat)`, `(pause)`, `(moment)`, and `(long pause)` become fixed silences. `--pacing-profile loose-comedy` adds a short gap between turns. Compound speech overlaps unless `--role` assigns the label to one subject.
- Every speaking subject needs one approved registration for each selected provider, model, and profile. A later run can select any subset of those targets.
- `--mode auto` uses native multi-speaker synthesis when the provider and scene allow it, and per-turn synthesis otherwise. `native` fails when native synthesis is unavailable. `segmented` synthesizes each turn separately. ElevenLabs `eleven_v3` and Gemini TTS support native dialogue; Gemini can preserve supported authored delivery natively. Overlaps and voice effects such as radio, intercom, telephone, and computer require per-turn synthesis.
- `--price` reports the cost of work still to do. Completed audio that can be mixed on disk is $0. Dialogue already sent to a provider with no recoverable audio is purchased again only when you pass `--allow-ambiguous-redispatch`. That flag does not retry a blocked sound effect.
- `**SFX:**`, `**VOCAL SFX:**`, `**AMBIENCE:**`, `[[SFX: ...]]`, and `[[VOCAL SFX: ...]]` need `--sfx-provider`, unless a compatible retained plan supplies that target. A directive is required unless its prompt starts with `OPTIONAL`. `{duration: 2.5s, gain: -3dB, pan: -0.4}` sets duration and mix. Action effects, ambience, and vocal reactions use `elevenlabs=eleven_text_to_sound_v2`.
- Scenes without speech use no TTS provider; sound-effect-only scenes still publish a mix. With neither speech nor sound-effect directives, the command finishes locally.
- Dialogue is 48 kHz stereo 24-bit PCM WAV at `audio/final/<target-key>.wav`. A mix that includes sound effects is `audio/final/<target-key>.soundscape.wav`.
- `--slideshow` checks reviewed panels and local video encoding before any provider call, then runs [generate-slideshow](./05-generate-slideshow.md) after audio completes. Price planning and generation checkpoints skip the video. Use `--mode segmented` with `--max-generation-slots`; a checkpoint retains audio without publishing a final WAV.
- [`resume`](../../00-setup-and-utilities/resume.md#comic-recovery) continues the original request and reuses completed audio. Pass `--allow-ambiguous-redispatch` again when recovered dialogue still has no audio. A `--max-generation-slots` limit applies only to the run that set it.

Next: [generate-slideshow](./05-generate-slideshow.md).
