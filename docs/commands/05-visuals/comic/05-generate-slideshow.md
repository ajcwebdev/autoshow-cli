# comic generate-slideshow

`generate-slideshow` synchronizes canonical panel PNGs with one complete selected dialogue or soundscape run and renders a still-panel MP4 locally. It does not call an image, video, TTS, or sound-effect provider.

See the [`comic` overview](./00-comic-overview.md) for catalogs, runtime paths, and the full walkthrough.

## Outline

- [generate-slideshow](#generate-slideshow)
  - [Options](#options)
  - [Examples](#examples)
  - [Behavior](#behavior)

## generate-slideshow

### Options

| Flag                              | Description                                                      | Default  |
| --------------------------------- | ---------------------------------------------------------------- | -------- |
| `--audio-target <provider=model>` | Complete audio run to synchronize, written as `provider=model`   | inferred |
| `--untimed-panel-ms <n>`          | Hold duration for a panel without dialogue or a discrete effect  | `2000`   |
| `--fps <n>`                       | Constant output frame rate from 1 through 120                    | `30`     |
| `--price`                         | Report the $0 local render cost without provider calls or writes | `false`  |

### Examples

Use the variables and fresh workspace from the [Harborlight setup](./00-comic-overview.md#setup). These examples share the same four-panel scene.

Prerequisite: all four canonical panel PNGs with matching even dimensions and one complete selected dialogue/soundscape run from [generate-audio](./04-generate-audio.md). A loose WAV is insufficient. The default command works only with one eligible audio run; select the exact target if there are several. All commands below are local; price reports readiness and the $0 render cost.

```bash
bun --no-env-file autoshow comic generate-slideshow "$SCRIPT" --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-slideshow "$SCRIPT" --audio-target elevenlabs=eleven_v3 --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-slideshow "$SCRIPT" --audio-target elevenlabs=eleven_v3 --untimed-panel-ms 2500 --fps 24 --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-slideshow "$SCRIPT" --audio-target elevenlabs=eleven_v3 --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

The four authored panels each contain speech, so `--untimed-panel-ms` affects only a deliberately authored silent-panel variant. Changing `--fps` changes local encoding and can require a fresh presentation. Preserve previous artifacts. Mocked synthetic-tone tests establish timing/decoding only; listen to approved real dialogue before publication.

### Behavior

- One complete soundscape run is used when it is the only one. Otherwise the sole complete dialogue run is used. Several eligible runs require `--audio-target provider=model`, which selects a matching soundscape run before a matching dialogue run. A raw audio file cannot synchronize panels.
- Every reviewed panel must exist as `panels/panel-NN.png` in this run, or in the run directory beside it named with the script slug. Every panel must share the same even width and height.
- An inline sound effect plays with its dialogue panel. A block effect plays with the nearest preceding action or panel note. Missing or ambiguous placement fails.
- Dialogue and effects inside one panel keep their relative timing and may overlap. Across panels, audio plays in reviewed order. A panel with neither dialogue nor a discrete effect holds for `--untimed-panel-ms`. Ambience loops for the whole presentation; with none, the track is silence.
- Rendering is local: hard-cut stills, H.264 video, AAC audio, and no motion, transitions, or rescaling. Success writes `presentation/presentation.json`, `presentation/final/slideshow.wav`, and `presentation/final/slideshow.mp4`. The same inputs leave that presentation unchanged.
- [`resume <run-directory>`](../../00-setup-and-utilities/resume.md#comic-recovery) finishes an interrupted render. [`resume <run-directory> --price`](../../00-setup-and-utilities/resume.md#comic-recovery) inspects that render without writes.
