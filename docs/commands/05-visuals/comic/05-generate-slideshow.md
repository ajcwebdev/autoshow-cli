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

```bash
bun autoshow comic generate-slideshow 01-01
bun autoshow comic generate-slideshow 01-01 --audio-target elevenlabs=eleven_v3
bun autoshow comic generate-slideshow 01-01 --untimed-panel-ms 2500 --fps 24
bun autoshow comic generate-slideshow 01-01 --price
```

### Behavior

- One complete soundscape run is used when it is the only one. Otherwise the sole complete dialogue run is used. Several eligible runs require `--audio-target provider=model`, which selects a matching soundscape run before a matching dialogue run. A raw audio file cannot synchronize panels.
- Every reviewed panel must exist as `panels/panel-NN.png` in this run, or in the run directory beside it named with the script slug. Every panel must share the same even width and height.
- An inline sound effect plays with its dialogue panel. A block effect plays with the nearest preceding action or panel note. Missing or ambiguous placement fails.
- Dialogue and effects inside one panel keep their relative timing and may overlap. Across panels, audio plays in reviewed order. A panel with neither dialogue nor a discrete effect holds for `--untimed-panel-ms`. Ambience loops for the whole presentation; with none, the track is silence.
- Rendering is local: hard-cut stills, H.264 video, AAC audio, and no motion, transitions, or rescaling. Success writes `presentation/presentation.json`, `presentation/final/slideshow.wav`, and `presentation/final/slideshow.mp4`. The same inputs leave that presentation unchanged.
- [`resume <run-directory>`](../../00-setup-and-utilities/resume.md#comic-recovery) finishes an interrupted render. [`resume <run-directory> --price`](../../00-setup-and-utilities/resume.md#comic-recovery) inspects that render without writes.
