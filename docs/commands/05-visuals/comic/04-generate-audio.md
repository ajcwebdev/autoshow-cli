# comic generate-audio

`generate-audio` renders an existing scene run from approved voice registrations. Register and approve voices with [`voice`](../../04-audio/voice/00-voice-overview.md) before this command.

Provider models and delivery markup are in [TTS](../../04-audio/tts/overview.md). See the [`comic` overview](./00-comic-overview.md) for catalogs, runtime paths, and the full walkthrough.

## Outline

- [generate-audio](#generate-audio)
  - [Options](#options)
  - [Examples](#examples)
  - [Behavior](#behavior)

## generate-audio

### Options

| Flag                                   | Description                                                                                                                         | Default         |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `--provider <provider[=model]>`        | Select a TTS provider/model; repeatable                                                                                             | cheapest hosted |
| `--sfx-provider <provider=model>`      | Sound-effect model: `elevenlabs=eleven_text_to_sound_v2`, `replicate=sepal/audiogen@<version>`, or `stability=stable-audio-3`       | none            |
| `--sfx-license-use <classification>`   | Intended use for license-restricted sound effects: `noncommercial`, `commercial`, or `unknown`. AudioGen requires `noncommercial`   | none            |
| `--step-concurrency sfx=<count>`       | Max parallel sound-effect requests                                                                                                  | `2`             |
| `--provider-concurrency <count>`       | Max hosted provider/model targets in parallel                                                                                       | `7`             |
| `--step-concurrency tts-chunk=<count>` | Max parallel hosted TTS requests per provider; `2` with `--all-providers`, `50` for a Grok-only selection                           | `30`            |
| `--concurrency-mode <ramp\|immediate>` | Start hosted requests at one and raise them to the cap (`ramp`), or start at the cap (`immediate`)                                  | `ramp`          |
| `--soundscape-timing-policy <policy>`  | `strict` uses authored inline cue offsets and fails when they are unavailable; `proportional` estimates each offset across its turn | `strict`        |
| `--all-providers`                      | Select every hosted TTS target                                                                                                      | `false`         |
| `--profile <key>`                      | Approved voice registration profile                                                                                                 | `default`       |
| `--mode <mode>`                        | `auto`, `native`, or `segmented`                                                                                                    | `auto`          |
| `--delivery-policy <policy>`           | `strict` rejects unsupported authored delivery; `best-effort` records it and continues                                              | `strict`        |
| `--pacing-profile <profile>`           | `none`, or `loose-comedy` to add a short gap between turns                                                                          | `none`          |
| `--max-generation-slots <count>`       | Synthesize at most this many outstanding requests, save a checkpoint, and exit without a final WAV                                  | none            |
| `--allow-ambiguous-redispatch`         | Retry dialogue already sent to a provider that has no recoverable audio; this may purchase it again                                 | `false`         |
| `--role <label=subject>`               | Map an uncatalogued or compound label to `role:key` or `voice:key`; repeatable                                                      | none            |
| `--slideshow`                          | Render the synchronized still-panel MP4 after audio completes                                                                       | `false`         |
| `--price`                              | Plan remaining work and cost without provider calls or writes                                                                       | `false`         |

### Examples

```bash
bun autoshow comic generate-audio 01-01 --provider elevenlabs=eleven_v3
bun autoshow comic generate-audio 01-01 --provider grok=grok-tts --mode segmented
bun autoshow comic generate-audio 01-01 --provider elevenlabs=eleven_v3 --sfx-provider elevenlabs=eleven_text_to_sound_v2
bun autoshow comic generate-audio 01-01 --sfx-provider replicate=sepal/audiogen@154b3e5141493cb1b8cec976d9aa90f2b691137e39ad906d2421b74c2a8c52b8 --sfx-license-use noncommercial
bun autoshow comic generate-audio 01-01 --provider elevenlabs --role "SHIP COMPUTER=role:computer"
bun autoshow comic generate-audio 01-01 --provider elevenlabs --slideshow
bun autoshow comic generate-audio 01-01 --all-providers --price
```

### Behavior

- `--output-dir` selects that directory. A populated directory must already be a scene run. A missing or empty directory starts a new scene run. `--price` requires an existing scene run and does not create a directory.
- Authored `beat`, `pause`/`moment`, and `long`/`heavy` cues become fixed silences. `--pacing-profile loose-comedy` adds a short gap between turns. Compound speech overlaps unless `--role` assigns the label to one subject.
- Every speaking subject needs one approved registration for each selected provider, model, and profile. A later run can select any subset of those targets.
- `--mode auto` uses native multi-speaker synthesis when the provider and scene allow it, and per-turn synthesis otherwise. `native` fails when native synthesis is unavailable. `segmented` synthesizes each turn on its own. ElevenLabs `eleven_v3` and Gemini TTS can synthesize natively. Overlaps, authored delivery, and voice effects such as radio, intercom, telephone, and computer use per-turn synthesis.
- `--price` reports the cost of work still to do. Completed audio that can be mixed on disk is $0. Dialogue already sent to a provider with no recoverable audio is purchased again only when you pass `--allow-ambiguous-redispatch`. That flag does not retry a blocked sound effect.
- `**SFX:**`, `**VOCAL SFX:**`, `**AMBIENCE:**`, `[[SFX: ...]]`, and `[[VOCAL SFX: ...]]` need `--sfx-provider`, unless a completed render of this scene already selected that sound-effect model. A directive is required unless it is prefixed with `OPTIONAL`. `{duration: 2.5s, gain: -3dB, pan: -0.4}` sets duration and mix. AudioGen and Stable Audio render action effects and ambience only. A required vocal reaction needs `elevenlabs=eleven_text_to_sound_v2`.
- A scene with no spoken lines writes no dialogue file. With no sound-effect directives, the command finishes without a provider call.
- Dialogue is 48 kHz stereo 24-bit PCM WAV at `audio/final/<target-key>.wav`. A mix that includes sound effects is `audio/final/<target-key>.soundscape.wav`.
- `--slideshow` checks reviewed panels and local video encoding before any provider call, then runs [generate-slideshow](./05-generate-slideshow.md) after audio completes. `--price` and `--max-generation-slots` skip the video.
- [`resume`](../../00-setup-and-utilities/resume.md#comic-recovery) continues the original request and reuses completed audio. Pass `--allow-ambiguous-redispatch` again when recovered dialogue still has no audio. A `--max-generation-slots` limit applies only to the run that set it.

Next: [generate-slideshow](./05-generate-slideshow.md).
