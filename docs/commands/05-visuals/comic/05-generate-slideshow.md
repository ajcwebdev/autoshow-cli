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

Prerequisites: all four canonical panel PNGs with matching even dimensions, one complete selected dialogue/soundscape run from [generate-audio](./04-generate-audio.md), and FFmpeg with H.264 encoding support. A loose WAV is insufficient. All commands below are local; `--price` checks readiness, including FFmpeg, and reports the $0 render cost.

```bash
bun --no-env-file autoshow comic generate-slideshow "$SCRIPT" --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-slideshow "$SCRIPT" --audio-target elevenlabs=eleven_v3 --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-slideshow "$SCRIPT" --audio-target elevenlabs=eleven_v3 --untimed-panel-ms 2500 --fps 24 --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-slideshow "$SCRIPT" --audio-target elevenlabs=eleven_v3 --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

The four authored panels each contain speech, so `--untimed-panel-ms` affects only a deliberately authored silent-panel variant. Changing options such as `--fps` rerenders locally and replaces the published presentation files; copy those files first if you need the earlier version.

### Behavior

- The sole complete selected soundscape run is used first; if none exists, the sole complete selected dialogue run is used. Multiple soundscape runs, or multiple dialogue runs without a soundscape, require `--audio-target provider=model`. An explicit target selects its matching soundscape before its matching dialogue run.
- Every reviewed panel must exist as `panels/panel-NN.png` in this run, or in the run directory beside it named with the script slug. Every panel must share the same even width and height.
- An inline sound effect plays with its dialogue panel. A block effect plays with the nearest preceding action or panel note. Missing or ambiguous placement fails.
- Dialogue and effects inside one panel keep their relative timing and may overlap. Across panels, audio plays in reviewed order. A panel with neither dialogue nor a discrete effect holds for `--untimed-panel-ms`. Ambience loops for the whole presentation; without it, unfilled intervals remain silent.
- Rendering is local: hard-cut stills, H.264 video, AAC audio, and no motion, transitions, or rescaling. Success writes `presentation/presentation.json`, `presentation/final/slideshow.wav`, and `presentation/final/slideshow.mp4`. The same inputs leave that presentation unchanged.
- [`resume <run-directory>`](../../00-setup-and-utilities/resume.md#comic-recovery) finishes an interrupted render. [`resume <run-directory> --price`](../../00-setup-and-utilities/resume.md#comic-recovery) inspects that render without writes.
