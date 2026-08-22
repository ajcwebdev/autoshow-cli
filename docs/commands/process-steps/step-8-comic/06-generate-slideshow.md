# comic generate-slideshow

`generate-slideshow` synchronizes canonical panel PNGs with one complete selected dialogue or soundscape run and renders the result locally. It does not resume audio generation or call an image, video, TTS, or sound-effect provider.

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
- Every reviewed panel must exist as `panels/panel-NN.png` in the current run or deterministic exact-script sibling. Sibling visuals are verified and copied into an immutable `presentation/inputs/` bundle inside the audio run. Panels must share identical even dimensions.
- Dialogue ownership uses exact source-segment ID, speaker, and speech text evidence. Exact parenthetical cues classified as delivery/timing may be elided when preserved in cue evidence.
- Inline sound effects follow their dialogue panel; block effects follow the panel owning the nearest preceding authored action or panel note. Missing or ambiguous ownership fails.
- Dialogue and effects within one panel preserve relative timing and overlap. Audio across panels is serialized in reviewed order. Untimed panels receive the configured hold duration (`--untimed-panel-ms`).
- Ambience loops continuously; runs without an ambience bed record digital silence as the continuous base. Presentation audio is derived from retained ranges and does not mutate source audio runs.
- FFmpeg renders same-size hard-cut stills as H.264/yuv420p video with AAC audio and fast-start metadata without motion or resize filters.
- On success, presentation compact writes `presentation/presentation.json` and hardlinks `presentation/final/slideshow.wav` and `presentation/final/slideshow.mp4`, cleaning up temporary working files.
- `comic generate-audio --slideshow` validates reviewed panels, dialogue ownership, and FFmpeg H.264 encoder availability before TTS dispatch.
- `--price` reports `$0.00` without writes.
