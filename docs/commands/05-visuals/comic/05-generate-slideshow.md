# comic generate-slideshow

Locally synchronize canonical panel PNGs with one complete dialogue/soundscape run. It uses no provider and accepts no loose untimed WAV.

## Options

- `--audio-target provider=model`: select a complete target when automatic selection is ambiguous. Prefer the sole complete soundscape; otherwise use the sole complete dialogue run. An explicit target prefers its soundscape.
- `--untimed-panel-ms`: positive safe integer hold for a panel without dialogue/discrete effects; default 2000.
- `--fps`: integer 1–120, default 30.
- `--price`: validate readiness, including FFmpeg, and report zero provider cost without writes.

## Examples

Use [setup](./00-comic-overview.md#setup) variables, complete audio from [generate-audio](./04-generate-audio.md), all four canonical panels, and FFmpeg with a supported H.264 encoder:

```bash
bun --no-env-file autoshow comic generate-slideshow "$SCRIPT" --audio-target elevenlabs=eleven_v3 --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-slideshow "$SCRIPT" --audio-target elevenlabs=eleven_v3 --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

## Behavior

Every consecutive `panels/panel-NN.png` must have identical even dimensions. Fallback discovery checks the sibling run named with the script slug, requiring exactly compatible reviewed visuals, source ownership, and dialogue reconciliation; arbitrary sibling directories or matching filenames are insufficient.

Within-panel dialogue/effects retain timing and overlap; cross-panel events follow reviewed order. Inline effects belong to their spoken segment's panel, block effects to the nearest preceding action/panel note. Missing/ambiguous ownership fails. Untimed panels hold; ambience loops through the presentation, otherwise unused intervals stay silent.

Rendering uses hard cuts, H.264/AAC, and original panel dimensions without motion, transitions, crop, or rescaling. Outputs are `presentation/presentation.json` and `presentation/final/slideshow.{wav,mp4}`. Identical completed inputs reuse the presentation; changed options replace derived files, preserving source audio. Save earlier derived versions separately if needed. [`resume`](../../00-setup-and-utilities/resume.md#comic-recovery) finishes a recorded interrupted presentation.
