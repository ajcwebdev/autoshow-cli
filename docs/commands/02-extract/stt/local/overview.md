# Local STT

Whisperfile is the default when no STT provider/default is selected:

```bash
bun autoshow extract input/examples/audio/1-audio.mp3 --provider whisperfile=tiny
```

Models: `tiny` (default), `tiny.en`, `small`, `small.en`, `medium`, `medium.en`, `large-v2`, `large-v3`. Setup installs only `tiny`; selecting others may download them, so install models first for offline work.

Whisperfile supplies word timing and optional native SRT/VTT/LRC where the executable supports it. It has no diarization or speaker-count control. See [local timing and speaker workflows](../workflows/timing/overview.md) for alignment and reviewed labels.
