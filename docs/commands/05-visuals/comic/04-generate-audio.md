# comic generate-audio

`generate-audio` consumes an existing compatible scene run and approved current voice registrations. It never creates, clones, approves, or deletes voices during synthesis.

Provider models, voices, and delivery markup are in [TTS](../../04-audio/tts/overview.md). See the [`comic` overview](./00-comic-overview.md) for catalogs, runtime paths, and the full walkthrough.

## Outline

- [generate-audio](#generate-audio)
  - [Options](#options)
  - [Examples](#examples)
  - [Behavior](#behavior)

## generate-audio

### Options

| Flag                                   | Description                                                                                                                                      | Default         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| `--provider <provider[=model]>`        | Select a TTS provider/model; repeatable                                                                                                          | cheapest hosted |
| `--sfx-provider <provider=model>`      | Dedicated sound-effect target: `elevenlabs=eleven_text_to_sound_v2`, `replicate=sepal/audiogen@<pinned-version>`, or `stability=stable-audio-3`  | none            |
| `--sfx-license-use <classification>`   | Intended use for license-restricted SFX: `noncommercial`, `commercial`, or `unknown`. AudioGen requires `noncommercial`                          | none            |
| `--step-concurrency sfx=<count>`       | Max parallel sound-effect requests                                                                                                               | `2`             |
| `--provider-concurrency <count>`       | Max hosted provider/model targets rendering in parallel                                                                                          | `7`             |
| `--step-concurrency tts-chunk=<count>` | Max parallel hosted TTS requests per provider                                                                                                    | `30`            |
| `--concurrency-mode <ramp\|immediate>` | Approach hosted dialogue and sound-effect caps from one request per provider/account lane (`ramp`) or start at the configured caps (`immediate`) | `ramp`          |
| `--soundscape-timing-policy <policy>`  | Time inline sound-effect cues with exact turn timing (`strict`) or spread them across the turn range (`proportional`)                            | `strict`        |
| `--all-providers`                      | Select every hosted TTS target                                                                                                                   | `false`         |
| `--profile <key>`                      | Approved voice registration profile                                                                                                              | `default`       |
| `--mode <mode>`                        | `auto`, `native`, or `segmented`                                                                                                                 | `auto`          |
| `--delivery-policy <policy>`           | `strict` rejects unsupported authored delivery; `best-effort` records it and continues                                                           | `strict`        |
| `--pacing-profile <profile>`           | `none`, or `loose-comedy` for fixed pause and between-turn silences                                                                              | `none`          |
| `--max-generation-slots <count>`       | Generate at most this many unresolved slots, write a checkpoint, and exit without a final WAV                                                    | none            |
| `--allow-ambiguous-redispatch`         | Resume a slot that was sent to a provider but has no recoverable audio; may repurchase it                                                        | `false`         |
| `--role <label=subject>`               | Resolve an uncatalogued or compound label to `role:key` or `voice:key`; repeatable                                                               | none            |
| `--slideshow`                          | Render the synchronized still-panel MP4 once audio completes                                                                                     | `false`         |
| `--price`                              | Plan remaining work and cost without provider calls or writes                                                                                    | `false`         |

### Examples

```bash
bun autoshow comic generate-audio 01-01 --provider hume=octave-2
bun autoshow comic generate-audio 01-01 --provider mistral=voxtral-mini-tts-2603 --mode segmented
bun autoshow comic generate-audio 01-01 --provider elevenlabs=eleven_v3 --sfx-provider elevenlabs=eleven_text_to_sound_v2
bun autoshow comic generate-audio 01-01 --sfx-provider replicate=sepal/audiogen@154b3e5141493cb1b8cec976d9aa90f2b691137e39ad906d2421b74c2a8c52b8 --sfx-license-use noncommercial
bun autoshow comic generate-audio 01-01 --provider hume --role "SHIP COMPUTER=role:computer"
bun autoshow comic generate-audio 01-01 --provider hume --slideshow
bun autoshow comic generate-audio 01-01 --all-providers --price
```

### Behavior

- With `--output-dir`, the command uses that exact directory: a populated directory must already be a compatible scene run, and a missing or empty directory is initialized as a fresh scene workspace. `--price` requires an existing compatible run and never creates an output directory.
- `--pacing-profile loose-comedy` maps `beat`, `pause`/`moment`, and `long`/`heavy` cues to fixed silences and adds a short gap between turns. Compound speech overlaps unless `--role` casts the label to one subject.
- Every speaking subject needs one approved registration for each selected provider/model/profile. A later run may use any subset of those targets.
- `--mode auto` uses native multi-speaker synthesis when the provider and scene allow it, otherwise segmented per-turn synthesis. `native` fails when native synthesis is not possible. `segmented` always synthesizes each turn independently. ElevenLabs `eleven_v3` and Hume `octave-2` can use native synthesis. Overlaps and local voice effects (radio, intercom, telephone, computer) require segmented rendering.
- `--price` reports remaining cost only. Completed audio that can be assembled locally is $0. A slot sent to a provider with no recoverable audio is not purchased again unless you rerun with `--allow-ambiguous-redispatch`.
- Authored `**SFX:**`, `**VOCAL SFX:**`, `**AMBIENCE:**`, `[[SFX: ...]]`, and `[[VOCAL SFX: ...]]` directives require `--sfx-provider` unless a previous run already recorded that target. Directives are required unless prefixed with `OPTIONAL`. Optional `{duration: 2.5s, gain: -3dB, pan: -0.4}` envelopes set duration and mix.
- Scenes with no spoken lines complete locally with no dialogue audio.
- Final dialogue is 48 kHz stereo 24-bit PCM WAV at `audio/final/<target-key>.wav`. A soundscape mix writes `audio/final/<target-key>.soundscape.wav`.
- `--slideshow` verifies reviewed panels and local video encoding before any provider call, then runs [generate-slideshow](./05-generate-slideshow.md) once audio completes. `--price` and `--max-generation-slots` skip that render.
- [`resume <run-directory> --price` and `resume <run-directory>`](../../00-setup-and-utilities/resume.md#comic-recovery) restore the original targets and settings, reuse completed audio, and finish a requested slideshow. Pass `--allow-ambiguous-redispatch` again if the recovered run still needs it. A `--max-generation-slots` checkpoint is not restored; resume finishes remaining slots.

Next: [generate-slideshow](./05-generate-slideshow.md).
