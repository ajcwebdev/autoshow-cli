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

| Flag                              | Description                                                                           | Default  |
| --------------------------------- | ------------------------------------------------------------------------------------- | -------- |
| `--audio-target <provider=model>` | Select an exact complete canonical audio target when automatic selection is ambiguous | inferred |
| `--untimed-panel-ms <n>`          | Hold duration for a panel with no dialogue or discrete effect                         | `2000`   |
| `--fps <n>`                       | Constant output frame rate from 1 through 120                                         | `30`     |
| `--price`                         | Report the local render cost and exit without writes                                  | `false`  |

### Examples

```bash
bun autoshow comic generate-slideshow 01-01
bun autoshow comic generate-slideshow 01-01 --audio-target elevenlabs=eleven_v3
bun autoshow comic generate-slideshow 01-01 --untimed-panel-ms 2500 --fps 24
bun autoshow comic generate-slideshow 01-01 --price
```

### Behavior

- Automatic selection uses the sole complete soundscape run when one exists, and otherwise the sole complete dialogue run. Multiple eligible runs require `--audio-target provider=model`, which selects a matching soundscape run before a matching dialogue run.
- Every reviewed panel must exist as `panels/panel-NN.png` in the current run or a matching run of the same script. Panels must share identical even dimensions.
- Inline sound effects follow their dialogue panel; block effects follow the panel owning the nearest preceding authored action or panel note. Missing or ambiguous ownership fails.
- Dialogue and effects within one panel keep their relative timing and overlap. Audio across panels plays in reviewed order. Untimed panels hold for `--untimed-panel-ms`.
- Ambience loops for the full presentation; runs without an ambience bed use silence. Source audio files are left unchanged.
- Rendering is local FFmpeg hard-cut stills: H.264 video with AAC audio, and no motion, transitions, or rescaling.
- On success, the command writes `presentation/presentation.json`, `presentation/final/slideshow.wav`, and `presentation/final/slideshow.mp4`.
- `--price` reports `$0.00` without writes.
