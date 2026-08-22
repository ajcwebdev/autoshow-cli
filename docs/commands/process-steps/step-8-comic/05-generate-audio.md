# comic generate-audio

`generate-audio` consumes an existing compatible scene run and approved current voice registrations. It never creates, clones, approves, or deletes voices during synthesis.

See the [`comic` overview](./00-comic-overview.md) for catalogs, runtime paths, and the full walkthrough. Provider models, voices, and delivery markup are in [TTS](../step-4-tts/text-to-speech-and-voice.md).

## Outline

- [generate-audio](#generate-audio)
  - [Options](#options)
  - [Examples](#examples)
  - [Behavior](#behavior)

## generate-audio

### Options

| Flag                                   | Description                                                                                                                                                                 | Default         |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `--provider <provider[=model]>`        | Select a TTS provider/model; repeatable                                                                                                                                     | cheapest hosted |
| `--sfx-provider <provider=model>`      | Select the dedicated authored sound-effect target; accepts `elevenlabs=eleven_text_to_sound_v2`, `replicate=sepal/audiogen@<pinned-version>`, or `stability=stable-audio-3` | none            |
| `--sfx-license-use <classification>`   | Declare intended use for license-restricted SFX targets: `noncommercial`, `commercial`, or `unknown`; required for AudioGen and never inferred from model selection         | none            |
| `--sfx-concurrency <count>`            | Bound parallel sound-effect requests independently from dialogue generation                                                                                                 | `2`             |
| `--provider-concurrency <count>`       | Max hosted provider/model targets rendering in parallel; does not limit chunks inside one target                                                                            | `7`             |
| `--tts-chunk-concurrency <count>`      | Hosted TTS chunk starts allowed in parallel per provider across the run                                                                                                     | `30`            |
| `--concurrency-mode <ramp\|immediate>` | Approach hosted dialogue and sound-effect caps from one request per provider/account lane (`ramp`) or start at the configured caps (`immediate`)                            | `ramp`          |
| `--soundscape-timing-policy <policy>`  | Resolve inline text offsets with exact turn timing (`strict`) or interpolated timing across turn ranges (`proportional`)                                                    | `strict`        |
| `--all-providers`                      | Select every hosted TTS target                                                                                                                                              | `false`         |
| `--profile <key>`                      | Select the approved registration profile for every subject/target                                                                                                           | `default`       |
| `--mode <mode>`                        | `auto`, `native`, or `segmented`                                                                                                                                            | `auto`          |
| `--delivery-policy <policy>`           | `strict` rejects unsupported authored delivery; `best-effort` records unsupported intent and continues                                                                      | `strict`        |
| `--pacing-profile <profile>`           | `none` or deterministic `loose-comedy` authored-pause/interturn pacing                                                                                                      | `none`          |
| `--max-generation-slots <count>`       | Generate at most this many remaining segmented slots, write a checkpoint, and exit without a final WAV                                                                      | none            |
| `--allow-ambiguous-redispatch`         | Authorize resuming a slot that was sent to a provider but has no recoverable audio; may repurchase it                                                                       | `false`         |
| `--role <label=subject>`               | Resolve an uncatalogued or compound label to `role:key` or `voice:key`; repeatable                                                                                          | none            |
| `--slideshow`                          | Render the synchronized still-panel MP4 automatically once audio completes                                                                                                 | `false`         |
| `--price`                              | Plan remaining work and cost without provider calls or writes                                                                                                               | `false`         |

### Examples

```bash
bun autoshow comic generate-audio 01-01 --provider gemini=gemini-3.1-flash-tts-preview --profile default
bun autoshow comic generate-audio 01-01 --provider mistral=voxtral-mini-tts-2603 --mode segmented
bun autoshow comic generate-audio 01-01 --provider elevenlabs=eleven_v3 --sfx-provider elevenlabs=eleven_text_to_sound_v2
bun autoshow comic generate-audio 07-04 --provider hume=octave-1 --provider hume=octave-2 --provider elevenlabs=eleven_v3 --profile ep07-comparison --mode segmented --delivery-policy best-effort --pacing-profile loose-comedy
bun autoshow comic generate-audio 01-01 --provider gemini --role "SHIP COMPUTER=role:computer"
bun autoshow comic generate-audio 01-01 --all-providers --price
```

### Behavior

- With `--output-dir`, the command uses that exact directory: a populated directory must already be a compatible scene run, and a missing or empty directory is initialized as a fresh scene workspace. Without it, the command scans matching timestamped scene directories newest-first and uses a compatible match.
- Every speakable segment becomes a dialogue turn, and authored timing cues stay on the turn. `--pacing-profile loose-comedy` maps `beat`, `pause`/`moment`, and `long`/`heavy` cues to fixed silences and adds a short gap between turns. Compound speech overlaps unless `--role` casts the label to one subject.
- Every speaking subject needs one approved registration for each selected provider/model/profile. After that snapshot exists, a later run may use any subset of those targets.
- `--mode auto` uses native multi-speaker synthesis when the provider and scene allow it, otherwise segmented per-turn synthesis. `native` fails when native synthesis is not possible. `segmented` always synthesizes each turn independently. Gemini native dialogue supports exactly two distinct speakers. Hume `octave-1` treats authored delivery as prompt descriptions; Hume `octave-2` uses native utterances with per-turn speed and silence. `--delivery-policy best-effort` records unsupported direction and continues. Overlaps and local voice-effect filters (radio/intercom/telephone/computer) force segmented rendering.
- `--max-generation-slots` limits how many remaining segmented slots to generate, writes a checkpoint, and leaves the run resumable without publishing `audio/final/`.
- `--price` is read-only. It prices only remaining work and reports zero spend when completed audio can be assembled locally. A request that was sent to a provider but has no recoverable audio is never purchased again inside the same command; rerun with `--allow-ambiguous-redispatch` to resume, which may repurchase that slot. Failed runs can be rerun, and completed segments are reused.
- Authored `**SFX:**`, `**VOCAL SFX:**`, `**AMBIENCE:**`, `[[SFX: ...]]`, and `[[VOCAL SFX: ...]]` directives populate the soundscape plan and require `--sfx-provider` unless a previous run already recorded that target. Directives are required unless prefixed with `OPTIONAL`; optional `{duration: 2.5s, gain: -3dB, pan: -0.4}` envelopes set synthesis duration and mix. Inline text offsets default to `--soundscape-timing-policy strict`; `proportional` maps offsets across turn ranges.
- Scenes with zero speakable turns complete locally with an empty dialogue plan.
- Final audio is 48 kHz stereo 24-bit PCM WAV at `audio/final/<target-key>.wav`, with `audio/<target-key>/render.json` and `audio/<target-key>/timeline.json`.
- `--slideshow` validates reviewed panels, dialogue ownership, and FFmpeg H.264 availability before any provider dispatch, then runs [generate-slideshow](./06-generate-slideshow.md) once audio completes. A `--price` plan or a `--max-generation-slots` checkpoint returns before that render.

Next: [generate-slideshow](./06-generate-slideshow.md).
